/**
 * ⛓⛓ goal-chest-pipeline — **THE SWEEP**: pipeline worlds with every generated room asked for a goal chest
 * (`seedlingGenGoal: 'chest'`), across the growth modes (sphere, shuffled spiral, grid, top-down; sphere and grid
 * again on the branchy skeleton, where the generator refuses goal chests) × seeds. For each
 * world, the build either succeeds or is refused BY NAME, and a built world:
 *   · reports `procgen_metadata["1"].goalContainers` EQUAL to the tally of its own sidecars (every generated room
 *     counted once: placed = location 0 is `kind: 'chest-goal'`, else its reason);
 *   · names only declared reasons (the generator's `GOAL_CHEST_REFUSALS`, or `no-ap-location`);
 *   · holds the SAME location names and pool as the same world opted out (the count is unchanged);
 *   · assembles, every goal chest a kept chest (`report.goalChests`, no apitem on its cell).
 * The per-mode totals are printed (`GOAL-CHEST SWEEP`), for the packet.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, afterAll } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { buildRunFromState, runPresetHeadless } from '../procgenPipeline/presetRun.js';
import {
    SEEDLING_GENERATED_HOST_STATE, SEEDLING_GENERATED_LEAF_STATE, SEEDLING_GENERATED_ROOM_STATE,
} from '../procgenPipeline/presetDefs.js';
import { GOAL_CONTAINER_NOT_PLACED_REASONS, goalContainerReport } from '../procgenCore/goalContainer.js';
import { GOAL_CHEST_REFUSALS } from './procgenSeedling.js';
import { CHEST_GOAL_KIND, goalContainerNoteOf } from './seedlingGenRoomPayload.js';
import { assembleGeneratedSeedlingSet } from './seedlingGeneratedSet.js';
import { mountedRecordsOf } from './wasmWalkTape.js';
import { SEEDLING_GEN_GOAL_KEY } from '../flashPanel/flashSeedlingGenLibrary.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}
const ADVENTURE = JSON.parse(readFileSync(join(ROOT,
    'frontend/presets/adventure/AP_14089154938208861744/AP_14089154938208861744_rules.json'), 'utf8'));
const GEN = 'flash_seedling_gen';
const SEEDS = [1, 2, 3, 4, 5, 6];
const REASONS = new Set([...GOAL_CHEST_REFUSALS, ...Object.values(GOAL_CONTAINER_NOT_PLACED_REASONS)]);

/** `[state, ctx]` for a mode and seed; `goal` adds the opt-in bag key. */
const WORLDS = {
    'sphere-leaf': (seed, goal) => [{ ...SEEDLING_GENERATED_LEAF_STATE, params: { ...SEEDLING_GENERATED_LEAF_STATE.params, seed, ...goal } }, {}],
    'sphere-host': (seed, goal) => [{ ...SEEDLING_GENERATED_HOST_STATE, params: { ...SEEDLING_GENERATED_HOST_STATE.params, seed, ...goal } }, {}],
    spiral: (seed, goal) => [{ ...SEEDLING_GENERATED_ROOM_STATE, substrateQuotas: { maze: 1, [GEN]: 4 },
        params: { ...SEEDLING_GENERATED_ROOM_STATE.params, seed, ...goal } }, {}],
    grid: (seed, goal) => [{ mode: 'gridGrowth', params: { seed, gridWidth: 3, gridHeight: 3, ...goal },
        scenario: { items: { key_red: 1, key_blue: 1, victory: 1 }, obstacles: { door_red: 1, door_blue: 1 } },
        substrateQuotas: {}, substrateMix: { maze: 1, [GEN]: 2 }, substrateMode: 'mix' }, {}],
    /** ⛓ the branchy skeleton: the measured home of the generator's goal-chest refusals (torch fallbacks) */
    'sphere-host-branchy': (seed, goal) => [{ ...SEEDLING_GENERATED_HOST_STATE,
        params: { ...SEEDLING_GENERATED_HOST_STATE.params, seed, seedlingGenSkeleton: 'branchy', ...goal } }, {}],
    'grid-branchy': (seed, goal) => [{ mode: 'gridGrowth',
        params: { seed, gridWidth: 3, gridHeight: 3, seedlingGenSkeleton: 'branchy', ...goal },
        scenario: { items: { key_red: 1, key_blue: 1, victory: 1 }, obstacles: { door_red: 1, door_blue: 1 } },
        substrateQuotas: {}, substrateMix: { maze: 1, [GEN]: 2 }, substrateMode: 'mix' }, {}],
    topDown: (seed, goal) => [{ mode: 'topDown', params: { seed, regionWidth: 10, regionHeight: 10, ...goal },
        scenario: { items: {}, obstacles: {} }, substrateQuotas: {}, substrateMix: { maze: 1, [GEN]: 1 },
        substrateMode: 'mix' }, { topDownSource: ADVENTURE, sphereLog: null }],
};
const GOAL = { [SEEDLING_GEN_GOAL_KEY]: 'chest' };
const build = async (mode, seed, goal) => {
    const [state, ctx] = WORLDS[mode](seed, goal);
    return (await runPresetHeadless(buildRunFromState(structuredClone(state), ctx))).rulesJson;
};
const names = (rules) => Object.values(rules.regions['1']).flatMap((r) => (r.locations ?? []).map((l) => l.name)).sort();

const TOTALS = {};
afterAll(() => {
    // eslint-disable-next-line no-console
    console.log(`GOAL-CHEST SWEEP ${JSON.stringify(TOTALS)}`);
});

describe('the goal-chest sweep: report == tally, count unchanged, every goal chest kept', () => {
    for (const mode of Object.keys(WORLDS)) {
        it.each(SEEDS)(`${mode} s%s`, async (seed) => {
            const t = (TOTALS[mode] ??= { worlds: 0, refusedWorlds: {}, requested: 0, placed: 0, notPlaced: {} });
            let world;
            try {
                world = await build(mode, seed, GOAL);
            } catch (e) {
                /** a world refused by name is allowed only when the opted-out world is refused too (not ours) */
                let plain = null;
                try { plain = await build(mode, seed, {}); } catch { /* the same refusal */ }
                expect(plain, `${mode} s${seed}: opted in THREW but opted out built — ${e.message}`).toBe(null);
                const key = String(e.message).split(':')[0].slice(0, 60);
                t.refusedWorlds[key] = (t.refusedWorlds[key] ?? 0) + 1;
                return;
            }
            const plain = await build(mode, seed, {});
            t.worlds += 1;
            const gens = Object.values(world.preset_sidecars['1']).filter((sc) => sc.substrate === GEN);
            const notes = gens.map((sc) => goalContainerNoteOf(sc.playable_payload));
            expect(notes.every(Boolean)).toBe(true);
            const report = world.procgen_metadata['1'].goalContainers;
            expect(report).toEqual(goalContainerReport(notes));
            expect(report.requested).toBe(gens.length);
            for (const r of Object.keys(report.notPlaced)) expect(REASONS.has(r), r).toBe(true);
            /** the location count is unchanged */
            expect(names(world)).toEqual(names(plain));
            expect(world.itempool_counts['1']).toEqual(plain.itempool_counts['1']);
            /** every placed goal chest is kept at assembly */
            const a = assembleGeneratedSeedlingSet(world, { selfPlayer: 1 });
            expect((a.report.goalChests ?? []).length).toBe(report.placed);
            const records = mountedRecordsOf(a.set);
            for (const c of a.report.goalChests ?? []) {
                const at = records.get(c.room).entities.filter((e) => e.x === c.cell.tx * 16 && e.y === c.cell.ty * 16);
                expect(at.map((e) => e.type)).toEqual(['chest']);
            }
            const placedRows = gens.filter((sc) => sc.playable_payload.locations[0]?.kind === CHEST_GOAL_KIND).length;
            expect(placedRows).toBe(report.placed);
            t.requested += report.requested;
            t.placed += report.placed;
            for (const [r, n] of Object.entries(report.notPlaced)) t.notPlaced[r] = (t.notPlaced[r] ?? 0) + n;
        }, 300_000);
    }
});
