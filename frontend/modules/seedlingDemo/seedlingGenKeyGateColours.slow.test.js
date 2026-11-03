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

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { buildRunFromState, runPresetHeadless } from '../procgenPipeline/presetRun.js';
import { SEEDLING_GENERATED_LEAF_STATE } from '../procgenPipeline/presetDefs.js';
import { BOSS_KEY_KIND } from './seedlingGenRoom.js';
import { KEYGATE_REQUEST_REFUSAL } from './seedlingGenRoomPayload.js';

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
};
const stateOf = (seed, { sphereCount, quota, items }) => ({
    ...SEEDLING_GENERATED_LEAF_STATE,
    substrateQuotas: { maze: 1, flash_seedling_gen: quota },
    scenario: { items, obstacles: {} },
    params: { ...SEEDLING_GENERATED_LEAF_STATE.params, seed, sphereCount, maxItemsPerRegion: 1,
        seedlingGenHostChildren: true, startSubstrate: 'maze', seedlingGenElements: 'keygate' },
});

describe('the keygate request sweep', () => {
    it.each(Object.keys(SHAPES))('%s: every world builds exact with distinct colours, or is refused not-met BY NAME', async (shape) => {
        const tally = { built: 0, keyRooms: 0, notMet: 0 };
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
        }
        console.log(`## KEYGATE-REQUEST-SWEEP | shape: ${shape} | seeds: ${SEEDS[0]}-${SEEDS.at(-1)} | built: `
            + `${tally.built} | key-gate rooms: ${tally.keyRooms} | ${KEYGATE_REQUEST_REFUSAL}: ${tally.notMet}`);
        expect(tally.notMet / SEEDS.length).toBeLessThanOrEqual(NOT_MET_BOUND);
    }, 900_000);
});
