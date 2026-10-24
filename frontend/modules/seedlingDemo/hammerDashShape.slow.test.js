/**
 * seedlingDemo/hammerDashShape.slow.test — ⛓ Seedling DK's whole-solve row, moved out of `hammerDashShape.test.js`
 * (⛓ seedling-hammer-escape-cache D4) because it runs for minutes: solo it passes, but in a parallel bounded vitest it
 * hit its timeout. In the `.slow` tier (`npm run test:unit:slow`, `fileParallelism: false`) it gets the whole CPU. The
 * row and its assertions are byte-identical to the ones it left; the corridor is described in `hammerDashShape.test.js`
 * (sweep 38845773709's request 392:0, L40, `fixtures/dash-shape/sweep-392-l40.json`).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { levelSourceFromAtlas } from './atlasSource.js';
import { solveAnytime } from './jsRuntimeSolver.js';
import { withDashLegPrecheck } from './solverBot.js';

/** ⛓ Seedling DK: sweep request 392:0 (L40), the pit corridor whose leg 1 is the pre-check's boundary. */
const PIT = JSON.parse(readFileSync(new URL('./fixtures/dash-shape/sweep-392-l40.json', import.meta.url), 'utf8'));
const pitSource = levelSourceFromAtlas({ levels: PIT.records });

describe('seedling DK (i) — DASH_LEG_PRECHECK: a corridor with a clean leg no window can bring under the bound is not scanned', () => {
    it('ON, sweep request 392:0 solved whole ships the same ticks for less work', () => {
        const solve = () => solveAnytime({ staging: PIT.staging, perTick: [], live: PIT.live, solverGoal: PIT.solverGoal,
            name: PIT.from.name, scratchPersistence: PIT.scratchPersistence, equips: null, budgetWork: PIT.budgetWork,
            upgradeWindowWork: null, levelSource: pitSource });
        const off = withDashLegPrecheck(false, solve);
        const on = withDashLegPrecheck(true, solve);
        expect(off.ok && on.ok).toBe(true);
        expect(on.plan.solution.length).toBe(828);
        expect(on.plan.solution).toEqual(off.plan.solution);
        expect(on.work).toBeLessThan(off.work);
        // OFF the full pass spends the budget on the 261-tick leg's scan; ON it refuses that corridor by name
        expect(off.passes.find((p) => p.pass === 'full')).toMatchObject({ ok: false, deadline: 'sword-dash', limit: 'budget' });
    }, 180_000);
});
