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
