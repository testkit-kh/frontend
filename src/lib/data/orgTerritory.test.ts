import { describe, expect, it } from 'vitest';
import {
	resolveStaffTerritorySlug,
	territorySlugForOrgName,
	territorySlugForOsmId
} from './orgTerritory';
import type { Territory } from './territories';

const territories = [
	{
		id: 'kronotsky',
		name: 'Кроноцкий',
		fullName: 'Кроноцкий заповедник, Камчатский край',
		region: 'Камчатский край',
		waterBody: 'Тихий океан',
		bounds: [
			[0, 0],
			[1, 1]
		],
		source: 'OSM relation/2800189',
		geometry: { type: 'Polygon', coordinates: [] }
	},
	{
		id: 'komandorsky',
		name: 'Командорский',
		fullName: 'Командорский заповедник, Камчатский край',
		region: 'Камчатский край',
		waterBody: 'Берингово море',
		bounds: [
			[0, 0],
			[1, 1]
		],
		source: 'OSM relation/5576397',
		geometry: { type: 'Polygon', coordinates: [] }
	}
] as Territory[];

describe('territorySlugForOrgName', () => {
	it('matches short name', () => {
		expect(territorySlugForOrgName('Кроноцкий', territories)).toBe('kronotsky');
	});

	it('matches full org-style name', () => {
		expect(
			territorySlugForOrgName('Кроноцкий государственный природный заповедник', territories)
		).toBe('kronotsky');
	});

	it('matches quoted national park style', () => {
		expect(
			territorySlugForOrgName('Национальный парк «Берингия»', [
				{
					...territories[0],
					id: 'beringia',
					name: 'Берингия',
					fullName: 'Национальный парк «Берингия», Чукотский автономный округ'
				}
			])
		).toBe('beringia');
	});

	it('returns null for unknown org', () => {
		expect(territorySlugForOrgName('Утриш', territories)).toBeNull();
		expect(territorySlugForOrgName('ООО ОЛЕГ', territories)).toBeNull();
	});

	it('returns null for empty input', () => {
		expect(territorySlugForOrgName('', territories)).toBeNull();
		expect(territorySlugForOrgName(null, [])).toBeNull();
	});
});

describe('territorySlugForOsmId', () => {
	it('matches relation id from organization field', () => {
		expect(territorySlugForOsmId('relation/2800189', territories)).toBe('kronotsky');
	});

	it('matches when source has OSM prefix', () => {
		expect(territorySlugForOsmId('OSM relation/5576397', territories)).toBe('komandorsky');
	});

	it('returns null for unknown osm id', () => {
		expect(territorySlugForOsmId('relation/999', territories)).toBeNull();
	});
});

describe('resolveStaffTerritorySlug', () => {
	it('prefers osm id over name', () => {
		expect(
			resolveStaffTerritorySlug(
				{ name: 'ООО ОЛЕГ', territory_osm_id: 'relation/5576397', has_territory: true },
				territories
			)
		).toBe('komandorsky');
	});

	it('falls back to name when osm missing', () => {
		expect(
			resolveStaffTerritorySlug({ name: 'Кроноцкий', territory_osm_id: null }, territories)
		).toBe('kronotsky');
	});

	it('returns null when neither matches — no silent first-territory fallback', () => {
		expect(
			resolveStaffTerritorySlug(
				{ name: 'ООО ОЛЕГ', territory_osm_id: null, has_territory: false },
				territories
			)
		).toBeNull();
	});
});
