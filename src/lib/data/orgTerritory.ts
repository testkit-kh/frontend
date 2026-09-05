import type { Territory } from './territories';

/**
 * Сопоставление организации сотрудника с OSM-слагом территории.
 *
 * На бэке у staff `organization.id` — UUID, а `territories.json` живёт на
 * слагах (`kronotsky`). Предпочтительный ключ — `territory_osm_id`
 * (`relation/2800189`), совпадающий с `source` в GeoJSON (`OSM relation/…`).
 * Если OSM ещё не привязан — матчим по имени организации.
 */

export type OrgTerritoryHint = {
	name?: string | null;
	territory_osm_id?: string | null;
	has_territory?: boolean | null;
};

function normalize(value: string): string {
	return value
		.toLowerCase()
		.replace(/[«»"'`]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Убрать служебные хвосты, чтобы «Кроноцкий заповедник» ≈ «Кроноцкий». */
function coreName(value: string): string {
	return normalize(value)
		.replace(
			/\b(фгбу|фгбу\s+)?(государственный\s+)?(природный\s+)?(биосферный\s+)?(заповедник|национальный парк|заказник|природный парк)\b/g,
			' '
		)
		.replace(/\s+/g, ' ')
		.trim();
}

/** `relation/2800189` или `OSM relation/2800189` → `relation/2800189`. */
function normalizeOsmId(value: string): string | null {
	const match = value
		.trim()
		.toLowerCase()
		.match(/\b(relation|way|node)\/\d+\b/);
	return match ? match[0] : null;
}

/**
 * Найти слаг по OSM id организации (`territory_osm_id`).
 * Возвращает null, если совпадения нет.
 */
export function territorySlugForOsmId(
	osmId: string | null | undefined,
	territories: Territory[]
): string | null {
	const needle = osmId ? normalizeOsmId(osmId) : null;
	if (!needle || territories.length === 0) return null;

	const hit = territories.find((t) => {
		const fromSource = normalizeOsmId(t.source);
		return fromSource === needle || t.id === needle.split('/')[1];
	});
	return hit?.id ?? null;
}

/**
 * Найти слаг территории по названию организации.
 * Возвращает null, если совпадения нет — карта останется в обзоре страны.
 */
export function territorySlugForOrgName(
	orgName: string | null | undefined,
	territories: Territory[]
): string | null {
	if (!orgName?.trim() || territories.length === 0) return null;

	const needle = normalize(orgName);
	const needleCore = coreName(orgName);

	const exact = territories.find(
		(t) =>
			normalize(t.name) === needle ||
			normalize(t.fullName) === needle ||
			normalize(t.fullName).startsWith(needle) ||
			needle.startsWith(normalize(t.name))
	);
	if (exact) return exact.id;

	if (needleCore.length >= 4) {
		const byCore = territories.find((t) => {
			const nameCore = coreName(t.name);
			const fullCore = coreName(t.fullName);
			return (
				nameCore === needleCore || fullCore.includes(needleCore) || needleCore.includes(nameCore)
			);
		});
		if (byCore) return byCore.id;
	}

	return null;
}

/**
 * Слаг «моей» ООПТ для staff: сначала OSM id, потом имя.
 * Без матча — null (нельзя подставлять первую территорию из списка).
 */
export function resolveStaffTerritorySlug(
	org: OrgTerritoryHint | null | undefined,
	territories: Territory[]
): string | null {
	if (!org || territories.length === 0) return null;

	const byOsm = territorySlugForOsmId(org.territory_osm_id, territories);
	if (byOsm) return byOsm;

	return territorySlugForOrgName(org.name, territories);
}
