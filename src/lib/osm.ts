/**
 * Подбор границ по OpenStreetMap — фолбэк, когда кадастрового номера нет.
 *
 * Зачем вообще фолбэк: кадастр есть далеко не у каждой ООПТ, а у части
 * заповедников границы в ФГИС ЕГРН не отдаются вовсе (ручка
 * `/parcels/resolve-check` для того и сделана, чтобы это было видно). Без
 * запасного пути регистрация ООПТ упирается в поле, которое сотруднику
 * нечем заполнить, и человек уходит.
 *
 * Почему Nominatim: бесплатно, без ключа и без регистрации, отдаёт готовый
 * GeoJSON-полигон (`polygon_geojson=1`) и разрешает CORS. Границы ООПТ в OSM
 * есть почти для всех федеральных заповедников — как `boundary=protected_area`
 * или `leisure=nature_reserve`.
 *
 * Ограничения политики использования Nominatim (соблюдаем, иначе забанят по
 * IP): не чаще одного запроса в секунду и никакого автопоиска на каждое
 * нажатие клавиши — отсюда `SEARCH_DEBOUNCE_MS` и обязательный AbortSignal у
 * вызывающего кода.
 *
 * Данные OSM — не юридический документ. В интерфейсе такая граница всегда
 * помечается источником, а кадастровый номер остаётся предпочтительным путём.
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

/** Пауза перед запросом: политика Nominatim — не чаще 1 запроса в секунду. */
export const SEARCH_DEBOUNCE_MS = 1200;

export type OsmPlace = {
	/** `osmType/osmId`, например `relation/1148559` — стабильный идентификатор. */
	id: string;
	/** Короткое имя для списка. */
	name: string;
	/** Полный адрес из Nominatim — им человек отличает два одноимённых объекта. */
	address: string;
	/** Категория объекта человеческим языком: «заповедник», «нацпарк», «заказник». */
	kind: string;
	geometry: GeoJSON.Geometry;
	/** Площадь считать нечем, но по bbox видно, что нашли не деревню. */
	bbox?: [number, number, number, number];
};

type NominatimFeature = {
	type: 'Feature';
	geometry: GeoJSON.Geometry;
	bbox?: number[];
	properties: {
		osm_type?: string;
		osm_id?: number;
		display_name?: string;
		name?: string;
		category?: string;
		type?: string;
		place_rank?: number;
	};
};

/** Человеческое название категории. Ключ — `category/type` из Nominatim. */
const KIND_LABEL: Record<string, string> = {
	'boundary/protected_area': 'ООПТ',
	'boundary/national_park': 'Национальный парк',
	'leisure/nature_reserve': 'Заповедник',
	'landuse/conservation': 'Охраняемая территория',
	'natural/wood': 'Лесной массив',
	'natural/water': 'Водный объект',
	'place/island': 'Остров'
};

function kindOf(properties: NominatimFeature['properties']): string {
	const key = `${properties.category ?? ''}/${properties.type ?? ''}`;
	return KIND_LABEL[key] ?? (properties.type ? properties.type.replace(/_/g, ' ') : 'Объект OSM');
}

/**
 * Найти охраняемую территорию по названию.
 *
 * Отдаём только объекты с площадной геометрией: точка вместо границы
 * заповедника бесполезна — по ней нельзя ни отрисовать территорию, ни
 * проверить, попадает ли в неё точка волонтёра.
 */
export async function searchProtectedAreas(
	query: string,
	signal?: AbortSignal
): Promise<OsmPlace[]> {
	const q = query.trim();
	if (q.length < 3) return [];

	const url = new URL(NOMINATIM);
	url.searchParams.set('q', q);
	url.searchParams.set('format', 'geojson');
	url.searchParams.set('polygon_geojson', '1');
	url.searchParams.set('limit', '8');
	url.searchParams.set('countrycodes', 'ru');
	url.searchParams.set('accept-language', 'ru');
	// Полигон в упрощённом виде: точность границы здесь не нужна, а полная
	// геометрия заповедника — это мегабайты, которые незачем гонять в телефон.
	url.searchParams.set('polygon_threshold', '0.001');

	const response = await fetch(url, { signal, headers: { Accept: 'application/geo+json' } });
	if (!response.ok) throw new Error(`OSM ответил ${response.status}`);

	const data = (await response.json()) as { features?: NominatimFeature[] };
	return (data.features ?? [])
		.filter((f) => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon')
		.map((f) => ({
			id: `${f.properties.osm_type ?? 'osm'}/${f.properties.osm_id ?? ''}`,
			name: f.properties.name ?? (f.properties.display_name ?? '').split(',')[0],
			address: f.properties.display_name ?? '',
			kind: kindOf(f.properties),
			geometry: f.geometry,
			bbox: f.bbox?.length === 4 ? (f.bbox as [number, number, number, number]) : undefined
		}));
}

/** Кадастровый номер формата `41:01:0000000:1`. Бэкенд требует такой же. */
export function isCadastralNumber(value: string): boolean {
	return /^\d{2}:\d{2}:\d{6,7}:\d{1,10}$/.test(value.trim());
}
