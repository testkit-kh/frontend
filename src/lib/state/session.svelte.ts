import { browser } from '$app/environment';
import { ApiError, loadToken, setToken, setUnauthorizedHandler } from '$lib/api/client';
import {
	auth,
	isStaffProfile,
	isVolunteerProfile,
	type Profile,
	type Schemas
} from '$lib/api/endpoints';
import type { Role } from '$lib/types';

/**
 * Сессия пользователя.
 *
 * Раньше здесь был мок: `crypto.randomUUID()` и `onboarded: true` без всякого
 * сервера. Теперь профиль приходит из `/auth/me`, а вместе с ним — состояние
 * обучения и согласия, от которых зависит доступ к карте.
 *
 * Профиль хранится целиком, а не разбирается на флаги: правила доступа живут
 * на бэкенде и меняются там, а фронт лишь показывает то, что ему ответили.
 * Дублировать логику «пускать или нет» на клиенте — верный способ получить два
 * расходящихся набора правил.
 */
class Session {
	profile = $state<Profile | null>(null);
	/** Пока false, гварды ничего не решают: мы ещё не знаем, кто перед нами. */
	ready = $state(false);
	/** Идёт вход или регистрация — форма блокирует повторную отправку. */
	busy = $state(false);
	error = $state<string | null>(null);

	get user() {
		return this.profile;
	}

	get role(): Role | null {
		return (this.profile?.role as Role | undefined) ?? null;
	}

	get isStaff(): boolean {
		return this.profile !== null && isStaffProfile(this.profile);
	}

	get name(): string {
		return this.profile?.full_name ?? '';
	}

	/** Организация сотрудника — по ней фильтруется карта и предложка. */
	get organizationId(): string | null {
		if (this.profile && isStaffProfile(this.profile)) return this.profile.organization.id;
		return null;
	}

	/** Карта открыта только после проверенного сертификата. */
	get hasMapAccess(): boolean {
		if (!this.profile) return false;
		if (isStaffProfile(this.profile)) return true;
		return this.profile.is_trained === true;
	}

	/** Нужен документ от родителя: до 18 лет и согласие ещё не подтверждено. */
	get needsConsent(): boolean {
		return (
			this.profile !== null &&
			isVolunteerProfile(this.profile) &&
			this.profile.consent_status === 'awaiting'
		);
	}

	get certificateStatus(): Schemas['CertificateStatus'] {
		if (this.profile && isVolunteerProfile(this.profile)) {
			return this.profile.certificate_status ?? 'none';
		}
		return 'none';
	}

	constructor() {
		if (!browser) return;
		// Протухший токен разлогинивает молча: показывать «ошибка 401» человеку,
		// который просто давно не заходил, незачем.
		setUnauthorizedHandler(() => this.#clear());
	}

	/** Восстановить сессию по сохранённому токену. Вызывается один раз в layout. */
	async restore(): Promise<void> {
		if (this.ready) return;
		if (!loadToken()) {
			this.ready = true;
			return;
		}
		try {
			this.profile = await auth.me();
		} catch {
			// Токен не подошёл — начинаем с чистого листа, без сообщений.
			this.#clear();
		} finally {
			this.ready = true;
		}
	}

	/** Перечитать профиль: статусы курса и согласия меняются на бэкенде. */
	async refresh(): Promise<void> {
		if (!loadToken()) return;
		try {
			this.profile = await auth.me();
		} catch (error) {
			if (error instanceof ApiError && error.isAuth) this.#clear();
		}
	}

	async login(email: string, password: string): Promise<boolean> {
		return this.#attempt(async () => {
			const { access_token } = await auth.login(email, password);
			setToken(access_token);
			this.profile = await auth.me();
		});
	}

	async registerVolunteer(body: Schemas['VolunteerRegisterRequest']): Promise<boolean> {
		return this.#attempt(async () => {
			await auth.registerVolunteer(body);
			// Регистрация не выдаёт токен — входим тем же паролем сразу, чтобы
			// человек не заполнял форму входа следом за формой регистрации.
			const { access_token } = await auth.login(body.email, body.password);
			setToken(access_token);
			this.profile = await auth.me();
		});
	}

	async registerOrganization(body: Schemas['OrganizationRegisterRequest']): Promise<boolean> {
		return this.#attempt(async () => {
			await auth.registerOrganization(body);
			const { access_token } = await auth.login(body.email, body.password);
			setToken(access_token);
			this.profile = await auth.me();
		});
	}

	logout() {
		this.#clear();
	}

	async #attempt(action: () => Promise<void>): Promise<boolean> {
		this.busy = true;
		this.error = null;
		try {
			await action();
			return true;
		} catch (error) {
			this.error =
				error instanceof ApiError ? error.message : 'Что-то пошло не так, попробуйте ещё раз';
			return false;
		} finally {
			this.busy = false;
		}
	}

	#clear() {
		this.profile = null;
		setToken(null);
	}
}

export const session = new Session();
