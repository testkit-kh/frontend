import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl';
import { STATUS_COLOR } from '$lib/types';

export const SATELLITE_TILES = [
	'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
];

export const MAP_STYLE: StyleSpecification = {
	version: 8,
	sources: {
		satellite: {
			type: 'raster',
			tiles: SATELLITE_TILES,
			tileSize: 256,
			maxzoom: 19,
			attribution: 'Снимки © Esri, Maxar, Earthstar Geographics'
		},
		labels: {
			type: 'raster',
			tiles: ['a', 'b', 'c'].map(
				(host) => `https://${host}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{ratio}.png`
			),
			tileSize: 256,
			maxzoom: 19,
			attribution: '© OpenStreetMap, © CARTO'
		}
	},
	layers: [
		{ id: 'background', type: 'background', paint: { 'background-color': '#0f2231' } },
		{ id: 'satellite', type: 'raster', source: 'satellite' },
		{
			id: 'labels',
			type: 'raster',
			source: 'labels',
			minzoom: 6,
			paint: { 'raster-opacity': 0.55 }
		}
	]
};

export const FIT_PADDING = 48;

export const hovered: ExpressionSpecification = ['boolean', ['feature-state', 'hover'], false];

export const STATUS_MATCH: ExpressionSpecification = [
	'match',
	['get', 'status'],
	'confirmed',
	STATUS_COLOR.confirmed,
	'pending',
	STATUS_COLOR.pending,
	'drone',
	STATUS_COLOR.drone,
	STATUS_COLOR.rejected
];
