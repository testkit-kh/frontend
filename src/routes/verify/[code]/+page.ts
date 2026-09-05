import { certificates, type CertificateVerification } from '$lib/api/certificates';

// Публичная страница, вне (app) — без гварда сессии. `ssr = false`: ручки
// верификации ещё нет на бэке (см. certificates.ts), рендерить на сервере
// нечего, а по той же причине, что у остального приложения, здесь не нужен
// SSR ради SEO — верификацию открывают по прямой ссылке из PDF/QR, а не ищут.
export const ssr = false;

export async function load({ params }) {
	let result: CertificateVerification | { valid: false } = { valid: false };
	try {
		result = await certificates.verify(params.code);
	} catch {
		/* ручки ещё нет либо код не найден — экран покажет «не найден» */
	}
	return { code: params.code, verification: result };
}
