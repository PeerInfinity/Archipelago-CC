/**
 * ⛓⛓⛓ SEEDLING IN THE PIPELINE T3 — `flash_seedling` AS A SPHERE-GROWTH LEAF.
 *
 * The entry's sphere hooks (`flashSeedlingLibrary.js` § `generateZoneForSpecs`):
 * a leaf spec binds ONE real door, returns no exit rule, maps the node's items
 * onto the room's own locations under the compiler's names, places each room at
 * most once per generation, and `prepareSphereGrowth` starts the next
 * generation with every room unplaced. The rooms, their doors and their
 * locations are read off an independent `compileRegionAtlas` of the same atlas,
 * never typed here.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
    substrateRegistryEntry as entry,
    SEEDLING_STARTER_ATLAS,
    FLASH_SEEDLING_SUBSTRATE_ID,
} from './flashSeedlingLibrary.js';
import { compileRegionAtlas } from '../procgenPipeline/regionAtlasCompiler.js';

const compiled = compileRegionAtlas(SEEDLING_STARTER_ATLAS);
/** The placeable rooms (≥1 wired door), in the compile's order, with their doors and locations. */
const ROOMS = Object.entries(compiled.rules.preset_sidecars['1'])
    .filter(([, s]) => s.substrate === FLASH_SEEDLING_SUBSTRATE_ID && s.playable_payload.exits.length > 0)
    .map(([apName, s]) => ({
        apName,
        payload: s.playable_payload,
        doors: s.playable_payload.exits.map((d) => d.exit_id),
        locations: compiled.rules.regions['1'][apName].locations.map((l) => l.name),
    }));
const roomOf = (payload) => ROOMS.find((r) => r.payload.atlas_region === payload.atlas_region
    && r.payload.atlas_sub_region === payload.atlas_sub_region);
/** The compiled room a realised spec took. */
const placed = (spec) => roomOf(entry.generateZoneForSpecs(spec).payload).apName;
/** A leaf's spec as `generateRegionZoneGen` builds it: the entrance side, ungated, and the node's items. */
const leaf = (regionId, items = [], side = 'W') => ({
    region_id: regionId,
    exitSpecs: [{ side, requirement: [], counts: {} }],
    locationSpecs: items.map((item, k) => ({ id: `${regionId}__item_${k}`, item, requirement: [], counts: {} })),
    seed: 1,
});

beforeEach(() => { entry.prepareSphereGrowth({}); });
afterEach(() => { entry.prepareSphereGrowth({}); entry.applyPipelineConfig({}); });

describe('flash_seedling — a sphere-growth LEAF', () => {
    it('the population is not vacuous: rooms with no location, and exactly one room with one', () => {
        expect(ROOMS.filter((r) => r.locations.length === 0).length).toBeGreaterThan(1);
        const withLoc = ROOMS.filter((r) => r.locations.length > 0);
        expect(withLoc).toHaveLength(1);
        expect(withLoc[0].locations).toHaveLength(1);
    });

    it('declares the leaf law: no child gate is hostable, and the back door is ungated', () => {
        expect(entry.canHostExitGates([], [{ item: 'key_red' }])).toBe(false);
        expect(entry.canHostExitGates([], [])).toBe(false);
        expect(entry.backPortalGated({})).toBe(false);
    });

    it('(a) a leaf spec binds ONE real door to its side, external, and returns no exit rule', () => {
        const out = entry.generateZoneForSpecs(leaf('region_3_2', [], 'W'));
        expect(out.exitRules).toEqual({});
        expect(out.locations).toEqual([]);
        const bound = Object.entries(out.payload.bound_doors);
        expect(bound).toHaveLength(1);
        const [[side, door]] = bound;
        expect(side).toBe('W');
        const room = roomOf(out.payload);
        expect(room, 'the payload is one compiled room\'s').toBeTruthy();
        expect(door).toMatchObject({ exit_id: room.doors[0], side: 'W', external: true });
        expect(out.payload).not.toHaveProperty('exits');
        // the compiled payload, less its exits, rides unchanged
        const { exits: _exits, ...rest } = room.payload;
        const { bound_doors: _bound, ...payloadRest } = out.payload;
        expect(payloadRest).toEqual(rest);
    });

    it('(a) the TIGHTEST room: a 0-item leaf takes a room with no location and the fewest doors', () => {
        const out = entry.generateZoneForSpecs(leaf('region_3_2'));
        const room = roomOf(out.payload);
        const noLoc = ROOMS.filter((r) => r.locations.length === 0);
        const fewest = Math.min(...noLoc.map((r) => r.doors.length));
        expect(room.locations).toEqual([]);
        expect(room.doors).toHaveLength(fewest);
        expect(room.apName).toBe(noLoc.find((r) => r.doors.length === fewest).apName);
    });

    it('(b) a spec with a CHILD exit is refused: a real room hosts no children', () => {
        const spec = leaf('region_3_2');
        spec.exitSpecs.unshift({ side: 'N', requirement: ['key_red'], counts: { key_red: 1 } });
        expect(() => entry.generateZoneForSpecs(spec)).toThrow(
            /region "region_3_2" asks a real Seedling room for 2 exit side\(s\) \[N, W\].*placed only as a LEAF.*hosts no children/);
        expect(() => entry.generateZoneForSpecs({ ...spec, exitSpecs: [] })).toThrow(/for 0 exit side\(s\)/);
    });

    it('(c) each placement takes a DIFFERENT room; with none left the next is refused by name', () => {
        const taken = ROOMS.map((_, k) => placed(leaf(`region_${k}`)));
        expect(new Set(taken).size).toBe(ROOMS.length);
        expect(() => entry.generateZoneForSpecs(leaf('region_extra'))).toThrow(new RegExp(
            `no unplaced room of the installed atlas "${SEEDLING_STARTER_ATLAS.atlas_id}" fits region `
            + '"region_extra" \\(needs 1 door\\(s\\) \\+ 0 location\\(s\\)\\).*placed at most once per world '
            + `— lower the ${FLASH_SEEDLING_SUBSTRATE_ID} quota`));
    });

    it('(c) the SAME region realised again keeps its room (a re-roll does not move it)', () => {
        const first = placed(leaf('region_3_2'));
        const second = placed(leaf('region_3_2'));
        const other = placed(leaf('region_4_4'));
        expect(second).toBe(first);
        expect(other).not.toBe(first);
    });

    it('(d) prepareSphereGrowth starts a new generation: every room is unplaced again', () => {
        const firstOfGeneration = placed(leaf('region_0'));
        for (let k = 1; k < ROOMS.length; k += 1) entry.generateZoneForSpecs(leaf(`region_${k}`));
        expect(() => entry.generateZoneForSpecs(leaf('region_next'))).toThrow(/no unplaced room/);
        // the hook contributes nothing to the plan — it only resets
        expect(entry.prepareSphereGrowth({ quotas: { [FLASH_SEEDLING_SUBSTRATE_ID]: 1 } })).toEqual({});
        expect(placed(leaf('region_next'))).toBe(firstOfGeneration);
    });

    it('(e) a node with ONE item lands in the only room with a location, under the compiler\'s name', () => {
        const room = ROOMS.find((r) => r.locations.length > 0);
        const out = entry.generateZoneForSpecs(leaf('region_3_2', ['key_red']));
        expect(roomOf(out.payload).apName).toBe(room.apName);
        expect(out.locations).toEqual([
            { id: 'region_3_2__item_0', global_name: room.locations[0], item: 'key_red' },
        ]);
        // …and a second 1-item leaf in the same generation has nowhere to go
        expect(() => entry.generateZoneForSpecs(leaf('region_4_4', ['key_blue'])))
            .toThrow(/fits region "region_4_4" \(needs 1 door\(s\) \+ 1 location\(s\)\)/);
    });

    it('(e) a node with TWO items is refused: no room has two locations', () => {
        expect(() => entry.generateZoneForSpecs(leaf('region_3_2', ['key_red', 'key_blue'])))
            .toThrow(/needs 1 door\(s\) \+ 2 location\(s\).*lower maxItemsPerRegion or raise fillerCount/);
    });
});
