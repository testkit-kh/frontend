import { request, type Schemas } from './client';

/**
 * Онбординг: образование волонтёра и граница ООПТ без кадастра.
 *
 * Ручки уже в OpenAPI — держим отдельным модулем, чтобы не смешивать с
 * «основным» списком экранов, но типы берём из схемы.
 */

export type EducationLevel = Schemas['EducationLevel'];
export type EducationPayload = Schemas['EducationRequest'];
export type EducationOut = Schemas['EducationOut'];
export type TerritoryPayload = Schemas['TerritoryUpdateRequest'];
export type TerritoryOut = Schemas['TerritoryOut'];

export const onboarding = {
	education: (body: EducationPayload) =>
		request<EducationOut>('/api/v1/volunteers/me/education', { body }),

	getEducation: () => request<EducationOut>('/api/v1/volunteers/me/education'),

	territory: (body: TerritoryPayload) =>
		request<TerritoryOut>('/api/v1/organizations/me/territory', { method: 'PATCH', body })
};
