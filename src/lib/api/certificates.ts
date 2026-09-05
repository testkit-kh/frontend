import { request } from './client';

/**
 * Сертификаты и публичная верификация (PLAN.md 5.6).
 *
 * Контракт спроектирован нами для бэкендера — ручек пока нет ни одной: нет
 * таблицы `certificates`, PDF, QR, `/verify/{code}` (ни в коде, ни в
 * `BACKEND_TASKS.md`). Отдельно от `endpoints.ts`: тот генерируется из
 * реального `openapi.json` (`pnpm run api:types`), а этих ручек там нет —
 * появятся сами, как только бэк их реализует и типы перегенерируются.
 *
 * До реализации `mine()`/`verify()` отвечают 404 — вызывающий код это
 * ожидает и показывает мягкое «скоро будет доступно», а не падает.
 *
 * Предлагаемый контракт:
 *   GET  /api/v1/certificates/me               → CertificateInfo
 *   GET  /api/v1/certificates/verify/{code}     → CertificateVerification (anonymous)
 *   POST /api/v1/certificates/{code}/share      → { ok: true }, шлёт `certificate_shared`
 */

export type CertificateInfo = {
	code: string;
	pdf_url: string;
	issued_at: string;
};

export type CertificateVerification =
	| {
			valid: true;
			revoked: false;
			full_name: string;
			course: string;
			issued_at: string;
			points_confirmed: number;
			hours: number;
	  }
	| { valid: true; revoked: true; revoked_at: string }
	| { valid: false };

export const certificates = {
	mine: () => request<CertificateInfo>('/api/v1/certificates/me'),

	verify: (code: string) =>
		request<CertificateVerification>(`/api/v1/certificates/verify/${encodeURIComponent(code)}`, {
			anonymous: true
		}),

	share: (code: string) =>
		request<{ ok: true }>(`/api/v1/certificates/${encodeURIComponent(code)}/share`, {
			method: 'POST'
		})
};
