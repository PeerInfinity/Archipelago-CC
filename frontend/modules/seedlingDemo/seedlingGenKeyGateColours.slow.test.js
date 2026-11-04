/**
 * ⛓ KEYGATE COLOURS (slice 2) — **THE REQUEST SWEEP: HOW OFTEN A REQUESTED KEY GATE IS NOT MET** (the CI sweep the
 * slice owes; runs in the slow battery, so its numbers come from CI, ⚖ 52).
 *
 * Sphere-growth worlds of generated rooms, every room asked for `keygate`, over a seed range and two tree shapes
 * (deep: 4 spheres; wide: 2 spheres). Each world either BUILDS with its requested key gates (oracle exact, colours
 * distinct) or is refused BY NAME, `keygate-request-not-met` (a requested room whose re-roll ladder drew no
 * certified key gate). Nothing else is allowed. The summary line prints the counts; the row pins the not-met rate
 * under a bound so a regression in the element's yield is seen.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, afterAll } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { buildRunFromState, runPresetHeadless } from '../procgenPipeline/presetRun.js';
import { SEEDLING_GENERATED_LEAF_STATE, SEEDLING_GENERATED_ROOM_STATE } from '../procgenPipeline/presetDefs.js';
import { BOSS_KEY_KIND } from './seedlingGenRoom.js';
import { KEYGATE_EXHAUSTED_REFUSAL, KEYGATE_REQUEST_REFUSAL } from './seedlingGenRoomPayload.js';
import { assembleGeneratedSeedlingSet } from './seedlingGeneratedSet.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}

const SEEDS = Array.from({ length: Number(process.env.KG_SWEEP_SEEDS ?? 20) }, (_, i) => i + 1);
/** The not-met rate the sweep must stay under (per WORLD; a world fails when ANY requested room is not met). */
const NOT_MET_BOUND = 0.25;
const SHAPES = {
    deep: { sphereCount: 4, quota: 5, items: { key_red: 1, key_blue: 1, key_green: 1, victory: 1 } },
    wide: { sphereCount: 2, quota: 6, items: { key_red: 1, key_blue: 1, key_green: 1, key_yellow: 1, victory: 1 } },
    /** ⛓ R3 (js-16): batched, so a batch's last wave is decided NONE at a BATCH BOUNDARY */
    batched: { sphereCount: 6, quota: 7, spheresPerBatch: 3,
        items: { key_red: 1, key_blue: 1, key_green: 1, key_yellow: 1, key_purple: 1, victory: 1 } },
};
/**
 * ⛓ R3 — why a declaring node was decided NONE (`introduces: []`): the LAST WAVE OF THE PLAN (no sphere w+2; the leaf), a BATCH
 * BOUNDARY (its batch's last wave: the next wave was not wired when it was decided), or NO HOST (a next wave with
 * no dealt item). This is not surfaced in the registry or the sidecar; `sphere_tree` records only `[]`.
 */
function noneReason(node, sphereCount, batch) {
    if (node.wave + 2 > sphereCount) return 'lastWaveOfPlan';
    if (batch && node.wave % batch === batch - 1) return 'batchBoundary';
    return 'noHost';
}
const stateOf = (seed, { sphereCount, quota, items, spheresPerBatch = null }) => ({
    ...SEEDLING_GENERATED_LEAF_STATE,
    substrateQuotas: { maze: 1, flash_seedling_gen: quota },
    scenario: { items, obstacles: {} },
    params: { ...SEEDLING_GENERATED_LEAF_STATE.params, seed, sphereCount, maxItemsPerRegion: 1,
        seedlingGenHostChildren: true, startSubstrate: 'maze', seedlingGenElements: 'keygate',
        ...(spheresPerBatch ? { spheresPerBatch } : {}) },
});

/** ⛓ R3 — totals over the WHOLE sweep, printed once. */
const TOTAL = { worlds: 0, built: 0, keyRooms: 0, notMet: 0, lastWaveOfPlan: 0, batchBoundary: 0, noHost: 0 };

describe('the keygate request sweep', () => {
    afterAll(() => {
        console.log(`## KEYGATE-REQUEST-SWEEP-TOTAL | worlds: ${TOTAL.worlds} | built: ${TOTAL.built} | key-gate rooms: `
            + `${TOTAL.keyRooms} | ${KEYGATE_REQUEST_REFUSAL}: ${TOTAL.notMet} | keygate-configured rooms decided NONE: `
            + `LAST WAVE OF PLAN ${TOTAL.lastWaveOfPlan}, BATCH BOUNDARY ${TOTAL.batchBoundary}, no host ${TOTAL.noHost}`);
    });
    it.each(Object.keys(SHAPES))('%s: every world builds exact with distinct colours, or is refused not-met BY NAME', async (shape) => {
        const tally = { built: 0, keyRooms: 0, notMet: 0, lastWaveOfPlan: 0, batchBoundary: 0, noHost: 0 };
        for (const seed of SEEDS) {
            let res;
            try {
                // eslint-disable-next-line no-await-in-loop
                res = await runPresetHeadless(buildRunFromState(structuredClone(stateOf(seed, SHAPES[shape]))));
            } catch (e) {
                expect(String(e.message), `${shape} s${seed}`).toMatch(new RegExp(`^${KEYGATE_REQUEST_REFUSAL}: `));
                tally.notMet += 1;
                continue;
            }
            expect(res.oracleErrors, `${shape} s${seed}`).toEqual([]);
            const keys = Object.values(res.rulesJson.preset_sidecars['1'])
                .flatMap((sc) => (sc.playable_payload?.locations ?? []).filter((l) => l.kind === BOSS_KEY_KIND))
                .map((l) => l.item);
            expect(new Set(keys).size, `${shape} s${seed}: distinct colours`).toBe(keys.length);
            tally.built += 1;
            tally.keyRooms += keys.length;
            const world = { lastWaveOfPlan: 0, batchBoundary: 0, noHost: 0 };
            for (const n of res.rulesJson.procgen_metadata['1'].sphere_tree.nodes) {
                if (Array.isArray(n.introduces) && n.introduces.length === 0) {
                    world[noneReason(n, SHAPES[shape].sphereCount, SHAPES[shape].spheresPerBatch ?? null)] += 1;
                }
            }
            for (const k of Object.keys(world)) tally[k] += world[k];
            /** ⛓ slice 2b — the world's own report (`procgen_metadata["1"].introductions`) says the same */
            const report = res.rulesJson.procgen_metadata['1'].introductions;
            expect(report, `${shape} s${seed}: report`).toEqual({ requested: keys.length + world.lastWaveOfPlan
                + world.batchBoundary + world.noHost, placed: keys.length, notPlaced: Object.fromEntries([
                ['last-wave-of-plan', world.lastWaveOfPlan], ['batch-boundary', world.batchBoundary],
                ['no-host', world.noHost]].filter(([, v]) => v > 0)) });
        }
        console.log(`## KEYGATE-REQUEST-SWEEP | shape: ${shape} | seeds: ${SEEDS[0]}-${SEEDS.at(-1)} | built: `
            + `${tally.built} | key-gate rooms: ${tally.keyRooms} | ${KEYGATE_REQUEST_REFUSAL}: ${tally.notMet} | `
            + `decided NONE: last-wave-of-plan ${tally.lastWaveOfPlan}, batch-boundary ${tally.batchBoundary}, no-host ${tally.noHost}`);
        TOTAL.worlds += SEEDS.length;
        for (const k of ['built', 'keyRooms', 'notMet', 'lastWaveOfPlan', 'batchBoundary', 'noHost']) TOTAL[k] += tally[k];
        expect(tally.notMet / SEEDS.length).toBeLessThanOrEqual(NOT_MET_BOUND);
    }, 900_000);
});

/**
 * ⛓⛓ slice 2b (`procgen-region-introduced`) — **THE PLAN-LESS SWEEP**: shuffled spiral, grid growth and top-down,
 * every generated room configured `keygate`, nothing requested. Each world BUILDS with distinct colours (each room
 * takes the least colour standing nowhere else in the run: `introduced`) or is refused BY NAME,
 * `keygate-colours-exhausted` (a 6th key-gate room). Its own report (`procgen_metadata["1"].introductions`) is
 * recounted from the sidecars, and the totals print the report's counts.
 */
const ADVENTURE = JSON.parse(readFileSync(join(ROOT,
    'frontend/presets/adventure/AP_14089154938208861744/AP_14089154938208861744_rules.json'), 'utf8'));
const PLAN_LESS = {
    spiral: (seed) => [{ ...SEEDLING_GENERATED_ROOM_STATE, substrateQuotas: { maze: 1, flash_seedling_gen: 4 },
        scenario: { items: { key_red: 1, key_blue: 1, key_green: 1, victory: 1 }, obstacles: {} },
        params: { ...SEEDLING_GENERATED_ROOM_STATE.params, seed, seedlingGenElements: 'keygate' } }, {}],
    grid: (seed) => [{ mode: 'gridGrowth', params: { seed, gridWidth: 3, gridHeight: 3, seedlingGenElements: 'keygate' },
        scenario: { items: { key_red: 1, key_blue: 1, victory: 1 }, obstacles: { door_red: 1, door_blue: 1 } },
        substrateQuotas: {}, substrateMix: { maze: 1, flash_seedling_gen: 2 }, substrateMode: 'mix' }, {}],
    topDown: (seed) => [{ mode: 'topDown', params: { seed, regionWidth: 10, regionHeight: 10,
        seedlingGenElements: 'keygate' }, scenario: { items: {}, obstacles: {} }, substrateQuotas: {},
    substrateMix: { maze: 1, flash_seedling_gen: 1 }, substrateMode: 'mix' }, { topDownSource: ADVENTURE, sphereLog: null }],
};
const PL_TOTAL = { worlds: 0, built: 0, exhausted: 0, requested: 0, placed: 0, notDrawn: 0 };

describe('the plan-less keygate sweep (introduced)', () => {
    afterAll(() => {
        console.log(`## KEYGATE-INTRODUCED-SWEEP-TOTAL | worlds: ${PL_TOTAL.worlds} | built: ${PL_TOTAL.built} | `
            + `${KEYGATE_EXHAUSTED_REFUSAL}: ${PL_TOTAL.exhausted} | report: requested ${PL_TOTAL.requested}, placed `
            + `${PL_TOTAL.placed}, not-drawn ${PL_TOTAL.notDrawn}`);
    });
    it.each(Object.keys(PLAN_LESS))('%s: every world builds with distinct colours and an exact report, or is refused exhausted BY NAME', async (mode) => {
        const tally = { built: 0, exhausted: 0, requested: 0, placed: 0, notDrawn: 0, multi: 0 };
        for (const seed of SEEDS) {
            const [state, ctx] = PLAN_LESS[mode](seed);
            let rules;
            try {
                // eslint-disable-next-line no-await-in-loop
                rules = (await runPresetHeadless(buildRunFromState(structuredClone(state), ctx))).rulesJson;
            } catch (e) {
                expect(String(e.message), `${mode} s${seed}`).toMatch(new RegExp(`^${KEYGATE_EXHAUSTED_REFUSAL}: `));
                tally.exhausted += 1;
                continue;
            }
            const gens = Object.values(rules.preset_sidecars['1']).filter((sc) => sc.substrate === 'flash_seedling_gen');
            const keys = gens.flatMap((sc) => sc.playable_payload.locations.filter((l) => l.kind === BOSS_KEY_KIND))
                .map((l) => l.item);
            expect(new Set(keys).size, `${mode} s${seed}: distinct colours`).toBe(keys.length);
            expect(() => assembleGeneratedSeedlingSet(rules, { selfPlayer: 1 }), `${mode} s${seed}`).not.toThrow();
            const report = rules.procgen_metadata['1'].introductions;
            expect(report, `${mode} s${seed}: report`).toEqual({ requested: gens.length, placed: keys.length,
                notPlaced: gens.length > keys.length ? { 'not-drawn': gens.length - keys.length } : {} });
            tally.built += 1;
            tally.requested += report.requested;
            tally.placed += report.placed;
            tally.notDrawn += report.notPlaced['not-drawn'] ?? 0;
            if (keys.length >= 2) tally.multi += 1;
        }
        console.log(`## KEYGATE-INTRODUCED-SWEEP | mode: ${mode} | seeds: ${SEEDS[0]}-${SEEDS.at(-1)} | built: `
            + `${tally.built} (multi-keygate ${tally.multi}) | ${KEYGATE_EXHAUSTED_REFUSAL}: ${tally.exhausted} | report: `
            + `requested ${tally.requested}, placed ${tally.placed}, not-drawn ${tally.notDrawn}`);
        PL_TOTAL.worlds += SEEDS.length;
        for (const k of ['built', 'exhausted', 'requested', 'placed', 'notDrawn']) PL_TOTAL[k] += tally[k];
        expect(tally.multi, `${mode}: multi-keygate worlds built`).toBeGreaterThan(0);
    }, 900_000);
});
