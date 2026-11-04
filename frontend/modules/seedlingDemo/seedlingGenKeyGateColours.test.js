/**
 * ⛓⛓ KEYGATE COLOURS (slice 2) — **SPHERE GROWTH REQUESTS EACH KEY-GATE ROOM'S KEY, ONE COLOUR PER ROOM** (⚖ the
 * user 2026-11-03: *"B: Distinct colour per room"*; then *"Yes, add introduced, and integrate it with at least sphere
 * growth mode. Regenerating a region should attempt to match the logic of the first generation, including
 * introduced items. Alternatively, items could be introduced only if the procgen pipeline specifically requests
 * them."*; then *"I want the reporting to happen through a substrate agnostic method, like the substrate registry."*).
 *
 * The capability is the registry entry's `itemIntroduction` (`procgenCore/itemIntroduction.js`); the planner's
 * pre-pass is `procgenPipeline/sphereIntroductions.js`. What these rows hold, on real sphere-growth worlds:
 *   1. 2+ key-gate rooms take DISTINCT colours, each room's goal ANDs its own `Has(<Colour> Key)`, and the key is
 *      a sphere item: the plan-vs-world oracle is EXACT and the sphere log carries the key (s1–3).
 *   2. BOTH SIDES of the logic: the same world checked against the plan WITHOUT the request reds; WITH it, it is
 *      exact. And the gate: a room that introduces a key the planner never asked for is refused by name.
 *   3. A 6th key-gate room is refused by name (`keygate-colours-exhausted`).
 *   4. REPLAY: the APWorld editor's regenerate of a key-gate room reproduces the first generation's colour, key
 *      location and goal rule (the limit `keygate-colour-not-allocated` no longer applies to it).
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, beforeAll, afterEach } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { buildRunFromState, runPresetHeadless } from '../procgenPipeline/presetRun.js';
import { SEEDLING_GENERATED_LEAF_STATE } from '../procgenPipeline/presetDefs.js';
import { computeItemSpheres, compareSpheresToPlan } from '../procgenPipeline/spherePlanner.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { ITEM_INTRODUCTION_REFUSAL_NAMES } from '../procgenCore/itemIntroduction.js';
import { regenerateRegionEntry } from '../apworldEditor/regionRegenerate.js';
import { composeRegenerateArgs, regionGenerationPlan } from '../apworldEditor/regionGenerationFlow.js';
import { BOSS_KEY_ITEMS, BOSS_KEY_KIND } from './seedlingGenRoom.js';
import { KEYGATE_EXHAUSTED_REFUSAL } from './seedlingGenRoomPayload.js';
import { assembleGeneratedSeedlingSet } from './seedlingGeneratedSet.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}

const GEN = 'flash_seedling_gen';
/** A sphere world of generated rooms behind a maze start, every room asked for `keygate` (no type). */
const keyWorld = (seed, { sphereCount = 4, quota = 5, items = { key_red: 1, key_blue: 1, key_green: 1, victory: 1 },
    maxItemsPerRegion = 1, spheresPerBatch = null } = {}) => ({
    ...SEEDLING_GENERATED_LEAF_STATE,
    substrateQuotas: { maze: 1, [GEN]: quota },
    scenario: { items, obstacles: {} },
    params: { ...SEEDLING_GENERATED_LEAF_STATE.params, seed, sphereCount, maxItemsPerRegion,
        seedlingGenHostChildren: true, startSubstrate: 'maze', seedlingGenElements: 'keygate',
        ...(spheresPerBatch ? { spheresPerBatch } : {}) },
});
const build = async (state) => runPresetHeadless(buildRunFromState(structuredClone(state)));
const HAS = (item) => ({ rule: 'Has', args: { item_name: item } });
const locationsOf = (rules) => Object.entries(rules.regions['1'])
    .flatMap(([region, r]) => (r.locations ?? []).map((l) => ({ region, ...l })));
const itemName = (l) => l.item?.name ?? l.item;

/** Every key-gate room of a built world: its key location, and the location(s) its key opens. */
function keyRooms(rules) {
    const out = [];
    for (const [region, sc] of Object.entries(rules.preset_sidecars['1'])) {
        const key = (sc.playable_payload?.locations ?? []).find((l) => l.kind === BOSS_KEY_KIND);
        if (!key) continue;
        const behind = (rules.regions['1'][region].locations ?? []).filter((l) => JSON.stringify(l.access_rule)
            === JSON.stringify(HAS(key.item)));
        out.push({ region, key, behind, payload: sc.playable_payload });
    }
    return out;
}

const WORLDS = {};
beforeAll(async () => {
    for (const seed of [1, 2, 3]) WORLDS[seed] = await build(keyWorld(seed));
}, 240_000);

describe('1 — sphere growth: one colour per key-gate room, the key a SPHERE item, the oracle exact', () => {
    it.each([1, 2, 3])('seed %i: 2+ key-gate rooms, DISTINCT colours, each goal behind its own key', (seed) => {
        const { rulesJson, oracleErrors } = WORLDS[seed];
        const rooms = keyRooms(rulesJson);
        expect(rooms.length).toBeGreaterThanOrEqual(2);
        const keys = rooms.map((r) => r.key.item);
        expect(new Set(keys).size).toBe(keys.length);
        for (const k of keys) expect(BOSS_KEY_ITEMS).toContain(k);
        for (const r of rooms) {
            expect(r.behind, `${r.region}: a location behind ${r.key.item}`).toHaveLength(1);
            /** the location behind the lock stands on the room's goal cell (location 0 of the payload) */
            expect(r.payload.locations[0].access_rule).toEqual(HAS(r.key.item));
            expect(r.payload.locations[0].cell).toEqual(r.payload.goal_cell);
            /** and the key location holds the key, vanilla placement, under the vanilla name shape */
            const keyLoc = locationsOf(rulesJson).find((l) => itemName(l) === r.key.item);
            expect(keyLoc.region).toBe(r.region);
            expect(keyLoc.name).toBe(`${r.region} - Boss Key ${BOSS_KEY_ITEMS.indexOf(r.key.item)}`);
        }
        expect(oracleErrors).toEqual([]);
    });

    it.each([1, 2, 3])('seed %i: the sphere log carries each key in the sphere the plan put it in', (seed) => {
        const { rulesJson } = WORLDS[seed];
        const plan = rulesJson.procgen_metadata['1'].sphere_plan;
        const planned = new Map();
        plan.spheres.forEach((s) => (s.introduced ?? []).forEach((i) => planned.set(i, s.sphere)));
        expect(planned.size).toBe(keyRooms(rulesJson).length);
        const computed = computeItemSpheres(rulesJson);
        for (const [item, sphere] of planned) {
            expect(computed.find((s) => s.items.includes(item))?.sphere, item).toBe(sphere);
        }
    });

    it.each([1, 2, 3])('seed %i: the tree RECORDS each decision (`introduces`), and the set assembles', (seed) => {
        const { rulesJson } = WORLDS[seed];
        const nodes = rulesJson.procgen_metadata['1'].sphere_tree.nodes;
        const recorded = nodes.flatMap((n) => n.introduces ?? []).map((d) => d.item).sort();
        expect(recorded).toEqual(keyRooms(rulesJson).map((r) => r.key.item).sort());
        /** a node of a substrate with nothing to introduce records nothing */
        for (const n of nodes) if (n.substrate !== GEN) expect(n).not.toHaveProperty('introduces');
        expect(() => assembleGeneratedSeedlingSet(rulesJson, { selfPlayer: 1 })).not.toThrow();
    });
});

describe('1b — R1/R2 (js-16): CHAINED rooms, and a decision REPLAYED across batches', () => {
    it('a key-gate room whose host is ITSELF a key-gate room (chained): every seed, oracle exact', () => {
        for (const seed of [1, 2, 3]) {
            const { rulesJson, oracleErrors } = WORLDS[seed];
            const nodes = rulesJson.procgen_metadata['1'].sphere_tree.nodes;
            const keyed = new Set(nodes.filter((n) => n.introduces?.length).map((n) => n.index));
            const chainedPairs = nodes.filter((n) => n.introduces?.some((d) => keyed.has(d.lockedFrom)));
            expect(chainedPairs.length, `seed ${seed}`).toBeGreaterThanOrEqual(1);
            /** the client locked a DEALT item of its host, never the host's own key */
            for (const n of chainedPairs) expect(BOSS_KEY_ITEMS).not.toContain(n.introduces[0].lockedItem);
            expect(oracleErrors).toEqual([]);
        }
    });

    it.each([1, 2, 3])('seed %i, spheresPerBatch=3 over 6 spheres: a decision of batch 1 is replayed in batch 2', async (seed) => {
        const items = { key_red: 1, key_blue: 1, key_green: 1, key_yellow: 1, key_purple: 1, victory: 1 };
        const { rulesJson, oracleErrors } = await build(keyWorld(seed, { sphereCount: 6, quota: 7, items, spheresPerBatch: 3 }));
        const nodes = rulesJson.procgen_metadata['1'].sphere_tree.nodes;
        const early = nodes.filter((n) => n.wave < 3 && n.introduces?.length);
        expect(early.length, 'a key-gate room decided in batch 1').toBeGreaterThanOrEqual(1);
        /** batch 2 re-dealt every item and found each locked item on its host again (no throw), and logic is exact */
        for (const n of early) {
            const [d] = n.introduces;
            const region = Object.keys(rulesJson.regions['1']).find((r) => (rulesJson.regions['1'][r].locations ?? [])
                .some((l) => JSON.stringify(l.access_rule) === JSON.stringify(HAS(d.item))));
            expect(region, `${d.item}'s lock is in the world`).toBeTruthy();
        }
        expect(oracleErrors).toEqual([]);
        expect(new Set(keyRooms(rulesJson).map((r) => r.key.item)).size).toBe(keyRooms(rulesJson).length);
    }, 120_000);
});

describe('2 — both sides of the logic, and the GATE', () => {
    it.each([1, 2, 3])('seed %i: WITHOUT the request the plan does not match the world; WITH it, exact', (seed) => {
        const { rulesJson } = WORLDS[seed];
        const plan = rulesJson.procgen_metadata['1'].sphere_plan;
        const without = { ...plan, spheres: plan.spheres.map(({ introduced: _i, ...s }) => s) };
        const computed = computeItemSpheres(rulesJson);
        expect(compareSpheresToPlan(computed, plan)).toEqual([]);
        expect(compareSpheresToPlan(computed, without).length).toBeGreaterThan(0);
    });

    describe('a substrate that introduces a key the planner did not request', () => {
        const original = substrateRegistry.get.bind(substrateRegistry);
        afterEach(() => { substrateRegistry.get = original; });
        it('is refused BY NAME (`unrequested-introduction`)', async () => {
            const entry = original(GEN);
            /** a misbehaving entry: it drops the pipeline's request and draws its key gate anyway */
            const rogue = { ...entry, generateRegionCore: (input) => {
                const { introduce: _drop, ...rest } = input;
                return entry.generateRegionCore(rest);
            } };
            substrateRegistry.get = (id) => (id === GEN ? rogue : original(id));
            await expect(build(keyWorld(1))).rejects.toThrow(
                new RegExp(`^${ITEM_INTRODUCTION_REFUSAL_NAMES.unrequested}: region '[^']+' holds '[A-Za-z]+ Key'`));
        }, 120_000);
    });
});

describe('3 — a 6th key-gate room is refused by name', () => {
    it('`keygate-colours-exhausted`, before any room is drawn', async () => {
        /** 8 spheres, one item each, all generated rooms: waves 0..5 are eligible, so the 6th asks for a 6th key */
        const state = keyWorld(1, { sphereCount: 8, quota: 9, items: { key_red: 1, key_blue: 1, key_green: 1,
            key_yellow: 1, key_purple: 1, key_orange: 1, key_white: 1, victory: 1 } });
        await expect(build(state)).rejects.toThrow(new RegExp(`^${KEYGATE_EXHAUSTED_REFUSAL}: generated Seedling room `
            + `.* all 5 key colours \\(${BOSS_KEY_ITEMS.join(', ')}\\) are already in the world`));
    }, 120_000);
});

describe('4 — REPLAY: the APWorld editor\'s regenerate reproduces the first generation\'s key gate', () => {
    it.each([1, 2, 3])('seed %i: every key-gate room regenerates with ITS colour, key location and goal rule', (seed) => {
        const doc = structuredClone(WORLDS[seed].rulesJson);
        for (const room of keyRooms(doc)) {
            const plan = regionGenerationPlan(doc, '1', room.region, GEN, { seed: 7 });
            expect(plan.refusal ?? null).toBe(null);
            /** the form's plain defaults (elements empty) AND the knobs read back off the payload: both replay */
            for (const bag of [plan.defaults, plan.recorded ?? plan.defaults]) {
            const args = composeRegenerateArgs(doc, '1', room.region, GEN, { ...bag });
            const res = regenerateRegionEntry(args);
            expect(res.ok, res.threw).toBe(true);
            const p = res.entry.playable_payload;
            const key = p.locations.find((l) => l.kind === BOSS_KEY_KIND);
            /** the first generation's logic, replayed: the same colour, under the same location name */
            expect(key).toMatchObject({ name: room.key.name, item: room.key.item });
            expect(p.locations[0].access_rule).toEqual(HAS(room.key.item));
            expect(p.locations[0].cell).toEqual(p.goal_cell);
            expect(p.locations.map((l) => l.name).sort()).toEqual(room.payload.locations.map((l) => l.name).sort());
            /** a different room (a fresh seed), the same lock */
            expect(p.record.entities.filter((e) => e.type === 'bosslock').map((e) => e.attrs.keyType))
                .toEqual([String(BOSS_KEY_ITEMS.indexOf(room.key.item))]);
            }
        }
    }, 120_000);
});

/**
 * ⛓⛓ slice 2b (`procgen-region-introduced`) — THE INTRODUCTIONS REPORT under sphere growth (⚖ the user, on rooms
 * configured for a key gate that got none: *"Accept, and report it"*). `procgen_metadata["1"].introductions` must
 * agree with the R3 sweep's own classification of every node decided NONE (`seedlingGenKeyGateColours.slow.test.js`
 * `noneReason`: the plan's last wave, a batch's last wave, else no host), plus fillers, which the planner now decides
 * NONE outright (left unasked, a filler drew a key the plan never scheduled: refused, measured seeds 1 and 2).
 */
describe('5 — the introductions report agrees with the sweep\'s classification, each sphere reason produced', () => {
    const sweepReason = (n, sphereCount, batch) => {
        if (n.isFiller) return 'filler-region';
        if (n.wave + 2 > sphereCount) return 'last-wave-of-plan';
        if (batch && n.wave % batch === batch - 1) return 'batch-boundary';
        return 'no-host';
    };
    const recount = (rules, sphereCount, batch = null) => {
        const nodes = rules.procgen_metadata['1'].sphere_tree.nodes.filter((n) => Array.isArray(n.introduces));
        const notPlaced = {};
        for (const n of nodes.filter((x) => x.introduces.length === 0)) {
            const r = sweepReason(n, sphereCount, batch);
            notPlaced[r] = (notPlaced[r] ?? 0) + 1;
        }
        return { requested: nodes.length, placed: nodes.filter((n) => n.introduces.length > 0).length, notPlaced };
    };

    it.each([1, 2, 3])('seed %i (4 spheres, mono): last-wave-of-plan; the report equals the recount', (seed) => {
        const report = WORLDS[seed].rulesJson.procgen_metadata['1'].introductions;
        expect(report).toEqual(recount(WORLDS[seed].rulesJson, 4));
        expect(report.notPlaced['last-wave-of-plan']).toBeGreaterThanOrEqual(1);
        expect(report.placed).toBe(keyRooms(WORLDS[seed].rulesJson).length);
    });

    it('batched (6 spheres, 3 per batch, seed 1): batch-boundary is produced and counted', async () => {
        const items = { key_red: 1, key_blue: 1, key_green: 1, key_yellow: 1, key_purple: 1, victory: 1 };
        const { rulesJson } = await build(keyWorld(1, { sphereCount: 6, quota: 7, items, spheresPerBatch: 3 }));
        const report = rulesJson.procgen_metadata['1'].introductions;
        expect(report).toEqual(recount(rulesJson, 6, 3));
        expect(report.notPlaced['batch-boundary']).toBeGreaterThanOrEqual(1);
    }, 120_000);

    it('fillers (fillerCount 2, seed 1 — refused before this slice): filler-region, and the oracle exact', async () => {
        const state = keyWorld(1, { quota: 8 });
        state.params.fillerCount = 2;
        const { rulesJson, oracleErrors } = await build(state);
        const report = rulesJson.procgen_metadata['1'].introductions;
        expect(report).toEqual(recount(rulesJson, 4));
        expect(report.notPlaced['filler-region']).toBe(2);
        expect(oracleErrors).toEqual([]);
    }, 120_000);

    it('a world whose declaring substrate is configured for NO key gate carries no report (R4)', async () => {
        const state = keyWorld(1);
        state.params.seedlingGenElements = '';
        const { rulesJson } = await build(state);
        expect(rulesJson.procgen_metadata['1']).not.toHaveProperty('introductions');
    }, 120_000);
});
