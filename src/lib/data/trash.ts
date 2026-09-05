import type { Schemas } from '$lib/api/endpoints';

export type TrashCategory = Schemas['TrashCategory'];
export type TrashFraction = Schemas['TrashFraction'];
export type AccessType = Schemas['AccessType'];
export type TrashDetails = Schemas['TrashDetails'];

export const TRASH_CATEGORY_LABEL: Record<TrashCategory, string> = {
	plastic: 'Пластик',
	fishing_gear: 'Рыболовные снасти',
	glass: 'Стекло',
	metal: 'Металл',
	wood: 'Дерево',
	rubber: 'Резина',
	hazardous: 'Опасные отходы',
	household: 'Бытовой мусор',
	construction: 'Стройматериалы',
	other: 'Прочее'
};

export const TRASH_CATEGORIES = Object.keys(TRASH_CATEGORY_LABEL) as TrashCategory[];

export const ACCESS_TYPE_LABEL: Record<AccessType, string> = {
	on_foot: 'Пешком',
	vehicle: 'На машине',
	boat: 'На лодке',
	helicopter: 'Вертолёт'
};

export const ACCESS_TYPES = Object.keys(ACCESS_TYPE_LABEL) as AccessType[];
