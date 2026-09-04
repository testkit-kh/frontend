function scale(lat) {
	return Math.cos((lat * Math.PI) / 180);
}

function project([px, py], [ax, ay], [bx, by], k) {
	const abx = (bx - ax) * k;
	const aby = by - ay;
	const apx = (px - ax) * k;
	const apy = py - ay;

	const lengthSq = abx * abx + aby * aby;
	const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / lengthSq));

	const dx = apx - abx * t;
	const dy = apy - aby * t;
	return dx * dx + dy * dy;
}

function side([px, py], [ax, ay], [bx, by], k) {
	return (bx - ax) * k * (py - ay) - (by - ay) * (px - ax) * k;
}

/**
 * @param {[number, number]} point
 * @param {[number, number][][]} lines участки берега
 * @returns {'land' | 'water' | 'unknown'} unknown — берега рядом нет вовсе
 */
export function landOrWater(point, lines) {
	const k = scale(point[1]);
	let best = Infinity;
	let bestSide = 0;

	for (const line of lines) {
		for (let i = 0; i < line.length - 1; i += 1) {
			const distance = project(point, line[i], line[i + 1], k);
			if (distance >= best) continue;
			best = distance;
			bestSide = side(point, line[i], line[i + 1], k);
		}
	}

	if (best === Infinity) return 'unknown';
	return bestSide >= 0 ? 'land' : 'water';
}

export function distanceToCoastKm(point, lines) {
	const k = scale(point[1]);
	let best = Infinity;

	for (const line of lines) {
		for (let i = 0; i < line.length - 1; i += 1) {
			best = Math.min(best, project(point, line[i], line[i + 1], k));
		}
	}

	return best === Infinity ? Infinity : Math.sqrt(best) * 111.32;
}
