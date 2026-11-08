/**
 * ⛓⛓ goal-chest-pipeline — **GOAL CHESTS IN THE FULL RANDOMIZER PIPELINE** (⚖ the user 2026-11-04, *"the next
 * priority is goal chests in the full randomizer pipeline"*, then *"I agree with your recommendations"*):
 *
 *   1. The goal chest IS the room's location 0: same id, item, name, rule, so the location count is unchanged; only the
 *      container changes (`kind: 'chest-goal'`, the chest's own tag) and the set assembler keeps the chest.
 *   2. OPT-IN: the bag key `seedlingGenGoal: 'chest'` (the room's `goal` knob → B3's `defaults.goalClass`). Nothing
 *      existing changes.
 *   3. A room that cannot fit one KEEPS the torch and that is REPORTED: `procgen_metadata["<p>"].goalContainers`,
 *      the `introductions` shape (`procgenCore/goalContainer.js`), read off each slot's serialised sidecars.
 *   4. NO loot chest in a goal-chest room until hammer's CHEST-INCIDENTAL lands. ⛓ LIFTED (goal-loot-lift): with
 *      `CHEST_LEG_DELTA` ON a goal-chest room also carries a loot chest (§6, and the two-chest e2e).
 *
 * MUTANTS (measured, each reverted — the slice's as-built):
 *  g1  `placeApItems` keeps door/loot chests only (chest-goal dropped from `KEPT_CHEST_KINDS`) ⇒ the keep row, the
 *      built-world row, the resolver row and the e2e red (an apitem replaces the goal chest);
 *  g2  `seatRows` never marks the goal row (`chestTag` forced null) ⇒ location-0 rows, the report and e2e red;
 *  g3  (retired by goal-loot-lift: the refusal is gone; its mutant is now "the refusal restored ⇒ §6 + the two-chest
 *      e2e red", and "CHEST_LEG_DELTA OFF ⇒ the loot chest dropped" is §6's in-file dependency row);
 *  g4  the report written under a hardcoded slot '1' ⇒ the 2-player row reds;
 *  g5  `seedlingGenProcgenParamsFromPayload` drops `goal` ⇒ the regenerate row reds (the room comes back a torch).
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, beforeAll } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { buildRunFromState, runPresetHeadless } from '../procgenPipeline/presetRun.js';
import {
    SEEDLING_GENERATED_CHESTDOOR_STATE, SEEDLING_GENERATED_HOST_STATE, SEEDLING_GENERATED_LEAF_STATE,
    SEEDLING_GENERATED_ROOM_STATE, SEEDLING_GENERATED_SWIM_STATE,
} from '../procgenPipeline/presetDefs.js';
import { buildRulesJson, growMaze } from '../procgenPipeline/procgenPipelineEngine.js';
import { regenerateRegionEntry } from '../apworldEditor/regionRegenerate.js';
import { composeRegenerateArgs, regionGenerationPlan } from '../apworldEditor/regionGenerationFlow.js';
import { GOAL_CONTAINER_NOT_PLACED_REASONS, goalContainerReport } from '../procgenCore/goalContainer.js';
import { rulesJsonSchemaErrors } from '../procgenCore/jsonSchemaCheck.js';
import { GOAL_CHEST_CLASS, GOAL_CHEST_REFUSALS } from './procgenSeedling.js';
import {
    CHEST_DOOR_ITEM, CHEST_GOAL_KIND, CHEST_LOOT_KIND, certifyGenRoom, extractGenRules, generateGenRoom, placeGenItems, rerollGenRoom, serializeGenRoom,
} from './seedlingGenRoom.js';
import {
    CHEST_GOAL_KIND as PAYLOAD_CHEST_GOAL_KIND, GEN_ROOM_GOAL_CHEST,
    goalContainerNoteOf,
} from './seedlingGenRoomPayload.js';
import {
    CHEST_GOAL_KIND as SET_CHEST_GOAL_KIND, assembleGeneratedSeedlingSet, placeApItems,
} from './seedlingGeneratedSet.js';
import { AP_ITEM_TYPE, placementKey } from './apPlacementRewriter.js';
import { mountedRecordsOf } from './wasmWalkTape.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { planLevelSetChunks } from './levelSetValidator.js';
import { createJsRuntime, JS_RUNTIME_PINS } from './jsRuntimeCore.js';
import { bootStaging } from './procgenOracle.js';
import { ITEM_PROPERTIES } from './tapeFormat.js';
import { solveAnytime, SOLVER_BUDGET_WORK, SOLVER_UPGRADE_WINDOW_WORK } from './jsRuntimeSolver.js';
import { arrivalSolveRequest, arrivalSolverGoal, continuationSolveRequest } from './wasmArrival.js';
import { withChestLegDelta } from './chestLegDelta.js';
import { SeedlingCheckBinding } from '../flashPanel/seedlingCheckBinding.js';
import { resolveSeedlingGoal } from '../flashPanel/seedlingPlaybackController.js';
import {
    SEEDLING_GEN_GOAL_KEY, buildSeedlingGenRegionParams, seedlingGenProcgenParamsFromPayload,
} from '../flashPanel/flashSeedlingGenLibrary.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { sidecarFieldsOf, sidecarPayloadErrors } from '../procgenCore/sidecarFields.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const SCHEMA = readJson('frontend/schema/rules.schema.json');
const GAME_CONFIG = readJson('frontend/modules/flashPanel/games/seedling.json');
const BRIDGE_CONFIG = JSON.stringify({ classes: GAME_CONFIG.classes, state_properties: GAME_CONFIG.state_properties });
const FLAGS = Object.fromEntries(Object.values(ITEM_PROPERTIES).map((s) => [s.property, s.kind === 'add' ? s.base : false]));
const GEN = 'flash_seedling_gen';

/** A pipeline room straight through the substrate's hooks (`rng.next()` fixed: the room's drawn seed). */
function hookRoom(v, { skeleton = 'empty', goal = 'chest', elements = '' } = {}) {
    const core = generateGenRoom({ region_id: 'region_0_0', exits: [{ side: 'east' }], size: { width: 10, height: 10 },
        rng: { next: () => v }, params: { seedlingGen: { skeleton, elements, biome: 'pre-sword', goal } } });
    placeGenItems(core.world, { items_to_place: ['key_blue'] });
    const extracted = extractGenRules(core.world, { regionId: 'region_0_0' });
    const payload = serializeGenRoom(core.world, extracted, null, null, { ordinalOfRegion: () => 0 });
    return { world: core.world, extracted, payload };
}
const atGoal = (p) => p.record.entities.filter((e) => e.x === p.goal_cell.tx * 16 && e.y === p.goal_cell.ty * 16);

const withGoal = (state) => Object.freeze({ ...state,
    params: Object.freeze({ ...state.params, [SEEDLING_GEN_GOAL_KEY]: GEN_ROOM_GOAL_CHEST }) });
const build = async (state) => (await runPresetHeadless(buildRunFromState(structuredClone(state)))).rulesJson;

/** The committed generated-room world (shuffled spiral, 2 rooms), every generated room asked for a goal chest. */
let goalWorld = null;
/** The committed sphere-growth host world, asked the same. */
let hostWorld = null;
/** ⛓ goal-loot-lift — the committed generated-room world asked for a goal chest AND `chestloot` in every room. */
let lootGoalWorld = null;
beforeAll(async () => {
    goalWorld = await build(withGoal(SEEDLING_GENERATED_ROOM_STATE));
    lootGoalWorld = await build(withGoal(Object.freeze({ ...SEEDLING_GENERATED_ROOM_STATE,
        params: Object.freeze({ ...SEEDLING_GENERATED_ROOM_STATE.params, seedlingGenElements: 'chestloot' }) })));
    hostWorld = await build(withGoal(SEEDLING_GENERATED_HOST_STATE));
}, 120_000);

describe('1 — LOCATION 0 IS THE GOAL CHEST', () => {
    it('one constant, three spellings; the knob value IS B3\'s goal class', () => {
        expect(CHEST_GOAL_KIND).toBe('chest-goal');
        expect(PAYLOAD_CHEST_GOAL_KIND).toBe(CHEST_GOAL_KIND);
        expect(SET_CHEST_GOAL_KIND).toBe(CHEST_GOAL_KIND);
        expect(GEN_ROOM_GOAL_CHEST).toBe(GOAL_CHEST_CLASS);
    });

    it.each([[0.2, 'empty'], [0.5, 'winding'], [0.7, 'branchy']])('drawn %s %s: location 0 is the chest on the goal cell, at its tag', (v, skeleton) => {
        const { payload } = hookRoom(v, { skeleton });
        const [chest] = atGoal(payload);
        expect(chest.type).toBe('chest');
        expect(payload.locations).toHaveLength(1);
        expect(payload.locations[0]).toEqual({ name: 'region_0_0__key_blue_pickup', item: 'key_blue', kind: CHEST_GOAL_KIND,
            cell: payload.goal_cell, tag: Number(chest.attrs.tag) });
        expect(payload.generation.goal).toBe(GOAL_CHEST_CLASS);
        expect(goalContainerNoteOf(payload)).toEqual({ placed: true });
    }, 60_000);

    it('the location is UNCHANGED but for its container: the torch room\'s row, plus `kind`', () => {
        const torch = hookRoom(0.2, { goal: '' }).payload;
        const chest = hookRoom(0.2).payload;
        const { kind, ...bare } = chest.locations[0];
        expect(kind).toBe(CHEST_GOAL_KIND);
        expect(Object.keys(bare)).toEqual(Object.keys(torch.locations[0]));
        expect([bare.name, bare.item]).toEqual([torch.locations[0].name, torch.locations[0].item]);
        expect(atGoal(torch).map((e) => e.type)).toEqual(['torchpickup']);
    }, 60_000);

    it('a RE-ROLL re-derives the kind from the new draw (a torch draw drops it; a chest draw keeps it)', () => {
        const { world } = hookRoom(0.2);
        const rows = world.locations.map(({ cell: _c, tag: _t, ...r }) => r);
        const { room, err } = rerollGenRoom(world, [...world.exits.entries()], rows, 'locations');
        expect(err).toBeUndefined();
        const chestAtGoal = room.record.entities.some((e) => e.type === 'chest'
            && e.x === room.goalCell.tx * 16 && e.y === room.goalCell.ty * 16);
        expect(room.locations[0].kind === CHEST_GOAL_KIND).toBe(chestAtGoal);
    }, 60_000);

    it('the editor\'s Save re-check (`certifyGenRoom`) certifies a goal-chest room: its goal solve opens the chest', () => {
        for (const [v, skeleton] of [[0.2, 'empty'], [0.5, 'winding']]) {
            const { payload } = hookRoom(v, { skeleton });
            expect(payload.locations[0].kind).toBe(CHEST_GOAL_KIND);
            expect(certifyGenRoom(payload, 'region_0_0')).toEqual({ certified: true, failures: [] });
        }
    }, 60_000);

    /** ⚖ js-16 review-before-GO: the sidecar `kind` enum gains 'chest-goal' (`flashSeedlingGenLibrary.js`).
     *  Mutant (measured): the enum without it ⇒ this row reds (`locations[0].kind: "chest-goal" not in enum`). */
    it('the built world\'s goal-chest sidecars VALIDATE against `flash_seedling_gen`\'s declaration', () => {
        const fields = sidecarFieldsOf(substrateRegistry.get(GEN));
        const chests = [goalWorld, hostWorld].flatMap((w) => Object.values(w.preset_sidecars['1']))
            .map((sc) => sc.playable_payload).filter((p) => (p?.locations ?? []).some((l) => l.kind === CHEST_GOAL_KIND));
        expect(chests).toHaveLength(2);
        for (const payload of chests) expect(sidecarPayloadErrors(fields, payload)).toEqual([]);
    });
});

describe('2 — `placeApItems` KEEPS the goal chest: a `rewrite: false` report row, never an apitem', () => {
    const CELL = { tx: 2, ty: 1 };
    const record = () => ({ width: 4, height: 4, layers: [], entities: [{ type: 'chest', x: 32, y: 16, attrs: { tag: '0' } }] });

    it('the chest stays, no apitem on its cell, the row says `kind: \'chest-goal\'`', () => {
        const { record: out, placed, chests } = placeApItems(record(), [
            { name: 'r__loc_0', kind: CHEST_GOAL_KIND, cell: CELL, tag: 0 }], 'r');
        expect(out.entities).toEqual(record().entities);
        expect(placed).toEqual([]);
        expect(chests).toEqual([{ location: 'r__loc_0', cell: CELL, tag: 0, rewrite: false, kind: CHEST_GOAL_KIND }]);
    });

    it('the control: the same row WITHOUT the kind (the gap, measured at base 894ddd6dcc) IS replaced by an apitem', () => {
        const { record: out, placed } = placeApItems(record(), [{ name: 'r__loc_0', cell: CELL, tag: 0 }], 'r');
        expect(out.entities.map((e) => e.type)).toEqual([AP_ITEM_TYPE]);
        expect(placed[0].replaced).toBe('chest');
    });

    it('over the built worlds: each goal chest is a fixed TABLE row, its chest in the set; `report.goalChests`', () => {
        for (const [world, names] of [[goalWorld, ['region_0_0__key_blue_pickup']], [hostWorld, ['region_2_2__loc_0']]]) {
            const a = assembleGeneratedSeedlingSet(world, { selfPlayer: 1 });
            expect(a.report.goalChests.map((c) => c.location)).toEqual(names);
            expect(a.report.apitems).toEqual([]);
            const records = mountedRecordsOf(a.set);
            for (const c of a.report.goalChests) {
                expect(a.table.get(placementKey(c.room, c.tag))).toMatchObject({
                    ledgerId: c.location, location: c.location, level: c.room, tag: c.tag, tagSource: 'fixed', rewrite: false });
                const at = records.get(c.room).entities.filter((e) => e.x === c.cell.tx * 16 && e.y === c.cell.ty * 16);
                expect(at.map((e) => [e.type, e.attrs?.tag])).toEqual([['chest', String(c.tag)]]);
            }
        }
    });
});

describe('3 — the item count is UNCHANGED: the same locations and pool as the torch world', () => {
    it.each([['seedling_generated_room', () => goalWorld], ['seedling_generated_host', () => hostWorld]])('%s', (game, world) => {
        const committed = readJson(`frontend/presets/${game}/AP_1/AP_1_rules.json`);
        const names = (rules) => Object.values(rules.regions['1']).flatMap((r) => (r.locations ?? []).map((l) => l.name)).sort();
        expect(names(world())).toEqual(names(committed));
        expect(world().itempool_counts['1']).toEqual(committed.itempool_counts['1']);
    });
});

describe('4 — a room that REFUSES the goal chest keeps the torch, and the report says why', () => {
    it.each([[6 / 13, GOAL_CHEST_REFUSALS[0]], [2 / 13, GOAL_CHEST_REFUSALS[1]]])('branchy drawn %s → %s', (v, reason) => {
        const { payload } = hookRoom(v, { skeleton: 'branchy' });
        expect(atGoal(payload).map((e) => e.type)).toEqual(['torchpickup']);
        expect('kind' in payload.locations[0]).toBe(false);
        expect(payload.generation.goalChestRefused).toBe(reason);
        expect(goalContainerNoteOf(payload)).toEqual({ placed: false, reason });
        /** the shipped room assembles it as an ordinary location: an apitem replaces the torch */
        expect(placeApItems(payload.record, payload.locations).placed[0].replaced).toBe('torchpickup');
    }, 60_000);

    it('the WORLD report EQUALS the tally of its sidecars; measured {requested 2, placed 1, notPlaced {no-ap-location 1}}', () => {
        const report = goalWorld.procgen_metadata['1'].goalContainers;
        expect(report).toEqual({ requested: 2, placed: 1, notPlaced: { [GOAL_CONTAINER_NOT_PLACED_REASONS.noLocation]: 1 } });
        const gens = Object.values(goalWorld.preset_sidecars['1']).filter((sc) => sc.substrate === GEN);
        expect(goalContainerReport(gens.map((sc) => goalContainerNoteOf(sc.playable_payload)))).toEqual(report);
        /** the room that holds no location stands its chest anyway: the report is "location 0 IS a chest" */
        const empty = gens.find((sc) => sc.playable_payload.locations.length === 0).playable_payload;
        expect(atGoal(empty).map((e) => e.type)).toEqual(['chest']);
        expect(hostWorld.procgen_metadata['1'].goalContainers).toEqual({ requested: 1, placed: 1, notPlaced: {} });
    });

    it('the report VALIDATES against rules.schema.json, and the schema refuses a malformed one', () => {
        expect(rulesJsonSchemaErrors(goalWorld, SCHEMA)).toEqual([]);
        const bad = structuredClone(goalWorld);
        bad.procgen_metadata['1'].goalContainers.bogus = 1;
        expect(rulesJsonSchemaErrors(bad, SCHEMA).join('\n')).toMatch(/goalContainers/);
    });

    it('ABSENT, not empty, on every committed generated world (none asked)', () => {
        for (const game of ['seedling_generated_room', 'seedling_generated_leaf', 'seedling_generated_host',
            'seedling_generated_swim', 'seedling_generated_chestdoor']) {
            const rules = readJson(`frontend/presets/${game}/AP_1/AP_1_rules.json`);
            expect(rules.procgen_metadata['1']).not.toHaveProperty('goalContainers');
        }
    });
});

describe('5 — the report is PER PLAYER', () => {
    const gridWorld = (seed, withGen) => {
        const { run } = buildRunFromState({ mode: 'gridGrowth',
            params: { seed, gridWidth: 3, gridHeight: 3, ...(withGen ? { [SEEDLING_GEN_GOAL_KEY]: GEN_ROOM_GOAL_CHEST } : {}) },
            scenario: { items: { key_red: 1, key_blue: 1, victory: 1 }, obstacles: { door_red: 1, door_blue: 1 } },
            substrateQuotas: {}, substrateMix: withGen ? { maze: 1, [GEN]: 2 } : { maze: 1, text_adventure: 1 },
            substrateMode: 'mix' });
        return { run, grown: growMaze(run.grow) };
    };
    /** both slots compile with no completion condition (regionIntroduced's measured note: playerId ≠ '1' with one throws) */
    const compile = ({ run, grown }, playerId) => buildRulesJson(grown.grid, {
        startCell: grown.startCell, ...run.compile, completionConditionItem: null, playerId,
        procgenMetadata: { driver: 'grid-growth' },
    });

    it('slot "2" (goal chests) carries ITS report under procgen_metadata["2"]; slot "1" (no generated room) none', () => {
        const p1 = compile(gridWorld(1, false), '1');
        const p2 = compile(gridWorld(1, true), '2');
        const doc = { procgen_metadata: { ...p1.procgen_metadata, ...p2.procgen_metadata } };
        expect(Object.keys(doc.procgen_metadata)).toEqual(['1', '2']);
        expect(doc.procgen_metadata['1']).not.toHaveProperty('goalContainers');
        const r2 = doc.procgen_metadata['2'].goalContainers;
        const gens = Object.values(p2.preset_sidecars['2']).filter((sc) => sc.substrate === GEN);
        const chests = gens.filter((sc) => sc.playable_payload.locations.some((l) => l.kind === CHEST_GOAL_KIND));
        expect(gens.length).toBeGreaterThanOrEqual(2);
        expect(chests.length).toBeGreaterThanOrEqual(1);
        expect(r2).toMatchObject({ requested: gens.length, placed: chests.length });
        expect(Object.values(r2.notPlaced).reduce((a, b) => a + b, 0)).toBe(r2.requested - r2.placed);
        expect(p2.procgen_metadata).not.toHaveProperty('1');
    }, 120_000);
});

/**
 * ⛓ goal-loot-lift (⚖ the user 2026-11-04 rule 4 lifted, once hammer's CHEST-INCIDENTAL `CHEST_LEG_DELTA` shipped ON,
 * f1e70ce021): a goal-chest room MAY also hold a LOOT chest. Both are locations (location 0 = the goal chest, the loot
 * chest its own `- Chest` row), the set keeps both, and the goal-container report still counts the goal chest only.
 * The OFF arm is the dependency: with the switch OFF the second chest leg refuses and the loot chest is dropped again.
 */
describe('6 — a goal-chest room ALSO carries a loot chest (rule 4 lifted: CHEST_LEG_DELTA ON)', () => {
    const LOOT = (p) => p.locations.filter((l) => l.kind === CHEST_LOOT_KIND);
    const chestsAt = (p, cell) => p.record.entities.filter((e) => e.type === 'chest' && e.x === cell.tx * 16 && e.y === cell.ty * 16);

    it.each([[0.2, 'empty'], [0.5, 'winding'], [0.1, 'branchy']])('drawn %s %s: location 0 the goal chest, a loot chest beside it, both chests in the record, certified', (v, skeleton) => {
        const { payload } = hookRoom(v, { skeleton, elements: 'chestloot' });
        expect(payload.locations[0]).toMatchObject({ name: 'region_0_0__key_blue_pickup', kind: CHEST_GOAL_KIND, cell: payload.goal_cell });
        const loot = LOOT(payload);
        expect(loot).toHaveLength(1);
        expect(loot[0]).toMatchObject({ name: 'region_0_0 - Chest', item: CHEST_DOOR_ITEM });
        expect(loot[0].tag).not.toBe(payload.locations[0].tag);
        expect(chestsAt(payload, payload.goal_cell).map((e) => Number(e.attrs.tag))).toEqual([payload.locations[0].tag]);
        expect(chestsAt(payload, loot[0].cell).map((e) => Number(e.attrs.tag))).toEqual([loot[0].tag]);
        expect(payload.generation.goal).toBe(GOAL_CHEST_CLASS);
        expect(goalContainerNoteOf(payload)).toEqual({ placed: true });
        expect(certifyGenRoom(payload, 'region_0_0')).toEqual({ certified: true, failures: [] });
    }, 60_000);

    it('⛓ the DEPENDENCY: CHEST_LEG_DELTA forced OFF, the same room DROPS the loot chest again (the goal chest stays)', () => {
        const off = withChestLegDelta(false, () => hookRoom(0.2, { elements: 'chestloot' })).payload;
        expect(LOOT(off)).toEqual([]);
        expect(off.locations[0].kind).toBe(CHEST_GOAL_KIND);
        expect(LOOT(hookRoom(0.2, { elements: 'chestloot' }).payload)).toHaveLength(1);
    }, 60_000);

    it('the controls: loot alone (torch goal) and goal chest + another element still build as before', () => {
        expect(LOOT(hookRoom(0.2, { elements: 'chestloot', goal: '' }).payload)).toHaveLength(1);
        expect(hookRoom(0.2, { elements: 'guard' }).payload.locations[0].kind).toBe(CHEST_GOAL_KIND);
    }, 60_000);

    it('a goal knob that is not `chest` is the knob\'s fault, by name', () => {
        expect(() => hookRoom(0.2, { goal: 'torchpickup' })).toThrow(/the generation knob `goal` = "torchpickup" is not usable/);
    });

    it('the BUILT world (spiral room, goal chest + chestloot): both kept as fixed table rows; goalContainers counts goal chests only', () => {
        const a = assembleGeneratedSeedlingSet(lootGoalWorld, { selfPlayer: 1 });
        expect(a.report.apitems).toEqual([]);
        expect(a.report.goalChests.length).toBeGreaterThanOrEqual(1);
        expect(a.report.lootChests.length).toBeGreaterThanOrEqual(1);
        const records = mountedRecordsOf(a.set);
        for (const c of [...a.report.goalChests, ...a.report.lootChests]) {
            expect(a.table.get(placementKey(c.room, c.tag))).toMatchObject({ location: c.location, level: c.room, tag: c.tag,
                tagSource: 'fixed', rewrite: false });
            const at = records.get(c.room).entities.filter((e) => e.x === c.cell.tx * 16 && e.y === c.cell.ty * 16);
            expect(at.map((e) => [e.type, e.attrs?.tag])).toEqual([['chest', String(c.tag)]]);
        }
        const gens = Object.values(lootGoalWorld.preset_sidecars['1']).filter((sc) => sc.substrate === GEN);
        const fields = sidecarFieldsOf(substrateRegistry.get(GEN));
        for (const sc of gens) expect(sidecarPayloadErrors(fields, sc.playable_payload)).toEqual([]);
        const placed = gens.filter((sc) => sc.playable_payload.locations.some((l) => l.kind === CHEST_GOAL_KIND)).length;
        const report = lootGoalWorld.procgen_metadata['1'].goalContainers;
        expect(report).toMatchObject({ requested: gens.length, placed });
        expect(placed).toBe(a.report.goalChests.length);
        expect(Object.values(report.notPlaced).reduce((x, y) => x + y, 0)).toBe(report.requested - report.placed);
        expect(rulesJsonSchemaErrors(lootGoalWorld, SCHEMA)).toEqual([]);
    });
});

describe('7 — the opt-in path: the bag key reaches the room ONLY WHEN GIVEN', () => {
    it('absent / empty → no `goal` in the regionParams; given → `goal: chest`; the payload reads it back', () => {
        expect(buildSeedlingGenRegionParams({ params: {} }).seedlingGen).not.toHaveProperty('goal');
        expect(buildSeedlingGenRegionParams({ params: { [SEEDLING_GEN_GOAL_KEY]: '' } }).seedlingGen).not.toHaveProperty('goal');
        expect(buildSeedlingGenRegionParams({ params: { [SEEDLING_GEN_GOAL_KEY]: 'chest' } }).seedlingGen.goal).toBe('chest');
        expect(seedlingGenProcgenParamsFromPayload(hookRoom(0.2).payload)[SEEDLING_GEN_GOAL_KEY]).toBe('chest');
        expect(seedlingGenProcgenParamsFromPayload(hookRoom(0.2, { goal: '' }).payload)).not.toHaveProperty(SEEDLING_GEN_GOAL_KEY);
    }, 60_000);
});

describe('8 — Playback: `resolveSeedlingGoal` resolves a goal chest as an entity goal', () => {
    it('the goal chest → {kind: location, entityType: chest}; the opt-out world\'s location keeps the apitem shape', () => {
        const a = assembleGeneratedSeedlingSet(goalWorld, { selfPlayer: 1 });
        const [c] = a.report.goalChests;
        expect(resolveSeedlingGoal({ kind: 'location', name: c.location }, a.report)).toEqual({
            goal: { kind: 'location', level: c.room, tag: c.tag, entityType: 'chest', name: c.location } });
        const plain = assembleGeneratedSeedlingSet(readJson('frontend/presets/seedling_generated_room/AP_1/AP_1_rules.json'),
            { selfPlayer: 1 });
        const [p] = plain.report.apitems;
        expect(p.location).toBe(c.location);
        expect(resolveSeedlingGoal({ kind: 'location', name: p.location }, plain.report)).toEqual({
            goal: { kind: 'location', level: p.room, tag: p.tag, name: p.location } });
        expect(resolveSeedlingGoal({ kind: 'location', name: 'Nowhere' }, a.report).refused)
            .toBe('"Nowhere" is not an AP location of the generated Seedling rooms');
    });
});

describe('⛔ byte identity — opted out, every committed generated world assembles the same set, table and report', () => {
    /** sha256/16 of `{set, table, report}` — seedlingGenChestLootAp's BASE, re-asserted at this slice's code. */
    const BASE = {
        seedling_generated_room: 'f3c77ab16c411d18',
        seedling_generated_leaf: 'dc58055dc27e2726',
        seedling_generated_host: 'aabc44bbc9bd1cee',
        seedling_generated_swim: 'e0df5a13884d12d4',
        seedling_generated_chestdoor: '268593bf139e4854',
    };
    it.each(Object.keys(BASE))('%s', (game) => {
        const rules = readJson(`frontend/presets/${game}/AP_1/AP_1_rules.json`);
        const a = assembleGeneratedSeedlingSet(rules, { selfPlayer: 1 });
        const digest = createHash('sha256')
            .update(JSON.stringify({ set: a.set, table: [...a.table.entries()], report: a.report })).digest('hex').slice(0, 16);
        expect(digest).toBe(BASE[game]);
        expect('goalChests' in a.report).toBe(false);
        expect(JSON.stringify(rules)).not.toMatch(/chest-goal|goalContainers|goalChestRefused|"goal":"chest"/);
    });
    it('a rebuild of each committed state, opted out, has no goal key anywhere (the generation is the torch world\'s)', async () => {
        for (const state of [SEEDLING_GENERATED_ROOM_STATE, SEEDLING_GENERATED_CHESTDOOR_STATE, SEEDLING_GENERATED_LEAF_STATE,
            SEEDLING_GENERATED_HOST_STATE, SEEDLING_GENERATED_SWIM_STATE]) {
            // eslint-disable-next-line no-await-in-loop
            const w = await build(state);
            expect(JSON.stringify(w)).not.toMatch(/chest-goal|goalContainers|goalChestRefused|"goal":/);
        }
    }, 120_000);
});

describe('⛓ REGENERATE: the APWorld editor\'s regenerate of a goal-chest room keeps the goal chest', () => {
    it('the recorded bag carries `seedlingGenGoal`, and the regenerated room\'s location 0 is the chest again', () => {
        const doc = structuredClone(hostWorld);
        const region = 'region_2_2';
        const before = doc.preset_sidecars['1'][region].playable_payload;
        expect(before.locations[0].kind).toBe(CHEST_GOAL_KIND);
        const plan = regionGenerationPlan(doc, '1', region, GEN);
        expect(plan.refusal ?? null).toBe(null);
        expect(plan.recorded?.[SEEDLING_GEN_GOAL_KEY]).toBe(GEN_ROOM_GOAL_CHEST);
        const res = regenerateRegionEntry(composeRegenerateArgs(doc, '1', region, GEN, { ...plan.recorded }));
        expect(res.ok, res.threw).toBe(true);
        const p = res.entry.playable_payload;
        expect(p.generation.goal).toBe(GOAL_CHEST_CLASS);
        expect(p.locations.map((l) => l.name)).toEqual(before.locations.map((l) => l.name));
        expect(p.locations[0]).toMatchObject({ name: before.locations[0].name, kind: CHEST_GOAL_KIND, cell: p.goal_cell });
        expect(atGoal(p).map((e) => e.type)).toEqual(['chest']);
    }, 120_000);
});

describe('⛓ END TO END on the JS runtime: open the goal chest → the check fires → the room\'s goal is complete', () => {
    it('the solver opens location 0\'s chest; `pendingCheck` "1|<room>|<tag>|0"; the binding checks location 0', () => {
        const assembled = assembleGeneratedSeedlingSet(goalWorld, { selfPlayer: 1 });
        const records = mountedRecordsOf(assembled.set);
        const levelSource = levelSourceFromAtlas(records);
        const arrival = { ...assembled.set.start };
        const chest = assembled.report.goalChests.find((c) => c.room === arrival.level);
        expect(chest.location).toBe('region_0_0__key_blue_pickup');

        const staging = bootStaging({ boot: arrival, items: { ...FLAGS }, pins: [...JS_RUNTIME_PINS] });
        const { goal } = resolveSeedlingGoal({ kind: 'location', name: chest.location }, assembled.report);
        const mapped = arrivalSolverGoal(goal, { staging, levelSource, record: records.get(arrival.level) });
        expect(mapped.goal).toEqual({ kind: 'collect-placement', placement: { x: chest.cell.tx * 16, y: chest.cell.ty * 16 } });
        const request = arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource, records,
            name: 'chest-goal-ap', scratchPersistence: true });
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

        /** the room's GOAL is the chest: opened (its tag cleared), and nothing else collected on the way */
        expect(JSON.parse(rt.game.botStatus()).persistence_cleared).toContainEqual({ level: chest.room, tag: chest.tag });
        expect(rt.collected.size).toBe(0);
        const checks = reports.filter(([p]) => p === 'pendingCheck').map(([, v]) => v);
        expect(checks).toEqual([`1|${chest.room}|${chest.tag}|0`]);

        const binding = new SeedlingCheckBinding({ table: assembled.table, placementKey, selfPlayer: 1 });
        const effects = binding.onStateReport('pendingCheck', checks[0]);
        expect(effects[0]).toMatchObject({ type: 'locationCheck', location: chest.location, ledgerId: chest.location,
            level: chest.room, tag: chest.tag });
        expect(binding.stats).toMatchObject({ checks: 1, unknown: 0 });
        expect(rt.deaths).toEqual([]);
    }, 120_000);

    /** ⛓ goal-loot-lift — the room holding BOTH chests: the loot chest's leg, then the goal chest's continuation from
     *  the shipped keys. Both open (their tags cleared), both checks fire, the binding checks both locations. */
    it('goal chest + loot chest in one room: both open on the JS runtime, two checks, both locations checked', () => {
        const assembled = assembleGeneratedSeedlingSet(lootGoalWorld, { selfPlayer: 1 });
        const records = mountedRecordsOf(assembled.set);
        const levelSource = levelSourceFromAtlas(records);
        const arrival = { ...assembled.set.start };
        const record = records.get(arrival.level);
        const goalChest = assembled.report.goalChests.find((c) => c.room === arrival.level);
        const lootChest = assembled.report.lootChests.find((c) => c.room === arrival.level);
        expect(goalChest.location).toBe('region_0_0__key_blue_pickup');
        expect(lootChest.location).toBe('region_0_0 - Chest');

        const staging = bootStaging({ boot: arrival, items: { ...FLAGS }, pins: [...JS_RUNTIME_PINS] });
        const solve = (request) => solveAnytime({ ...request, budgetWork: SOLVER_BUDGET_WORK, upgradeWindowWork: SOLVER_UPGRADE_WINDOW_WORK }).plan;
        const lootGoal = resolveSeedlingGoal({ kind: 'location', name: lootChest.location }, assembled.report).goal;
        const mapped = arrivalSolverGoal(lootGoal, { staging, levelSource, record });
        expect(mapped.goal).toEqual({ kind: 'collect-placement', placement: { x: lootChest.cell.tx * 16, y: lootChest.cell.ty * 16 } });
        const leg1 = solve(arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource, records, name: 'loot-leg', scratchPersistence: true }));
        expect(leg1?.solution?.length).toBeGreaterThan(0);
        const shipped = leg1.solution.map((k) => [...k]);
        const goalGoal = resolveSeedlingGoal({ kind: 'location', name: goalChest.location }, assembled.report).goal;
        const cont = continuationSolveRequest({ staging, shipped, goal: goalGoal, levelSource, records, record, name: 'goal-leg' });
        expect(cont.refusal).toBeUndefined();
        const leg2 = solve(cont.request);
        expect(leg2?.solution?.length).toBeGreaterThan(0);
        /** the continuation's plan is the TAIL: its `prefixLength` is the shipped loot leg, not part of `solution` */
        expect(leg2.prefixLength).toBe(shipped.length);
        const tail = leg2.solution;

        const reports = [];
        const rt = createJsRuntime({ onStateChanged: (p, v) => reports.push([p, v]) });
        expect(rt.game.configure(BRIDGE_CONFIG)).toBe('ok');
        for (const c of planLevelSetChunks(assembled.set).chunks) rt.game.botLoadLevels(JSON.stringify(c));
        rt.queueItems([{ class: 'game', property: 'menu', value: false },
            { invocation: 'new_instance', className: 'Game', args: [arrival.level, arrival.x, arrival.y] }]);
        rt.tick();
        reports.length = 0;
        for (const keys of [...leg1.solution, ...tail]) expect(rt.tick(new Set(keys)).halted ?? null).toBeNull();
        for (let t = 0; t < 30; t += 1) rt.tick();

        const cleared = JSON.parse(rt.game.botStatus()).persistence_cleared;
        expect(cleared).toContainEqual({ level: lootChest.room, tag: lootChest.tag });
        expect(cleared).toContainEqual({ level: goalChest.room, tag: goalChest.tag });
        const checks = reports.filter(([p]) => p === 'pendingCheck').map(([, v]) => v);
        /** the first field counts the run's checks: the loot chest's is the 1st, the goal chest's the 2nd */
        expect(checks).toEqual([`1|${lootChest.room}|${lootChest.tag}|0`, `2|${goalChest.room}|${goalChest.tag}|0`]);

        const binding = new SeedlingCheckBinding({ table: assembled.table, placementKey, selfPlayer: 1 });
        expect(checks.flatMap((c) => binding.onStateReport('pendingCheck', c)).filter((e) => e.type === 'locationCheck')
            .map((e) => [e.type, e.location]))
            .toEqual([['locationCheck', lootChest.location], ['locationCheck', goalChest.location]]);
        expect(binding.stats).toMatchObject({ checks: 2, unknown: 0 });
        expect(rt.deaths).toEqual([]);
    }, 180_000);
});
