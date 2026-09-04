import { writeFile, mkdir } from 'node:fs/promises';
import { countVertices, simplifyGeometry } from './simplify.mjs';

const UA = 'kosmo-hackathon-prototype/0.1 (https://github.com/, chistyi-bereg)';
const ENDPOINT = 'https://nominatim.openstreetmap.org/search';

const TERRITORIES = [
	{ id: 'utrish', query: 'Заповедник «Утриш»', short: 'Утриш', region: 'Краснодарский край' },
	{
		id: 'kurshskaya-kosa',
		query: 'Национальный парк «Куршская коса»',
		short: 'Куршская коса',
		region: 'Калининградская область'
	},
	{
		id: 'sochi',
		query: 'Сочинский национальный парк',
		short: 'Сочинский НП',
		region: 'Краснодарский край'
	},
	{
		id: 'zemlya-leoparda',
		query: 'Национальный парк «Земля леопарда»',
		short: 'Земля леопарда',
		region: 'Приморский край'
	}
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function search(query) {
	const url = new URL(ENDPOINT);
	url.searchParams.set('q', query);
	url.searchParams.set('format', 'json');
	url.searchParams.set('polygon_geojson', '1');
	url.searchParams.set('limit', '5');
	url.searchParams.set('accept-language', 'ru');

	const response = await fetch(url, { headers: { 'User-Agent': UA } });
	if (!response.ok) throw new Error(`${query}: HTTP ${response.status}`);
	return response.json();
}

function pickPolygon(results) {
	return results.find(
		(item) => item.geojson?.type === 'Polygon' || item.geojson?.type === 'MultiPolygon'
	);
}

function toBounds(box) {
	const [south, north, west, east] = box.map(Number);
	return [
		[west, south],
		[east, north]
	];
}

const features = [];

for (const territory of TERRITORIES) {
	const results = await search(territory.query);
	const hit = pickPolygon(results);

	if (!hit) {
		console.warn(`! ${territory.query}: полигон не найден, пропускаем`);
		continue;
	}

	const geometry = simplifyGeometry(hit.geojson);

	features.push({
		type: 'Feature',
		id: territory.id,
		properties: {
			id: territory.id,
			name: territory.short,
			fullName: hit.display_name.split(',').slice(0, 2).join(',').trim(),
			region: territory.region,
			bounds: toBounds(hit.boundingbox),
			source: `OSM ${hit.osm_type}/${hit.osm_id}`
		},
		geometry
	});

	console.log(
		`+ ${territory.short}: ${geometry.type}, ${countVertices(hit.geojson)} → ${countVertices(geometry)} вершин, OSM ${hit.osm_type}/${hit.osm_id}`
	);
	await sleep(1100);
}

await mkdir('static/data', { recursive: true });
await writeFile(
	'static/data/territories.json',
	JSON.stringify({ type: 'FeatureCollection', features }, null, '\t') + '\n'
);

console.log(`\nЗаписано ${features.length} территорий в static/data/territories.json`);
