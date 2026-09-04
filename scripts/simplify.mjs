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

function simplifyRing(points, tolerance) {
	const result = simplifyLine(points, tolerance);
	if (result.length < 4) return points;
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
