import { request, type Schemas } from './client';

export type { Schemas };

/**
 * Ручки бэкенда одним списком.
 *
 * Отдельно от `client.ts`, чтобы компоненты не собирали пути строками:
 * опечатка в URL иначе всплывает только в рантайме, а здесь её ловит
 * TypeScript через типы, сгенерированные из OpenAPI.
 */

export type VolunteerProfile = Schemas['VolunteerProfile'];
export type StaffProfile = Schemas['StaffProfile'];
export type Profile = VolunteerProfile | StaffProfile;
export type CourseStatus = Schemas['CourseStatusOut'];
export type Notification = Schemas['NotificationOut'];
export type NotificationList = Schemas['NotificationListOut'];
export type CompanyInfo = Schemas['CompanyInfoOut'];
export type AnalyticsSummary = Schemas['AnalyticsSummaryOut'];
export type ParentalConsent = Schemas['ParentalConsentOut'];
export type Hypothesis = Schemas['HypothesisOut'];
export type CertificateStatus = Schemas['CertificateStatus'];
export type ConsentStatus = Schemas['ConsentStatus'];

export function isStaffProfile(profile: Profile): profile is StaffProfile {
	return profile.role === 'staff';
}

export function isVolunteerProfile(profile: Profile): profile is VolunteerProfile {
	return profile.role === 'volunteer';
}

// ═══════════════════════════════════════════════════════════════════════════
// Auth
// ═══════════════════════════════════════════════════════════════════════════

export const auth = {
	/** Логин совместим с OAuth2 password flow, поэтому форма, а не JSON. */
	login: (email: string, password: string) =>
		request<Schemas['TokenResponse']>('/auth/login', {
			form: { username: email, password },
			anonymous: true
		}),

	registerVolunteer: (body: Schemas['VolunteerRegisterRequest']) =>
		request<VolunteerProfile>('/auth/register/volunteer', { body, anonymous: true }),

	registerOrganization: (body: Schemas['OrganizationRegisterRequest']) =>
		request<StaffProfile>('/auth/register/organization', { body, anonymous: true }),

	me: () => request<Profile>('/auth/me')
};

// ═══════════════════════════════════════════════════════════════════════════
// Обучение и согласие
// ═══════════════════════════════════════════════════════════════════════════

export const course = {
	status: () => request<CourseStatus>('/api/v1/course/me'),

	/**
	 * Ссылка на курс. Переход делается через наш бэкенд, а не прямо на
	 * iSpring: только так фиксируется `course_redirect_click`, от которого
	 * считается вся метрика возврата.
	 */
	redirectUrl: (notificationId?: string) =>
		`${import.meta.env.VITE_API_URL ?? '/api-proxy'}/api/v1/course/redirect` +
		(notificationId ? `?nid=${encodeURIComponent(notificationId)}` : ''),

	submitCertificate: (certificateUrl: string) =>
		request<Schemas['VolunteerProfileOut']>('/api/v1/volunteers/me/certificate', {
			body: { certificate_url: certificateUrl }
		})
};

export const consent = {
	submit: (body: Schemas['ParentalConsentCreateRequest']) =>
		request<ParentalConsent>('/api/v1/volunteers/me/parental-consent', { body })
};

// ═══════════════════════════════════════════════════════════════════════════
// Уведомления
// ═══════════════════════════════════════════════════════════════════════════

export const notifications = {
	list: (unreadOnly = false) =>
		request<NotificationList>('/api/v1/notifications', {
			query: { unread_only: unreadOnly }
		}),

	markRead: (id: string) =>
		request<Notification>(`/api/v1/notifications/${id}/read`, { method: 'POST' }),

	markAllRead: () => request<NotificationList>('/api/v1/notifications/read-all', { method: 'POST' })
};

// ═══════════════════════════════════════════════════════════════════════════
// Точки и территории
// ═══════════════════════════════════════════════════════════════════════════

export const hypotheses = {
	create: (body: Schemas['HypothesisCreateRequest']) =>
		request<Hypothesis>('/api/v1/hypotheses', { body }),

	pending: () => request<Hypothesis[]>('/api/v1/hypotheses/pending'),

	validate: (id: string, status: Schemas['HypothesisStatus']) =>
		request<Schemas['HypothesisValidateResponse']>(`/api/v1/hypotheses/${id}/validate`, {
			body: { status }
		}),

	mapLayers: () => request<Schemas['GeoJSONFeatureCollection']>('/api/v1/map/layers'),

	parcels: (organizationId?: string) =>
		request<Schemas['GeoJSONFeatureCollection']>('/api/v1/map/parcels.geojson', {
			query: { org_id: organizationId },
			anonymous: true
		})
};

// ═══════════════════════════════════════════════════════════════════════════
// Реестр и аналитика
// ═══════════════════════════════════════════════════════════════════════════

export const registry = {
	/** Автозаполнение формы регистрации ООПТ. Работает без токена. */
	company: (inn: string, signal?: AbortSignal) =>
		request<CompanyInfo>('/api/v1/registry/company', {
			query: { inn },
			anonymous: true,
			signal
		})
};

export const analytics = {
	summary: () => request<AnalyticsSummary>('/api/v1/analytics/summary'),

	embed: (slug: 'funnel' | 'oopt' | 'impact') =>
		request<Schemas['DashboardEmbedOut']>(`/api/v1/analytics/embed/${slug}`)
};
