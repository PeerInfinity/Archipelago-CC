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
    maxItemsPerRegion = 1 } = {}) => ({
    ...SEEDLING_GENERATED_LEAF_STATE,
    substrateQuotas: { maze: 1, [GEN]: quota },
    scenario: { items, obstacles: {} },
    params: { ...SEEDLING_GENERATED_LEAF_STATE.params, seed, sphereCount, maxItemsPerRegion,
        seedlingGenHostChildren: true, startSubstrate: 'maze', seedlingGenElements: 'keygate' },
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
