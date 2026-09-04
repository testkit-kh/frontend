import { describe, expect, it } from 'vitest';
import { formatCoords, plural } from './format';

describe('plural', () => {
	it('picks "one" for numbers ending in 1 (except 11)', () => {
		expect(plural(1, 'день', 'дня', 'дней')).toBe('день');
		expect(plural(21, 'день', 'дня', 'дней')).toBe('день');
	});

	it('picks "few" for numbers ending in 2-4 (except 12-14)', () => {
		expect(plural(2, 'день', 'дня', 'дней')).toBe('дня');
		expect(plural(23, 'день', 'дня', 'дней')).toBe('дня');
	});

	it('picks "many" for numbers ending in 0, 5-9, or 11-14', () => {
		expect(plural(5, 'день', 'дня', 'дней')).toBe('дней');
		expect(plural(11, 'день', 'дня', 'дней')).toBe('дней');
	});
});

describe('formatCoords', () => {
	it('formats [lng, lat] as "lat, lng" with 5 decimal places', () => {
		expect(formatCoords([37.6173, 55.7558])).toBe('55.75580, 37.61730');
	});
});
