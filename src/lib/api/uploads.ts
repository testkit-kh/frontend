import { request, ApiError, type Schemas } from './client';

/**
 * Presigned PUT в объектное хранилище (P0-2).
 *
 * Контракт: `POST /uploads/presign` → `{ upload_url, public_url, headers, … }`,
 * затем браузер сам делает PUT файла на `upload_url` с заголовками из ответа.
 */

export type UploadPurpose =
	'hypothesis_photo' | 'certificate' | 'consent_scan' | 'event_photo' | 'other';

export type PresignRequest = {
	filename: string;
	content_type: string;
	purpose: UploadPurpose;
};

export type PresignResponse = Schemas['UploadPresignOut'];

export const uploads = {
	presign: (body: PresignRequest) => request<PresignResponse>('/api/v1/uploads/presign', { body }),

	/** Presign + PUT. Возвращает public_url для сохранения в доменной ручке. */
	async putFile(file: File | Blob, purpose: UploadPurpose, filename?: string): Promise<string> {
		const name =
			filename ?? (file instanceof File && file.name ? file.name : `upload-${Date.now()}`);
		const contentType =
			(file instanceof File && file.type) || (file as Blob).type || 'application/octet-stream';

		const presign = await uploads.presign({
			filename: name,
			content_type: contentType,
			purpose
		});

		const response = await fetch(presign.upload_url, {
			method: presign.method ?? 'PUT',
			headers: presign.headers,
			body: file
		});
		if (!response.ok) {
			throw new ApiError(response.status, 'Не удалось загрузить файл');
		}
		return presign.public_url;
	}
};
