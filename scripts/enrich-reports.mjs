import { readFile, writeFile } from 'node:fs/promises';
import { simplifyGeometry } from './simplify.mjs';

const UA = 'kosmo-hackathon-prototype/0.1 (chistyi-bereg)';
const NOMINATIM = 'https://nominatim.openstreetmap.org';
const OSRM = 'https://router.project-osrm.org';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function nominatim(path, params) {
	const url = new URL(`${NOMINATIM}/${path}`);
	for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
	const response = await fetch(url, { headers: { 'User-Agent': UA } });
	if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
	await sleep(1100);
	return response.json();
}

function distanceKm([lng1, lat1], [lng2, lat2]) {
	const meanLat = ((lat1 + lat2) / 2) * (Math.PI / 180);
	const dx = (lng2 - lng1) * Math.cos(meanLat);
	const dy = lat2 - lat1;
	return Math.sqrt(dx * dx + dy * dy) * 111.32;
}

function boundsCenter([[west, south], [east, north]]) {
	return [(west + east) / 2, (south + north) / 2];
}

function expand([[west, south], [east, north]], degrees) {
	return [
		[west - degrees, south - degrees],
		[east + degrees, north + degrees]
	];
}

async function nearestCity(bounds) {
	const center = boundsCenter(bounds);

	for (const padding of [0.15, 0.5, 1.2]) {
		const [[west, south], [east, north]] = expand(bounds, padding);
		const results = await nominatim('search', {
			q: 'город',
			format: 'json',
			featureType: 'city',
			limit: '10',
			'accept-language': 'ru',
			viewbox: `${west},${north},${east},${south}`,
			bounded: '1'
		});

		if (!results.length) continue;

		const sorted = results
			.map((city) => ({
				name: city.name,
				coordinates: [Number(city.lon), Number(city.lat)],
				distance: distanceKm(center, [Number(city.lon), Number(city.lat)])
			}))
			.sort((a, b) => a.distance - b.distance);

		return sorted[0];
	}

	return null;
}

async function placeName([lng, lat]) {
	const data = await nominatim('reverse', {
		lat: String(lat),
		lon: String(lng),
		format: 'json',
		zoom: '14',
		'accept-language': 'ru'
	});

	const address = data?.address ?? {};
	const local =
		address.village ??
		address.hamlet ??
		address.town ??
		address.suburb ??
		address.city_district ??
		address.city ??
		address.municipality;
	const county = address.county ?? address.state_district ?? address.state;

	if (local && county && local !== county) return `${local}, ${county}`;
	return local ?? county ?? data?.name ?? null;
}

async function route(from, to) {
	const url = `${OSRM}/route/v1/driving/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=geojson`;
	const response = await fetch(url, { headers: { 'User-Agent': UA } });
	await sleep(400);

	if (!response.ok) return null;
	const data = await response.json();
	const found = data?.routes?.[0];
	if (!found) return null;

	return {
		km: Math.round(found.distance / 100) / 10,
		minutes: Math.round(found.duration / 60),
		geometry: simplifyGeometry(found.geometry, 0.002)
	};
}

const territories = JSON.parse(await readFile('static/data/territories.json', 'utf8'));
const reports = JSON.parse(await readFile('static/data/reports.json', 'utf8'));

function centroid(geometry) {
	if (geometry.type === 'Point') return geometry.coordinates;
	const ring = geometry.coordinates[0].slice(0, -1);
	const sum = ring.reduce((acc, [lng, lat]) => [acc[0] + lng, acc[1] + lat], [0, 0]);
	return [sum[0] / ring.length, sum[1] / ring.length];
}

const cities = new Map();

for (const territory of territories.features) {
	const { id, name, bounds } = territory.properties;
	const city = await nearestCity(bounds);

	if (!city) {
		console.warn(`! ${name}: ближайший город не найден`);
		continue;
	}

	cities.set(id, city);
	console.log(
		`\n${name}: ближайший город — ${city.name} (${Math.round(city.distance)} км по прямой)`
	);
}

let enriched = 0;
let routed = 0;

for (const report of reports) {
	const point = centroid(report.geometry);

	report.place = await placeName(point);

	const city = cities.get(report.territoryId);
	if (city) {
		const found = await route(city.coordinates, point);
		if (found) {
			report.route = { from: city.name, ...found };
			routed += 1;
		}
	}

	enriched += 1;
	process.stdout.write(`\r  обработано ${enriched} из ${reports.length}`);
}

await writeFile('static/data/reports.json', JSON.stringify(reports, null, '\t') + '\n');

console.log(`\n\nМест определено: ${reports.filter((r) => r.place).length} из ${reports.length}`);
console.log(`Маршрутов построено: ${routed} из ${reports.length}`);
