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
 * stats and its order are the same. D1b — `CONTACT_FIDELITY.baitAlignSafeMemo` (OFF): the bait alignment's `safe(p)`
 * (57,874 of 96,384 asks a repeat) answered once per position. A COST key too. These rows pin both at L41 (the SEARCHGAPS
 * staging, both press-goal arms) and the solver's L41 plan through the bait and the fire block, ON = OFF.
 *
 * Mutants (predicted first; copy + edit + run + restore), the results in the report.
 */
import { describe, expect, it } from 'vitest';

import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging } from './tapeRunner.js';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { solveSegment } from './solverBot.js';
import { BAIT_ALIGN_PROBE, BAIT_SEARCH_COUNTERS, alignmentCandidates, searchBaitOrdering } from './crusherBait.js';
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
/** `fn` under `memo` (both cost keys, D1 and D1b), with the floods the bait search made and the seeds it skipped. */
const counted = (memo, fn) => {
    const f0 = BAIT_SEARCH_COUNTERS.floods;
    const s0 = BAIT_SEARCH_COUNTERS.skipped;
    const aligned = [];
    BAIT_ALIGN_PROBE.record = aligned;
    try {
        const out = withContactFidelity({ baitComponentMemo: memo, baitAlignSafeMemo: memo }, fn);
        return { out, floods: BAIT_SEARCH_COUNTERS.floods - f0, skipped: BAIT_SEARCH_COUNTERS.skipped - s0, aligned };
    } finally {
        BAIT_ALIGN_PROBE.record = null;
    }
};

describe('fidelity L41TOTEM D1 — the switches', () => {
    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY || !!process.env.SEEDLING_BAIT_COMPONENT_MEMO
        || !!process.env.SEEDLING_BAIT_ALIGN_SAFE_MEMO)('both ship OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.baitComponentMemo).toBe(false);
        expect(CONTACT_FIDELITY.baitComponentMemo).toBe(false);
        expect(CONTACT_FIDELITY_DEFAULTS.baitAlignSafeMemo).toBe(false);
        expect(CONTACT_FIDELITY.baitAlignSafeMemo).toBe(false);
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

describe('fidelity L41TOTEM D1b — the alignment asks each position once, with the same candidates', () => {
    it('a safety that varies with x AND y: ON asks fewer and answers the same list', async () => {
        const run = await arrival();
        const target = { x: run.state.x + 7.3, y: run.state.y - 4.1 };
        // stand-ins for the caller's crusher sight: unsafe on every third pixel row and every fifth column, then (a
        // second call, as the next chain's crushers sit elsewhere) on every fourth row — each call keeps its own answers
        const sights = [(p) => Math.floor(p.y) % 3 !== 0 && Math.floor(p.x) % 5 !== 0, (p) => Math.floor(p.y) % 4 !== 1];
        const asked = (memo) => {
            let asks = 0;
            const lists = withContactFidelity({ baitAlignSafeMemo: memo }, () => sights.map((sight) => alignmentCandidates(
                run, target, (p) => { asks += 1; return sight(p); }).map((c) => [c.at.x, c.at.y, c.moves, c.ticks.length])));
            return { lists, asks };
        };
        const off = asked(false);
        const on = asked(true);
        for (const list of off.lists) expect(list.length).toBeGreaterThan(3);
        expect(off.lists[1]).not.toEqual(off.lists[0]);
        expect(on.lists).toEqual(off.lists);
        expect(on.asks).toBeLessThan(off.asks);
    });
});

describe('fidelity L41TOTEM D1 + D1b — the solver at L41 through the bait and the fire block, ON = OFF', () => {
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
        // D1b: every alignment's candidate list ([x, y, moves, ticks] rows, nearest first) is the same, chain by chain
        expect(off.aligned.length).toBeGreaterThanOrEqual(3);
        expect(on.aligned).toEqual(off.aligned);
    }, 180_000);
});
