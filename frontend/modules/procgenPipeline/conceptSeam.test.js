/**
 * ⛓⛓ CONCEPT LIBRARY T1, D1 — **THE WORLD'S CONCEPT LIST REACHES THE PLACER.**
 *
 * `DEFAULT_PARAMS.concepts` is the world's list of concept ids (EMPTY by
 * default); `assembleRegionParams` carries a NON-EMPTY list into every region's
 * params (and writes no key for an empty one); `generateRegionProcedural` hands
 * `spec.params` to `placeFromRules`. The two other procedural placers that
 * receive it — the text adventure's and the generated Seedling room's — ignore
 * it: the same input with and without `params` places the same room.
 */
import { describe, it, expect } from 'vitest';

import '../mazeRoom/mazeRoomLibrary.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { createRng } from '../shared/rng.js';
import { DEFAULT_ITEMS, DEFAULT_OBSTACLES } from '../shared/procgen/library.js';
import { spatialCore, ruleGatePlacer, tileGridPathExtractor, tileGridSerializer }
    from '../shared/procgen/adapterPrimitives.js';
import { DEFAULT_PARAMS, panelDefaultParams, mergedItemLib } from './presetRun.js';
import { assembleRegionParams } from './sphereConfigHooks.js';
import { generateRegion } from './procgenPipelineEngine.js';
import { CONCEPTS, isConceptRow, itemRowsOf, markConceptRow } from '../procgenCore/concepts.js';
import { generateTextAdventureRoom, placeTextAdventureRules }
    from '../textAdventureSubstrateWrapper/textAdventureRoom.js';
import { substrateRegistryEntry as GEN_ENTRY } from '../flashPanel/flashSeedlingGenLibrary.js';
// the headless BUILD door: registers the generated-room entry and installs its generator
import '../flashPanel/flashSeedlingGenBuild.js';

const ALL = Object.keys(CONCEPTS);
const SWORD_GATE = { rule: 'Has', args: { item_name: 'Progressive Sword' } };

describe('the knob — DEFAULT_PARAMS.concepts', () => {
    it('is the EMPTY list, in the base defaults and the panel defaults', () => {
        expect(DEFAULT_PARAMS.concepts).toEqual([]);
        expect(panelDefaultParams().concepts).toEqual([]);
    });
});

describe('assembleRegionParams — the list rides into the region params only when it names something', () => {
    it('an empty or absent list writes NO `concepts` key (a concept-less world takes no new key)', () => {
        expect('concepts' in assembleRegionParams({ activeIds: ['maze'], params: { ...panelDefaultParams() } }))
            .toBe(false);
        expect('concepts' in assembleRegionParams({ activeIds: ['maze'], params: {} })).toBe(false);
        expect('concepts' in assembleRegionParams({ activeIds: [], params: undefined })).toBe(false);
    });
    it('a non-empty list is written as a COPY, in both modes', () => {
        const params = { ...panelDefaultParams(), concepts: ['guardian', 'sword'] };
        for (const mode of ['sphere', 'topDown']) {
            const out = assembleRegionParams({ activeIds: ['maze'], mode, params });
            expect(out.concepts).toEqual(['guardian', 'sword']);
            expect(out.concepts).not.toBe(params.concepts);
        }
    });
});

describe('mergedItemLib — an ITEM concept the world names joins its item library', () => {
    const state = (concepts) => ({
        mode: 'sphereGrowth', substrateMode: 'quota', substrateQuotas: { maze: 4 }, substrateMix: {},
        params: { ...panelDefaultParams(), concepts },
    });
    it('an empty list adds nothing (the library is the concept-less one)', () => {
        const none = mergedItemLib({ ...state([]), params: { ...panelDefaultParams() } });
        expect(mergedItemLib(state([]))).toEqual(none);
        expect('Progressive Sword' in none).toBe(false);
    });
    it('sword + swim (+ the gates, which add no item) add exactly the table\'s rows, colour and symbol included', () => {
        const none = mergedItemLib(state([]));
        const got = mergedItemLib(state(['sword', 'guardian', 'swim', 'water']));
        const added = Object.fromEntries(Object.entries(got).filter(([k]) => !(k in none)));
        // ⛓ T0b: each added row is MARKED with its concept (`markConceptRow`).
        expect(added).toEqual({
            'Progressive Sword': markConceptRow(itemRowsOf(CONCEPTS.sword)[0], 'sword'),
            'Progressive Swim': markConceptRow(itemRowsOf(CONCEPTS.swim)[0], 'swim'),
        });
        expect(Object.values(added).every(isConceptRow)).toBe(true);
        expect(Object.values(none).some(isConceptRow)).toBe(false);
        expect(added['Progressive Sword'].color).toBe(CONCEPTS.sword.item.color);
    });
    it('never over a row a library already declares (the shared red key stays the shared one)', () => {
        const none = mergedItemLib(state([]));
        expect(mergedItemLib(state(['key'])).key_red).toBe(none.key_red);
    });
});

describe('generateRegionProcedural hands `spec.params` to placeFromRules', () => {
    const PROBE = 't1_concept_seam_probe';
    it('the placer receives the region\'s params object, concepts and all', () => {
        const seen = [];
        if (!substrateRegistry.has(PROBE)) {
            substrateRegistry.register({
                id: PROBE, label: 'probe', panelComponentType: 'none', loadRegionEvent: 'none',
                supportedFeatures: [], deserializeWorld: () => null,
                generateRegionCore: spatialCore,
                placeFromRules: (world, input) => { seen.push(input.params); return ruleGatePlacer(world, input); },
                extractPathsAndObstacles: tileGridPathExtractor,
                serializeWorld: tileGridSerializer,
            });
        }
        const params = { concepts: ['guardian', 'sword'] };
        generateRegion({
            substrate: PROBE, region_id: 'r0', size: { width: 8, height: 6 },
            entrances: [{ side: 'W', tile: { x: 0, y: 3 } }], exits: [{ exit_id: 'e0', side: 'E', target_region: 'r1', access_rule: SWORD_GATE }],
            locations: [], itemLib: DEFAULT_ITEMS, obstacleLib: DEFAULT_OBSTACLES, rng: createRng(7), params,
        });
        expect(seen.length).toBeGreaterThan(0);
        expect(seen.every((p) => p === params)).toBe(true);
    });
});

describe('the other procedural placers ignore `params`', () => {
    const noDrawRng = () => ({ next() { throw new Error('a text adventure room drew from the rng'); } });
    it('the text adventure: the same room, the same return, with and without params.concepts', () => {
        const build = () => generateTextAdventureRoom({
            region_id: 'Hall', size: { width: 8, height: 6 }, entrances: [{ side: 'S', tile: { x: 4, y: 5 } }],
            exits: [{ exit_id: 'North', exitName: 'North', side: 'N', targetRegion: 'Tower' }],
            rng: noDrawRng(),
        });
        const input = {
            exit_rules: { North: SWORD_GATE },
            location_rules: { Chest: SWORD_GATE },
            item_placements: [{ item_id: 'Progressive Swim', location_id: 'Chest' }],
            rng: noDrawRng(),
        };
        const a = build();
        const b = build();
        const outA = placeTextAdventureRules(a.world, input);
        const outB = placeTextAdventureRules(b.world, { ...input, params: { concepts: ALL } });
        expect(outB).toEqual(outA);
        expect([...b.world.exits.entries()]).toEqual([...a.world.exits.entries()]);
        expect(b.world.locations).toEqual(a.world.locations);
    });
    it('the generated Seedling room: the same room, the same return, with and without params.concepts', () => {
        const seededRng = (seed) => ({ next: () => (seed + 0.5) / 0x7fffffff });
        const build = () => GEN_ENTRY.generateRegionCore({
            region_id: 'gen_probe', size: { width: 10, height: 10 }, entrances: [],
            exits: [{ exit_id: 'a', side: 'N', targetRegion: 'x' }], rng: seededRng(3), params: {},
        });
        const input = {
            exit_rules: { a: SWORD_GATE },
            location_rules: { L0: SWORD_GATE },
            item_placements: [{ item_id: 'Progressive Swim', location_id: 'L0' }],
        };
        const a = build();
        const b = build();
        const outA = GEN_ENTRY.placeFromRules(a.world, input);
        const outB = GEN_ENTRY.placeFromRules(b.world, { ...input, params: { concepts: ALL } });
        expect(outB).toEqual(outA);
        expect([...b.world.exits.entries()]).toEqual([...a.world.exits.entries()]);
        expect(b.world.locations).toEqual(a.world.locations);
    });
});
