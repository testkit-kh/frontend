import type { Territory } from './territories';

/**
 * Сопоставление организации сотрудника с OSM-слагом территории.
 *
 * На бэке у staff `organization.id` — UUID, а `territories.json` живёт на
 * слагах (`kronotsky`). Предпочтительный ключ — `territory_osm_id`
 * (`relation/2800189`), совпадающий с `source` в GeoJSON (`OSM relation/…`).
 * Если OSM ещё не привязан — матчим по имени, затем по геометрии участков.
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
 * Возвращает null, если совпадения нет (в т.ч. для `relation/test`).
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

/** Точка внутри bbox территории (достаточно для навигации по карте). */
export function territorySlugForPoint(
	lon: number,
	lat: number,
	territories: Territory[]
): string | null {
	if (!Number.isFinite(lon) || !Number.isFinite(lat) || territories.length === 0) return null;
	for (const territory of territories) {
		const [[west, south], [east, north]] = territory.bounds as [[number, number], [number, number]];
		if (lon >= west && lon <= east && lat >= south && lat <= north) return territory.id;
	}
	return null;
}

function ringCentroid(ring: number[][]): [number, number] | null {
	const pts = ring.length > 1 ? ring.slice(0, -1) : ring;
	if (pts.length === 0) return null;
	const sum = pts.reduce((acc, [lng, lat]) => [acc[0] + lng, acc[1] + lat] as [number, number], [
		0, 0
	] as [number, number]);
	return [sum[0] / pts.length, sum[1] / pts.length];
}

/** Грубая центроида GeoJSON-геометрии участка. */
export function geometryCentroid(
	geometry: GeoJSON.Geometry | null | undefined
): [number, number] | null {
	if (!geometry) return null;
	if (geometry.type === 'Point') {
		const [lon, lat] = geometry.coordinates;
		return Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : null;
	}
	if (geometry.type === 'Polygon') return ringCentroid(geometry.coordinates[0] ?? []);
	if (geometry.type === 'MultiPolygon') {
		const first = geometry.coordinates[0]?.[0];
		return first ? ringCentroid(first) : null;
	}
	return null;
}

/**
 * Слаг по участкам организации: OSM id в properties, иначе центроида в bbox ООПТ.
 * Нужен, когда `territory_osm_id` кастомный (`relation/test`) или не из каталога.
 */
export function territorySlugForParcels(
	collection: GeoJSON.FeatureCollection | null | undefined,
	territories: Territory[]
): string | null {
	if (!collection?.features?.length || territories.length === 0) return null;

	for (const feature of collection.features) {
		const props = feature.properties ?? {};
		const haystack = [props.description, props.name, props.id].filter(Boolean).join(' ');
		const byOsm = territorySlugForOsmId(String(haystack), territories);
		if (byOsm) return byOsm;
	}

	for (const feature of collection.features) {
		const point = geometryCentroid(feature.geometry);
		if (!point) continue;
		const byPoint = territorySlugForPoint(point[0], point[1], territories);
		if (byPoint) return byPoint;
	}

	return null;
}

/** Общий bbox участков — для «Моя территория», если каталог ООПТ не сматчился. */
export function boundsFromParcels(
	collection: GeoJSON.FeatureCollection | null | undefined
): [[number, number], [number, number]] | null {
	if (!collection?.features?.length) return null;
	let minLon = Infinity;
	let minLat = Infinity;
	let maxLon = -Infinity;
	let maxLat = -Infinity;

	const eat = (lon: number, lat: number) => {
		if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
		// Отсекаем «нулевой остров» у Африки — типичный мусор координат.
		if (Math.abs(lon) < 0.2 && Math.abs(lat) < 0.2) return;
		minLon = Math.min(minLon, lon);
		minLat = Math.min(minLat, lat);
		maxLon = Math.max(maxLon, lon);
		maxLat = Math.max(maxLat, lat);
	};

	const walk = (coords: unknown): void => {
		if (!Array.isArray(coords) || coords.length === 0) return;
		if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
			eat(coords[0], coords[1]);
			return;
		}
		for (const child of coords) walk(child);
	};

	for (const feature of collection.features) {
		if (feature.geometry) walk(feature.geometry.coordinates);
	}

	if (!Number.isFinite(minLon) || !Number.isFinite(maxLon)) return null;
	if (minLon === maxLon) {
		minLon -= 0.05;
		maxLon += 0.05;
	}
	if (minLat === maxLat) {
		minLat -= 0.05;
		maxLat += 0.05;
	}
	return [
		[minLon, minLat],
		[maxLon, maxLat]
	];
}

/**
 * Слаг «моей» ООПТ для staff: OSM id → имя → участки на карте.
 * Без матча — null (нельзя подставлять первую территорию из списка).
 */
export function resolveStaffTerritorySlug(
	org: OrgTerritoryHint | null | undefined,
	territories: Territory[],
	parcels?: GeoJSON.FeatureCollection | null
): string | null {
	if (!org || territories.length === 0) return null;

	const byOsm = territorySlugForOsmId(org.territory_osm_id, territories);
	if (byOsm) return byOsm;

	const byName = territorySlugForOrgName(org.name, territories);
	if (byName) return byName;

	return territorySlugForParcels(parcels, territories);
}
