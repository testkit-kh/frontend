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
export type CoordinatorProfile = Schemas['CoordinatorProfile'];
export type Profile = VolunteerProfile | StaffProfile | CoordinatorProfile;
export type CourseStatus = Schemas['CourseStatusOut'];
export type Notification = Schemas['NotificationOut'];
export type NotificationList = Schemas['NotificationListOut'];
export type CompanyInfo = Schemas['CompanyInfoOut'];
export type AnalyticsSummary = Schemas['AnalyticsSummaryOut'];
export type ParentalConsent = Schemas['ParentalConsentOut'];
export type Hypothesis = Schemas['HypothesisOut'];
export type MyHypothesis = Schemas['MyHypothesisOut'];
export type CertificateStatus = Schemas['CertificateStatus'];
export type ConsentStatus = Schemas['ConsentStatus'];
export type PendingCertificate = Schemas['PendingCertificateOut'];
export type CleanupEvent = Schemas['EventOut'];
export type EventList = Schemas['EventListOut'];
export type CadastralParcel = Schemas['CadastralParcelOut'];
export type MonitoringSite = Schemas['MonitoringSiteOut'];
export type SiteSurvey = Schemas['SiteSurveyOut'];
export type SiteAccumulation = Schemas['SiteAccumulationOut'];
export type OrganizationProfile = Schemas['OrganizationProfileOut'];
export type OrganizationListItem = Schemas['OrganizationListItemOut'];

export function isStaffProfile(profile: Profile): profile is StaffProfile {
	return profile.role === 'staff';
}

export function isVolunteerProfile(profile: Profile): profile is VolunteerProfile {
	return profile.role === 'volunteer';
}

export function isCoordinatorProfile(profile: Profile): profile is CoordinatorProfile {
	return profile.role === 'coordinator';
}

// ═══════════════════════════════════════════════════════════════════════════
// Auth
// ═══════════════════════════════════════════════════════════════════════════

export const auth = {
	/** Логин совместим с OAuth2 password flow, поэтому форма, а не JSON.
	 *  Вместе с access выставляется httpOnly refresh-кука. */
	login: (email: string, password: string) =>
		request<Schemas['TokenResponse']>('/auth/login', {
			form: { username: email, password },
			anonymous: true
		}),

	/** Обмен refresh-куки на access. Без Bearer. */
	refresh: () =>
		request<Schemas['TokenResponse']>('/auth/refresh', {
			method: 'POST',
			anonymous: true
		}),

	/** Отзыв refresh-куки. Идемпотентен. */
	logout: () => request<void>('/auth/logout', { method: 'POST', anonymous: true }),

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
	 * Уйти на курс. Переход идёт через наш бэкенд, а не прямо на iSpring:
	 * только так фиксируется `course_redirect_click`, от которого считается
	 * вся метрика возврата. JSON, а не HTTP-редирект: ручка требует
	 * Bearer-токен, а обычный `<a href>` заголовков не шлёт — поэтому здесь
	 * авторизованный fetch, а переход по `url` делает вызывающий код сам.
	 */
	redirect: (notificationId?: string) =>
		request<{ url: string }>('/api/v1/course/redirect', {
			query: { nid: notificationId }
		}),

	submitCertificate: (certificateUrl: string) =>
		request<Schemas['VolunteerProfileOut']>('/api/v1/volunteers/me/certificate', {
			body: { certificate_url: certificateUrl }
		}),

	/** Очередь сертификатов на проверку (координатор). */
	pendingCertificates: () => request<PendingCertificate[]>('/api/v1/certificates/pending'),

	reviewCertificate: (volunteerId: string, body: Schemas['CertificateReviewRequest']) =>
		request<Schemas['VolunteerProfileOut']>(`/api/v1/certificates/${volunteerId}/review`, {
			method: 'POST',
			body
		})
};

export const consent = {
	submit: (body: Schemas['ParentalConsentCreateRequest']) =>
		request<ParentalConsent>('/api/v1/volunteers/me/parental-consent', { body }),

	/** Очередь согласий на проверку (координатор). */
	pending: () => request<ParentalConsent[]>('/api/v1/consents/pending'),

	review: (id: string, body: Schemas['ConsentReviewRequest']) =>
		request<ParentalConsent>(`/api/v1/consents/${id}/review`, { method: 'POST', body })
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

	markAllRead: () =>
		request<NotificationList>('/api/v1/notifications/read-all', { method: 'POST' }),

	/** Ручной запуск рассылки — демо-ручка, не ждать часового цикла планировщика. */
	dispatchReminders: (dryRun: boolean) =>
		request<Schemas['ReminderDispatchOut']>('/api/v1/notifications/dispatch-reminders', {
			method: 'POST',
			query: { dry_run: dryRun }
		})
};

// ═══════════════════════════════════════════════════════════════════════════
// Точки и территории
// ═══════════════════════════════════════════════════════════════════════════

export const hypotheses = {
	create: (body: Schemas['HypothesisCreateRequest']) =>
		request<Hypothesis>('/api/v1/hypotheses', { body }),

	/** Свои точки со статусами и причиной отказа — лента «Мои точки».
	 *  Ответ страничный (`items`/`total`), а не голый список. */
	mine: (params: { limit?: number; offset?: number } = {}) =>
		request<Schemas['MyHypothesesListOut']>('/api/v1/hypotheses/my', {
			query: { limit: params.limit, offset: params.offset }
		}),

	pending: () => request<Hypothesis[]>('/api/v1/hypotheses/pending'),

	validate: (id: string, status: Schemas['HypothesisStatus'], reason?: string) =>
		request<Schemas['HypothesisValidateResponse']>(`/api/v1/hypotheses/${id}/validate`, {
			body: { status, reason }
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

// ═══════════════════════════════════════════════════════════════════════════
// Кабинет ООПТ — мероприятия, участки, площадки наблюдений, профиль
// ═══════════════════════════════════════════════════════════════════════════

export const events = {
	/** Одна ручка на две роли: сотруднику — все мероприятия своей ООПТ,
	 *  волонтёру — запланированные по всей программе. */
	list: (params: { status?: Schemas['EventStatus']; limit?: number; offset?: number } = {}) =>
		request<EventList>('/api/v1/events', {
			query: { status: params.status, limit: params.limit, offset: params.offset }
		}),

	/** Создать мероприятие вручную (сотрудник ООПТ). */
	create: (body: {
		title: string;
		description?: string;
		place?: string;
		scheduled_at?: string;
		hypothesis_id?: string;
	}) => request<CleanupEvent>('/api/v1/events', { body }),

	/** Записаться (волонтёр). Идемпотентно: повтор возвращает already_joined. */
	join: (id: string) =>
		request<Schemas['EventJoinOut']>(`/api/v1/events/${id}/join`, { method: 'POST' }),

	/** Отменить запись. */
	leave: (id: string) => request<void>(`/api/v1/events/${id}/join`, { method: 'DELETE' }),

	update: (
		id: string,
		body: {
			title?: string;
			place?: string;
			description?: string;
			scheduled_at?: string;
		}
	) => request<CleanupEvent>(`/api/v1/events/${id}`, { method: 'PATCH', body }),

	cancel: (id: string) => request<CleanupEvent>(`/api/v1/events/${id}/cancel`, { method: 'POST' }),

	complete: (id: string, body: Schemas['EventCompleteRequest']) =>
		request<Schemas['EventCompleteResponse']>(`/api/v1/events/${id}/complete`, {
			method: 'POST',
			body
		}),

	/** Фото до/после уборки (сотрудник), после complete. */
	beforeAfter: (id: string, body: Schemas['EventBeforeAfterRequest']) =>
		request<Schemas['EventBeforeAfterOut']>(`/api/v1/events/${id}/before-after`, {
			method: 'POST',
			body
		})
};

export const parcels = {
	list: () => request<CadastralParcel[]>('/api/v1/organizations/me/parcels'),

	add: (cadastralNumber: string) =>
		request<CadastralParcel>('/api/v1/organizations/me/parcels', {
			body: { cadastral_number: cadastralNumber }
		}),

	/** Участок без кадастра: полигон из Nominatim (OSM). */
	addFromOsm: (body: {
		osm_id: string;
		name: string;
		geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
	}) =>
		request<CadastralParcel>('/api/v1/organizations/me/parcels/from-osm', {
			body
		}),

	retry: (id: string) =>
		request<CadastralParcel>(`/api/v1/parcels/${id}/retry`, { method: 'POST' }),

	/** Пробный резолвинг без записи в БД — ответ не типизирован из OpenAPI: у
	 *  ручки нет response_model, она возвращает диагностический dict. */
	resolveCheck: (cadastralNumber: string) =>
		request<{
			cadastral_number: string;
			outcome: 'ok' | 'not_found' | 'unavailable';
			detail?: string;
			hint?: string;
			elapsed_seconds: number;
			geometry_type?: string;
			rings?: number;
			vertices?: number;
			geometry?: unknown;
		}>('/api/v1/parcels/resolve-check', { query: { cadastral_number: cadastralNumber } }),

	setGeometry: (
		id: string,
		geometry: Schemas['GeoJSONGeometry'] | GeoJSON.Geometry,
		source: 'manual' | 'osm' = 'manual'
	) =>
		request<CadastralParcel>(`/api/v1/parcels/${id}/geometry`, {
			method: 'PUT',
			body: { geometry, source }
		}),

	remove: (id: string) => request<void>(`/api/v1/parcels/${id}`, { method: 'DELETE' })
};

export const monitoring = {
	list: () => request<MonitoringSite[]>('/api/v1/monitoring-sites'),

	create: (body: Schemas['MonitoringSiteCreateRequest']) =>
		request<MonitoringSite>('/api/v1/monitoring-sites', { body }),

	surveys: (siteId: string) => request<SiteSurvey[]>(`/api/v1/monitoring-sites/${siteId}/surveys`),

	addSurvey: (siteId: string, body: Schemas['SiteSurveyCreateRequest']) =>
		request<SiteSurvey>(`/api/v1/monitoring-sites/${siteId}/surveys`, { body }),

	accumulation: (siteId: string) =>
		request<SiteAccumulation>(`/api/v1/monitoring-sites/${siteId}/accumulation`)
};

export const organizations = {
	/** Профиль своей организации (сотрудник ООПТ). */
	me: () => request<OrganizationProfile>('/api/v1/organizations/me'),

	updateMe: (body: Schemas['OrganizationUpdateRequest']) =>
		request<OrganizationProfile>('/api/v1/organizations/me', { method: 'PATCH', body }),

	/** Очередь организаций на верификацию (координатор). */
	list: (verificationStatus?: Schemas['OrgVerificationStatus']) =>
		request<OrganizationListItem[]>('/api/v1/organizations', {
			query: { verification_status: verificationStatus }
		}),

	verify: (id: string, body: Schemas['OrganizationVerifyRequest']) =>
		request<OrganizationListItem>(`/api/v1/organizations/${id}/verify`, {
			method: 'POST',
			body
		})
};

// ═══════════════════════════════════════════════════════════════════════════
// ML — сканы подложки и находки автодетекции
// ═══════════════════════════════════════════════════════════════════════════

export type MlFinding = {
	id: string;
	scan_id: string;
	detection_id: number | null;
	lat: number | null;
	lon: number | null;
	trash_categories: string[] | null;
	dominant_category: string | null;
	fraction: string | null;
	confidence: number | null;
	estimated_volume_m3: number | null;
	estimated_mass_kg: number | null;
	label_ru: string | null;
	color_hex: string | null;
	hypothesis_id: string | null;
	created_at: string;
};

export type MlScan = {
	id: string;
	requester_id: string | null;
	organization_id: string | null;
	bbox: number[];
	zoom: number;
	tile_source: string | null;
	ml_job_id: string | null;
	summary: {
		count?: number;
		dominant_category?: string | null;
		total_volume_m3?: number | null;
		coverage_ratio?: number;
	} | null;
	geojson: GeoJSON.FeatureCollection | null;
	overlay_bounds: number[][] | null;
	imagery: {
		source?: string;
		attribution?: string;
		zoom?: number;
		gsd_m_per_px?: number;
		too_coarse?: boolean;
		candidates_suppressed?: boolean;
	} | null;
	fraud_flags: Array<{ code: string; severity: string; message: string }> | null;
	model_info: { backend?: string; trained?: boolean; version?: string } | null;
	candidates_suppressed: boolean;
	findings_count: number;
	hypotheses_created: number;
	created_at: string;
	findings?: MlFinding[] | null;
};

export type MlHealth = {
	configured: boolean;
	status: string;
	detail?: string | null;
	backend?: string | null;
	backend_ready?: boolean | null;
	trained?: boolean | null;
	version?: string | null;
};

export const ml = {
	health: () => request<MlHealth>('/api/v1/ml/health'),

	createScan: (body: { bbox: [number, number, number, number]; zoom?: number; source?: string }) =>
		request<MlScan>('/api/v1/ml/scans', { body }),

	listScans: (params: { limit?: number; offset?: number } = {}) =>
		request<{ items: MlScan[]; total: number }>('/api/v1/ml/scans', {
			query: { limit: params.limit, offset: params.offset }
		}),

	getScan: (id: string) => request<MlScan>(`/api/v1/ml/scans/${id}`),

	listFindings: (params: { limit?: number; offset?: number; scan_id?: string } = {}) =>
		request<{ items: MlFinding[]; total: number }>('/api/v1/ml/findings', {
			query: {
				limit: params.limit,
				offset: params.offset,
				scan_id: params.scan_id
			}
		}),

	overlayGeojson: (params: { limit?: number; scan_id?: string } = {}) =>
		request<GeoJSON.FeatureCollection>('/api/v1/ml/overlay.geojson', {
			query: { limit: params.limit, scan_id: params.scan_id }
		})
};
