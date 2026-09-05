import { browser } from '$app/environment';
import { ApiError } from '$lib/api/client';
import {
	onboarding as api,
	type EducationPayload,
	type TerritoryPayload
} from '$lib/api/onboarding';

/**
 * Анкеты онбординга с локальным буфером.
 *
 * Пишем в localStorage сразу, отправка — попытка. Сетевой сбой или 5xx
 * оставляют `pending`, и анкета уедет при следующем заходе. 404 больше не
 * ожидаем: ручки образования и территории уже на бэке.
 */

export type SyncState = 'pending' | 'synced';

export type EducationDraft = EducationPayload & {
	savedAt: string;
	sync: SyncState;
	/** Когда последний раз пытались отправить — см. `RETRY_AFTER_MS`. */
	triedAt?: string;
};

export type TerritoryDraft = TerritoryPayload & {
	savedAt: string;
	sync: SyncState;
	triedAt?: string;
};

/**
 * Пауза между фоновыми попытками при сетевых сбоях.
 * Успешный ответ снимает `pending` сразу; час нужен только чтобы не долбить
 * упавший API на каждой навигации.
 */
const RETRY_AFTER_MS = 60 * 60 * 1000;

type Record_ = {
	education?: EducationDraft;
	territory?: TerritoryDraft;
	/** Онбординг пройден или осознанно пропущен — второй раз не показываем. */
	doneAt?: string;
};

const KEY = (userId: string) => `kosmo.onboarding.${userId}`;

function read(userId: string): Record_ {
	if (!browser) return {};
	try {
		return JSON.parse(localStorage.getItem(KEY(userId)) ?? '{}') as Record_;
	} catch {
		// Битый JSON или запрещённое хранилище: начинаем с чистого листа, но не
		// падаем — онбординг не та вещь, ради которой стоит ронять приложение.
		return {};
	}
}

function write(userId: string, value: Record_) {
	if (!browser) return;
	try {
		localStorage.setItem(KEY(userId), JSON.stringify(value));
	} catch {
		/* приватный режим — анкета живёт только в памяти вкладки */
	}
}

class Onboarding {
	#userId = $state<string | null>(null);
	record = $state<Record_>({});

	/** Вызывается, когда профиль известен. Идемпотентно. */
	load(userId: string) {
		if (this.#userId === userId) return;
		this.#userId = userId;
		this.record = read(userId);
		// Незакрытые долги отправляем молча: человек уже всё заполнил, дёргать
		// его повторно не за что.
		void this.retrySync();
	}

	reset() {
		this.#userId = null;
		this.record = {};
	}

	get education(): EducationDraft | null {
		return this.record.education ?? null;
	}

	get territory(): TerritoryDraft | null {
		return this.record.territory ?? null;
	}

	get done(): boolean {
		return Boolean(this.record.doneAt);
	}

	/** Есть ли что-то, что не доехало до сервера — показываем это честно. */
	get pendingSync(): boolean {
		return this.record.education?.sync === 'pending' || this.record.territory?.sync === 'pending';
	}

	async saveEducation(payload: EducationPayload): Promise<void> {
		const draft: EducationDraft = {
			...payload,
			savedAt: new Date().toISOString(),
			sync: 'pending'
		};
		this.#patch({ education: draft });
		await this.#push('education', true);
	}

	async saveTerritory(payload: TerritoryPayload): Promise<void> {
		const draft: TerritoryDraft = {
			...payload,
			savedAt: new Date().toISOString(),
			sync: 'pending'
		};
		this.#patch({ territory: draft });
		await this.#push('territory', true);
	}

	/** Онбординг закончен — пройден полностью или пропущен человеком. */
	finish() {
		this.#patch({ doneAt: new Date().toISOString() });
	}

	async retrySync(): Promise<void> {
		if (this.record.education?.sync === 'pending') await this.#push('education');
		if (this.record.territory?.sync === 'pending') await this.#push('territory');
	}

	/**
	 * Отправка одной анкеты. Любая ошибка оставляет её в `pending`: разбирать,
	 * «настоящий» это отказ или отсутствующая ручка, здесь незачем — данные
	 * лежат локально и ничего не теряется в обоих случаях.
	 *
	 * `force` — попытка по действию человека (он только что нажал «сохранить»);
	 * фоновые попытки уважают паузу.
	 */
	async #push(what: 'education' | 'territory', force = false): Promise<void> {
		const draft = this.record[what];
		if (!draft || draft.sync === 'synced') return;
		if (!force && draft.triedAt && Date.now() - Date.parse(draft.triedAt) < RETRY_AFTER_MS) {
			return;
		}

		const tried = { ...draft, triedAt: new Date().toISOString() };
		this.#patch({ [what]: tried } as Partial<Record_>);

		try {
			if (what === 'education') {
				const { savedAt: _s, sync: _y, triedAt: _t, ...payload } = this.record.education!;
				await api.education(payload);
			} else {
				const { savedAt: _s, sync: _y, triedAt: _t, ...payload } = this.record.territory!;
				await api.territory(payload);
			}
			this.#patch({ [what]: { ...tried, sync: 'synced' } } as Partial<Record_>);
		} catch (error) {
			// 404 — ручки ещё нет; всё остальное тоже не повод что-то терять:
			// анкета остаётся в `pending` и уедет следующей попыткой.
			if (error instanceof ApiError && error.isAuth) return;
		}
	}

	#patch(patch: Partial<Record_>) {
		this.record = { ...this.record, ...patch };
		if (this.#userId) write(this.#userId, this.record);
	}
}

export const onboardingState = new Onboarding();
