/**
 * ⛓⛓⛓ seedling-hammer-rock-holder-wait: A PRESSER A RESTING SOLID ALREADY HOLDS IS DISCHARGED AFTER ITS FADE
 * (`RESTING_HOLDER`, OFF; `SEEDLING_RESTING_HOLDER=1`).
 *
 * The witness is L28's leg to the L30 door from state (136,296) with {28,0} + {28,1} cleared (the rock booted fallen
 * on `button@112,240`, fidelity ROCKBUTTON's `rockbutton-l28-walk` staging). The switch reads the run (`restingHolderOn`):
 * no level id, no Seedling constant. Mutants (each predicted, made by copy + edit, restored and checked with `cmp`) are
 * in the report, `CC/docs/cloud-reports/seedling-hammer-rock-holder-wait.md` §5.
 */
import { describe, expect, it } from 'vitest';
import { withContactFidelity } from './contactFidelity.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging } from './tapeRunner.js';
import { arrivalStaging } from './fidelityArrival.js';
import { L28 } from './fidelityRockButton.js';
import {
    RESTING_HOLDER, RESTING_HOLDER_DEFAULT, restingHolderProbe, solveSegment, SolverRefusal, stanceHypothesisProbe,
    withRestingHolder,
} from './solverBot.js';

const BOOT = { level: 28, x: 128, y: 288 };
const DOOR = [{ kind: 'reach-exit', exit: { x: 304, y: 16 } }];
const bootRun = (cleared) => createRunForStaging(arrivalStaging(BOOT, { items: ['hasSword'], cleared }), atlasLevelSource());
const under = (holder, rock, fn) => withRestingHolder(holder, () => withContactFidelity({ fallRockHoldsButton: rock }, fn));
const presser = { x: 112, y: 240 };   // `button@112,240`'s record point (L28.button)

/** The leg solved on a fresh run: the outcome, the run's ticks, its hits, the lock writes and the per-tick y. */
function solveDoor(cleared) {
    const run = bootRun(cleared);
    const ys = [];
    const advance = run.advance.bind(run);
    run.advance = (...a) => { const r = advance(...a); ys.push(run.state.y); return r; };
    let err = null;
    try {
        solveSegment({ run, goals: DOOR, name: 'rock-holder-wait', boot: BOOT });
    } catch (e) { err = e; }
    return { err, run, ys, hits: run.ledger('playerHits'),
        lockWrites: run.lockWrites.map((w) => [w.id, w.t, w.value]) };
}

describe('ROCK-HOLDER-WAIT — `RESTING_HOLDER` (OFF)', () => {
    it.skipIf(process.env.SEEDLING_RESTING_HOLDER)('ships OFF; its env name is a known worker env name', () => {
        expect(RESTING_HOLDER_DEFAULT).toBe(false);
        expect(RESTING_HOLDER.enabled).toBe(false);
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_RESTING_HOLDER');
        withRestingHolder(true, () => expect(RESTING_HOLDER.enabled).toBe(true));
        expect(RESTING_HOLDER.enabled).toBe(false);
    });

    it('the holder read: a resting Solid on the presser AND the model reading it down — else nothing', () => {
        const read = (cleared, rock) => under(true, rock, () => restingHolderProbe(bootRun(cleared), presser));
        expect(read([0, 1], true)).toEqual({ solid: L28.rock.id, tag: 'fallrock', presser: L28.button.id,
            tile: { tx: 7, ty: 15 } });
        // the rock rests there, but the model does not count it (fidelity's key OFF): the button reads up → no holder
        expect(read([0, 1], false)).toBe(null);
        // nothing on the presser (the rock still overhead): no holder, whatever the model counts
        expect(read([], true)).toBe(null);
        expect(read([], false)).toBe(null);
    });

    it('guard (iii): the lock joins the stance hypothesis as a `weigh` only ON with the model counting the rock', () => {
        const lockIn = (holder, rock) => under(holder, rock,
            () => stanceHypothesisProbe(bootRun([0, 1])).filter((h) => h.id === L28.lock.id));
        expect(lockIn(true, true)).toEqual([{ id: L28.lock.id, kind: 'activator', strategy: 'weigh' }]);
        expect(lockIn(true, false)).toEqual([]);
        expect(lockIn(false, true)).toEqual([]);
        expect(lockIn(false, false)).toEqual([]);
    });

    it('OFF (either rock arm), and ON with the model NOT counting the rock: today\'s refusal at the button\'s stance', () => {
        for (const [holder, rock] of [[false, false], [false, true], [true, false]]) {
            const { err, run } = under(holder, rock, () => solveDoor([0, 1]));
            expect(err, `holder ${holder} rock ${rock}`).toBeInstanceOf(SolverRefusal);
            expect(err.obstacle).toEqual({ kind: 'proximity-hazard', id: L28.button.id });
            expect(err.message).toMatch(/^solverBot: no REACHABLE stance inside button@112,240 in level 28/);
            expect(run.ticksCompleted).toBe(0);
        }
    });

    it('ON + the model counting the rock: the solver WAITS out the fade (t0–t101), crosses the open lock hitless, and '
        + 'stops at the next wall — `kill (bobsoldier@264,168)`, its dwell hit at t361 (the game agrees: report §6)', () => {
        const { err, run, ys, hits, lockWrites } = under(true, true, () => solveDoor([0, 1]));
        expect(lockWrites).toEqual([[L28.lock.id, 101, false]]);
        // the wait: no movement until the lock's write tick
        expect(ys.slice(0, 101).every((y) => y === 296)).toBe(true);
        // through the lock's tile (y 208–224), never touched before the bobsoldier's swing
        expect(ys.findIndex((y) => y < 200) + 1).toBe(205);
        expect(Math.min(...ys)).toBeCloseTo(183.313, 3);
        expect(hits.map((h) => [h.t, h.source, h.id])).toEqual([[361, 'sword', 'bobsoldier@264,168']]);
        expect(run.ticksCompleted).toBe(361);
        expect(err).not.toBeInstanceOf(SolverRefusal);
        expect(err.message).toMatch(/kill \(bobsoldier@264,168\) by press: the dwell was HIT at tick 74/);
    });

    it('a presser with NO Solid on it (the rock overhead) still asks its stance: ON is OFF, byte for byte', () => {
        const outcome = (holder, rock) => {
            const { err, run, ys, lockWrites } = under(holder, rock, () => solveDoor([]));
            return { message: err?.message ?? null, t: run.ticksCompleted, minY: Math.min(...ys), lockWrites };
        };
        const off = outcome(false, true);
        expect(off.message).toMatch(/kill \(bobsoldier@264,168\) stance: the re-planned corridor failed too/);
        expect(off.t).toBe(1277);
        expect(off.lockWrites.map(([, t, v]) => [t, v])).toEqual([[121, false], [127, true], [786, false], [792, true]]);
        expect(outcome(true, true)).toEqual(off);
        expect(outcome(true, false)).toEqual(outcome(false, false));
    });
});
