import { readFile, writeFile } from 'node:fs/promises';
import { distanceToCoastKm, landOrWater } from './coastline.mjs';

function rng(seed) {
	let state = seed;
	return () => {
		state |= 0;
		state = (state + 0x6d2b79f5) | 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const random = rng(20260904);
const pick = (list) => list[Math.floor(random() * list.length)];

const TRASH_TITLES = [
	'Свалка после шторма',
	'Пластик и сети на галечном пляже',
	'Мешки у съезда к морю',
	'Кострища и стекло на стоянке',
	'Навал грунта у грунтовой дороги',
	'Покрышки в овраге',
	'Стихийная свалка у кордона',
	'Бытовой мусор на смотровой площадке',
	'Обрывки сетей и буи на камнях',
	'Строительный мусор у поворота'
];

const SPILL_TITLES = [
	'Мазутное пятно у мыса',
	'Плёнка в бухте',
	'Тёмная полоса вдоль берега',
	'Радужный отлив у причала',
	'Мутное пятно после дождей'
];

const TRASH_NOTES = [
	'Пластик, канистры и обрывки сетей вдоль уреза воды, примерно 300 метров пляжа.',
	'Занесло между камнями, руками разобрать реально. Есть фото с геометкой.',
	'Кто-то вывалил мусор прямо у поворота, свежие следы от колёс.',
	'Дикая стоянка, битое стекло по всей площадке.',
	'Светлое пятно неправильной формы, появилось между съёмками.',
	'Подъезд есть, нужна машина под вывоз — руками не унести.'
];

const SPILL_NOTES = [
	'Тёмная полоса вдоль берега на снимке, форма не повторяет облачность.',
	'Радужный отлив на воде рядом со стоянкой катеров. Не уверен, что не тень.',
	'Пятно держится третий день и смещается вдоль берега, а не с облаками.',
	'На соседнем снимке того же дня пятна нет — похоже на свежий сброс.'
];

const AUTHORS = [
	'Алина К.',
	'Тимур В.',
	'Даша Р.',
	'Егор С.',
	'Марк П.',
	'Ксения М.',
	'Пётр Л.',
	'Настя Ж.',
	'Илья Б.',
	'Соня Т.'
];

const CONFIRM_VERDICTS = [
	'Подтверждено выездом инспектора.',
	'Совпало с данными облёта, объём подтверждён.',
	'Подтверждено. Дату субботника согласуем с лесничеством.'
];

const REJECT_VERDICTS = [
	'Это тень от скального выступа: повторяется на всех снимках и смещается по солнцу.',
	'На месте чисто — убрали до нашего выезда.',
	'Пятно оказалось отмелью, видно на снимках за три года.',
	'Точка вне границ ООПТ, передали в муниципалитет.'
];

const DRONE_VERDICTS = [
	'Актуального снимка нет, старый под облаками. Поставили в план облёта.',
	'Разрешения снимка не хватает, чтобы отличить мусор от гальки. Нужен дрон.',
	'Съёмка этого участка старше двух месяцев. Запросили облёт.'
];

function inRing([x, y], ring) {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
		const [xi, yi] = ring[i];
		const [xj, yj] = ring[j];
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
	}
	return inside;
}

function inPolygon(point, rings) {
	if (!inRing(point, rings[0])) return false;
	return rings.slice(1).every((hole) => !inRing(point, hole));
}

function inGeometry(point, geometry) {
	if (geometry.type === 'Polygon') return inPolygon(point, geometry.coordinates);
	return geometry.coordinates.some((rings) => inPolygon(point, rings));
}

const SHORE_KM = 6;

function randomOnShore(geometry, bounds, coast) {
	const [[west, south], [east, north]] = bounds;

	for (let attempt = 0; attempt < 40000; attempt += 1) {
		const point = [west + random() * (east - west), south + random() * (north - south)];
		if (!inGeometry(point, geometry)) continue;
		if (landOrWater(point, coast) !== 'land') continue;
		if (distanceToCoastKm(point, coast) > SHORE_KM) continue;
		return point;
	}

	return null;
}

function randomOffshore(bounds, coast) {
	const [[west, south], [east, north]] = bounds;

	const segments = [];
	for (const line of coast) {
		for (let i = 0; i < line.length - 1; i += 1) {
			const [ax, ay] = line[i];
			if (ax < west || ax > east || ay < south || ay > north) continue;
			segments.push([line[i], line[i + 1]]);
		}
	}

	if (!segments.length) return null;

	for (let attempt = 0; attempt < 200; attempt += 1) {
		const [[ax, ay], [bx, by]] = segments[Math.floor(random() * segments.length)];
		const k = Math.cos((ay * Math.PI) / 180);

		const dx = (bx - ax) * k;
		const dy = by - ay;
		const length = Math.hypot(dx, dy);
		if (length === 0) continue;

		const offset = (0.2 + random() * 1.6) / 111.32;
		const point = [
			ax + (bx - ax) / 2 + ((dy / length) * offset) / k,
			ay + (by - ay) / 2 - (dx / length) * offset
		];

		if (landOrWater(point, coast) === 'water') return point;
	}

	return null;
}

function blob(center, radius) {
	const vertices = 5 + Math.floor(random() * 3);
	const ring = [];
	for (let i = 0; i < vertices; i += 1) {
		const angle = (i / vertices) * Math.PI * 2;
		const distance = radius * (0.55 + random() * 0.65);
		ring.push([
			center[0] + (Math.cos(angle) * distance) / Math.cos((center[1] * Math.PI) / 180),
			center[1] + Math.sin(angle) * distance
		]);
	}
	ring.push(ring[0]);
	return ring;
}

function offshoreBlob(center, coast) {
	let radius = 0.004 + random() * 0.006;

	for (let attempt = 0; attempt < 8; attempt += 1) {
		const ring = blob(center, radius);
		if (ring.every((point) => landOrWater(point, coast) === 'water')) return ring;
		radius *= 0.7;
	}

	return null;
}

function spillGeometry(bounds, coast) {
	for (let attempt = 0; attempt < 30; attempt += 1) {
		const center = randomOffshore(bounds, coast);
		if (!center) return null;
		const ring = offshoreBlob(center, coast);
		if (ring) return { center, ring };
	}
	return null;
}

const TODAY = new Date('2026-09-04');
function daysAgo(days) {
	const date = new Date(TODAY);
	date.setDate(date.getDate() - days);
	return date.toISOString().slice(0, 10);
}

function statusQuota(count) {
	const drone = Math.max(1, Math.round(count * 0.15));
	const rejected = Math.max(1, Math.round(count * 0.12));
	const pending = Math.max(3, Math.round(count * 0.33));
	const confirmed = count - drone - rejected - pending;
	return [
		...Array(confirmed).fill('confirmed'),
		...Array(pending).fill('pending'),
		...Array(drone).fill('drone'),
		...Array(rejected).fill('rejected')
	];
}

function shuffle(list) {
	const result = [...list];
	for (let i = result.length - 1; i > 0; i -= 1) {
		const j = Math.floor(random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

const territories = JSON.parse(await readFile('static/data/territories.json', 'utf8'));
const coastlines = JSON.parse(await readFile('scripts/cache/coastline.json', 'utf8'));
const reports = [];
let counter = 100;

for (const territory of territories.features) {
	const { id, name, bounds } = territory.properties;
	const coast = coastlines[id] ?? [];
	const count = territory.geometry.type === 'MultiPolygon' ? 12 : 9;
	const statuses = shuffle(statusQuota(count));

	for (let i = 0; i < count; i += 1) {
		const kind = random() < 0.28 ? 'spill' : 'trash';
		const status = statuses[i];

		const spill = kind === 'spill' ? spillGeometry(bounds, coast) : null;
		const center =
			kind === 'spill' ? spill?.center : randomOnShore(territory.geometry, bounds, coast);

		if (!center) {
			console.warn(`! ${name}: не удалось разместить ${kind}, пропускаем`);
			continue;
		}

		const verdict =
			status === 'confirmed'
				? pick(CONFIRM_VERDICTS)
				: status === 'rejected'
					? pick(REJECT_VERDICTS)
					: status === 'drone'
						? pick(DRONE_VERDICTS)
						: undefined;

		const event =
			status === 'confirmed' && random() < 0.55
				? { date: daysAgo(-2 - Math.floor(random() * 25)), signed: Math.floor(random() * 45) }
				: undefined;

		counter += 1;
		reports.push({
			id: `r-${counter}`,
			territoryId: id,
			kind,
			source: kind === 'spill' ? 'satellite' : random() < 0.7 ? 'field' : 'satellite',
			title: pick(kind === 'spill' ? SPILL_TITLES : TRASH_TITLES),
			note: pick(kind === 'spill' ? SPILL_NOTES : TRASH_NOTES),
			author: pick(AUTHORS),
			createdAt: daysAgo(1 + Math.floor(random() * 55)),
			status,
			...(verdict ? { verdict } : {}),
			...(event ? { event } : {}),
			geometry:
				kind === 'spill'
					? { type: 'Polygon', coordinates: [spill.ring] }
					: { type: 'Point', coordinates: center.map((n) => Number(n.toFixed(5))) }
		});
	}

	const mine = reports.filter((r) => r.territoryId === id);
	console.log(`+ ${name}: ${mine.length} гипотез`);
}

reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

await writeFile('static/data/reports.json', JSON.stringify(reports, null, '\t') + '\n');

const byStatus = reports.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
console.log(`\nВсего ${reports.length} гипотез:`, byStatus);
