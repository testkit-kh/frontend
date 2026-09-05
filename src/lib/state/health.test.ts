import { describe, expect, it } from 'vitest';
import { DIRTY_THRESHOLD, healthByTerritory, overallMood, territoryHealth } from './health';
import type { Report, ReportStatus } from '$lib/types';

function report(territoryId: string, status: ReportStatus, id = crypto.randomUUID()): Report {
	return {
		id,
		territoryId,
		kind: 'trash',
		source: 'field',
		title: 'Тест',
		note: '',
		author: 'Тестов Т.',
		createdAt: '2026-09-01',
		status,
		geometry: { type: 'Point', coordinates: [160, 54] }
	};
}

describe('territoryHealth', () => {
	it('не считает отклонённые точки открытыми', () => {
		const items = [
			report('kronotsky', 'rejected'),
			report('kronotsky', 'rejected'),
			report('kronotsky', 'pending')
		];

		expect(territoryHealth(items, 'kronotsky')).toEqual({ open: 1, total: 3, mood: 'clean' });
	});

	it('считает открытыми и подтверждённые: мусор подтверждён, но лежит на месте', () => {
		const items = Array.from({ length: DIRTY_THRESHOLD }, () => report('kronotsky', 'confirmed'));

		expect(territoryHealth(items, 'kronotsky').mood).toBe('dirty');
	});

	it('хмурится ровно на пороге, не раньше', () => {
		const below = Array.from({ length: DIRTY_THRESHOLD - 1 }, () => report('teriberka', 'pending'));

		expect(territoryHealth(below, 'teriberka').mood).toBe('clean');
		expect(territoryHealth([...below, report('teriberka', 'pending')], 'teriberka').mood).toBe(
			'dirty'
		);
	});

	it('не учитывает точки соседних территорий', () => {
		const items = [
			...Array.from({ length: DIRTY_THRESHOLD }, () => report('samursky', 'pending')),
			report('kronotsky', 'pending')
		];

		expect(territoryHealth(items, 'kronotsky')).toEqual({ open: 1, total: 1, mood: 'clean' });
	});

	it('пустая территория считается чистой', () => {
		expect(territoryHealth([], 'kronotsky')).toEqual({ open: 0, total: 0, mood: 'clean' });
	});
});

describe('healthByTerritory', () => {
	it('разносит точки по территориям', () => {
		const items = [
			report('kronotsky', 'pending'),
			report('kronotsky', 'rejected'),
			report('teriberka', 'confirmed')
		];

		const health = healthByTerritory(items);

		expect(health.get('kronotsky')).toEqual({ open: 1, total: 2, mood: 'clean' });
		expect(health.get('teriberka')).toEqual({ open: 1, total: 1, mood: 'clean' });
	});

	it('территории без точек в результат не попадают', () => {
		expect(healthByTerritory([report('kronotsky', 'pending')]).has('teriberka')).toBe(false);
	});
});

describe('overallMood', () => {
	it('без данных страна считается чистой, а не грязной', () => {
		expect(overallMood([])).toBe('clean');
	});

	it('одна проблемная территория из четырёх картины не меняет', () => {
		const items = [
			...Array.from({ length: DIRTY_THRESHOLD }, () => report('kronotsky', 'pending')),
			report('teriberka', 'pending'),
			report('samursky', 'pending'),
			report('kurshskaya-kosa', 'pending')
		];

		expect(overallMood(items)).toBe('clean');
	});

	it('треть проблемных территорий — уже повод хмуриться', () => {
		const items = [
			...Array.from({ length: DIRTY_THRESHOLD }, () => report('kronotsky', 'pending')),
			...Array.from({ length: DIRTY_THRESHOLD }, () => report('teriberka', 'pending')),
			report('samursky', 'pending'),
			report('kurshskaya-kosa', 'pending')
		];

		expect(overallMood(items)).toBe('dirty');
	});
});
