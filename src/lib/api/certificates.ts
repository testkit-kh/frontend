import { request } from './client';
import type { Schemas } from './client';

/**
 * Выданные сертификаты (PLAN 5.6).
 * Типы частично зеркалят OpenAPI; verify отдаёт плоскую схему с optional-полями.
 */

export type CertificateInfo = Schemas['IssuedCertificateOut'];

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

function adaptVerify(raw: Schemas['CertificateVerificationOut']): CertificateVerification {
	if (!raw.valid) return { valid: false };
	if (raw.revoked) {
		return {
			valid: true,
			revoked: true,
			revoked_at: raw.revoked_at ?? new Date().toISOString()
		};
	}
	return {
		valid: true,
		revoked: false,
		full_name: raw.full_name ?? '',
		course: raw.course ?? '',
		issued_at: raw.issued_at ?? new Date().toISOString(),
		points_confirmed: raw.points_confirmed ?? 0,
		hours: raw.hours ?? 0
	};
}

export const certificates = {
	mine: () => request<CertificateInfo>('/api/v1/certificates/me'),

	verify: async (code: string) => {
		const raw = await request<Schemas['CertificateVerificationOut']>(
			`/api/v1/certificates/verify/${encodeURIComponent(code)}`,
			{ anonymous: true }
		);
		return adaptVerify(raw);
	},

	share: (code: string) =>
		request<{ ok: true }>(`/api/v1/certificates/${encodeURIComponent(code)}/share`, {
			method: 'POST'
		})
};
