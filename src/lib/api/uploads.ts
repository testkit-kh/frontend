import { request } from './client';

/**
 * Presigned-загрузка файлов — контракт `P0-2` из `BACKEND_TASKS.md`, ручки
 * ещё нет на бэке. Отдельно от `endpoints.ts`: тот генерируется из реального
 * `openapi.json` (`pnpm run api:types`), а этой ручки там пока нет — попадёт
 * туда сама, как только бэкендер её реализует и типы перегенерируются.
 *
 * До появления ручки запрос отвечает 404 — вызывающий код (`offlineQueue`)
 * это ожидает и держит точку в очереди, а не падает.
 */

export type UploadPurpose = 'hypothesis_photo' | 'certificate' | 'consent_scan';

export type PresignRequest = {
	filename: string;
	content_type: string;
	purpose: UploadPurpose;
};

export type PresignResponse = {
	upload_url: string;
	public_url: string;
	fields: Record<string, string>;
	expires_at: string;
};

export const uploads = {
	presign: (body: PresignRequest) => request<PresignResponse>('/api/v1/uploads/presign', { body })
};
