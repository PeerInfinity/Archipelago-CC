/**
 * ⛓⛓ CRUSHER FORK (slice `seedling-js-forkrun`) — every production `solveSegment` call passes `forkRun`, the
 * fresh run fidelity's `bait` verb tries a choreography on before committing it (`solverBot.solveSegment`'s
 * docblock; the node pattern is `twoPassSolve`'s `forkRun: () => makeRun(rows)`). Without it `execBait` takes
 * the nearest aligned start unchecked, and L42's chain 2 refuses (the slow row,
 * `jsRuntimeSolverForkRun.slow.test.js`, drives that end to end).
 *
 * The rows here are cheap: `solveSegment` is wrapped to RECORD its input and stop, so each wired path is read
 * without a search; then the fork itself is checked against the shadow it must equal.
 */
import { describe, expect, it, vi } from 'vitest';

import { CRUSHER_WITNESSES, crusherStaging } from '../../../scripts/procgen/plan-seedling-crusher-witness.mjs';

const seen = { inputs: [], stop: true };
class Recorded extends Error {}
vi.mock('./solverBot.js', async (importOriginal) => {
    const orig = await importOriginal();
    return { ...orig, solveSegment: (o) => {
        seen.inputs.push(o);
        if (seen.stop) throw new Recorded('recorded');
        return orig.solveSegment(o);
    } };
});

const { atlasLevelSource } = await import('./levelSource.js');
const { createRunForStaging, solveStaging } = await import('./tapeRunner.js');
const { forkRunFor, liveOf, replayTape, runDigest, solveFromTape } = await import('./jsRuntimeSolver.js');
const { solveForPage } = await import('./watchSolve.js');
const { canCross } = await import('./seedlingCanCross.js');

const levelSource = atlasLevelSource();
const W = CRUSHER_WITNESSES[0];
const staging = await crusherStaging(W);
const lastInput = (fn) => {
    seen.inputs.length = 0;
    try { fn(); } catch (e) { if (!(e instanceof Recorded)) throw e; }
    expect(seen.inputs).toHaveLength(1);
    return seen.inputs[0];
};
/** A fresh run at the staging's boot, as the fork must be. */
const freshDigest = (s = staging) => runDigest(createRunForStaging(s, levelSource));
const keys = (...k) => new Set(k);

describe('every production solve path passes `forkRun` — a FRESH run at the boot, built as `run` was', () => {
    it('jsRuntimeSolver.solveFromTape (the JS page and the wasm engine, in the worker or in place)', () => {
        const live = liveOf(createRunForStaging(staging, levelSource));
        const o = lastInput(() => solveFromTape({ staging, perTick: [], live, levelSource, solverGoal: W.goals[0] }));
        expect(typeof o.forkRun).toBe('function');
        const fork = o.forkRun();
        expect(fork).not.toBe(o.run);
        expect(fork.ticksCompleted).toBe(0);
        expect(runDigest(fork)).toBe(freshDigest());
    });

    it('watchSolve.solveForPage (the editor\'s SOLVE arm and the procgen oracle)', () => {
        const o = lastInput(() => solveForPage({ levelSource, staging, goals: [W.goals[0]], name: 'fork-row' }));
        expect(typeof o.forkRun).toBe('function');
        const fork = o.forkRun();
        expect(fork).not.toBe(o.run);
        expect(fork.ticksCompleted).toBe(0);
        expect(runDigest(fork)).toBe(freshDigest(solveStaging(staging)));
    });

    it('seedlingCanCross.canCross (the can-cross oracle), with its idle prefix replayed by the solver', () => {
        const o = lastInput(() => canCross({ level: 22, exit: 29, arrival: { from: 25 }, dashMode: 'none', witness: false, idle: 2 }));
        expect(typeof o.forkRun).toBe('function');
        const fork = o.forkRun();
        expect(fork).not.toBe(o.run);
        expect(fork.ticksCompleted).toBe(0);
        // The solver replays `perTick` (the prefix included) onto the fork: it lands where `run` stood.
        o.prefix.forEach((h) => fork.advance(h));
        expect(runDigest(fork)).toBe(runDigest(o.run));
    });
});

describe('the fork shares no mutable state with the shadow, and re-makes the PLAY\'s equips', () => {
    const perTick = [...Array(12)].map((_, i) => (i < 6 ? keys('left') : keys('up')));

    it('two forks and the shadow advance independently', () => {
        const shadow = replayTape({ staging, perTick, levelSource });
        const before = runDigest(shadow);
        const make = forkRunFor({ staging, levelSource });
        const a = make();
        const b = make();
        expect(a).not.toBe(b);
        perTick.forEach((h) => a.advance(h));
        expect(runDigest(a)).toBe(before);
        expect(b.ticksCompleted).toBe(0);
        expect(runDigest(b)).toBe(freshDigest());
        expect(runDigest(shadow)).toBe(before);
    });

    it('a play equip inside the prefix is re-made at its tick, as `replayTape` makes it', () => {
        const equips = new Map([[3, 1]]);
        const shadow = replayTape({ staging, perTick, levelSource, equips });
        const fork = forkRunFor({ staging, levelSource, equips, prefixLength: perTick.length })();
        perTick.forEach((h) => fork.advance(h));
        expect(runDigest(fork)).toBe(runDigest(shadow));
        expect(fork.inventory).toEqual(shadow.inventory);
        // The control: a fork that did NOT re-make the equip is a different run (the row can tell).
        const bare = forkRunFor({ staging, levelSource })();
        perTick.forEach((h) => bare.advance(h));
        expect(runDigest(bare)).not.toBe(runDigest(shadow));
        // …and only inside the prefix: an advance past it (the solver's own ticks) equips nothing.
        const past = forkRunFor({ staging, levelSource, equips: new Map([[1, 1]]), prefixLength: 1 })();
        const plain = createRunForStaging(staging, levelSource);
        past.advance(keys()); plain.advance(keys());
        const s0 = { ...past.inventory };
        past.advance(keys()); plain.advance(keys());
        expect(past.inventory).toEqual(s0);
        expect(runDigest(past)).toBe(runDigest(plain));
    });
});
