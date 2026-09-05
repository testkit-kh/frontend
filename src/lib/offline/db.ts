import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/**
 * Очередь несинхронизированных точек. Отдельная база, а не localStorage:
 * фото хранится как `Blob` — localStorage такое не примет, а IndexedDB
 * рассчитана именно на бинарные данные и не блокирует поток при записи.
 */

export type QueueStatus = 'queued' | 'syncing' | 'sent' | 'failed';

export type QueuePayload = {
	lat: number;
	lon: number;
	/** Уходит на бэкенд как есть. */
	description: string;
	/** Дальше — только для мок-зеркала в `reports.svelte.ts` (список/карточки
	 *  на `/map` пока читают его, не реальный бэк). */
	title: string;
	territoryId: string;
	authorName: string;
};

export type QueueEntry = {
	clientId: string;
	createdAtClient: string;
	status: QueueStatus;
	attempts: number;
	lastError?: string;
	payload: QueuePayload;
	photo?: { blob: Blob; contentType: string } | null;
};

interface OfflineDB extends DBSchema {
	queue: {
		key: string;
		value: QueueEntry;
		indexes: { status: string };
	};
}

let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null;

function db() {
	dbPromise ??= openDB<OfflineDB>('cb-offline', 1, {
		upgrade(database) {
			const store = database.createObjectStore('queue', { keyPath: 'clientId' });
			store.createIndex('status', 'status');
		}
	});
	return dbPromise;
}

export async function listQueued(): Promise<QueueEntry[]> {
	return (await db()).getAll('queue');
}

export async function putQueued(entry: QueueEntry): Promise<void> {
	await (await db()).put('queue', entry);
}

export async function deleteQueued(clientId: string): Promise<void> {
	await (await db()).delete('queue', clientId);
}
