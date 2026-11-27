/**
 * ⛓ CONTENT SETS GEN-1 — the region-biome table and the world's maze-biome setting (`mazeRegionBiomes.js`):
 * the setting normalised or refused by name at settings time, the per-room mix picked by hash (no rng), a region
 * biome handed to the engine as its base, and sized as its base.
 */
import { describe, it, expect } from 'vitest';

import {
    MAZE_BIOME_KEY, MAZE_BIOME_SEED_KEY, MazeBiomeSettingError, REGION_BIOMES, TILE_KINDS_DOMAINS, TILE_KINDS_KEY,
    engineBiomeOf, isRegionBiome, mazeBiomeIds, mazeBiomeRegionParams, normalizeMazeBiomeSetting, pickMazeBiome,
    placesTileKinds, regionBiomeOf, resolvedTileKinds,
} from './mazeRegionBiomes.js';
import { BIOMES, DEFAULT_BIOME_ID, kindsOffered } from '../procgenCore/skeletonKinds.js';
import { mazeCapacityAt, mazeRoomIsOpen } from './mazeLocationCapacity.js';

describe('GEN-1 — the region biomes', () => {
    it('scattered is "Randomly placed tiles" on classic walls, with 5% / cap 8 / min 1, and is NOT a skeleton kind', () => {
        expect(REGION_BIOMES.scattered).toMatchObject({
            name: 'Randomly placed tiles', base: 'classic', tileKinds: { percent: 5, cap: 8, min: 1 },
        });
        // ⛔ outside the closure's table: the constructive vocabulary gains no second spelling of classic
        for (const id of Object.keys(REGION_BIOMES)) {
            expect(BIOMES[id], id).toBeUndefined();
            expect(BIOMES[REGION_BIOMES[id].base], id).toBeDefined();
        }
        expect(mazeBiomeIds()).toEqual([...kindsOffered({ simulator: true }), 'scattered']);
        expect(placesTileKinds('scattered')).toBe(true);
        expect(placesTileKinds('classic')).toBe(false);
        expect(isRegionBiome('classic')).toBe(false);
    });

    it('engineBiomeOf hands the engine the base (paramsOverride kept); anything else passes through as it is', () => {
        expect(engineBiomeOf({ id: 'scattered' })).toEqual({ id: 'classic' });
        expect(engineBiomeOf({ id: 'scattered', paramsOverride: { a: 1 }, tileKinds: { cap: 2 } }))
            .toEqual({ id: 'classic', paramsOverride: { a: 1 } });
        const rooms = { id: 'rooms' };
        expect(engineBiomeOf(rooms)).toBe(rooms);
        expect(engineBiomeOf(null)).toBe(null);
    });

    it('a scattered room is sized as its classic twin (mazeLocationCapacity resolves through the table)', () => {
        for (const params of [{ maxIterations: 0 }, {}]) {
            for (const exits of [0, 1, 3]) {
                expect(mazeRoomIsOpen(params, { exits, biome: { id: 'scattered' } }))
                    .toBe(mazeRoomIsOpen(params, { exits, biome: { id: 'classic' } }));
                expect(mazeCapacityAt({ width: 8, height: 6 }, params, { exits, biome: { id: 'scattered' } }))
                    .toEqual(mazeCapacityAt({ width: 8, height: 6 }, params, { exits, biome: { id: 'classic' } }));
            }
        }
        // the trap this guards: an id the engine's table lacks reads as "walled"
        expect(mazeRoomIsOpen({ maxIterations: 0 }, { exits: 1, biome: { id: 'scattered' } })).toBe(true);
    });

    it('resolvedTileKinds: the biome\'s numbers, under the world\'s override, under the room\'s own stamp', () => {
        expect(resolvedTileKinds({ id: 'scattered' })).toEqual({ percent: 5, cap: 8, min: 1 });
        expect(resolvedTileKinds({ id: 'scattered' }, { cap: 3 })).toEqual({ percent: 5, cap: 3, min: 1 });
        expect(resolvedTileKinds({ id: 'scattered', tileKinds: { percent: 10 } }, { cap: 3 })).toEqual({ percent: 10, cap: 3, min: 1 });
        expect(resolvedTileKinds({ id: 'classic' }, { cap: 3 })).toBeNull();
    });
});

describe('GEN-1 — the world setting (⚖ Q8 "A per-room mix")', () => {
    it('normalises: absent / classic / [classic] are the default; a one-element list IS its id', () => {
        for (const v of [undefined, null, '', DEFAULT_BIOME_ID, [{ id: 'classic' }], [{ id: 'classic', weight: 3 }], ['classic']]) {
            expect(normalizeMazeBiomeSetting(v), JSON.stringify(v)).toBeNull();
        }
        expect(normalizeMazeBiomeSetting('scattered')).toBe('scattered');
        expect(normalizeMazeBiomeSetting([{ id: 'scattered', weight: 4 }])).toBe('scattered');
        expect(normalizeMazeBiomeSetting(['scattered'])).toBe('scattered');
        expect(normalizeMazeBiomeSetting([{ id: 'classic', weight: 2 }, 'scattered']))
            .toEqual([{ id: 'classic', weight: 2 }, { id: 'scattered', weight: 1 }]);
    });

    it.each([
        ['an unknown id', 'maze', /mazeBiome names "maze", which is not a maze biome \(empty, classic/],
        ['an unknown id in the list', [{ id: 'classic' }, { id: 'lava' }], /mazeBiome\[1\] names "lava", which is not a maze biome/],
        ['a Seedling-only palette word', 'post-sword', /names "post-sword", which is not a maze biome/],
        ['a weight that is not a positive integer', [{ id: 'classic', weight: 0 }, 'scattered'], /mazeBiome\[0\]\.weight must be a positive integer; got 0/],
        ['a fractional weight', [{ id: 'classic', weight: 1.5 }, 'scattered'], /weight must be a positive integer; got 1\.5/],
        ['a biome twice', ['scattered', { id: 'scattered', weight: 2 }], /mazeBiome\[1\] names "scattered" twice/],
        ['an unknown row field', [{ id: 'classic', w: 2 }, 'scattered'], /mazeBiome\[0\] has unknown field "w" \(id, weight\)/],
        ['an empty list', [], /a non-empty list of \{id, weight\}/],
    ])('refused by name at settings time: %s', (_, value, pattern) => {
        expect(() => normalizeMazeBiomeSetting(value)).toThrow(MazeBiomeSettingError);
        expect(() => mazeBiomeRegionParams({ params: { [MAZE_BIOME_KEY]: value } })).toThrow(pattern);
    });

    it('buildRegionParams: no key at all for the default; the id; a list with the world seed; tileKinds only when not the default', () => {
        expect(mazeBiomeRegionParams({ params: {} })).toEqual({});
        expect(mazeBiomeRegionParams({ params: { seed: 4, [MAZE_BIOME_KEY]: 'classic' } })).toEqual({});
        expect(mazeBiomeRegionParams({ params: { seed: 4, [MAZE_BIOME_KEY]: 'scattered' } })).toEqual({ [MAZE_BIOME_KEY]: 'scattered' });
        // the one-element list is the single id, byte for byte
        expect(JSON.stringify(mazeBiomeRegionParams({ params: { seed: 4, [MAZE_BIOME_KEY]: [{ id: 'scattered', weight: 3 }] } })))
            .toBe(JSON.stringify(mazeBiomeRegionParams({ params: { seed: 4, [MAZE_BIOME_KEY]: 'scattered' } })));
        expect(mazeBiomeRegionParams({ params: { seed: 4, [MAZE_BIOME_KEY]: ['classic', 'scattered'] } })).toEqual({
            [MAZE_BIOME_KEY]: [{ id: 'classic', weight: 1 }, { id: 'scattered', weight: 1 }], [MAZE_BIOME_SEED_KEY]: 4,
        });
        expect(mazeBiomeRegionParams({ params: { [MAZE_BIOME_KEY]: 'scattered', [TILE_KINDS_KEY]: { percent: 5, cap: 8, min: 1 } } }))
            .toEqual({ [MAZE_BIOME_KEY]: 'scattered' });
        expect(mazeBiomeRegionParams({ params: { [MAZE_BIOME_KEY]: 'scattered', [TILE_KINDS_KEY]: { cap: 2 } } }))
            .toEqual({ [MAZE_BIOME_KEY]: 'scattered', [TILE_KINDS_KEY]: { cap: 2 } });
    });

    it.each([
        ['tileKinds with no tile-placing biome', { [TILE_KINDS_KEY]: { cap: 2 } }, /tileKinds is set, but no biome of mazeBiome \(classic\) places tile kinds/],
        ['tileKinds with rooms only', { [MAZE_BIOME_KEY]: 'rooms', [TILE_KINDS_KEY]: { cap: 2 } }, /no biome of mazeBiome \(rooms\) places tile kinds/],
        ['a percent past its domain', { [MAZE_BIOME_KEY]: 'scattered', [TILE_KINDS_KEY]: { percent: 26 } }, /tileKinds\.percent must be an integer from 0 to 25/],
        ['a cap of 0', { [MAZE_BIOME_KEY]: 'scattered', [TILE_KINDS_KEY]: { cap: 0 } }, /tileKinds\.cap must be an integer from 1 to 32/],
        ['min above cap', { [MAZE_BIOME_KEY]: 'scattered', [TILE_KINDS_KEY]: { cap: 2, min: 3 } }, /tileKinds\.min \(3\) is more than its cap \(2\)/],
        ['an unknown number', { [MAZE_BIOME_KEY]: 'scattered', [TILE_KINDS_KEY]: { density: 3 } }, /tileKinds has unknown field "density"/],
    ])('refused by name: %s', (_, params, pattern) => {
        expect(() => mazeBiomeRegionParams({ params })).toThrow(pattern);
    });

    it('the domains are declared, integers, and hold the defaults', () => {
        for (const [k, d] of Object.entries(TILE_KINDS_DOMAINS)) {
            expect(Number.isInteger(d.min) && Number.isInteger(d.max), k).toBe(true);
            expect(REGION_BIOMES.scattered.tileKinds[k]).toBeGreaterThanOrEqual(d.min);
            expect(REGION_BIOMES.scattered.tileKinds[k]).toBeLessThanOrEqual(d.max);
        }
    });

    it('the mix picks by hash of (seed, region id): stable, weighted, seed-dependent, and classic is null', () => {
        const setting = normalizeMazeBiomeSetting([{ id: 'classic', weight: 1 }, { id: 'scattered', weight: 3 }]);
        const regions = Array.from({ length: 400 }, (_, i) => `region_${i % 20}_${Math.floor(i / 20)}`);
        const pick = (seed) => regions.map((r) => pickMazeBiome(setting, seed, r)?.id ?? 'classic');
        expect(pick(1)).toEqual(pick(1)); // stable: the same answer every time (a regenerate reproduces it)
        const scattered = pick(1).filter((id) => id === 'scattered').length;
        expect(scattered).toBeGreaterThan(250); // ~3/4 of 400
        expect(scattered).toBeLessThan(350);
        expect(pick(2)).not.toEqual(pick(1)); // the world seed matters
        expect(pickMazeBiome(setting, 1, 'region_0_0') === null || pickMazeBiome(setting, 1, 'region_0_0').id === 'scattered').toBe(true);
        expect(pickMazeBiome(null, 1, 'r')).toBeNull();
        expect(pickMazeBiome('rooms', 1, 'r')).toEqual({ id: 'rooms' });
        // the registry hook reads the regionParams the build hook wrote
        const rp = mazeBiomeRegionParams({ params: { seed: 7, [MAZE_BIOME_KEY]: setting } });
        expect(regionBiomeOf({ params: rp, regionId: 'region_3_4' })).toEqual(pickMazeBiome(setting, 7, 'region_3_4'));
        expect(regionBiomeOf({ params: {}, regionId: 'region_3_4' })).toBeNull();
    });
});
