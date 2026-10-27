/**
 * seedling-fidelity-l41totem (wave 33) — sweep leg 855 (L41 Totem Part 240,144 from `in_L40_944_96`), TIMED OUT at the
 * sweep's 90 s leg budget in every full sweep since 10-24.
 *
 * W0 (measured, the report): the leg's solve is NOT 240 s. On CI the page's worker solved it in 4.4 s / 9.0 s (keyed
 * runs 40536788606 / 40536803626), and the plan is 2,505 ticks, which the game plays at its own ~30 ticks/s pacing cap
 * (≥ 83.5 s). The solve is the only slack, and the crusher-bait ordering search is 60% of it: it runs once per pass from
 * the same arrival, and 68,406 of its 68,418 component floods start inside a component it has already flooded under the
 * same configuration. Every non-empty flood ends with its key in `seenStates`, so each of those floods ends at `continue`.
 *
 * D1 — `CONTACT_FIDELITY.baitComponentMemo` (OFF): such a seed is skipped before its flood. A COST key: the answer, its
 * stats and its order are the same. These rows pin that at L41 (the SEARCHGAPS staging, both press-goal arms) and the
 * solver's L41 plan through the bait, ON = OFF.
 *
 * Mutants (predicted first; copy + edit + run + restore), the results in the report.
 */
import { describe, expect, it } from 'vitest';

import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging } from './tapeRunner.js';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { solveSegment } from './solverBot.js';
import { BAIT_SEARCH_COUNTERS, searchBaitOrdering } from './crusherBait.js';
import { ropeStaging } from './fidelityRope.js';
import { CRUSHERPRESS_WITNESSES } from './fidelityCrusherPress.js';

const SRC = atlasLevelSource();
const W = CRUSHERPRESS_WITNESSES[0];
const arrival = async () => createRunForStaging(await ropeStaging(W), SRC);
const SHIELD = ['breakablerock@224,64', 'breakablerock@224,80'];
const PART = { x: 244, y: 148, right: 252, bottom: 156 };
const searchShielded = (run) => {
    const live = run.liveGeometryOpts();
    return searchBaitOrdering({ run, liveOpts: { ...live, brokenRocks: new Set([...(live.brokenRocks ?? []), ...SHIELD]) },
        inventory: run.progress('inventory'), aimRect: PART, allowTeleporter: null });
};
/** The search under `memo`, with the floods it made and the seeds it skipped. */
const counted = (memo, fn) => {
    const f0 = BAIT_SEARCH_COUNTERS.floods;
    const s0 = BAIT_SEARCH_COUNTERS.skipped;
    const out = withContactFidelity({ baitComponentMemo: memo }, fn);
    return { out, floods: BAIT_SEARCH_COUNTERS.floods - f0, skipped: BAIT_SEARCH_COUNTERS.skipped - s0 };
};

describe('fidelity L41TOTEM D1 — the switch', () => {
    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY || !!process.env.SEEDLING_BAIT_COMPONENT_MEMO)(
        'ships OFF', () => {
            expect(CONTACT_FIDELITY_DEFAULTS.baitComponentMemo).toBe(false);
            expect(CONTACT_FIDELITY.baitComponentMemo).toBe(false);
        });
});

describe('fidelity L41TOTEM D1 — the bait search at L41, ON = OFF', () => {
    for (const pressGoal of [true, false]) {
        it(`crusherBaitPressGoal ${pressGoal ? 'ON' : 'OFF'}: the same answer, stats and order; the duplicate floods skipped`,
            async () => {
                const run = await arrival();
                const ask = () => withContactFidelity({ crusherBaitPressGoal: pressGoal }, () => searchShielded(run));
                const off = counted(false, ask);
                const on = counted(true, ask);
                expect(on.out).toEqual(off.out);
                expect(off.out.stats.expanded).toBe(102);
                expect(off.out.goal ?? null).toBe(pressGoal ? 'press' : null);
                // OFF never skips; ON floods each (configuration, component) once and skips every other seed.
                expect(off.skipped).toBe(0);
                expect(on.skipped).toBeGreaterThan(0);
                expect(on.floods + on.skipped).toBe(off.floods);
                expect(on.floods * 100).toBeLessThan(off.floods);
            });
    }
});

describe('fidelity L41TOTEM D1 — the solver at L41 through the bait, ON = OFF', () => {
    it('the plan the SEARCHGAPS staging solves is the same tick for tick', async () => {
        const staging = await ropeStaging(W);
        const solve = () => solveSegment({ run: createRunForStaging(staging, SRC), goals: W.goals, name: 'l41totem',
            boot: staging.boot, dashMode: 'all', forkRun: () => createRunForStaging(staging, SRC) });
        const keys = (out) => out.perTick.map((k) => [...k].sort().join('+'));
        const off = counted(false, solve);
        const on = counted(true, solve);
        // the part is collected through the bait and the fire block's presses (FIREMOVE: 2,189 ticks at the base)
        expect(off.out.perTick.length).toBe(2189);
        expect(keys(on.out)).toEqual(keys(off.out));
        expect(on.out.equips).toEqual(off.out.equips);
        expect([on.out.waypointsPlanned, on.out.replans]).toEqual([off.out.waypointsPlanned, off.out.replans]);
        expect(on.skipped).toBeGreaterThan(0);
    }, 180_000);
});
