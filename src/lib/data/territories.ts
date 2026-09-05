import type { LngLatBoundsLike } from 'maplibre-gl';

/**
 * Значение «вся страна» для выбора территории.
 *
 * Строка, а не `null`: значение проходит через <select>, который умеет только
 * строки. Префикс с подчёркиваниями исключает совпадение с настоящим id ООПТ.
 */
export const ALL_TERRITORIES = '__all__';

export type Territory = {
	id: string;
	name: string;
	fullName: string;
	region: string;
	/** Море или озеро, к которому примыкает территория. Определяет, от какого
	 *  берега строится прибрежная буферная зона. */
	waterBody: string;
	bounds: LngLatBoundsLike;
	source: string;
	geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
};

type Collection = GeoJSON.FeatureCollection<
	GeoJSON.Polygon | GeoJSON.MultiPolygon,
	Omit<Territory, 'geometry'>
>;

export function parseTerritories(collection: Collection): Territory[] {
	return collection.features.map((feature) => ({
		...feature.properties,
		geometry: feature.geometry
	}));
}

export function territoryFeature(territory: Territory) {
	return {
		type: 'FeatureCollection' as const,
		features: [
			{ type: 'Feature' as const, properties: { id: territory.id }, geometry: territory.geometry }
		]
	};
}

export function territoriesFeature(territories: Territory[]) {
	return {
		type: 'FeatureCollection' as const,
		features: territories.map((territory, index) => ({
			type: 'Feature' as const,
			id: index,
			properties: { id: territory.id },
			geometry: territory.geometry
		}))
	};
}
