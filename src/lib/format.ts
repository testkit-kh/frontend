const DATE = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });

export function formatDate(iso: string) {
	const date = new Date(iso);
	return Number.isNaN(date.valueOf()) ? iso : DATE.format(date);
}

export function plural(count: number, one: string, few: string, many: string) {
	const mod10 = count % 10;
	const mod100 = count % 100;
	if (mod10 === 1 && mod100 !== 11) return one;
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
	return many;
}

export function formatCoords([lng, lat]: [number, number]) {
	return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
