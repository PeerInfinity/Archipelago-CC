/**
 * seedlingDemo/hammerRefugeCut.test — ⛓⛓⛓ SEEDLING HAMMER-PHASE RE: THE REFUGE'S BEST-ETA CUT (`REFUGE_ETA_CUT`,
 * `pressKillCost.js`, OFF).
 *
 * ON, `deriveRefuge` stops a later candidate's preview at its `best.eta + 1`-th sample: such a walk cannot win. The rows
 * ask the derivation OFF against ON on two committed walks:
 *   · G1's game witness `hammer-g1-l40-ghostkill` (C1's staging A with the ghost sword, the solve's own executed
 *     prefix), at refuge ticks of the press kill — among them 972 and 1251, where a later candidate beats the first
 *     arrival, so a cut below the best's ETA would drop the winner;
 *   · fidelity's `movingwait-l42-381-pace` at t1150 with BW's `PRESS_KILL_BOMBS` ON both ways, where the bombs refuse
 *     the nearest refuge: the cut's bound must be the best that PASSED, never a refused candidate's.
 * The predicate's own row pins the edge (a tie arrives at `eta` and is not stopped).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
    PRESS_KILL_BOMBS_COUNTS, REFUGE_ETA_CUT, REFUGE_ETA_CUT_COUNTS, REFUGE_ETA_CUT_DEFAULT, refugeEtaCut,
    resetPressKillBombsCounts, resetRefugeEtaCutCounts, withPressKillBombs, withRefugeEtaCut,
} from './pressKillCost.js';
import { deriveRefuge } from './solverBot.js';
import { createRunForStaging, createTapeStepper, stagingFromTape } from './tapeRunner.js';
import { parseTape } from './tapeFormat.js';
import { atlasLevelSource } from './levelSource.js';

const NO_CONTACTS = new Set();
const REFUGE_WINDOW = 45; // `SPINNER.hammerPeriod`: the window the press kill asks a refuge over when no i-frame runs

/** The run after each of `ticks` on a committed tape, handed to `at(t, run)` (the run is read, never advanced there). */
function replayTo(url, ticks, at, opts = {}) {
    const tape = parseTape(readFileSync(url, 'utf8'));
    const held = [];
    const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h) => { held[t] = h; }, ...opts });
    for (let r = st.next(); !r.done; r = st.next());
    const run = createRunForStaging({ ...stagingFromTape(tape), equips: [] }, atlasLevelSource());
    const want = new Set(ticks);
    for (const k of held.filter(Boolean)) {
        if (want.has(run.ticksCompleted)) at(run.ticksCompleted, run);
        if (run.ticksCompleted >= Math.max(...ticks)) break;
        run.advance(k);
    }
}

const both = (run) => {
    const off = withRefugeEtaCut(false, () => deriveRefuge(run, NO_CONTACTS, REFUGE_WINDOW));
    const on = withRefugeEtaCut(true, () => deriveRefuge(run, NO_CONTACTS, REFUGE_WINDOW));
    return { off, on };
};

describe('REFUGE_ETA_CUT — the switch and the cut', () => {
    it.skipIf(globalThis.process?.env?.SEEDLING_REFUGE_ETA_CUT !== undefined)('ships OFF', () => {
        expect(REFUGE_ETA_CUT_DEFAULT).toBe(false);
        expect(REFUGE_ETA_CUT.enabled).toBe(false);
    });

    it('withRefugeEtaCut sets and restores it, also on a throw', () => {
        const was = REFUGE_ETA_CUT.enabled;
        expect(withRefugeEtaCut(true, () => REFUGE_ETA_CUT.enabled)).toBe(true);
        expect(REFUGE_ETA_CUT.enabled).toBe(was);
        expect(() => withRefugeEtaCut(true, () => { throw new Error('x'); })).toThrow('x');
        expect(REFUGE_ETA_CUT.enabled).toBe(was);
    });

    it('the cut stops at the (eta + 1)-th sample, never at the eta-th (a tie still arrives)', () => {
        const calls = (eta, n) => { const f = refugeEtaCut(eta); return Array.from({ length: n }, () => f()); };
        expect(calls(3, 5)).toEqual([false, false, false, true, true]);
        expect(calls(0, 2)).toEqual([true, true]);
        // one predicate per preview: a second one starts its own count
        const f = refugeEtaCut(1);
        f();
        expect(refugeEtaCut(1)()).toBe(false);
    });

    it('OFF writes nothing to the instrument', () => {
        resetRefugeEtaCutCounts();
        replayTo(new URL('./fixtures/hammer-g1-ghostkill-witness/hammer-g1-l40-ghostkill.tape.json', import.meta.url),
            [600], (t, run) => { withRefugeEtaCut(false, () => deriveRefuge(run, NO_CONTACTS, REFUGE_WINDOW)); });
        expect(REFUGE_ETA_CUT_COUNTS).toEqual({ previews: 0, cut: 0 });
    }, 120_000);
});

describe('REFUGE_ETA_CUT — staging A with the ghost (G1\'s witness walk)', () => {
    it('at the press kill\'s refuge ticks ON chooses the refuge OFF chooses, and the cut is exercised', () => {
        const TICKS = [600, 972, 973, 974, 1251, 1766, 2191];
        const seen = [];
        resetRefugeEtaCutCounts();
        replayTo(new URL('./fixtures/hammer-g1-ghostkill-witness/hammer-g1-l40-ghostkill.tape.json', import.meta.url),
            TICKS, (t, run) => {
                const { off, on } = both(run);
                expect(on, `t${t}`).toEqual(off);
                seen.push([t, off && [off.x, off.y, off.eta]]);
            });
        expect(seen.map((s) => s[0])).toEqual(TICKS);
        expect(seen.every((s) => s[1] !== null)).toBe(true);
        expect(REFUGE_ETA_CUT_COUNTS.previews).toBe(12 * TICKS.length);
        expect(REFUGE_ETA_CUT_COUNTS.cut).toBeGreaterThan(0);
    }, 180_000);
});

describe('REFUGE_ETA_CUT — with BW\'s PRESS_KILL_BOMBS ON (leg 381\'s MOVINGWAIT witness walk)', () => {
    it('t1150: the bombs refuse the nearest refuge, and the cut keeps BW\'s answer (216,168)', () => {
        const witness = JSON.parse(readFileSync(new URL('./fixtures/bomb-witness/movingwait-l42-381-pace.json',
            import.meta.url), 'utf8'));
        const cams = new Map(witness.samples.map((s) => [s.t, s.cam]));
        let run = null;
        const st = createTapeStepper(parseTape(JSON.stringify(witness.tape)), {
            levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; },
            cameraWitness: (t) => cams.get(t) ?? null,
        });
        for (let r = st.next(); !r.done; r = st.next()) if (r.value.observation.t >= 1150) break;
        expect(run.ticksCompleted).toBe(1150);
        withPressKillBombs(true, () => {
            resetPressKillBombsCounts();
            const off = withRefugeEtaCut(false, () => deriveRefuge(run, NO_CONTACTS, REFUGE_WINDOW));
            expect([off.x, off.y]).toEqual([216, 168]);
            expect(PRESS_KILL_BOMBS_COUNTS.refugeRefused).toBe(11);
            resetPressKillBombsCounts();
            resetRefugeEtaCutCounts();
            const on = withRefugeEtaCut(true, () => deriveRefuge(run, NO_CONTACTS, REFUGE_WINDOW));
            expect(on).toEqual(off);
            expect(REFUGE_ETA_CUT_COUNTS.cut).toBeGreaterThan(0);
            // ⚠ the instrument the switch names: two of OFF's refused candidates come AFTER the best, and the cut stops
            // their previews before the bombs are asked (a refused candidate never bounds the cut: the answer is OFF's)
            expect(PRESS_KILL_BOMBS_COUNTS.refugeRefused).toBe(9);
        });
        // and with the bombs OFF the cut keeps BW's OFF answer
        const { off, on } = both(run);
        expect([off.x, off.y]).toEqual([232, 200]);
        expect(on).toEqual(off);
    }, 120_000);
});
