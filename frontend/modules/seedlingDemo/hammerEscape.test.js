/**
 * hammerEscape — SEEDLING HAMMER-PHASE A: the HIT-AWARE spinner forecast (D1,
 * `levelRun.spinnerForecastWithPress`) and the space-time ESCAPE kernel (D2,
 * `spaceTimeReach.js`) the press kill's `HAMMER_ESCAPE` arm is built on.
 *
 * D1's witness is model vs model and exact: for every press LANDING in a walk,
 * the forecast taken at the AIM tick (before the press exists) is the run's own
 * bodies, rect for rect and `{hits, hitsTimer, destroy}` for each, until the
 * next landing (`witness-seedling-press-forecast.mjs`, whose `witnessWalk` these
 * rows call; the instrument runs every committed tape and every solving residue).
 *
 * D2's game witnesses (`plan-seedling-hammer-a-escape.mjs`, recorded on p4f):
 * `r9-solve-18`'s staging at two live-refusal residues, solved with
 * `HAMMER_ESCAPE` ON, played by the game and reproduced here at 0 px.
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *
 *   m1 the forecast drops the knockback (`vx`/`vy` kept from before the hit)
 *        -> every walk's witness red (the instrument: 9 of 9 walks), so the
 *           committed-walk rows below red
 *   m3 (found by the sweep, fixed) `landing` taken from ANY landed test, a press
 *        already in flight included -> the in-flight row red; on the solver,
 *        an escape searched from the wrong landing asked for points it never
 *        previewed (residue 35, follow 0: "no player position for the hit test")
 *   m2 the escape's prune off (`safe: () => true` in `pressEscape`)
 *        -> both solve-reproduction rows red (residue 21 re-plans to another
 *           walk, residue 15 refuses HAMMER_SAFETY again); the sweep: 13 of
 *           the 45 residues refuse
 */
import { describe, expect, it } from 'vitest';

import { loadTape } from './fixtures/index.js';
import { heldKeysAt } from './tapeFormat.js';
import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { witnessWalk } from '../../../scripts/procgen/witness-seedling-press-forecast.mjs';
import { loadExpectation } from './fixtures/index.js';
import { runTapeToStream } from './tapeRunner.js';
import { twoPassSolve } from './twoPassSolve.js';
import { SPINNER } from './spinner.js';
import {
    DEADLINE_SITES, HAMMER_ESCAPE, HAMMER_ESCAPE_BOUNDS, HAMMER_PHASE_RUNG, withHammerEscape,
} from './solverBot.js';
import {
    HOLD_FIRST_KEY_SETS, SPACE_TIME_KEY_SETS, coarseKey, spaceTimeReach,
} from './spaceTimeReach.js';

const SOURCE = atlasLevelSource();
const replayRun = (name) => {
    const tape = loadTape(name);
    const st = stagingFromTape(tape);
    return { tape, make: () => createRunForStaging(st, SOURCE) };
};
const witnessTape = (name, aimBack = 1) => {
    const { tape, make } = replayRun(name);
    return witnessWalk(make, (t) => heldKeysAt(tape, t), tape.tick_count, 700, aimBack);
};

describe('hammer-phase A D1 — the hit-aware forecast (levelRun.spinnerForecastWithPress)', () => {
    it('⛓⛓⛓ the committed chain window: at every landing the forecast taken at the aim tick IS the run, byte for byte', () => {
        const r = witnessTape('r9-solve-18');
        expect(r.landings).toBeGreaterThan(0);
        expect(r.mismatches).toEqual([]);
        expect(r.scoped).toEqual([]);
    }, 120_000);

    it('⛓⛓ the game-recorded phase witness (a phase stall in its walk) is exact too', () => {
        const r = witnessTape('f1c-l18-phase42');
        expect(r.landings).toBeGreaterThan(0);
        expect(r.mismatches).toEqual([]);
    }, 120_000);

    it('⛓⛓ a carried shield is NAMED unmodelled: its bump at the aim tick is not in the forecast, and from the press tick the walk is exact (the dark-stuff latch through the i-frame included)', () => {
        const at = witnessTape('r1-dark-shield-spinner');
        expect(at.mismatches).toEqual([]);
        expect(at.scoped.length).toBeGreaterThan(0);
        expect(at.scoped[0].unmodelled.join()).toMatch(/shield bump/);
        const fromPress = witnessTape('r1-dark-shield-spinner', 0);
        expect(fromPress.landings).toBeGreaterThan(0);
        expect(fromPress.mismatches).toEqual([]);
        expect(fromPress.scoped).toEqual([]);
    }, 120_000);

    it('⛓ it reports, it does not assume: a re-press inside the slash timer is a DASH, a press in flight is never this press\'s landing, a press in the past and a missing point are refused, and spinnerForecast is untouched', () => {
        const { tape, make } = replayRun('r9-solve-18');
        const run = make();
        let pressedAt = null;
        for (let t = 0; t < tape.tick_count && pressedAt === null; t += 1) {
            if (heldKeysAt(tape, t).has('primary')) pressedAt = t;
            run.advance(heldKeysAt(tape, t));
        }
        expect(pressedAt).not.toBeNull();
        const stand = () => ({ x: run.state.x, y: run.state.y });
        const before = JSON.stringify(run.spinnerForecast(60));
        const again = run.spinnerForecastWithPress(60, { pressAt: run.ticksCompleted + 1,
            direction: run.state.direction, positions: stand });
        expect(again.outcome).toBe('dash');
        expect(JSON.stringify(run.spinnerForecast(60))).toBe(before);
        expect(again.rows.length).toBe(60);
        // ⛓ the press just made is IN FLIGHT: its tests are applied and reported, and never this press's landing
        const later = run.spinnerForecastWithPress(80, { pressAt: run.ticksCompleted + 40,
            direction: run.state.direction, positions: stand });
        expect(later.outcome).toBe('slash');
        const inFlight = later.tests.filter((x) => !x.own);
        expect(inFlight.length).toBeGreaterThan(0);
        expect(inFlight.every((x) => x.t <= pressedAt + 5)).toBe(true);
        if (later.landing) expect(later.landing.t).toBeGreaterThan(run.ticksCompleted + 40);
        expect(() => run.spinnerForecastWithPress(10, { pressAt: run.ticksCompleted - 1,
            direction: 0, positions: stand })).toThrow(/cannot press in the past/);
        expect(() => run.spinnerForecastWithPress(10, { pressAt: run.ticksCompleted,
            direction: 0, positions: [] })).toThrow(/no player position/);
    }, 60_000);
});

/** A toy controller: one px per tick per held axis, no inertia. */
const toyStep = (st, keys) => {
    const vx = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
    const vy = (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0);
    return { x: st.x + vx, y: st.y + vy, vx, vy };
};

describe('hammer-phase A D2 — the space-time kernel (spaceTimeReach)', () => {
    // a wall of danger sweeping right one px a tick, starting at x = -3: standing still dies, walking right lives
    const sweep = (st, i) => st.x > i - 3;
    const start = { x: 0, y: 0, vx: 0, vy: 0 };

    it('⛓⛓ a certificate is tick-exact by construction: its keys, re-stepped, give its states, every one safe', () => {
        const r = spaceTimeReach({ start, step: toyStep, safe: sweep, horizon: 12, keySets: HOLD_FIRST_KEY_SETS,
            keyOf: coarseKey(1) });
        expect(r.ok).toBe(true);
        expect(r.keys.length).toBe(12);
        let st = start;
        for (let k = 0; k < r.keys.length; k += 1) {
            st = toyStep(st, r.keys[k]);
            expect(st).toEqual(r.states[k + 1]);
            expect(sweep(st, k + 1)).toBe(true);
        }
    });

    it('⛓ a negative names its bound: exhausted, the horizon of the earliest mode, the expansions, the deadline', () => {
        const never = () => false;
        const boxed = (st, i) => sweep(st, i) && st.x < 2;
        expect(spaceTimeReach({ start, step: toyStep, safe: boxed, horizon: 20 }).bound).toBe('exhausted');
        expect(spaceTimeReach({ start, step: toyStep, safe: sweep, horizon: 5, mode: 'earliest', goal: never })
            .bound).toBe('horizon');
        expect(spaceTimeReach({ start, step: toyStep, safe: sweep, horizon: 40, mode: 'earliest', goal: never,
            maxExpansions: 7 }).bound).toBe('expansions');
        let asks = 0;
        const r = spaceTimeReach({ start, step: toyStep, safe: sweep, horizon: 40, mode: 'earliest', goal: never,
            checkEvery: 3, shouldStop: () => { asks += 1; return asks >= 2; } });
        expect(r.bound).toBe('deadline');
        expect(r.expansions).toBe(6);
    });

    it('⛓ the earliest mode answers WHEN: the first index the goal holds, from the first state reaching it', () => {
        const r = spaceTimeReach({ start, step: toyStep, safe: () => true, horizon: 30, mode: 'earliest',
            goal: (st) => st.x === 5 && st.y === -3, keySets: SPACE_TIME_KEY_SETS, keyOf: coarseKey(1) });
        expect(r.ok).toBe(true);
        expect(r.endIndex).toBe(5);
    });

    it('⛓ deterministic: the answer depends on its inputs only', () => {
        const a = spaceTimeReach({ start, step: toyStep, safe: sweep, horizon: 15, keyOf: coarseKey(2) });
        const b = spaceTimeReach({ start, step: toyStep, safe: sweep, horizon: 15, keyOf: coarseKey(2) });
        expect(JSON.stringify(a.states)).toBe(JSON.stringify(b.states));
        expect(a.keys.map((k) => [...k].join('+'))).toEqual(b.keys.map((k) => [...k].join('+')));
    });
});

const R9 = stagingFromTape(loadTape('r9-solve-18'));
const solveR9At = (residue) => {
    const P = SPINNER.hammerPeriod;
    const was = ((R9.seam.time % P) + P) % P;
    const seam = { ...R9.seam, time: R9.seam.time + ((((residue - was) % P) + P) % P) - P };
    const makeRun = (persistence) => createRunForStaging({ ...R9, seam, persistence, equips: [] }, SOURCE);
    return twoPassSolve({ makeRun, goals: [{ kind: 'reach-exit', exit: { x: 176, y: 112 } }], name: 'r9-solve-18',
        boot: R9.boot, persistence: R9.persistence.filter((c) => c.at === undefined),
        gameTick: async () => { throw new Error('no game oracle here'); } });
};

describe('hammer-phase A D2 — HAMMER_ESCAPE in the press kill', () => {
    // ⛓ hammer-phase A2 (⚖ user 2026-10-07, "I approve."): ON by default; `SEEDLING_HAMMER_ESCAPE=0` turns it off.
    it('⛓⛓ ON by default, a deadline site of its own (appended), and its bounds are the mechanism\'s', () => {
        expect(HAMMER_ESCAPE.enabled).toBe(true);
        expect(DEADLINE_SITES[DEADLINE_SITES.length - 1]).toBe('hammer-escape');
        expect(HAMMER_ESCAPE_BOUNDS.horizon).toBe(SPINNER.hitsTimerMax + HAMMER_PHASE_RUNG.horizon);
        expect(HAMMER_ESCAPE_BOUNDS.follow).toBe(0);
    });

    for (const residue of [21, 15]) {
        const name = `hammer-a-l18-escape${residue}`;
        it(`⛓⛓⛓ the game witness ${name}: the model reproduces the game's recording at 0 px, no hit, the crossing on the game's tick`, () => {
            const tape = loadTape(name);
            const got = runTapeToStream(tape, { levelSource: SOURCE });
            const want = loadExpectation(name).stream;
            expect(got.ticks.length).toBe(want.ticks.length);
            for (let i = 0; i < want.ticks.length; i += 1) {
                expect([got.ticks[i].x, got.ticks[i].y, got.ticks[i].level])
                    .toEqual([want.ticks[i].x, want.ticks[i].y, want.ticks[i].level]);
            }
            const run = createRunForStaging(stagingFromTape(tape), SOURCE);
            for (let t = 0; t < tape.tick_count; t += 1) run.advance(heldKeysAt(tape, t));
            expect(run.playerHits).toEqual([]);
            expect(run.transitions.map((x) => x.t)).toEqual(want.transitions.map((x) => x.t));
        }, 120_000);

        it(`⛓⛓ ${name} IS the solve: off, the staging refuses HAMMER_SAFETY; on, it solves to the witness's keys with an escape at every landing`, async () => {
            let refused = null;
            try { await withHammerEscape(false, () => solveR9At(residue)); } catch (e) { refused = e; }
            expect(refused?.code).toBe('HAMMER_SAFETY');
            const was = HAMMER_ESCAPE.enabled;
            const r = await withHammerEscape(true, () => solveR9At(residue));
            expect(HAMMER_ESCAPE.enabled).toBe(was);
            const tape = loadTape(name);
            expect(r.out.perTick.length).toBe(tape.tick_count);
            for (let t = 0; t < tape.tick_count; t += 1) {
                expect([...r.out.perTick[t]].sort()).toEqual([...heldKeysAt(tape, t)].sort());
            }
            const press = r.out.records.filter((x) => x.arm === 'press');
            expect(press.flatMap((x) => x.escapes ?? []).length).toBe(press.flatMap((x) => x.landings).length);
        }, 300_000);
    }
});
