/**
 * ⛓⛓ seedling gen B1 — **EACH GENERATED LOOT CHEST IS A REAL ARCHIPELAGO
 * LOCATION** (⚖ the user, 2026-11-01: *"(e) Loot/goal chests"*), on the door
 * chest's own path (`seedlingGenChestDoorAp.test.js`, seedling-gen-chestdoor-ap):
 *
 *   1. `seedlingGenRoom` adds one LOCATION row per `summary.lootChests` entry,
 *      AFTER the draw, at the chest's FIXED tag (`chestRows`, `kind:
 *      'chest-loot'`); the rows stay LAST, so location 0 is still the goal's.
 *      Names: `<region> - Chest`, door chests first and loot chests after them,
 *      the second and later suffixed ` 2`, ` 3`, … — unique per room.
 *   2. `seedlingGeneratedSet.placeApItems` NEVER replaces a loot chest with an
 *      `apitem`: a fixed-address report row (`rewrite: false`), reported in
 *      `report.lootChests`.
 *   3. The compiled pool gains one item per loot chest (the filler), so items ==
 *      locations.
 *
 * Plus the end to end on the JS runtime (chestdoor-ap's pattern): open the loot
 * chest → `pendingCheck` → the binding's `locationCheck` for `<region> - Chest`;
 * and byte identity: no committed preset carries a loot chest, so none moves.
 *
 * MUTANTS (measured, each reverted — the slice's as-built):
 *  m1  `placeApItems`' chest branch takes door chests only ⇒ the keep row, the
 *      built-world row and the e2e red (an apitem replaces the loot chest);
 *  m2  `chestRows` drops the loot chests ⇒ the row, hook, pool and e2e rows red;
 *  m3  the re-roll's loot-count law off ⇒ the re-roll row reds.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, beforeAll } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { buildRunFromState, runPresetHeadless } from '../procgenPipeline/presetRun.js';
import { SEEDLING_GENERATED_ROOM_STATE } from '../procgenPipeline/presetDefs.js';
import {
    CHEST_DOOR_ITEM, CHEST_DOOR_KIND, CHEST_LOOT_KIND, chestDoorRows, chestRows, extractGenRules, generateGenRoom,
    placeGenItems, rerollGenRoom, serializeGenRoom,
} from './seedlingGenRoom.js';
import {
    CHEST_LOOT_KIND as SET_CHEST_LOOT_KIND, assembleGeneratedSeedlingSet, placeApItems,
} from './seedlingGeneratedSet.js';
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
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { sidecarFieldsOf, sidecarPayloadErrors } from '../procgenCore/sidecarFields.js';

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
function hookRoom(v, { elements = 'chestloot', skeleton = 'empty' } = {}) {
    const core = generateGenRoom({ region_id: 'region_0_0', exits: [{ side: 'east' }], size: { width: 10, height: 10 },
        rng: { next: () => v }, params: { seedlingGen: { elements, skeleton, biome: 'pre-sword' } } });
    placeGenItems(core.world, { items_to_place: ['key_blue'] });
    const extracted = extractGenRules(core.world, { regionId: 'region_0_0' });
    const payload = serializeGenRoom(core.world, extracted, null, null, { ordinalOfRegion: () => 0 });
    return { world: core.world, extracted, payload };
}

/** The committed generated-room world, every generated room asked for a loot chest (seed 1: both place one). */
const LOOT_STATE = Object.freeze({ ...SEEDLING_GENERATED_ROOM_STATE,
    params: Object.freeze({ ...SEEDLING_GENERATED_ROOM_STATE.params, seedlingGenElements: 'chestloot' }) });
let lootWorld = null;
beforeAll(async () => {
    lootWorld = (await runPresetHeadless(buildRunFromState(structuredClone(LOOT_STATE)))).rulesJson;
}, 120_000);

const LOOT = { kind: 'chest-loot', cell: { tx: 8, ty: 1 }, tag: 1 };
const DOOR = { kind: 'chest-door', cell: { tx: 4, ty: 5 }, tag: 2 };

describe('1 — a LOCATION row per loot chest, after the draw, at the chest\'s fixed tag', () => {
    it('0, 1 and 2 loot chests → 0, 1 and 2 rows: `<room> - Chest`, the filler, `kind: \'chest-loot\'`', () => {
        expect(chestRows('region_4', {})).toEqual([]);
        expect(chestRows('region_4', { lootChests: [LOOT] })).toEqual([{ id: 'chest_loot', name: 'region_4 - Chest',
            kind: CHEST_LOOT_KIND, item: CHEST_DOOR_ITEM, cell: { tx: 8, ty: 1 }, tag: 1 }]);
        const two = chestRows('region_4', { lootChests: [LOOT, { ...LOOT, cell: { tx: 2, ty: 6 }, tag: 3 }] });
        expect(two.map((r) => [r.id, r.name, r.tag])).toEqual([
            ['chest_loot', 'region_4 - Chest', 1], ['chest_loot_2', 'region_4 - Chest 2', 3]]);
        expect(SET_CHEST_LOOT_KIND).toBe(CHEST_LOOT_KIND);
    });

    it('UNIQUE NAMES when a room holds a door chest AND a loot chest: door first `- Chest`, loot `- Chest 2`', () => {
        const both = chestRows('region_4', { chestDoors: [DOOR], lootChests: [LOOT] });
        expect(both.map((r) => [r.id, r.name, r.kind])).toEqual([
            ['chest_door', 'region_4 - Chest', CHEST_DOOR_KIND], ['chest_loot', 'region_4 - Chest 2', CHEST_LOOT_KIND]]);
        expect(new Set(both.map((r) => r.name)).size).toBe(2);
        /** ⛓ a door-chest room's rows are exactly chestdoor-ap's (`chestDoorRows` IS `chestRows` over doors) */
        expect(chestRows('region_4', { chestDoors: [DOOR, { ...DOOR, tag: 9 }] }))
            .toEqual(chestDoorRows('region_4', { chestDoors: [DOOR, { ...DOOR, tag: 9 }], lootChests: [LOOT] }));
    });

    it('through the hooks: the loot chest\'s row is LAST, location 0 stays the goal, the chest at cell+tag', () => {
        const { world, extracted, payload } = hookRoom(0.2);
        const [chest] = world.summary.lootChests;
        expect(payload.locations.map((l) => [l.name, l.kind ?? null, l.tag])).toEqual([
            ['region_0_0__key_blue_pickup', null, 0], ['region_0_0 - Chest', CHEST_LOOT_KIND, chest.tag]]);
        expect(payload.locations[0].cell).toEqual(payload.goal_cell);
        expect(payload.locations[1].cell).toEqual(chest.cell);
        expect(payload.record.entities.filter((e) => e.type === 'chest'))
            .toEqual([expect.objectContaining({ x: chest.cell.tx * 16, y: chest.cell.ty * 16, attrs: { tag: String(chest.tag) } })]);
        expect(extracted.locations.find((l) => l.id === 'chest_loot'))
            .toMatchObject({ item: CHEST_DOOR_ITEM, global_name: 'region_0_0 - Chest', access_rule: { rule: 'True_' } });
    }, 60_000);

    it('a RE-ROLL keeps the declared loot chests: only a draw with as many is taken, its rows re-derived', () => {
        // ⛓ branchy, drawn seed 0.85: with the count law OFF the re-roll takes attempt 4, which places NO loot chest
        //   (measured) — so the law is what keeps the declared row
        const { world } = hookRoom(0.85, { skeleton: 'branchy' });
        const rows = world.locations.filter((l) => l.kind !== CHEST_LOOT_KIND).map(({ cell: _c, tag: _t, ...r }) => r);
        const { room, err } = rerollGenRoom(world, [...world.exits.entries()], rows, 'locations');
        expect(err).toBeUndefined();
        expect(room.seed).not.toBe(world.seed);
        expect(room.summary.lootChests).toHaveLength(1);
        expect(room.locations.map((l) => [l.id, l.kind ?? null])).toEqual([
            ['key_blue_pickup', null], ['chest_loot', CHEST_LOOT_KIND]]);
        expect(room.locations[1]).toMatchObject({ cell: room.summary.lootChests[0].cell, tag: room.summary.lootChests[0].tag });
        expect(room.generation.rerolls).toBeGreaterThan(4);
    }, 60_000);

    /** ⚖ js-16 PASS (via lab-1): the sidecar `kind` enum gains 'chest-loot' (`flashSeedlingGenLibrary.js`).
     *  Mutant (measured): the enum without it ⇒ this row reds (`locations[1].kind`). */
    it('the built world\'s loot-chest sidecars VALIDATE against `flash_seedling_gen`\'s declaration', () => {
        const fields = sidecarFieldsOf(substrateRegistry.get('flash_seedling_gen'));
        const loot = Object.values(lootWorld.preset_sidecars['1']).map((sc) => sc.playable_payload)
            .filter((p) => (p?.locations ?? []).some((l) => l.kind === CHEST_LOOT_KIND));
        expect(loot).toHaveLength(2);
        for (const payload of loot) expect(sidecarPayloadErrors(fields, payload)).toEqual([]);
    });

    it('a room whose draw placed none has NO row, and no `lootChests` / `kind` key anywhere', () => {
        const none = hookRoom(0.2, { elements: '' });
        expect('lootChests' in none.world.summary).toBe(false);
        expect(none.payload.locations.map((l) => l.name)).toEqual(['region_0_0__key_blue_pickup']);
        expect(none.payload.locations.some((l) => 'kind' in l)).toBe(false);
    }, 60_000);
});

describe('2 — `placeApItems` KEEPS the loot chest: a `rewrite: false` report row, never an apitem', () => {
    const CELL = { tx: 2, ty: 1 };
    const record = () => ({ width: 4, height: 4, layers: [], entities: [{ type: 'chest', x: 32, y: 16, attrs: { tag: '1' } }] });

    it('the chest stays, no apitem lands on its cell, and the row says `kind: \'chest-loot\'`', () => {
        const { record: out, placed, chests } = placeApItems(record(), [
            { name: 'r - Chest', kind: CHEST_LOOT_KIND, cell: CELL, tag: 1 }], 'r');
        expect(out.entities).toEqual(record().entities);
        expect(out.entities.some((e) => e.type === AP_ITEM_TYPE)).toBe(false);
        expect(placed).toEqual([]);
        expect(chests).toEqual([{ location: 'r - Chest', cell: CELL, tag: 1, rewrite: false, kind: CHEST_LOOT_KIND }]);
    });

    it('the control: a plain location on the same cell IS replaced', () => {
        const { record: out, placed } = placeApItems(record(), [{ name: 'r__loc_0', cell: CELL, tag: 1 }], 'r');
        expect(out.entities.map((e) => e.type)).toEqual([AP_ITEM_TYPE]);
        expect(placed[0].replaced).toBe('chest');
    });

    it('over a built world: each loot chest is a fixed-address TABLE row, its chest in the set, no apitem on it', () => {
        const assembled = assembleGeneratedSeedlingSet(lootWorld, { selfPlayer: 1 });
        const { lootChests } = assembled.report;
        expect(lootChests.map((c) => c.location)).toEqual(['region_0_0 - Chest', 'region_0_1 - Chest']);
        expect('chestDoors' in assembled.report).toBe(false);
        expect(assembled.report.apitems.map((a) => a.location)).toEqual(['region_0_0__key_blue_pickup']);
        const records = mountedRecordsOf(assembled.set);
        for (const c of lootChests) {
            expect(assembled.table.get(placementKey(c.room, c.tag))).toMatchObject({
                ledgerId: c.location, location: c.location, level: c.room, tag: c.tag, tagSource: 'fixed', rewrite: false });
            const entities = records.get(c.room).entities.filter((e) => e.x === c.cell.tx * 16 && e.y === c.cell.ty * 16);
            expect(entities.map((e) => [e.type, e.attrs?.tag])).toEqual([['chest', String(c.tag)]]);
        }
    });
});

describe('3 — the pool gains one item per loot chest: items == locations', () => {
    it('the built world: 2 loot chests → 2 more locations and 2 more pool items than the committed world', () => {
        const committed = readJson('frontend/presets/seedling_generated_room/AP_1/AP_1_rules.json');
        const count = (rules) => ({
            locations: Object.values(rules.regions['1']).reduce((n, r) => n + (r.locations ?? []).length, 0),
            pool: Object.values(rules.itempool_counts['1']).reduce((n, k) => n + k, 0),
        });
        expect(count(committed)).toEqual({ locations: 1, pool: 1 });
        expect(count(lootWorld)).toEqual({ locations: 3, pool: 3 });
        expect(lootWorld.itempool_counts['1']).toEqual({ ...committed.itempool_counts['1'], [CHEST_DOOR_ITEM]: 2 });
        const chestLocs = Object.values(lootWorld.regions['1']).flatMap((r) => r.locations ?? [])
            .filter((l) => / - Chest$/.test(l.name));
        expect(chestLocs.map((l) => [l.name, l.item?.name])).toEqual([
            ['region_0_0 - Chest', CHEST_DOOR_ITEM], ['region_0_1 - Chest', CHEST_DOOR_ITEM]]);
    });
});

describe('⛔ byte identity — no committed preset carries a loot chest, so its set, table and report are unmoved', () => {
    /** sha256/16 of `{set, table, report}` — chestdoor-ap's digests (measured at `8f00dd71b3`) and chestdoor-preset's
     *  (`b646d32d95`), re-asserted here at this slice's code. */
    const BASE = {
        seedling_generated_room: 'f3c77ab16c411d18',
        seedling_generated_leaf: 'dc58055dc27e2726',
        seedling_generated_host: 'aabc44bbc9bd1cee',
        seedling_generated_swim: 'e0df5a13884d12d4',
        seedling_generated_chestdoor: '268593bf139e4854',
    };
    it.each(Object.keys(BASE))('%s: the same set, table and report; no `lootChests`, no loot `kind`', (game) => {
        const rules = readJson(`frontend/presets/${game}/AP_1/AP_1_rules.json`);
        const a = assembleGeneratedSeedlingSet(rules, { selfPlayer: 1 });
        const digest = createHash('sha256')
            .update(JSON.stringify({ set: a.set, table: [...a.table.entries()], report: a.report })).digest('hex').slice(0, 16);
        expect(digest).toBe(BASE[game]);
        expect('lootChests' in a.report).toBe(false);
        expect(JSON.stringify(rules)).not.toMatch(/chest-loot|lootChests/);
    });
});

describe('⛓ END TO END on the JS runtime: open the loot chest → the check fires → the location is reported', () => {
    it('the solver opens `region_0_0 - Chest` from below; `pendingCheck` "…|0|<tag>|0"; the binding checks it', () => {
        const assembled = assembleGeneratedSeedlingSet(lootWorld, { selfPlayer: 1 });
        const records = mountedRecordsOf(assembled.set);
        const levelSource = levelSourceFromAtlas(records);
        const arrival = { ...assembled.set.start };
        const chest = assembled.report.lootChests.find((c) => c.room === arrival.level);
        expect(chest.location).toBe('region_0_0 - Chest');

        const staging = bootStaging({ boot: arrival, items: { ...FLAGS }, pins: [...JS_RUNTIME_PINS] });
        const goal = { kind: 'location', level: chest.room, tag: chest.tag, name: chest.location };
        const mapped = arrivalSolverGoal(goal, { staging, levelSource, record: records.get(arrival.level) });
        expect(mapped.goal).toEqual({ kind: 'collect-placement', placement: { x: chest.cell.tx * 16, y: chest.cell.ty * 16 } });
        const request = arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource, records,
            name: 'chest-loot-ap', scratchPersistence: true });
        const { plan } = solveAnytime({ ...request, budgetWork: SOLVER_BUDGET_WORK, upgradeWindowWork: SOLVER_UPGRADE_WINDOW_WORK });
        expect(plan?.solution?.length).toBeGreaterThan(0);

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
