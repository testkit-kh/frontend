import { browser } from '$app/environment';
import { ApiError, request } from '$lib/api/client';
import { uploads } from '$lib/api/uploads';
import { reports } from '$lib/state/reports.svelte';
import {
	deleteQueued,
	listQueued,
	putQueued,
	type QueueEntry,
	type QueuePayload
} from '$lib/offline/db';

/**
 * Очередь точек, которые ещё не долетели до бэкенда.
 *
 * Контракт синхронизации — `P0-1`/`P0-2` из `BACKEND_TASKS.md` (пишет другой
 * человек, ручки может ещё не быть): `client_id`/`created_at_client` в
 * `POST /hypotheses` для идемпотентности повторной отправки, presigned-адрес
 * из `POST /uploads/presign` для фото (грузим напрямую в S3, не через себя).
 * Пока бэк это не выкатил, сетевая ошибка/404 просто держит запись в очереди
 * вместо падения — синхронизация доедет сама, когда ручки появятся.
 *
 * Успешная отправка зеркалится в мок-стор `reports`: список/карточки на
 * `/map` всё ещё читают его, а не реальный бэк (это отдельная миграция), и
 * без зеркала только что отправленная точка была бы не видна самому автору.
 */
class OfflineQueue {
	items = $state<QueueEntry[]>([]);
	online = $state(browser ? navigator.onLine : true);
	syncing = $state(false);

	get pending() {
		return this.items.filter((e) => e.status === 'queued' || e.status === 'syncing');
	}

	get failed() {
		return this.items.filter((e) => e.status === 'failed');
	}

	async init() {
		if (!browser) return;
		this.items = await listQueued();

		window.addEventListener('online', () => {
			this.online = true;
			this.syncAll();
		});
		window.addEventListener('offline', () => {
			this.online = false;
		});

		// Ретрай при открытии приложения — второй фолбэк из плана, на случай
		// если событие online не пришло (свернутая вкладка, перезапуск ОС).
		if (this.online) this.syncAll();
	}

	async enqueue(payload: QueuePayload, photo?: File | null): Promise<void> {
		const entry: QueueEntry = {
			clientId: crypto.randomUUID(),
			createdAtClient: new Date().toISOString(),
			status: 'queued',
			attempts: 0,
			payload,
			photo: photo ? { blob: photo, contentType: photo.type || 'application/octet-stream' } : null
		};
		await putQueued(entry);
		this.items = [entry, ...this.items];
		void this.syncOne(entry.clientId);
	}

	async syncOne(clientId: string): Promise<void> {
		const entry = this.items.find((e) => e.clientId === clientId);
		if (!entry || entry.status === 'sent' || entry.status === 'syncing') return;

		entry.status = 'syncing';
		this.#touch(entry);

		try {
			let photoUrl: string | undefined;
			if (entry.photo) {
				photoUrl = await this.#uploadPhoto(entry.photo.blob, entry.photo.contentType);
			}

			// Прямой request(), а не typed-клиент из endpoints.ts: `client_id`/
			// `created_at_client` — контракт P0-1, ещё не попал в сгенерированную
			// схему (появится там сам после `pnpm run api:types`, когда ручка
			// готова на бэке).
			await request('/api/v1/hypotheses', {
				body: {
					lat: entry.payload.lat,
					lon: entry.payload.lon,
					description: entry.payload.description,
					photo_url: photoUrl,
					client_id: entry.clientId,
					created_at_client: entry.createdAtClient
				}
			});

			reports.add({
				territoryId: entry.payload.territoryId,
				kind: 'trash',
				source: 'field',
				title: entry.payload.title,
				note: entry.payload.description,
				author: entry.payload.authorName,
				geometry: { type: 'Point', coordinates: [entry.payload.lon, entry.payload.lat] }
			});

			entry.status = 'sent';
			await deleteQueued(entry.clientId);
			this.items = this.items.filter((e) => e.clientId !== clientId);
		} catch (cause) {
			entry.attempts += 1;
			if (cause instanceof ApiError && cause.status !== 0 && cause.status !== 503) {
				// Настоящий отказ (валидация, авторизация) — авто-ретрай тут
				// бессмысленен, дальше решает человек.
				entry.status = 'failed';
				entry.lastError = cause.message;
			} else {
				// Нет связи или сервис временно недоступен — остаётся в очереди.
				entry.status = 'queued';
				entry.lastError = cause instanceof Error ? cause.message : 'Нет связи с сервером';
			}
			this.#touch(entry);
		}
	}

	async syncAll(): Promise<void> {
		if (this.syncing) return;
		this.syncing = true;
		try {
			for (const entry of [...this.pending]) {
				await this.syncOne(entry.clientId);
			}
		} finally {
			this.syncing = false;
		}
	}

	async discard(clientId: string): Promise<void> {
		await deleteQueued(clientId);
		this.items = this.items.filter((e) => e.clientId !== clientId);
	}

	async #uploadPhoto(blob: Blob, contentType: string): Promise<string> {
		const presign = await uploads.presign({
			filename: `hypothesis-${Date.now()}.jpg`,
			content_type: contentType,
			purpose: 'hypothesis_photo'
		});

		const form = new FormData();
		for (const [key, value] of Object.entries(presign.fields ?? {})) {
			form.append(key, value as string);
		}
		form.append('file', blob);

		// Прямая загрузка в S3 по presigned URL — мимо нашего API и без Bearer:
		// так и задуман контракт P0-2, фото тяжёлые, гонять их через себя незачем.
		const response = await fetch(presign.upload_url, { method: 'POST', body: form });
		if (!response.ok) throw new ApiError(response.status, 'Не удалось загрузить фото');

		return presign.public_url;
	}

	#touch(entry: QueueEntry) {
		putQueued(entry).catch(() => {});
		this.items = this.items.map((e) => (e.clientId === entry.clientId ? entry : e));
	}
}

export const offlineQueue = new OfflineQueue();
