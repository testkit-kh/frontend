export const DEFAULT_TOLERANCE = 0.0005;

function sqSegmentDistance([px, py], [ax, ay], [bx, by]) {
	let x = ax;
	let y = ay;
	let dx = bx - ax;
	let dy = by - ay;

	if (dx !== 0 || dy !== 0) {
		const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
		if (t > 1) {
			x = bx;
			y = by;
		} else if (t > 0) {
			x += dx * t;
			y += dy * t;
		}
	}

	dx = px - x;
	dy = py - y;
	return dx * dx + dy * dy;
}

export function simplifyLine(points, tolerance = DEFAULT_TOLERANCE) {
	if (points.length <= 2) return points;
	const sqTolerance = tolerance * tolerance;

	const keep = new Uint8Array(points.length);
	keep[0] = 1;
	keep[points.length - 1] = 1;

	const stack = [[0, points.length - 1]];
	while (stack.length) {
		const [first, last] = stack.pop();
		let index = -1;
		let maxDistance = sqTolerance;

		for (let i = first + 1; i < last; i += 1) {
			const distance = sqSegmentDistance(points[i], points[first], points[last]);
			if (distance > maxDistance) {
				index = i;
				maxDistance = distance;
			}
		}

		if (index === -1) continue;
		keep[index] = 1;
		stack.push([first, index], [index, last]);
	}

	return points.filter((_, i) => keep[i]);
}

function bboxRing(points) {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const [x, y] of points) {
		if (x < minX) minX = x;
		if (y < minY) minY = y;
		if (x > maxX) maxX = x;
		if (y > maxY) maxY = y;
	}
	return [
		[minX, minY],
		[maxX, minY],
		[maxX, maxY],
		[minX, maxY],
		[minX, minY]
	];
}

function simplifyRing(points, tolerance) {
	const result = simplifyLine(points, tolerance);
	// Кольцо схлопнулось — значит оно меньше допуска. Возвращать исходное
	// нельзя: тогда рост допуска УВЕЛИЧИВАЕТ число вершин (каждый мелкий
	// островок откатывается к полной детализации). Отдаём габаритный
	// прямоугольник: остров остаётся на карте, детализация уходит.
	if (result.length < 4) return bboxRing(points);
	const [firstX, firstY] = result[0];
	const [lastX, lastY] = result[result.length - 1];
	return firstX === lastX && firstY === lastY ? result : [...result, result[0]];
}

export function simplifyGeometry(geometry, tolerance = DEFAULT_TOLERANCE) {
	if (geometry.type === 'LineString') {
		return { ...geometry, coordinates: simplifyLine(geometry.coordinates, tolerance) };
	}
	if (geometry.type === 'Polygon') {
		return {
			...geometry,
			coordinates: geometry.coordinates.map((ring) => simplifyRing(ring, tolerance))
		};
	}
	return {
		...geometry,
		coordinates: geometry.coordinates.map((poly) =>
			poly.map((ring) => simplifyRing(ring, tolerance))
		)
	};
}

export function countVertices(geometry) {
	if (geometry.type === 'LineString') return geometry.coordinates.length;
	if (geometry.type === 'Polygon') {
		return geometry.coordinates.reduce((sum, ring) => sum + ring.length, 0);
	}
	return geometry.coordinates.reduce(
		(sum, poly) => sum + poly.reduce((inner, ring) => inner + ring.length, 0),
		0
	);
}

/**
 * Приблизительная площадь кольца в кв. градусах (формула шнурков).
 * Нужна только для сравнения колец между собой, не для реальных измерений.
 */
function ringArea(points) {
	let sum = 0;
	for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
		sum += (points[j][0] - points[i][0]) * (points[j][1] + points[i][1]);
	}
	return Math.abs(sum) / 2;
}

/**
 * Убирает из MultiPolygon самые мелкие острова, оставляя те, что в сумме
 * дают `keepShare` общей площади. Для шхер с тысячами островков это
 * единственный способ уложиться в бюджет вершин, не превращая берег в кашу.
 */
export function dropTinyIslands(geometry, keepShare = 0.98, maxPolygons = Infinity) {
	if (geometry.type !== 'MultiPolygon') return geometry;

	const polys = geometry.coordinates
		.map((poly) => ({ poly, area: ringArea(poly[0]) }))
		.sort((a, b) => b.area - a.area);

	const total = polys.reduce((sum, p) => sum + p.area, 0);
	if (total === 0) return geometry;

	const kept = [];
	let accumulated = 0;
	for (const { poly, area } of polys) {
		if (kept.length >= maxPolygons) break;
		kept.push(poly);
		accumulated += area;
		if (accumulated / total >= keepShare) break;
	}

	return { ...geometry, coordinates: kept };
}

/**
 * Упрощает геометрию до заданного числа вершин, повышая допуск, пока не
 * уложится. Фиксированный допуск не годится: Куршская коса — 34 вершины,
 * Ладожские шхеры — 56 тысяч.
 */
export function simplifyToBudget(
	geometry,
	budget,
	{ startTolerance = DEFAULT_TOLERANCE, maxTolerance = 0.005 } = {}
) {
	let tolerance = startTolerance;
	let result = simplifyGeometry(geometry, tolerance);

	// Потолок допуска — примерно 500 м. Дальше упрощать бессмысленно: граница
	// ООПТ, сдвинутая на километры, перестаёт отвечать на вопрос «точка внутри
	// территории или нет», ради которого она и нужна. Изрезанные берега
	// (Ладожские шхеры) в бюджет не уложатся — и это честнее, чем показать
	// вымышленный контур.
	while (countVertices(result) > budget && tolerance < maxTolerance) {
		tolerance = Math.min(tolerance * 1.7, maxTolerance);
		result = simplifyGeometry(geometry, tolerance);
		if (tolerance >= maxTolerance) break;
	}

	return { geometry: result, tolerance, overBudget: countVertices(result) > budget };
}
