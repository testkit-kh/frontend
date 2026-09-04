import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { countVertices, dropTinyIslands, simplifyToBudget } from './simplify.mjs';

const UA = 'kosmo-hackathon-prototype/0.1 (https://github.com/, chistyi-bereg)';
const ENDPOINT = 'https://nominatim.openstreetmap.org/search';

// Реальная география проекта «Чистый берег» (с сайта Фонда защитников природы).
// Утриш / Сочи из прототипа убраны — в проекте их нет.
// waterBody важен: буферная зона строится от берега моря ИЛИ озера.
const TERRITORIES = [
	// --- Камчатский край -------------------------------------------------
	{
		id: 'kronotsky',
		query: 'Кроноцкий заповедник',
		short: 'Кроноцкий',
		region: 'Камчатский край',
		waterBody: 'Тихий океан'
	},
	{
		id: 'yuzhno-kamchatsky',
		query: 'Южно-Камчатский заказник',
		short: 'Южно-Камчатский',
		region: 'Камчатский край',
		waterBody: 'Охотское море'
	},
	{
		id: 'komandorsky',
		query: 'Командорский заповедник',
		short: 'Командорский',
		region: 'Камчатский край',
		waterBody: 'Берингово море'
	},
	// --- Чукотский АО ------------------------------------------------------
	{
		id: 'beringia',
		query: 'Национальный парк «Берингия»',
		short: 'Берингия',
		region: 'Чукотский АО',
		waterBody: 'Берингово море'
	},
	// --- Приморский край ---------------------------------------------------
	{
		id: 'zemlya-leoparda',
		query: 'Национальный парк «Земля леопарда»',
		short: 'Земля леопарда',
		region: 'Приморский край',
		waterBody: 'Японское море'
	},
	{
		id: 'dv-morskoy',
		query: 'Дальневосточный морской заповедник',
		short: 'ДВ морской',
		region: 'Приморский край',
		waterBody: 'Японское море'
	},
	{
		id: 'sikhote-alin',
		query: 'Сихотэ-Алинский заповедник',
		short: 'Сихотэ-Алинский',
		region: 'Приморский край',
		waterBody: 'Японское море'
	},
	// --- Магаданская область ------------------------------------------------
	{
		id: 'magadansky',
		query: 'Магаданский заповедник',
		short: 'Магаданский',
		region: 'Магаданская область',
		waterBody: 'Охотское море'
	},
	// --- Сахалинская область ------------------------------------------------
	{
		id: 'kurilsky',
		query: 'Курильский заповедник',
		short: 'Курильский',
		region: 'Сахалинская область',
		waterBody: 'Тихий океан'
	},
	// --- Иркутская область --------------------------------------------------
	{
		id: 'pribaikalsky',
		query: 'Прибайкальский национальный парк',
		short: 'Прибайкальский',
		region: 'Иркутская область',
		waterBody: 'озеро Байкал'
	},
	// --- Ненецкий АО --------------------------------------------------------
	{
		id: 'nenetsky',
		query: 'Ненецкий заповедник',
		short: 'Ненецкий',
		region: 'Ненецкий АО',
		waterBody: 'Печорское море'
	},
	// --- Арктика ------------------------------------------------------------
	{
		id: 'russkaya-arktika',
		query: 'Национальный парк «Русская Арктика»',
		short: 'Русская Арктика',
		region: 'Архангельская область',
		waterBody: 'Баренцево море, Северный Ледовитый океан'
	},
	// --- Ленинградская область ----------------------------------------------
	{
		id: 'nizhne-svirsky',
		query: 'Нижне-Свирский заповедник',
		short: 'Нижне-Свирский',
		region: 'Ленинградская область',
		waterBody: 'Ладожское озеро'
	},
	// --- Карелия -------------------------------------------------------------
	{
		id: 'ladozhskie-shhery',
		query: 'Национальный парк «Ладожские шхеры»',
		short: 'Ладожские шхеры',
		region: 'Республика Карелия',
		waterBody: 'Ладожское озеро'
	},
	// --- Калининградская область ---------------------------------------------
	{
		id: 'kurshskaya-kosa',
		query: 'Национальный парк «Куршская коса»',
		short: 'Куршская коса',
		region: 'Калининградская область',
		waterBody: 'Балтийское море'
	},
	// --- Архангельская область ------------------------------------------------
	{
		id: 'onezhskoe-pomorie',
		query: 'Национальный парк «Онежское Поморье»',
		short: 'Онежское Поморье',
		region: 'Архангельская область',
		waterBody: 'Белое море'
	},
	// --- Мурманская область ----------------------------------------------------
	{
		id: 'kandalakshsky',
		query: 'Кандалакшский заповедник',
		short: 'Кандалакшский',
		region: 'Мурманская область',
		waterBody: 'Белое море, Баренцево море'
	},
	{
		id: 'teriberka',
		query: 'Природный парк «Териберка»',
		short: 'Териберка',
		region: 'Мурманская область',
		waterBody: 'Баренцево море'
	},
	// --- Дагестан ---------------------------------------------------------------
	{
		id: 'dagestansky',
		query: 'Дагестанский заповедник',
		short: 'Дагестанский',
		region: 'Республика Дагестан',
		waterBody: 'Каспийское море'
	},
	{
		id: 'samursky',
		query: 'Самурский национальный парк',
		short: 'Самурский',
		region: 'Республика Дагестан',
		waterBody: 'Каспийское море'
	}
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Сырые ответы Nominatim кешируются: подбор упрощения — итеративный процесс,
// а долбить публичный сервис одним и тем же запросом невежливо и медленно.
const CACHE_PATH = 'scripts/.cache/territories-raw.json';

async function loadCache() {
	try {
		return JSON.parse(await readFile(CACHE_PATH, 'utf-8'));
	} catch {
		return {};
	}
}

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
const missing = [];
const cache = await loadCache();

for (const territory of TERRITORIES) {
	let hit = cache[territory.id];

	if (!hit) {
		hit = pickPolygon(await search(territory.query)) ?? null;
		cache[territory.id] = hit;
		await sleep(1100);
	}

	if (!hit) {
		missing.push(territory.short);
		console.warn(`! ${territory.query}: полигон не найден, пропускаем`);
		continue;
	}

	// Бюджет вершин на территорию: файл грузится на каждой сессии, а границы
	// нужны для попадания точки в зону, не для кадастровой точности.
	const VERTEX_BUDGET = 1200;
	// Архипелаги (Ладожские шхеры — тысячи островов) не укладываются в бюджет
	// одним лишь допуском: площадь размазана, ни один остров не доминирует.
	// Оставляем 120 крупнейших — для попадания точки в зону этого достаточно.
	const MAX_ISLANDS = 120;
	const trimmed = dropTinyIslands(hit.geojson, 0.98, MAX_ISLANDS);
	const { geometry, tolerance, overBudget } = simplifyToBudget(trimmed, VERTEX_BUDGET);

	features.push({
		type: 'Feature',
		id: territory.id,
		properties: {
			id: territory.id,
			name: territory.short,
			fullName: hit.display_name.split(',').slice(0, 2).join(',').trim(),
			region: territory.region,
			waterBody: territory.waterBody,
			bounds: toBounds(hit.boundingbox),
			source: `OSM ${hit.osm_type}/${hit.osm_id}`
		},
		geometry
	});

	console.log(
		`+ ${territory.short}: ${geometry.type}, ${countVertices(hit.geojson)} → ${countVertices(geometry)} вершин ` +
			`(допуск ${tolerance.toFixed(5)}${overBudget ? ', СВЕРХ БЮДЖЕТА' : ''}), OSM ${hit.osm_type}/${hit.osm_id}`
	);
}

await mkdir('scripts/.cache', { recursive: true });
await writeFile(CACHE_PATH, JSON.stringify(cache));

await mkdir('static/data', { recursive: true });
await writeFile(
	'static/data/territories.json',
	JSON.stringify({ type: 'FeatureCollection', features }, null, '\t') + '\n'
);

console.log(`\nЗаписано ${features.length} территорий в static/data/territories.json`);
