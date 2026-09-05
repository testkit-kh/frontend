import { certificates, type CertificateVerification } from '$lib/api/certificates';

// Публичная страница, вне (app) — без гварда сессии.
export const ssr = false;

export async function load({ params }) {
	let result: CertificateVerification | { valid: false } = { valid: false };
	try {
		result = await certificates.verify(params.code);
	} catch {
		/* сеть / несуществующий код — экран покажет «не найден» */
	}
	return { code: params.code, verification: result };
}
