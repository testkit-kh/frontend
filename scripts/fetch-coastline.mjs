import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { simplifyLine } from './simplify.mjs';

const MIRRORS = [
	'https://overpass-api.de/api/interpreter',
	'https://overpass.kumi.systems/api/interpreter',
	'https://overpass.private.coffee/api/interpreter'
];

const UA = 'kosmo-hackathon-prototype/0.1 (chistyi-bereg)';

const PADDING = 0.25;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ask(query) {
	let lastError = 'неизвестно';

	for (let attempt = 0; attempt < 2; attempt += 1) {
		for (const mirror of MIRRORS) {
			try {
				const response = await fetch(mirror, {
					method: 'POST',
					headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
					body: new URLSearchParams({ data: query })
				});

				if (response.ok) return response.json();
				lastError = `HTTP ${response.status}`;
			} catch (error) {
				lastError = String(error);
			}

			console.warn(`  ${new URL(mirror).host}: ${lastError}, пробуем дальше`);
			await sleep(3000);
		}
	}

	throw new Error(`Overpass недоступен: ${lastError}`);
}

async function coastlineIn([[west, south], [east, north]]) {
	const bbox = [south - PADDING, west - PADDING, north + PADDING, east + PADDING].join(',');
	const query = `[out:json][timeout:90];way["natural"="coastline"](${bbox});out geom;`;

	const data = await ask(query);

	return data.elements
		.filter((element) => element.geometry?.length >= 2)
		.map((element) =>
			simplifyLine(
				element.geometry.map((node) => [node.lon, node.lat]),
				0.0002
			)
		);
}

const territories = JSON.parse(await readFile('static/data/territories.json', 'utf8'));
const result = {};

for (const territory of territories.features) {
	const { id, name, bounds } = territory.properties;
	const lines = await coastlineIn(bounds);
	result[id] = lines;

	const nodes = lines.reduce((sum, line) => sum + line.length, 0);
	console.log(`+ ${name}: ${lines.length} участков берега, ${nodes} точек`);

	await sleep(2000);
}

await mkdir('scripts/cache', { recursive: true });
await writeFile('scripts/cache/coastline.json', JSON.stringify(result) + '\n');

console.log('\nЗаписано в scripts/cache/coastline.json');
