import type { Report } from '$lib/types';

export function toAreas(items: Report[]) {
	return {
		type: 'FeatureCollection' as const,
		features: items
			.filter((report) => report.geometry.type === 'Polygon')
			.map((report, index) => ({
				type: 'Feature' as const,
				id: index,
				properties: { id: report.id, status: report.status, kind: report.kind },
				geometry: report.geometry as GeoJSON.Geometry
			}))
	};
}

export function centroid(report: Report): [number, number] {
	if (report.geometry.type === 'Point') return report.geometry.coordinates;
	const points = report.geometry.coordinates[0].slice(0, -1);
	const sum = points.reduce((acc, [lng, lat]) => [acc[0] + lng, acc[1] + lat], [0, 0]);
	return [sum[0] / points.length, sum[1] / points.length];
}

/**
 * Точки-«булавки» территорий для обзора страны.
 *
 * На масштабе всей страны сами полигоны ООПТ вырождаются в пиксель, а
 * отдельные точки загрязнения сливаются в кашу. Поэтому в обзоре показываем
 * по одной метке на территорию с числом открытых точек: это и легенда, и
 * навигация — клик уводит внутрь территории.
 */
export function territoryPins(
	territories: { id: string; name: string; bounds: unknown }[],
	health: Map<string, { open: number; total: number; mood: string }>
) {
	return {
		type: 'FeatureCollection' as const,
		features: territories.map((territory) => {
			const [[west, south], [east, north]] = territory.bounds as [
				[number, number],
				[number, number]
			];
			const state = health.get(territory.id);
			return {
				type: 'Feature' as const,
				properties: {
					id: territory.id,
					name: territory.name,
					open: state?.open ?? 0,
					total: state?.total ?? 0,
					mood: state?.mood ?? 'clean'
				},
				geometry: {
					type: 'Point' as const,
					// Центр рамки территории: настоящий центроид многоконтурного
					// полигона считать здесь незачем — метка всё равно условная.
					coordinates: [(west + east) / 2, (south + north) / 2] as [number, number]
				}
			};
		})
	};
}
