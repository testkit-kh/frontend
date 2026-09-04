import { parseTerritories } from '$lib/data/territories';
import type { Report } from '$lib/types';

export const ssr = false;

export async function load({ fetch }) {
	const [territories, reports] = await Promise.all([
		fetch('/data/territories.json').then((r) => r.json()),
		fetch('/data/reports.json').then((r) => r.json() as Promise<Report[]>)
	]);

	return { territories: parseTerritories(territories), reports };
}
