/**
 * ⛓⛓ seedling-gen-chestdoor-ap — **EACH GENERATED DOOR CHEST IS A REAL
 * ARCHIPELAGO LOCATION** (⚖ the user, 2026-10-30: chests as DOORS, and each
 * door chest IS an AP location — it always drops a seal piece).
 *
 *   1. `seedlingGenRoom` adds one LOCATION row per `summary.chestDoors` entry,
 *      AFTER the draw, at the chest's FIXED tag (`chestDoorRows`); the rows
 *      stay LAST, so location 0 is still the goal's.
 *   2. `seedlingGeneratedSet.placeApItems` NEVER replaces a door chest with an
 *      `apitem` (an apitem is not solid: the wall's only gap would open). The
 *      location becomes a fixed-address report row (`rewrite: false`, the R4b
 *      path) — the chest's own clear is the check.
 *   3. The compiled pool gains one item per door chest (the row's filler), so
 *      items == locations.
 *
 * ⚖ js-13's conditions, pinned here:
 *   · END TO END on the JS runtime — a pipeline world with door chests,
 *     assembled as the host assembles it, mounted on the JS page; the solver
 *     opens the chest from below, the game reports `pendingCheck`, and the
 *     check binding turns it into `locationCheck` for `<region> - Chest`.
 *   · a world WITHOUT a chest door is byte-identical: the assembled set, its
 *     table and its report over the four committed generated presets
 *     (digests measured at the base, `8f00dd71b3`, before this change).
 *
 * Mutants (measured, each reverted): see the slice's as-built.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, beforeAll } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { buildRunFromState, runPresetHeadless } from '../procgenPipeline/presetRun.js';
import { LIBRARY_SLOT_FILLER_ITEM } from '../procgenPipeline/procgenPipelineEngine.js';
import { SEEDLING_GENERATED_ROOM_STATE } from '../procgenPipeline/presetDefs.js';
import {
    CHEST_DOOR_ITEM, CHEST_DOOR_KIND, chestDoorRows, extractGenRules, generateGenRoom, placeGenItems,
    rerollGenRoom, serializeGenRoom,
} from './seedlingGenRoom.js';
import {
    CHEST_DOOR_KIND as SET_CHEST_DOOR_KIND, GeneratedSetError, assembleGeneratedSeedlingSet, placeApItems,
} from './seedlingGeneratedSet.js';
import { chestDoorLocationName } from './procgenSeedling.js';
import { AP_ITEM_TYPE, placementKey } from './apPlacementRewriter.js';
import { mountedRecordsOf } from './wasmWalkTape.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { planLevelSetChunks } from './levelSetValidator.js';
import { createJsRuntime, JS_RUNTIME_PINS } from './jsRuntimeCore.js';
import { bootStaging } from './procgenOracle.js';
import { ITEM_PROPERTIES } from './tapeFormat.js';
import { solveAnytime, SOLVER_BUDGET_WORK, SOLVER_UPGRADE_WINDOW_WORK } from './jsRuntimeSolver.js';
import { arrivalSolveRequest, arrivalSolverGoal } from './wasmArrival.js';
import { SeedlingCheckBinding } from '../flashPanel/seedlingCheckBinding.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const GAME_CONFIG = readJson('frontend/modules/flashPanel/games/seedling.json');
const BRIDGE_CONFIG = JSON.stringify({ classes: GAME_CONFIG.classes, state_properties: GAME_CONFIG.state_properties });
const FLAGS = Object.fromEntries(Object.values(ITEM_PROPERTIES).map((s) => [s.property, s.kind === 'add' ? s.base : false]));

/** A pipeline room straight through the substrate's hooks (`rng.next()` fixed: the room's drawn seed). */
function hookRoom(v, elements = 'chestdoor') {
    const core = generateGenRoom({ region_id: 'region_0_0', exits: [{ side: 'east' }], size: { width: 10, height: 10 },
        rng: { next: () => v }, params: { seedlingGen: { elements, skeleton: 'empty', biome: 'pre-sword' } } });
    placeGenItems(core.world, { items_to_place: ['key_blue'] });
    const extracted = extractGenRules(core.world, { regionId: 'region_0_0' });
    const payload = serializeGenRoom(core.world, extracted, null, null, { ordinalOfRegion: () => 0 });
    return { world: core.world, extracted, payload };
}

/** The committed generated-room world, with every generated room asked for a door chest (seed 1: both place one). */
const CHEST_STATE = Object.freeze({ ...SEEDLING_GENERATED_ROOM_STATE,
    params: Object.freeze({ ...SEEDLING_GENERATED_ROOM_STATE.params, seedlingGenElements: 'chestdoor' }) });
let chestWorld = null;
beforeAll(async () => {
    chestWorld = (await runPresetHeadless(buildRunFromState(structuredClone(CHEST_STATE)))).rulesJson;
}, 120_000);

describe('1 — a LOCATION row per door chest, after the draw, at the chest\'s fixed tag', () => {
    it('0, 1 and 2 door chests → 0, 1 and 2 rows: the chest\'s cell and tag, `<room> - Chest`, the filler item', () => {
        expect(chestDoorRows('region_4', {})).toEqual([]);
        expect(chestDoorRows('region_4', { stop: null })).toEqual([]);
        const one = { kind: 'chest-door', cell: { tx: 3, ty: 2 }, tag: 5 };
        expect(chestDoorRows('region_4', { chestDoors: [one] })).toEqual([{ id: 'chest_door',
            name: chestDoorLocationName('region_4'), kind: CHEST_DOOR_KIND, item: CHEST_DOOR_ITEM,
            cell: { tx: 3, ty: 2 }, tag: 5 }]);
        const two = chestDoorRows('region_4', { chestDoors: [one, { ...one, cell: { tx: 6, ty: 6 }, tag: 9 }] });
        expect(two.map((r) => [r.id, r.name, r.tag])).toEqual([
            ['chest_door', 'region_4 - Chest', 5], ['chest_door_2', 'region_4 - Chest 2', 9]]);
        expect(new Set(two.map((r) => r.name)).size).toBe(2);
    });

    it('the row\'s item IS the engine\'s slot filler (one string, two modules)', () => {
        expect(CHEST_DOOR_ITEM).toBe(LIBRARY_SLOT_FILLER_ITEM);
        expect(SET_CHEST_DOOR_KIND).toBe(CHEST_DOOR_KIND);
    });

    it('through the hooks: a room that places a door chest carries its row LAST; location 0 stays the goal', () => {
        const { world, extracted, payload } = hookRoom(0.2);
        const [chest] = world.summary.chestDoors;
        expect(payload.locations.map((l) => [l.name, l.kind ?? null, l.tag])).toEqual([
            ['region_0_0__key_blue_pickup', null, 0], ['region_0_0 - Chest', CHEST_DOOR_KIND, chest.tag]]);
        expect(payload.locations[0].cell).toEqual(payload.goal_cell);
        expect(payload.locations[1].cell).toEqual(chest.cell);
        // the chest IS in the room, at that cell and tag (the binding's `chest {tag}`)
        expect(payload.record.entities.filter((e) => e.type === 'chest'))
            .toEqual([expect.objectContaining({ x: chest.cell.tx * 16, y: chest.cell.ty * 16, attrs: { tag: String(chest.tag) } })]);
        expect(extracted.locations.find((l) => l.id === 'chest_door'))
            .toMatchObject({ item: CHEST_DOOR_ITEM, global_name: 'region_0_0 - Chest', access_rule: { rule: 'True_' } });
    }, 60_000);

    it('a RE-ROLL keeps the declared door chests: only a draw with as many is taken, its rows re-derived', () => {
        // ⛓ drawn seed 0.5: re-roll 1 places NO door chest (measured), so only the law takes re-roll 2
        const { world } = hookRoom(0.5);
        const rows = world.locations.filter((l) => l.kind !== CHEST_DOOR_KIND).map(({ cell: _c, tag: _t, ...r }) => r);
        const { room, err } = rerollGenRoom(world, [...world.exits.entries()], rows, 'locations');
        expect(err).toBeUndefined();
        expect(room.seed).not.toBe(world.seed);
        expect(room.summary.chestDoors).toHaveLength(1);
        expect(room.locations.map((l) => [l.id, l.kind ?? null])).toEqual([
            ['key_blue_pickup', null], ['chest_door', CHEST_DOOR_KIND]]);
        expect(room.locations[1]).toMatchObject({ cell: room.summary.chestDoors[0].cell, tag: room.summary.chestDoors[0].tag });
        expect(room.generation.rerolls).toBe(2);
    }, 60_000);

    it('a room whose draw placed none has NO row, and no `chestDoors` / `kind` key anywhere', () => {
        const { world, payload } = hookRoom(0.1);
        expect('chestDoors' in world.summary).toBe(false);
        expect(payload.locations.map((l) => l.name)).toEqual(['region_0_0__key_blue_pickup']);
        expect(payload.locations.some((l) => 'kind' in l)).toBe(false);
        const none = hookRoom(0.2, '');
        expect(none.payload.locations.map((l) => l.name)).toEqual(['region_0_0__key_blue_pickup']);
    }, 60_000);
});

describe('2 — `placeApItems` KEEPS the door chest: a `rewrite: false` report row, never an apitem', () => {
    const CELL = { tx: 2, ty: 1 };
    const record = () => ({ width: 4, height: 4, layers: [], entities: [{ type: 'chest', x: 32, y: 16, attrs: { tag: '1' } }] });

    it('the chest stays, no apitem lands on its cell, and it is reported apart from the apitems', () => {
        const { record: out, placed, chests } = placeApItems(record(), [
            { name: 'r - Chest', kind: CHEST_DOOR_KIND, cell: CELL, tag: 1 }], 'r');
        expect(out.entities).toEqual(record().entities);
        expect(out.entities.some((e) => e.type === AP_ITEM_TYPE)).toBe(false);
        expect(placed).toEqual([]);
        expect(chests).toEqual([{ location: 'r - Chest', cell: CELL, tag: 1, rewrite: false }]);
    });

    it('a plain location on the same cell IS replaced (the control: only the door chest is kept)', () => {
        const { record: out, placed } = placeApItems(record(), [{ name: 'r__loc_0', cell: CELL, tag: 1 }], 'r');
        expect(out.entities.map((e) => e.type)).toEqual([AP_ITEM_TYPE]);
        expect(placed[0].replaced).toBe('chest');
    });

    it('⛔ a door-chest location with no chest of its tag on its cell is REFUSED by name', () => {
        const at = () => placeApItems(record(), [{ name: 'r - Chest', kind: CHEST_DOOR_KIND, cell: CELL, tag: 2 }], 'r');
        expect(at).toThrow(GeneratedSetError);
        expect(at).toThrow(/region 'r' location 'r - Chest' is a door chest at \(2,1\) tag 2, and the room holds no chest/);
    });

    it('over a built world: every door chest is a fixed-address TABLE row, its chest in the set, no apitem on it', () => {
        const assembled = assembleGeneratedSeedlingSet(chestWorld, { selfPlayer: 1 });
        const { chestDoors } = assembled.report;
        expect(chestDoors.map((c) => c.location)).toEqual(['region_0_0 - Chest', 'region_0_1 - Chest']);
        expect(assembled.report.apitems.map((a) => a.location)).toEqual(['region_0_0__key_blue_pickup']);
        const records = mountedRecordsOf(assembled.set);
        for (const c of chestDoors) {
            expect(assembled.table.get(placementKey(c.room, c.tag))).toMatchObject({
                ledgerId: c.location, location: c.location, level: c.room, tag: c.tag, tagSource: 'fixed', rewrite: false });
            const entities = records.get(c.room).entities.filter((e) => e.x === c.cell.tx * 16 && e.y === c.cell.ty * 16);
            expect(entities.map((e) => [e.type, e.attrs?.tag])).toEqual([['chest', String(c.tag)]]);
        }
    });
});

describe('3 — the pool gains one item per door chest: items == locations', () => {
    it('the built world: 2 door chests → 2 more locations and 2 more pool items than the committed world', () => {
        const committed = readJson('frontend/presets/seedling_generated_room/AP_1/AP_1_rules.json');
        const count = (rules) => ({
            locations: Object.values(rules.regions['1']).reduce((n, r) => n + (r.locations ?? []).length, 0),
            pool: Object.values(rules.itempool_counts['1']).reduce((n, k) => n + k, 0),
        });
        expect(count(committed)).toEqual({ locations: 1, pool: 1 });
        expect(count(chestWorld)).toEqual({ locations: 3, pool: 3 });
        expect(chestWorld.itempool_counts['1']).toEqual({ ...committed.itempool_counts['1'], [CHEST_DOOR_ITEM]: 2 });
        expect(chestWorld.items['1'][CHEST_DOOR_ITEM].classification).toBe('filler');
        const chestLocs = Object.values(chestWorld.regions['1']).flatMap((r) => r.locations ?? [])
            .filter((l) => / - Chest$/.test(l.name));
        expect(chestLocs.map((l) => [l.name, l.item?.name])).toEqual([
            ['region_0_0 - Chest', CHEST_DOOR_ITEM], ['region_0_1 - Chest', CHEST_DOOR_ITEM]]);
    });
});

describe('⚖ js-13 (2) — a world WITHOUT a door chest is BYTE-IDENTICAL', () => {
    /** sha256 (16 hex) of the assembled set, its table and its report — measured at the base `8f00dd71b3`. */
    const BASE = {
        seedling_generated_room: 'f3c77ab16c411d18',
        seedling_generated_leaf: 'dc58055dc27e2726',
        seedling_generated_host: 'aabc44bbc9bd1cee',
        seedling_generated_swim: 'e0df5a13884d12d4',
    };
    it.each(Object.keys(BASE))('%s: `placeApItems` → the same set, table and report', (game) => {
        const a = assembleGeneratedSeedlingSet(readJson(`frontend/presets/${game}/AP_1/AP_1_rules.json`), { selfPlayer: 1 });
        const digest = createHash('sha256')
            .update(JSON.stringify({ set: a.set, table: [...a.table.entries()], report: a.report })).digest('hex').slice(0, 16);
        expect(digest).toBe(BASE[game]);
        expect('chestDoors' in a.report).toBe(false);
    });
    // ⛓ The POOL's identity is the pipeline's: each committed preset is rebuilt and compared whole by its own row
    //   ("the committed … preset IS this world": seedlingGeneratedWorld / …HostWorld / …SwimWorld tests).
});

describe('⚖ js-13 (1) — END TO END on the JS runtime: open the door chest → the check fires → the location is reported', () => {
    it('the solver opens `region_0_0 - Chest` from below; `pendingCheck` "…|0|<tag>|0"; the binding checks the location', () => {
        const assembled = assembleGeneratedSeedlingSet(chestWorld, { selfPlayer: 1 });
        const records = mountedRecordsOf(assembled.set);
        const levelSource = levelSourceFromAtlas(records);
        const arrival = { ...assembled.set.start };
        const chest = assembled.report.chestDoors.find((c) => c.room === arrival.level);
        expect(chest.location).toBe('region_0_0 - Chest');

        // the plan: the wasm arrival's own request (`arrivalSolverGoal` finds the chest by its tag)
        const staging = bootStaging({ boot: arrival, items: { ...FLAGS }, pins: [...JS_RUNTIME_PINS] });
        const goal = { kind: 'location', level: chest.room, tag: chest.tag, name: chest.location };
        const mapped = arrivalSolverGoal(goal, { staging, levelSource, record: records.get(arrival.level) });
        expect(mapped.goal).toEqual({ kind: 'collect-placement', placement: { x: chest.cell.tx * 16, y: chest.cell.ty * 16 } });
        const request = arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource, records,
            name: 'chest-door-ap', scratchPersistence: true });
        const { plan } = solveAnytime({ ...request, budgetWork: SOLVER_BUDGET_WORK, upgradeWindowWork: SOLVER_UPGRADE_WINDOW_WORK });
        expect(plan?.solution?.length).toBeGreaterThan(0);

        // the JS page, mounted as the host delivers it, played on the plan's keys
        const reports = [];
        const rt = createJsRuntime({ onStateChanged: (p, v) => reports.push([p, v]) });
        expect(rt.game.configure(BRIDGE_CONFIG)).toBe('ok');
        for (const c of planLevelSetChunks(assembled.set).chunks) rt.game.botLoadLevels(JSON.stringify(c));
        rt.queueItems([{ class: 'game', property: 'menu', value: false },
            { invocation: 'new_instance', className: 'Game', args: [arrival.level, arrival.x, arrival.y] }]);
        rt.tick();
        reports.length = 0;
        for (const keys of plan.solution) expect(rt.tick(new Set(keys)).halted ?? null).toBeNull();
        for (let t = 0; t < 30; t += 1) rt.tick();

        // the CHEST opened (its slot cleared) — no apitem was there to take
        expect(JSON.parse(rt.game.botStatus()).persistence_cleared).toContainEqual({ level: chest.room, tag: chest.tag });
        expect(rt.collected.size).toBe(0);
        const checks = reports.filter(([p]) => p === 'pendingCheck').map(([, v]) => v);
        expect(checks).toEqual([`1|${chest.room}|${chest.tag}|0`]);

        const binding = new SeedlingCheckBinding({ table: assembled.table, placementKey, selfPlayer: 1 });
        const effects = binding.onStateReport('pendingCheck', checks[0]);
        expect(effects[0]).toMatchObject({ type: 'locationCheck', location: 'region_0_0 - Chest', ledgerId: 'region_0_0 - Chest',
            level: chest.room, tag: chest.tag });
        expect(binding.stats).toMatchObject({ checks: 1, unknown: 0 });
        expect(rt.deaths).toEqual([]);
    }, 120_000);
});
