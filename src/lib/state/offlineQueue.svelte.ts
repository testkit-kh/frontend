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

const SYNC_TAG = 'cb-offline-queue';

/**
 * Очередь точек, которые ещё не долетели до бэкенда.
 *
 * Контракт синхронизации — `P0-1`/`P0-2` из `BACKEND_TASKS.md`: `client_id`/
 * `created_at_client` в `POST /hypotheses`, presigned из `POST /uploads/presign`.
 * Пока фото-ручка не готова, точка без фото уходит, с фото — ждёт в очереди.
 *
 * Триггеры синка: online, открытие приложения, visibilitychange, Background
 * Sync (если браузер умеет) + ручная кнопка на `/offline`.
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
			void this.syncAll();
		});
		window.addEventListener('offline', () => {
			this.online = false;
		});
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible' && this.online) void this.syncAll();
		});

		navigator.serviceWorker?.addEventListener('message', (event) => {
			if (event.data?.type === 'cb-sync') void this.syncAll();
		});

		if (this.online) void this.syncAll();
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
		void this.#requestBackgroundSync();
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
				try {
					photoUrl = await this.#uploadPhoto(entry.photo.blob, entry.photo.contentType);
				} catch (uploadError) {
					// MinIO на стенде часто не поднят: не блокируем точку из‑за фото —
					// уходит описание/координаты, фото дошлём когда хранилище появится
					// (повтор с тем же client_id идемпотентен, но без повторной
					// загрузки файла — для демо важнее живая точка на карте).
					const retryable =
						uploadError instanceof ApiError &&
						(uploadError.status === 0 || uploadError.status === 503 || uploadError.status === 404);
					if (!retryable) throw uploadError;
					entry.lastError = `Фото не загрузилось (${uploadError.message}) — точка ушла без него`;
				}
			}

			const created = await request<{ id: string }>('/api/v1/hypotheses', {
				body: {
					lat: entry.payload.lat,
					lon: entry.payload.lon,
					description: entry.payload.description,
					photo_url: photoUrl,
					client_id: entry.clientId,
					created_at_client: entry.createdAtClient,
					trash: entry.payload.trash
				}
			});

			reports.add({
				id: created.id,
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
				entry.status = 'failed';
				entry.lastError = cause.message;
			} else {
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

	async retry(clientId: string): Promise<void> {
		const entry = this.items.find((e) => e.clientId === clientId);
		if (!entry) return;
		entry.status = 'queued';
		entry.lastError = undefined;
		this.#touch(entry);
		await this.syncOne(clientId);
	}

	async #uploadPhoto(blob: Blob, contentType: string): Promise<string> {
		const file =
			blob instanceof File
				? blob
				: new File([blob], `hypothesis-${Date.now()}.jpg`, { type: contentType });
		return uploads.putFile(file, 'hypothesis_photo');
	}

	async #requestBackgroundSync() {
		try {
			const reg = await navigator.serviceWorker?.ready;
			const syncManager = (
				reg as ServiceWorkerRegistration & {
					sync?: { register: (tag: string) => Promise<void> };
				}
			)?.sync;
			await syncManager?.register(SYNC_TAG);
		} catch {
			/* Safari / без SW — остаются online/visibility */
		}
	}

	#touch(entry: QueueEntry) {
		putQueued(entry).catch(() => {});
		this.items = this.items.map((e) => (e.clientId === entry.clientId ? entry : e));
	}
}

export const offlineQueue = new OfflineQueue();
