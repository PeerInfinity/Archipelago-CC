/**
 * ⛓⛓⛓ SEEDLING IN THE PIPELINE T3 — `flash_seedling` AS A SPHERE-GROWTH LEAF
 * (and, since seedling generated G6, a HOST: the rows under "G6" below).
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
    SEEDLING_ATLAS_HOST_CHILDREN_KEY,
    SEEDLING_DOOR_LOCK_PREFIX,
    buildSeedlingAtlasRegionParams,
    seedlingDoorLocks,
} from './flashSeedlingLibrary.js';
import { compileRegionAtlas } from '../procgenPipeline/regionAtlasCompiler.js';
import { compileAccessRule } from '../shared/procgen/pathsAndObstaclesCompiler.js';

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

    it('G6 — a HOST by default (a gate per door of the roomiest room), T3\'s LEAF by the state\'s knob', () => {
        const most = Math.max(...ROOMS.map((r) => r.doors.length));
        const gates = (n) => Array.from({ length: n }, (_, k) => [{ item: `key_${k}`, count: 1 }]);
        expect(entry.canHostExitGates([], [{ item: 'key_red' }])).toBe(true);
        expect(entry.canHostExitGates(gates(most - 1), [{ item: 'key_red' }])).toBe(true);
        expect(entry.canHostExitGates(gates(most), [{ item: 'key_red' }])).toBe(false);
        const host = buildSeedlingAtlasRegionParams({ params: {} });
        expect(entry.exitGateVeto(host)([], [{ item: 'key_red' }])).toBe(true);
        expect(entry.exitGateVeto({})(gates(most), [{ item: 'key_red' }])).toBe(false);
        expect(entry.backPortalGated({})).toBe(true);
        expect(entry.backPortalGated(host)).toBe(true);
        const leafParams = buildSeedlingAtlasRegionParams({ params: { [SEEDLING_ATLAS_HOST_CHILDREN_KEY]: false } });
        expect(leafParams).toEqual({ seedlingAtlas: { hostChildren: false } });
        expect(entry.exitGateVeto(leafParams)([], [{ item: 'key_red' }])).toBe(false);
        expect(entry.exitGateVeto(leafParams)([], [])).toBe(false);
        expect(entry.backPortalGated(leafParams)).toBe(false);
        expect(entry.buildRegionParams).toBe(buildSeedlingAtlasRegionParams);
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

    it('(b) G6 — a HOST spec binds a door per side (the tightest room with enough doors), each child\'s gate a LOCK on its path', () => {
        const spec = leaf('region_3_2');
        spec.exitSpecs.unshift({ side: 'N', requirement: ['key_red'], counts: { key_red: 1 } });
        const out = entry.generateZoneForSpecs(spec);
        const room = roomOf(out.payload);
        expect(room.doors.length).toBeGreaterThanOrEqual(2);
        expect(Object.entries(out.payload.bound_doors).map(([side, d]) => [side, d.exit_id]))
            .toEqual([['N', room.doors[0]], ['W', room.doors[1]]]);
        expect(out.exitRules).toEqual({}); // this path compiles exitPaths (T3 §17.0 #3)
        // the compiled rule is the tree's gate EXACTLY; the ungated side is True_
        expect(compileAccessRule(out.exitPaths.N, out.obstacleDefs)).toEqual({ rule: 'Has', args: { item_name: 'key_red' } });
        expect(compileAccessRule(out.exitPaths.W, out.obstacleDefs)).toEqual({ rule: 'True_' });
        expect(out.obstacleDefs).toEqual({ [`${SEEDLING_DOOR_LOCK_PREFIX}key_red`]: {
            id: `${SEEDLING_DOOR_LOCK_PREFIX}key_red`, name: 'key_red lock', clear_set_type: 'rule',
            clear_rule: { rule: 'Has', args: { item_name: 'key_red' } } } });
    });

    it('(b) G6 — the lock carries EVERY term: several items AND together, a count rides the rule', () => {
        const { exitPaths, obstacleDefs } = seedlingDoorLocks([
            { side: 'E', requirement: ['key_red', 'key_blue'], counts: { key_blue: 2 } },
            { side: 'S', requirement: [], counts: {} },
        ]);
        expect(compileAccessRule(exitPaths.E, obstacleDefs)).toEqual({ rule: 'And', children: [
            { rule: 'Has', args: { item_name: 'key_red' } },
            { rule: 'Has', args: { item_name: 'key_blue', count: 2 } }] });
        expect(Object.keys(obstacleDefs)).toEqual([`${SEEDLING_DOOR_LOCK_PREFIX}key_red`,
            `${SEEDLING_DOOR_LOCK_PREFIX}key_blue__x2`]);
        // an empty requirement is the engine's own default path (a leaf's bytes cannot move)
        expect(exitPaths.S).toEqual([{ path_id: 'p1', obstacles: [] }]);
    });

    it('(b) more sides than any room has doors, or none at all, is refused by name', () => {
        const most = Math.max(...ROOMS.map((r) => r.doors.length));
        const spec = { region_id: 'region_3_2', exitSpecs: ['N', 'E', 'S', 'W'].slice(0, most + 1)
            .map((side) => ({ side, requirement: [], counts: {} })), locationSpecs: [], seed: 1 };
        expect(() => entry.generateZoneForSpecs(spec)).toThrow(new RegExp(`needs ${most + 1} door\\(s\\) \\+ 0 location`));
        expect(() => entry.generateZoneForSpecs({ ...spec, exitSpecs: [] }))
            .toThrow(/region "region_3_2" asks a real Seedling room for no exit side at all/);
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
