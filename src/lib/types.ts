export type Role = 'volunteer' | 'staff';

export type User = {
	id: string;
	name: string;
	email: string;
	role: Role;
	organizationId?: string;
	onboarded: boolean;
};

export type ReportKind = 'trash' | 'spill';

export type ReportStatus = 'pending' | 'confirmed' | 'drone' | 'rejected';

export type ReportSource = 'field' | 'satellite';

export type Report = {
	id: string;
	territoryId: string;
	kind: ReportKind;
	source: ReportSource;
	title: string;
	note: string;
	author: string;
	createdAt: string;
	status: ReportStatus;
	verdict?: string;
	place?: string;
	route?: {
		from: string;
		km: number;
		minutes: number;
		geometry: { type: 'LineString'; coordinates: [number, number][] };
	};
	event?: { date: string; signed: number };
	geometry:
		| { type: 'Point'; coordinates: [number, number] }
		| { type: 'Polygon'; coordinates: [number, number][][] };
};

export const KIND_LABEL: Record<ReportKind, string> = {
	trash: 'Свалка мусора',
	spill: 'Разлив в воду'
};

export const STATUS_LABEL: Record<ReportStatus, string> = {
	pending: 'На проверке',
	confirmed: 'Подтверждено',
	drone: 'Нужен облёт дроном',
	rejected: 'Отклонено'
};

export const STATUS_COLOR: Record<ReportStatus, string> = {
	pending: '#f59e0b',
	confirmed: '#10b981',
	drone: '#38bdf8',
	rejected: '#94a3b8'
};
