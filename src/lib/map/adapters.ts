import type { MyHypothesis } from '$lib/api/endpoints';
import type { Territory } from '$lib/data/territories';
import type { Report, ReportStatus } from '$lib/types';

/**
 * Перевод точек бэкенда в модель карты.
 *
 * Карта исторически работала на демо-файле `static/data/reports.json`, и
 * настоящие точки волонтёра до неё не доезжали: человек отправлял наблюдение,
 * видел его до перезагрузки страницы и терял. Здесь — мост между тем, что
 * отдаёт API (`/hypotheses/my`, `/map/layers`), и тем, что умеет рисовать
 * `PollutionMap`.
 *
 * Демо-данные при этом не выбрасываются: без них пустая карта не показывает
 * ни легенды, ни смысла продукта. Настоящие точки просто кладутся поверх.
 */

/** У бэкенда пять состояний, у карты — четыре. */
const STATUS: Record<string, ReportStatus> = {
	pending: 'pending',
	approved: 'confirmed',
	rejected: 'rejected',
	drone_requested: 'drone',
	// Убранная точка остаётся на карте подтверждённой: карта убранных мест —
	// это и есть результат проекта. Что именно с ней произошло, видно в
	// карточке по вердикту.
	cleaned: 'confirmed'
};

/**
 * К какой ООПТ отнести точку.
 *
 * Бэкенд знает `organization_id`, но территории на фронте — это слои из OSM с
 * собственными id (`kronotsky`), и сопоставить их напрямую нечем. Поэтому
 * определяем по координатам: bbox достаточно — фильтр в списке нужен для
 * навигации, а не для юридических границ.
 */
export function territoryIdFor(
	lon: number,
	lat: number,
	territories: Territory[]
): string | undefined {
	for (const territory of territories) {
		const [[west, south], [east, north]] = territory.bounds as [[number, number], [number, number]];
		if (lon >= west && lon <= east && lat >= south && lat <= north) return territory.id;
	}
	return undefined;
}

/**
 * Точка из личной ленты (`/hypotheses/my`).
 *
 * Лента — урезанная проекция `HypothesisOut`: смета и коэффициенты уборки —
 * рабочие данные ООПТ, автору точки они не нужны. Зато есть судьба точки:
 * назначено ли по ней мероприятие. Для автора это главный ответ на «а что
 * дальше», и он попадает в вердикт карточки.
 */
export function hypothesisToReport(
	item: MyHypothesis,
	territories: Territory[],
	authorName: string
): Report {
	const territoryId = territoryIdFor(item.lon, item.lat, territories) ?? territories[0]?.id ?? '';
	const cleaned = item.status === 'cleaned';
	const event =
		item.event_id != null
			? {
					id: item.event_id,
					date: (item.event_scheduled_at ?? item.created_at).slice(0, 10),
					signed: 0
				}
			: undefined;

	return {
		id: item.id,
		territoryId,
		kind: 'trash',
		source: 'field',
		title: item.description.slice(0, 60) || 'Наблюдение',
		note: item.description,
		author: authorName,
		createdAt: (item.created_at ?? new Date().toISOString()).slice(0, 10),
		status: STATUS[item.status] ?? 'pending',
		verdict: cleaned
			? 'Убрано'
			: (item.reject_reason ?? (item.event_id ? 'По точке назначена уборка' : undefined)),
		event,
		geometry: { type: 'Point', coordinates: [item.lon, item.lat] }
	};
}

type MapFeature = {
	geometry?: { type?: string; coordinates?: unknown } | null;
	// Поля необязательные и нулевые: так их описывает сгенерированная из
	// OpenAPI схема `GeoJSONProperties`, и сужать тип здесь значит соврать.
	properties?: {
		id?: string | null;
		layer?: string | null;
		status?: string | null;
		description?: string | null;
	} | null;
};

/**
 * Подтверждённые точки со слоя `/map/layers` — то, что видно всем.
 *
 * Полигоны ООПТ из того же ответа пропускаем: территории фронт рисует из
 * своего файла, и вторая копия границ поверх первой только рябит.
 */
export function mapLayersToReports(
	collection: { features?: MapFeature[] } | null | undefined,
	territories: Territory[]
): Report[] {
	return (collection?.features ?? [])
		.filter((f) => f.properties?.layer !== 'oopt_territory')
		.filter((f) => f.geometry?.type === 'Point')
		.map((f) => {
			const [lon, lat] = (f.geometry!.coordinates as [number, number]) ?? [0, 0];
			const description = f.properties?.description ?? 'Подтверждённое наблюдение';
			return {
				id: f.properties?.id ?? `${lon},${lat}`,
				territoryId: territoryIdFor(lon, lat, territories) ?? territories[0]?.id ?? '',
				kind: 'trash' as const,
				source: 'field' as const,
				title: description.slice(0, 60),
				note: description,
				author: 'Волонтёр программы',
				createdAt: new Date().toISOString().slice(0, 10),
				status: (STATUS[f.properties?.status ?? 'approved'] ?? 'confirmed') as ReportStatus,
				geometry: { type: 'Point' as const, coordinates: [lon, lat] as [number, number] }
			};
		});
}
