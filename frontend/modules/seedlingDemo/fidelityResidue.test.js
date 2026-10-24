/**
 * seedling-fidelity-residue (wave 28) — TIMEDPASS's PASS TO THE EXIT (D-A, `CONTACT_FIDELITY.drillTimedPassExit`, OFF).
 *
 * D-A. With `drillTimedPass` ON, Fire alone cuts L28's rope hit-free, and the rope's `FallRock` ceremony releases the
 * drill parked under the stance ONTO it (TIMEDPASS D1): the `reach-exit` that follows refused at its first gate ("the
 * danger map forbids (151.87,55.81) — enemy:drill@128,96"), and from that state every continuation is hit (measured:
 * 81 of 81 two-tick key sequences, each held 10 ticks more). ON:
 *   (1) the exit is a TIMED PASS to the crossing (`execDrillTimedPassExit`): `searchDrillTimedPass` with the goal the
 *       stepper's transition through that door, certified on a fork, then played;
 *   (2) the pass to the cut's stance, when the segment's next goal is a `reach-exit`, is certified only with that
 *       crossing's pass behind the cut (`accept`): the first stand that holds is passed over when the cut leaves no way
 *       out, and the search runs on (L25: 2 passed over, 59 → 60 t to the stance).
 * Measured: from the L25 arrival both doors SOLVE hit-free (L26 door 182 t, L25 door 134 t); from the L26 arrival the
 * only stand that holds in the search's window ((152,56), t121) leaves no way out, so the clear-tag refuses by name.
 * (Its forced-hit reading, measured and not built: the hit at the stance knocks the player 9.3 px west, into
 * `drill@80,96`'s box when the 20-tick i-frame ends — steering is blocked for all of it — so the exit costs two hits.)
 * OFF: byte-identical — the gate's refusal.
 *
 * Mutants (predicted first; copy + edit + run + restore), the results in the report:
 *   a1  `execDrillTimedPassExit` not called                     → the two ON exit rows red (the gate refusal returns)
 *   a2  the cut's certificate ignores the way out (`accept` null) → the L25 rows red: the first stand (59 t) is the one
 *                                                                  the release dooms, so the exit refuses
 *   a3  the search's crossing accepts any teleporter              → the L25-door row red (the pass crosses to L26)
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging } from './tapeRunner.js';
import { arrivalStaging } from './fidelityArrival.js';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { solveSegment, SolverRefusal } from './solverBot.js';
import { compareDrillKillWitness, drillKillModelSamples } from './fidelityDrillKill.js';
import { TIMEDPASS_EXIT_WITNESSES, TIMEDPASS_WITNESS_DIR, timedPassTape } from './fidelityTimedPass.js';

const SRC = atlasLevelSource();
const L28_CUT = Object.freeze({ kind: 'clear-tag', tag: { level: 28, tag: 0 }, at: { x: 160, y: 64 },
    obstacle: 'rope@160,64' });
const ARRIVALS = Object.freeze({ L25: { level: 28, x: 96, y: 16 }, L26: { level: 28, x: 16, y: 96 } });
const DOORS = Object.freeze({ L26: { x: 0, y: 96 }, L25: { x: 96, y: 0 } });

function solve(arrival, goals) {
    const boot = ARRIVALS[arrival];
    const staging = arrivalStaging(boot, { items: ['hasFire'] });
    const run = createRunForStaging(staging, SRC);
    try {
        const out = solveSegment({ run, goals, name: 'residue', boot, forkRun: () => createRunForStaging(staging, SRC) });
        const rec = (k) => (out.records ?? []).find((r) => r.goal === k) ?? null;
        return { run, out, refusal: null, cut: rec('clear-tag'), exit: rec('reach-exit') };
    } catch (e) {
        if (!(e instanceof SolverRefusal)) throw e;
        return { run, out: null, refusal: e, cut: null, exit: null };
    }
}
const cutThenExit = (door) => [{ ...L28_CUT }, { kind: 'reach-exit', exit: { ...DOORS[door] } }];
const ON = (fn) => withContactFidelity({ drillTimedPass: true, drillTimedPassExit: true }, fn);
const OFF = (fn) => withContactFidelity({ drillTimedPass: true, drillTimedPassExit: false }, fn);
const keys = (out) => out.perTick.map((h) => [...h].sort().join('+'));

describe('fidelity RESIDUE D-A — the switch', () => {
    it('ships OFF, behind `drillTimedPass` (ON)', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.drillTimedPassExit).toBe(false);
        expect(CONTACT_FIDELITY.drillTimedPassExit).toBe(false);
        expect(CONTACT_FIDELITY_DEFAULTS.drillTimedPass).toBe(true);
    });
});

describe('fidelity RESIDUE D-A — Fire alone: the cut, then the way out (L28)', () => {
    it.each([['L26', 182, 111], ['L25', 134, 63]])('ON: from the L25 arrival to the %s door — SOLVED %i t, 0 hits, the '
        + 'exit a certified pass of %i t', (door, ticks, exitTicks) => ON(() => {
        const r = solve('L25', cutThenExit(door));
        expect(r.refusal).toBeNull();
        expect(r.out.perTick.length).toBe(ticks);
        expect(r.run.level).toBe(door === 'L26' ? 26 : 25);
        expect((r.run.ledger('playerHits') ?? []).length).toBe(0);
        expect(r.cut.drillPass).toMatchObject({ verb: 'drill-pass', drills: ['drill@128,96'], stance: { x: 152, y: 56 },
            ticks: 60, certified: true, exitAfter: { passedOver: 2 } });
        expect(r.exit.drillPass).toMatchObject({ verb: 'drill-pass-exit', to: door === 'L26' ? 26 : 25,
            ticks: exitTicks, certified: true });
    }), 180000);
    it.each([['L26'], ['L25']])('ON: from the L26 arrival to the %s door — REFUSED at the cut by name: the one stand that '
        + 'holds leaves no way out', (door) => ON(() => {
        const r = solve('L26', cutThenExit(door));
        expect(r.refusal).not.toBeNull();
        expect(r.refusal.obstacle).toMatchObject({ kind: 'drill', id: 'drill@80,96' });
        expect(r.refusal.message).toMatch(/\(152,56\): walks arrive from search tick 107, and none in 45 ticks stands 14 /);
        expect(r.refusal.message).toMatch(/with a way out \(1 passed over: after the cut, no pass to the crossing to /);
    }), 240000);
    it('OFF (byte-identical): the exit after the cut refuses at its first gate — the residue TIMEDPASS named', () => OFF(() => {
        const r = solve('L25', cutThenExit('L26'));
        expect(r.refusal.message).toMatch(/reach-exit \(0,96\)->L26: the danger map forbids \(152\.17\d*,56\.36\d*\) — enemy:drill@128,96/);
    }), 120000);
    it('ON: a cut with no exit after it plans what OFF plans (no way out is asked) — L25, 70 t', () => {
        const off = OFF(() => solve('L25', [{ ...L28_CUT }]));
        const on = ON(() => solve('L25', [{ ...L28_CUT }]));
        expect(on.out.perTick.length).toBe(70);
        expect(keys(on.out)).toEqual(keys(off.out));
        expect(on.cut.drillPass.exitAfter).toBeUndefined();
    }, 120000);
    it('ON: a Sword run is untouched — the exit walk after the kill and the cut is OFF\'s, tick for tick', () => {
        const run = (items) => {
            const boot = ARRIVALS.L26;
            const staging = arrivalStaging(boot, { items });
            return solveSegment({ run: createRunForStaging(staging, SRC), goals: cutThenExit('L25'), name: 'residue',
                boot, forkRun: () => createRunForStaging(staging, SRC) });
        };
        const off = OFF(() => run(['hasSword']));
        const on = ON(() => run(['hasSword']));
        expect(keys(on)).toEqual(keys(off));
        expect((on.records ?? []).find((r) => r.goal === 'reach-exit').drillPass).toBeUndefined();
    }, 180000);
});

describe('fidelity RESIDUE D-A — the game witnesses (p4g), replayed against the model at 0 px', () => {
    const path = (name) => join(TIMEDPASS_WITNESS_DIR, `${name}.json`);
    const load = (name) => JSON.parse(readFileSync(path(name), 'utf8'));
    it.each(TIMEDPASS_EXIT_WITNESSES.map((w) => [w.name]))('%s: recorded on the default build, hit-free, and across the '
        + 'door', (name) => {
        const rec = load(name);
        const w = TIMEDPASS_EXIT_WITNESSES.find((x) => x.name === name);
        expect(rec.page).toBe('seedling_bot_ap_p4g');
        expect(rec.samples.every((g) => g.hits === 0)).toBe(true);
        expect(rec.end.level).toBe(w.goals[1].exit.x === 0 ? 26 : 25);
    });
    it.each(TIMEDPASS_EXIT_WITNESSES.map((w) => [w.name]))('%s: the model (both keys ON) reproduces the game on every '
        + 'sampled tick', async (name) => {
        const rec = load(name);
        const w = TIMEDPASS_EXIT_WITNESSES.find((x) => x.name === name);
        const m = await drillKillModelSamples(rec.tape, w.switches);
        expect(m.error).toBeNull();
        expect(compareDrillKillWitness(rec.samples, m.samples, rec.tape.boot.level)).toEqual([]);
        expect(m.pulls.map((p) => p.id)).toEqual(['rope@160,64']);
    }, 120000);
    it.each(TIMEDPASS_EXIT_WITNESSES.map((w) => [w.name]))('%s: the solver still plans the recorded tape', async (name) => {
        const rec = load(name);
        const { tape } = await timedPassTape(TIMEDPASS_EXIT_WITNESSES.find((w) => w.name === name));
        expect(tape.inputs).toEqual(rec.tape.inputs);
    }, 180000);
    it('every exit witness file exists', () => {
        for (const w of TIMEDPASS_EXIT_WITNESSES) expect(existsSync(path(w.name))).toBe(true);
    });
});
