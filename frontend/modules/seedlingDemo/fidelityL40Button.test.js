/**
 * Seedling fidelity L40BUTTON (wave 12): `Level 040 - Totem Part 64,144` from L40's NORTH arrivals.
 *
 * Sweep-4 legs 378 (from L41) and 381 (from L42) refused at `buttonroom@160,128`'s stance and named
 * `wandlock@448,432` — group 2, held only by a Solid on `button@480,384` — as the prerequisite nothing could open.
 * D1 (`probe-seedling-l40button.mjs`): from both arrivals the part needs only the NW cluster, `buttonroom@272,208`
 * {t 0} → the three `breakablerock`s {22,23,24} → `buttonroom@160,128` {t 1}, the order the game recorded in
 * `r5-l40-part0`. Group 2 is never in the way. The gap was the stance HYPOTHESIS: it discharged the cluster's
 * wandlocks and no rock, so the buttonroom's one stance cell read as unreachable.
 *
 * D2: `STANCE_ROCKS` (OFF) adds every rock the run can break to the hypothesis, keeps a rock out of its own swing
 * stance's hypothesis, and asks every swing candidate directly before any under the hypothesis.
 * D3: the two arrivals' ON plans, recorded on the game (p4f) as `l40button-l41-part0` / `l40button-l42-part0`;
 * `tapeRunner.test.js` holds each at 0 px against its game stream, and the rows below read what they did.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { STANCE_ROCKS, SolverRefusal, stanceHypothesisProbe, withStanceRocks } from './solverBot.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, runTape } from './tapeRunner.js';
import { twoPassSolve } from './twoPassSolve.js';
import {
    L40BUTTON_GOAL, L40BUTTON_WITNESSES, l40buttonStaging,
} from '../../../scripts/procgen/plan-seedling-l40button-witness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const levelSource = atlasLevelSource();
const ROCKS = ['breakablerock@160,144', 'breakablerock@176,128', 'breakablerock@176,144'];
const CLUSTER_BOOT = { level: 40, x: 272, y: 224 };
const tape = (name) => parseTape(readFileSync(join(HERE, 'fixtures', 'tapes', `${name}.json`), 'utf8'));

const rocksIn = (h) => h.filter((r) => r.kind === 'rock').map((r) => r.id).sort();

async function solveFrom(boot, on) {
    const staging = await l40buttonStaging(boot);
    const makeRun = (p) => createRunForStaging({ ...staging, persistence: p }, levelSource);
    return withStanceRocks(on, () => twoPassSolve({
        makeRun, goals: [L40BUTTON_GOAL], name: 'l40button-test', boot: staging.boot,
        persistence: staging.persistence, log: () => {},
    }));
}

describe('L40BUTTON D2 — the switch and the hypothesis', () => {
    it('STANCE_ROCKS ships OFF', () => {
        expect(STANCE_ROCKS.enabled).toBe(false);
    });

    it('OFF the hypothesis at leg 378\'s arrival holds the cluster\'s wandlocks and no rock; ON it adds the three', async () => {
        const staging = await l40buttonStaging(L40BUTTON_WITNESSES[0].boot);
        const run = createRunForStaging(staging, levelSource);
        const off = withStanceRocks(false, () => stanceHypothesisProbe(run));
        const on = withStanceRocks(true, () => stanceHypothesisProbe(run));
        expect(rocksIn(off)).toEqual([]);
        expect(off.map((h) => h.id)).toEqual(expect.arrayContaining(
            ['wandlock@176,80', 'wandlock@176,208', 'wandlock@208,128', 'wandlock@208,144', 'wandlock@208,160']));
        expect(rocksIn(on)).toEqual(ROCKS);
        expect(on.filter((h) => h.kind === 'rock').every((h) => h.strategy === 'break')).toBe(true);
        // Everything OFF had, ON has too, in the same order — the rocks are appended, nothing else moves.
        expect(on.slice(0, off.length)).toEqual(off);
    });

    it('a run with no sword hypothesises no rock (the swing could not break it)', async () => {
        const staging = await l40buttonStaging(L40BUTTON_WITNESSES[0].boot);
        staging.seam = { ...staging.seam, items: { ...staging.seam.items, hasSword: false } };
        const run = createRunForStaging(staging, levelSource);
        expect(run.progress('primaryWeapon')).not.toBe('sword');
        expect(rocksIn(withStanceRocks(true, () => stanceHypothesisProbe(run)))).toEqual([]);
    });

    it('from the cluster\'s own boot: OFF refuses with the legs\' sentence, ON latches t0, breaks, latches t1, collects', async () => {
        let refusal = null;
        try { await solveFrom(CLUSTER_BOOT, false); } catch (e) { refusal = e; }
        expect(refusal).toBeInstanceOf(SolverRefusal);
        expect(refusal.message).toMatch(/no REACHABLE stance inside buttonroom@160,128/);
        expect(refusal.message).toMatch(/wandlock@448,432 — its group t=2 publishes only while a Solid sits on button@480,384/);

        const solved = await solveFrom(CLUSTER_BOOT, true);
        expect(solved.out.records.map((r) => r.strategy)).toEqual(['hold', 'break', 'hold', 'collect']);
        const staging = await l40buttonStaging(CLUSTER_BOOT);
        const run = createRunForStaging({ ...staging, persistence: solved.persistence }, levelSource);
        for (const held of solved.out.perTick) run.advance(held);
        expect(run.playerHits.length).toBe(0);
        const at = Object.fromEntries(run.earnedClears.filter((c) => c.level === 40).map((c) => [c.tag, c.t]));
        expect(at[7]).toBeLessThan(Math.min(at[22], at[23], at[24]));
        expect(Math.max(at[22], at[23], at[24])).toBeLessThan(at[1]);
    }, 180_000);
});

describe('L40BUTTON D3 — the two arrivals\' witnesses (recorded on the game; 0 px in tapeRunner)', () => {
    for (const w of L40BUTTON_WITNESSES) {
        it(`${w.name} (leg ${w.leg}): the model replays it to the part, through the cluster, with no hit`, () => {
            const t = tape(w.name);
            expect(t.boot).toEqual(w.boot);
            const out = runTape(t, { levelSource });
            const last = out.ticks.at(-1);
            expect(last.level).toBe(40);
            expect(Math.abs(last.x - 64)).toBeLessThan(24);
            expect(Math.abs(last.y - 144)).toBeLessThan(24);
            expect(out.playerHits.length).toBe(0);
            const at = Object.fromEntries(out.earnedClears.filter((c) => c.level === 40).map((c) => [c.tag, c.t]));
            // ⛓ The cluster in its forced order: group 0's latch, the three rocks, group 1's latch.
            expect(at[7]).toBeLessThan(Math.min(at[22], at[23], at[24]));
            expect(Math.max(at[22], at[23], at[24])).toBeLessThan(at[1]);
            // ⛔ and nothing in group 2 — no wandlock tag {9,10} and no button@480,384 hold — moved.
            expect(at[9]).toBeUndefined();
            expect(at[10]).toBeUndefined();
        });
    }
});
