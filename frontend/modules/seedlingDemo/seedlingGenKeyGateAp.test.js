/**
 * ⛓⛓ strategy elements r2 — **THE KEY GATE IN AN ARCHIPELAGO WORLD** (⚖ the user 2026-11-03: *"a randomized AP
 * item whose vanilla placement is the key"*, then *"B: Distinct colour per room"*):
 *
 *   1. `seedlingGenRoom` adds one LOCATION row per `summary.bossKeys` entry, AFTER the draw, at the key's FIXED cell
 *      and tag (`bossKeyRows`, `kind: 'boss-key'`), named the vanilla way (`<room> - Boss Key <t>`), holding the
 *      Seedling world's key item for its type (`BOSS_KEY_ITEMS[t]`, = `seedlingAtlasDerivation.ITEM_FOR_KEY`). The
 *      compiled pool gains that item: +1 location, +1 item, and vanilla placement puts the key on its own spot.
 *   2. THE LOCK AS A RULE: a location on the goal cell (behind the lock) requires the key item — `Has(<key>)`
 *      ANDed onto its rule in the extracted rules AND the payload.
 *   3. `seedlingGeneratedSet.placeApItems` REPLACES the `bosskey` with an `apitem` like any location (⚖ no special
 *      grants: the key reaches the player only through the location's item).
 *   4. ⚖ "B": an UNREQUESTED key gate past generated room #0 is refused at SERIALIZE (`keygate-colour-not-allocated`),
 *      and a set where two rooms hold ONE colour at ASSEMBLY (`keygate-colour-shared`). The sphere planner REQUESTS a
 *      distinct colour per room (keygate colours slice 2: `seedlingGenKeyGateColours.test.js`). And a driver that
 *      drops the room's goal rule is refused at serialize (`keygate-rule-not-carried`).
 *
 * Plus the END TO END on the JS runtime: walk to the key spot → its `locationCheck` fires; the AP item `Red Key`
 * delivered through the shipped bridge config (`Main.hasKeySet(0, true)`); walk to the goal → the lock opens →
 * the goal's `locationCheck` fires. And byte identity: no committed preset holds a key gate, so none moves.
 *
 * MUTANTS (measured, each reverted — the slice's as-built):
 *  k1  `withKeyRule` returns the rule unchanged ⇒ the FILE fails: `beforeAll`'s build is refused
 *      `keygate-rule-not-carried` (the serialize guard catches the dropped rule before any row runs);
 *  k2  `placeApItems` keeps the `bosskey` (a `boss-key` row skipped) ⇒ the replace row and the e2e red;
 *  k3  the sidecar enum without 'boss-key' ⇒ the validation row reds;
 *  k4  the serialize-time colour rule off ⇒ the two-room row reds.
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
    BOSS_KEY_ITEMS, BOSS_KEY_KIND, bossKeyLocationName, bossKeyRows, extractGenRules, generateGenRoom, placeGenItems,
    rerollGenRoom, serializeGenRoom,
} from './seedlingGenRoom.js';
import { KEYGATE_COLOUR_REFUSAL, KEYGATE_RULE_REFUSAL, KEYGATE_SHARED_REFUSAL } from './seedlingGenRoomPayload.js';
import { BOSS_KEY_KIND as SET_BOSS_KEY_KIND, assembleGeneratedSeedlingSet, placeApItems } from './seedlingGeneratedSet.js';
import { ITEM_FOR_KEY } from './seedlingAtlasDerivation.js';
import { AP_ITEM_TYPE, placementKey } from './apPlacementRewriter.js';
import { mountedRecordsOf } from './wasmWalkTape.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { planLevelSetChunks } from './levelSetValidator.js';
import { buildLevelWorld } from './levelWorld.js';
import { walkableCellsFrom } from './levelSetExits.js';
import { createJsRuntime, JS_RUNTIME_PINS } from './jsRuntimeCore.js';
import { bootStaging } from './procgenOracle.js';
import { ITEM_PROPERTIES } from './tapeFormat.js';
import { solveAnytime, SOLVER_BUDGET_WORK, SOLVER_UPGRADE_WINDOW_WORK } from './jsRuntimeSolver.js';
import { arrivalSolveRequest, arrivalSolverGoal } from './wasmArrival.js';
import { SeedlingCheckBinding } from '../flashPanel/seedlingCheckBinding.js';
import { FlashBridgeAdapter } from '../flashPanel/flashBridgeAdapter.js';
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
function hookRoom(v, { elements = 'keygate', skeleton = 'empty', items = ['key_blue', 'victory'], ordinal = 0 } = {}) {
    const core = generateGenRoom({ region_id: 'region_0_0', exits: [{ side: 'east' }], size: { width: 10, height: 10 },
        rng: { next: () => v }, params: { seedlingGen: { elements, skeleton, biome: 'pre-sword' } } });
    placeGenItems(core.world, { items_to_place: items });
    const extracted = extractGenRules(core.world, { regionId: 'region_0_0' });
    const payload = serializeGenRoom(core.world, extracted, null, null, { ordinalOfRegion: () => ordinal });
    return { world: core.world, extracted, payload };
}

/** ⛓ A key-gate world the pipeline CAN build: ONE generated room among mazes, `shuffledSpiral` (a driver that keeps
 *  the room's own location rules). Seed 1: the generated room `region_0_0` places the gate, the goal holds `key_blue`. */
const keyState = (elements) => Object.freeze({ ...SEEDLING_GENERATED_ROOM_STATE,
    substrateQuotas: Object.freeze({ maze: 3, flash_seedling_gen: 1 }),
    params: Object.freeze({ ...SEEDLING_GENERATED_ROOM_STATE.params, seedlingGenElements: elements }) });
const ONE_ROOM = keyState('keygate');
const ONE_ROOM_BLUE = keyState('keygate;type=3');
/** The committed generated-room world (TWO generated rooms), both asked for a key gate. */
const TWO_ROOMS = Object.freeze({ ...SEEDLING_GENERATED_ROOM_STATE,
    params: Object.freeze({ ...SEEDLING_GENERATED_ROOM_STATE.params, seedlingGenElements: 'keygate' }) });
const build = async (state) => (await runPresetHeadless(buildRunFromState(structuredClone(state)))).rulesJson;

let keyWorld = null;
let blueWorld = null;
beforeAll(async () => {
    keyWorld = await build(ONE_ROOM);
    blueWorld = await build(ONE_ROOM_BLUE);
}, 240_000);

const locationsOf = (rules) => Object.values(rules.regions['1']).flatMap((r) => r.locations ?? []);
const HAS = (item) => ({ rule: 'Has', args: { item_name: item } });

describe('1 — a LOCATION row per key spot: `<room> - Boss Key <t>`, the key item, fixed cell and tag', () => {
    it('the key items ARE the Seedling world\'s (`ITEM_FOR_KEY`), one per type, and the name is vanilla\'s shape', () => {
        expect(BOSS_KEY_ITEMS).toEqual(ITEM_FOR_KEY);
        expect(bossKeyLocationName('Level 019', 0)).toBe('Level 019 - Boss Key 0');
        expect(SET_BOSS_KEY_KIND).toBe(BOSS_KEY_KIND);
        expect(bossKeyRows('region_4', {})).toEqual([]);
        for (const keyType of [0, 1, 2, 3, 4]) {
            expect(bossKeyRows('region_4', { bossKeys: [{ kind: BOSS_KEY_KIND, cell: { tx: 2, ty: 1 }, tag: 2, keyType }] }))
                .toEqual([{ id: 'boss_key', name: `region_4 - Boss Key ${keyType}`, kind: BOSS_KEY_KIND,
                    item: ITEM_FOR_KEY[keyType], cell: { tx: 2, ty: 1 }, tag: 2 }]);
        }
    });

    it('through the hooks: the key row is LAST at the bosskey\'s cell+tag; location 0 is the goal and ANDs `Has(Red Key)`', () => {
        const { world, extracted, payload } = hookRoom(0.2);
        const [key] = world.summary.bossKeys;
        expect(payload.locations.map((l) => [l.name, l.kind ?? null])).toEqual([
            ['region_0_0__key_blue_pickup', null], ['region_0_0__victory_pickup', null],
            ['region_0_0 - Boss Key 0', BOSS_KEY_KIND]]);
        expect(payload.locations[0].cell).toEqual(payload.goal_cell);
        expect(payload.locations[2]).toMatchObject({ cell: key.cell, tag: key.tag, item: 'Red Key' });
        expect(payload.record.entities.filter((e) => e.type === 'bosskey')).toEqual([expect.objectContaining({
            x: key.cell.tx * 16, y: key.cell.ty * 16, attrs: { keyType: '0', tag: String(key.tag) } })]);
        expect(payload.record.entities.filter((e) => e.type === 'bosslock')).toHaveLength(1);
        /** the lock as a rule: the goal (only) requires the key, in the extracted rules and in the payload */
        const rules = Object.fromEntries(extracted.locations.map((l) => [l.id, l.access_rule]));
        expect(rules).toEqual({ key_blue_pickup: HAS('Red Key'), victory_pickup: { rule: 'True_' },
            boss_key: { rule: 'True_' } });
        expect(payload.locations[0].access_rule).toEqual(HAS('Red Key'));
        expect('access_rule' in payload.locations[1]).toBe(false);
        expect(extracted.locations.find((l) => l.id === 'boss_key'))
            .toMatchObject({ item: 'Red Key', global_name: 'region_0_0 - Boss Key 0' });
    }, 60_000);

    it('⛓ every OTHER location and every door stands on the START side of the lock (the game\'s own flood)', () => {
        for (const v of [0.2, 0.5, 0.7, 0.85, 0.95]) {
            const { payload } = hookRoom(v);
            if (!payload.locations.some((l) => l.kind === BOSS_KEY_KIND)) continue;
            /** `walkableCellsFrom` builds the level world with every solid live — the `bosslock` included */
            expect(buildLevelWorld(payload.record).collidesSolid).toBeTypeOf('function');
            const reach = walkableCellsFrom(payload.record, payload.start);
            const key = (c) => `${c.tx},${c.ty}`;
            expect(reach.has(key(payload.goal_cell)), `${v} goal behind the lock`).toBe(false);
            for (const l of payload.locations.filter((x) => key(x.cell) !== key(payload.goal_cell))) {
                expect(reach.has(key(l.cell)), `${v} ${l.name}`).toBe(true);
            }
            for (const e of payload.exits) {
                const [tx, ty] = e.exit_tiles[0];
                expect(reach.has(`${tx},${ty}`), `${v} door ${e.exit_id}`).toBe(true);
            }
        }
    }, 120_000);

    it('a RE-ROLL keeps the declared key spot: only a draw with one is taken, its row re-derived', () => {
        const { world } = hookRoom(0.2);
        const rows = world.locations.filter((l) => l.kind !== BOSS_KEY_KIND).map(({ cell: _c, tag: _t, ...r }) => r);
        const { room, err } = rerollGenRoom(world, [...world.exits.entries()], rows, 'locations');
        expect(err).toBeUndefined();
        expect(room.summary.bossKeys).toHaveLength(1);
        expect(room.locations.at(-1)).toMatchObject({ kind: BOSS_KEY_KIND, cell: room.summary.bossKeys[0].cell,
            tag: room.summary.bossKeys[0].tag });
    }, 60_000);

    /** ⚖ js-16 PASS (via lab-1): the sidecar `kind` enum gains 'boss-key' (`flashSeedlingGenLibrary.js`). */
    it('the built world\'s key-gate sidecar VALIDATES against `flash_seedling_gen`\'s declaration', () => {
        const fields = sidecarFieldsOf(substrateRegistry.get('flash_seedling_gen'));
        const keyed = Object.values(keyWorld.preset_sidecars['1']).map((sc) => sc.playable_payload)
            .filter((p) => (p?.locations ?? []).some((l) => l.kind === BOSS_KEY_KIND));
        expect(keyed).toHaveLength(1);
        for (const payload of keyed) expect(sidecarPayloadErrors(fields, payload)).toEqual([]);
    });

    it('a room without a key gate has NO row, no `bossKeys`, and no key rule', () => {
        const none = hookRoom(0.2, { elements: '' });
        expect('bossKeys' in none.world.summary).toBe(false);
        expect(none.payload.locations.some((l) => 'kind' in l || 'access_rule' in l)).toBe(false);
        expect(none.extracted.locations.every((l) => l.access_rule.rule === 'True_')).toBe(true);
    }, 60_000);
});

describe('2 — the built world: +1 location, +1 item, the goal requires its key, the key spot is REPLACED', () => {
    it('Red (type 0): `region_0_0 - Boss Key 0` holds `Red Key`; the goal ANDs `Has(Red Key)`; pool +1', () => {
        const committed = readJson('frontend/presets/seedling_generated_room/AP_1/AP_1_rules.json');
        expect(locationsOf(keyWorld).map((l) => [l.name, l.item?.name, l.access_rule])).toEqual([
            ['region_0_0__key_blue_pickup', 'key_blue', HAS('Red Key')],
            ['region_0_0 - Boss Key 0', 'Red Key', { rule: 'True_' }]]);
        expect(keyWorld.itempool_counts['1']).toEqual({ ...committed.itempool_counts['1'], 'Red Key': 1 });
    });

    it('⚖ "B" — a single room\'s colour is its `type`: `keygate;type=3` is `Boss Key 3`, `Blue Key`, `Has(Blue Key)`', () => {
        expect(locationsOf(blueWorld).map((l) => [l.name, l.item?.name, l.access_rule])).toEqual([
            ['region_0_0__key_blue_pickup', 'key_blue', HAS('Blue Key')],
            ['region_0_0 - Boss Key 3', 'Blue Key', { rule: 'True_' }]]);
        const rec = Object.values(blueWorld.preset_sidecars['1']).map((sc) => sc.playable_payload)
            .find((p) => p?.generation).record;
        expect(rec.entities.filter((e) => e.type.startsWith('boss')).map((e) => [e.type, e.attrs.keyType]))
            .toEqual([['bosslock', '3'], ['bosskey', '3']]);
    });

    it('`placeApItems` REPLACES the bosskey with an `apitem` (no special grant); the control chest rows are untouched', () => {
        const assembled = assembleGeneratedSeedlingSet(keyWorld, { selfPlayer: 1 });
        const spot = assembled.report.apitems.find((a) => a.location === 'region_0_0 - Boss Key 0');
        expect(spot).toMatchObject({ room: 0, replaced: 'bosskey' });
        const rec = mountedRecordsOf(assembled.set).get(0);
        expect(rec.entities.some((e) => e.type === 'bosskey')).toBe(false);
        expect(rec.entities.filter((e) => e.type === 'bosslock')).toHaveLength(1);
        expect(rec.entities.find((e) => e.type === AP_ITEM_TYPE && e.x === spot.cell.tx * 16 && e.y === spot.cell.ty * 16))
            .toMatchObject({ attrs: { tag: String(spot.tag) } });
        expect(assembled.table.get(placementKey(0, spot.tag))).toMatchObject({ location: 'region_0_0 - Boss Key 0' });
        expect('chestDoors' in assembled.report || 'lootChests' in assembled.report).toBe(false);
        /** the bare function, too: a `boss-key` row on a bosskey cell replaces it */
        const out = placeApItems({ entities: [{ type: 'bosskey', x: 32, y: 16, attrs: { keyType: '0', tag: '2' } }] },
            [{ name: 'r - Boss Key 0', kind: BOSS_KEY_KIND, cell: { tx: 2, ty: 1 }, tag: 2 }]);
        expect(out.record.entities.map((e) => e.type)).toEqual([AP_ITEM_TYPE]);
        expect(out.placed[0].replaced).toBe('bosskey');
    });
});

describe('3 — ⚖ "B: Distinct colour per room": an UNREQUESTED key gate past room #0, and a shared colour, refused BY NAME', () => {
    it('two generated key-gate rooms in a spiral (no planner request): refused at SERIALIZE (`keygate-colour-not-allocated`)', async () => {
        await expect(build(TWO_ROOMS)).rejects.toThrow(new RegExp(`^${KEYGATE_COLOUR_REFUSAL}: multi-room keygate colours are allocated by the sphere planner's requests, and this room's key gate was not requested\\. .*region_0_1.*#1`));
    }, 120_000);

    it('two key-gate rooms holding ONE colour in a set: refused at ASSEMBLY (`keygate-colour-shared`)', () => {
        const rules = structuredClone(readJson('frontend/presets/seedling_generated_room/AP_1/AP_1_rules.json'));
        for (const sc of Object.values(rules.preset_sidecars['1'])) {
            const p = sc.playable_payload;
            if (!p?.generation) continue;
            p.locations.push({ name: `${p.level} - Boss Key 0`, kind: BOSS_KEY_KIND, item: 'Red Key',
                cell: { ...p.start }, tag: 29 });
        }
        expect(() => assembleGeneratedSeedlingSet(rules, { selfPlayer: 1 }))
            .toThrow(new RegExp(`^${KEYGATE_SHARED_REFUSAL}: generated Seedling set: rooms region_0_0, region_0_1 each hold a KEY GATE opened by 'Red Key'`));
        /** DISTINCT colours are no longer refused here (the planner allocates them; ⛓ keygate colours slice 2) */
        let n = 0;
        for (const sc of Object.values(rules.preset_sidecars['1'])) {
            const key = sc.playable_payload?.locations?.find((l) => l.kind === BOSS_KEY_KIND);
            if (key) { key.item = BOSS_KEY_ITEMS[n]; n += 1; }
        }
        expect(() => assembleGeneratedSeedlingSet(rules, { selfPlayer: 1 }))
            .not.toThrow(new RegExp(`^(${KEYGATE_SHARED_REFUSAL}|${KEYGATE_COLOUR_REFUSAL})`));
    });

    it('⚠ KNOWN LIMIT, named: a key gate in generated room #1 is refused even when room #0 has none', () => {
        expect(() => hookRoom(0.2, { ordinal: 1 })).toThrow(/keygate-colour-not-allocated: .*#1.*KNOWN LIMIT/s);
        expect(() => hookRoom(0.2, { ordinal: 0 })).not.toThrow();
        expect(() => hookRoom(0.2, { elements: '', ordinal: 1 })).not.toThrow();
    }, 60_000);

    it('a driver that DROPS the goal\'s key rule is refused at serialize (`keygate-rule-not-carried`)', () => {
        const core = generateGenRoom({ region_id: 'region_0_0', exits: [{ side: 'east' }], size: { width: 10, height: 10 },
            rng: { next: () => 0.2 }, params: { seedlingGen: { elements: 'keygate', skeleton: 'empty', biome: 'pre-sword' } } });
        placeGenItems(core.world, { items_to_place: ['key_blue'] });
        const extracted = extractGenRules(core.world, { regionId: 'region_0_0' });
        /** what the procedural driver does (`procgenPipelineEngine`'s spec override): the spec's rule wins */
        for (const l of extracted.locations) l.access_rule = { rule: 'True_' };
        expect(() => serializeGenRoom(core.world, extracted, null, null, { ordinalOfRegion: () => 0 }))
            .toThrow(new RegExp(`^${KEYGATE_RULE_REFUSAL}: .*key_blue_pickup.*'Red Key'`));
        /** a spec rule that already requires the key is CARRIED, and passes */
        for (const l of extracted.locations) {
            if (l.id === 'key_blue_pickup') l.access_rule = { rule: 'And', children: [HAS('Sword'), HAS('Red Key')] };
        }
        expect(() => serializeGenRoom(core.world, extracted, null, null, { ordinalOfRegion: () => 0 })).not.toThrow();
    }, 60_000);
});

describe('⛔ byte identity — no committed preset holds a key gate, so its set, table and report are unmoved', () => {
    /** sha256/16 of `{set, table, report}` — chestdoor-ap's and chestdoor-preset's digests, re-asserted here. */
    const BASE = {
        seedling_generated_room: 'f3c77ab16c411d18',
        seedling_generated_leaf: 'dc58055dc27e2726',
        seedling_generated_host: 'aabc44bbc9bd1cee',
        seedling_generated_swim: 'e0df5a13884d12d4',
        seedling_generated_chestdoor: '268593bf139e4854',
    };
    it.each(Object.keys(BASE))('%s: the same set, table and report; no `boss-key` anywhere', (game) => {
        const rules = readJson(`frontend/presets/${game}/AP_1/AP_1_rules.json`);
        const a = assembleGeneratedSeedlingSet(rules, { selfPlayer: 1 });
        const digest = createHash('sha256')
            .update(JSON.stringify({ set: a.set, table: [...a.table.entries()], report: a.report })).digest('hex').slice(0, 16);
        expect(digest).toBe(BASE[game]);
        expect(JSON.stringify(rules)).not.toMatch(/boss-key|bossKeys|bosslock/);
    });
});

/** One leg on the JS runtime: solve from `staging` to `goal` (an AP location), drive the plan, return the checks. */
function leg(rt, { assembled, records, levelSource, staging, goal, name }) {
    const mapped = arrivalSolverGoal(goal, { staging, levelSource, record: records.get(goal.level) });
    const request = arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource, records, name,
        scratchPersistence: true });
    const res = solveAnytime({ ...request, budgetWork: SOLVER_BUDGET_WORK, upgradeWindowWork: SOLVER_UPGRADE_WINDOW_WORK });
    const { plan } = res;
    expect(plan?.solution?.length, name).toBeGreaterThan(0);
    return { mapped, plan };
}

describe('⛓ END TO END on the JS runtime: key spot → its check; the AP key delivered; the lock opens → the goal\'s check', () => {
    it('`region_0_0 - Boss Key 0` fires; `Red Key` → `Main.hasKeySet(0, true)`; the walk opens the lock and fires the goal', () => {
        const assembled = assembleGeneratedSeedlingSet(keyWorld, { selfPlayer: 1 });
        const records = mountedRecordsOf(assembled.set);
        const levelSource = levelSourceFromAtlas(records);
        const arrival = { ...assembled.set.start };
        const spot = assembled.report.apitems.find((a) => a.location === 'region_0_0 - Boss Key 0');
        const goalRow = assembled.report.apitems.find((a) => a.location === 'region_0_0__key_blue_pickup');
        const binding = new SeedlingCheckBinding({ table: assembled.table, placementKey, selfPlayer: 1 });

        const reports = [];
        const rt = createJsRuntime({ onStateChanged: (p, v) => reports.push([p, v]) });
        expect(rt.game.configure(BRIDGE_CONFIG)).toBe('ok');
        for (const c of planLevelSetChunks(assembled.set).chunks) rt.game.botLoadLevels(JSON.stringify(c));
        rt.queueItems([{ class: 'game', property: 'menu', value: false },
            { invocation: 'new_instance', className: 'Game', args: [arrival.level, arrival.x, arrival.y] }]);
        rt.tick();
        reports.length = 0;
        const checks = () => reports.filter(([p]) => p === 'pendingCheck').map(([, v]) => v);

        /** LEG 1 — the key spot (an apitem now): its check fires, and the game holds NO key (no special grant). */
        const staging1 = bootStaging({ boot: arrival, items: { ...FLAGS }, pins: [...JS_RUNTIME_PINS] });
        const one = leg(rt, { assembled, records, levelSource, staging: staging1, name: 'keygate-spot',
            goal: { kind: 'location', level: spot.room, tag: spot.tag, name: spot.location } });
        expect(one.mapped.goal.placement).toEqual({ x: spot.cell.tx * 16, y: spot.cell.ty * 16 });
        for (const keys of one.plan.solution) expect(rt.tick(new Set(keys)).halted ?? null).toBeNull();
        for (let t = 0; t < 30; t += 1) rt.tick();
        expect(checks()).toEqual([`1|${spot.room}|${spot.tag}|0`]);
        expect(binding.onStateReport('pendingCheck', checks()[0])[0])
            .toMatchObject({ type: 'locationCheck', location: 'region_0_0 - Boss Key 0' });
        const keyMask = () => JSON.parse(rt.game.readState()).keyMask;
        expect(keyMask()).toBe(0);

        /** THE AP ITEM — `Red Key` (vanilla placement) through the SHIPPED bridge config: a method-call write. */
        const adapter = new FlashBridgeAdapter({
            config: GAME_CONFIG, flashObjectId: 'keygate-e2e',
            stateManager: { getLatestStateSnapshot: () => ({ inventory: { 'Red Key': 1 } }) },
            dispatcher: { publish: () => {} }, eventBus: { subscribe: () => () => {} }, log: () => {},
        });
        adapter.gameReady = true;
        const writes = adapter._itemWritesFor({ 'Red Key': 1 }, { quiet: true })
            .filter((w) => w.invocation === 'method_call')
            .map(({ invocation, path, method, args }) => ({ invocation, path, method, args }));
        expect(writes).toEqual([{ invocation: 'method_call', path: [{ class: 'Main' }], method: 'hasKeySet', args: [0, true] }]);
        rt.queueItems(writes);
        rt.tick();
        expect(keyMask()).toBe(1);

        /** LEG 2 — the player re-enters the room at its arrival HOLDING key 0 (the session keeps the AP key and the
         *  cleared key spot): the walk opens the lock from below and takes the goal. ⚠ Booted at the arrival, not
         *  mid-tile where leg 1 stopped: measured, a solve booted at (39.9,72.85) stalled on a wall graze walking
         *  to the lock's stance — a solver walk from an off-grid boot, not a key or lock question. */
        rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [arrival.level, arrival.x, arrival.y] }]);
        rt.tick();
        expect(keyMask()).toBe(1);
        expect(JSON.parse(rt.game.botStatus()).persistence_cleared).toContainEqual({ level: spot.room, tag: spot.tag });
        const staging2 = bootStaging({ boot: arrival, items: { ...FLAGS }, pins: [...JS_RUNTIME_PINS] });
        staging2.save.keys = [0];
        staging2.persistence = [{ level: spot.room, tag: spot.tag, note: 'the key spot collected (leg 1)' }];
        reports.length = 0;
        const two = leg(rt, { assembled, records, levelSource, staging: staging2, name: 'keygate-goal',
            goal: { kind: 'location', level: goalRow.room, tag: goalRow.tag, name: goalRow.location } });
        for (const keys of two.plan.solution) expect(rt.tick(new Set(keys)).halted ?? null).toBeNull();
        for (let t = 0; t < 30; t += 1) rt.tick();
        /** ⛓ the lock's OWN clear reports first (`BossLock.update`'s `setPersistence(tag, false)` — its tag is no AP
         *  location, so the binding files it unknown), then the goal's check: the lock opened, then the goal fell. */
        const lock = records.get(0).entities.find((e) => e.type === 'bosslock');
        expect(checks()).toEqual([`2|0|${lock.attrs.tag}|0`, `3|${goalRow.room}|${goalRow.tag}|0`]);
        expect(binding.onStateReport('pendingCheck', checks()[0]).some((e) => e.type === 'locationCheck')).toBe(false);
        expect(binding.onStateReport('pendingCheck', checks()[1])[0])
            .toMatchObject({ type: 'locationCheck', location: 'region_0_0__key_blue_pickup' });
        expect(binding.stats).toMatchObject({ checks: 2, unknown: 1 });
        expect(rt.deaths).toEqual([]);
    }, 240_000);
});
