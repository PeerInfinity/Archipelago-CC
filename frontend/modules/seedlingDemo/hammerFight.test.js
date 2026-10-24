/**
 * hammerFight — SEEDLING HAMMER-PHASE B2: the whole press-kill FIGHT as one space-time search (`HAMMER_FIGHT`,
 * `solverBot.deriveFight`), on the forecast cursor `levelRun.spinnerFightForecast` and slice A's kernel.
 *
 * ⚖ The user (2026-10-09): *"plan the whole fight as one search, surviving to the last kill, with each press a step
 * and the bodies' hit state in the search"* — behind its own flag, OFF by default.
 *
 * ── THE MUTATION LIST (run during development; each row's catcher named) ──
 *
 *   m1 the bodies' fight state dropped from the dedup key -> the certificate row (a merged node carries another
 *        path's forecast? no: each node keeps its own cursor, so the certificate stays exact) and the measured
 *        lengths/expansions in the report (D2.8)
 *   m2 the goal's post-kill window dropped (every body dead is the goal) -> the certificate row (its tail)
 */
import { describe, expect, it } from 'vitest';

import { loadExpectation, loadTape } from './fixtures/index.js';
import { heldKeysAt } from './tapeFormat.js';
import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging, runTapeToStream, stagingFromTape } from './tapeRunner.js';
import { twoPassSolve } from './twoPassSolve.js';
import { SPINNER } from './spinner.js';
import {
    DEADLINE_SITES, HAMMER_ESCAPE_BOUNDS, HAMMER_FIGHT, HAMMER_FIGHT_BOUNDS, HAMMER_FIGHT_MEASURED,
    HAMMER_FIGHT_TRACE, deriveFight, withHammerFight,
} from './solverBot.js';
import { bestFirstQueue } from './spaceTimeReach.js';

const SOURCE = atlasLevelSource();
const R9 = stagingFromTape(loadTape('r9-solve-18'));
const seamAt = (residue) => {
    const P = SPINNER.hammerPeriod;
    const was = ((R9.seam.time % P) + P) % P;
    return { ...R9.seam, time: R9.seam.time + ((((residue - was) % P) + P) % P) - P };
};
const runAt = (residue) => createRunForStaging({ ...R9, seam: seamAt(residue), equips: [] }, SOURCE);
const solveR9At = (residue) => {
    const seam = seamAt(residue);
    const makeRun = (persistence) => createRunForStaging({ ...R9, seam, persistence, equips: [] }, SOURCE);
    return twoPassSolve({ makeRun, goals: [{ kind: 'reach-exit', exit: { x: 176, y: 112 } }], name: 'r9-solve-18',
        boot: R9.boot, persistence: R9.persistence.filter((c) => c.at === undefined),
        gameTick: async () => { throw new Error('no game oracle here'); } });
};

describe('hammer-phase B2 — the best-first queue', () => {
    it('⛓ pops the least under a total order, ties broken by the caller\'s insertion number', () => {
        const q = bestFirstQueue((a, b) => (a.f - b.f) || (a.seq - b.seq));
        [5, 1, 4, 1, 3, 9, 2].forEach((f, seq) => q.push({ f, seq }));
        const out = [];
        while (q.size > 0) out.push(q.pop());
        expect(out.map((x) => `${x.f}.${x.seq}`)).toEqual(['1.1', '1.3', '2.6', '3.4', '4.2', '5.0', '9.5']);
        expect(q.pop()).toBe(undefined);
    });
});

describe('hammer-phase B2 — the forecast cursor (`spinnerFightForecast`)', () => {
    it('⛓⛓⛓ one press through the cursor IS `spinnerForecastWithPress`: every row, every body, every test', () => {
        const run = runAt(40);
        const step = run.previewStepper();
        const stand = new Set();
        // stand 20 ticks, press at +20 facing as the stood state faces; the points are the stood states
        const pts = [{ ...run.state }];
        for (let k = 1; k < 40; k += 1) pts.push(step({ ...pts[k - 1] }, stand));
        const pressAt = run.ticksCompleted + 20;
        const direction = pts[20].direction;
        const one = run.spinnerForecastWithPress(40, { pressAt, direction, positions: pts });
        const c = run.spinnerFightForecast();
        for (let k = 0; k < 40; k += 1) c.advance(pts[k], k === 20 ? { direction } : null);
        expect(JSON.stringify(c.rows)).toBe(JSON.stringify(one.rows));
        expect(JSON.stringify(c.bodies)).toBe(JSON.stringify(one.bodies));
        expect(c.tests.map((x) => [x.t, x.id, x.landed])).toEqual(one.tests.map((x) => [x.t, x.id, x.landed]));
        // a fork replays the same rows from where it forks
        const f = c.fork(10);
        for (let k = 11; k < 40; k += 1) f.advance(pts[k], k === 20 ? { direction } : null);
        expect(JSON.stringify(f.rows)).toBe(JSON.stringify(one.rows));
        // a window in flight reads the point, and says so without one
        const g = run.spinnerFightForecast();
        for (let k = 0; k < 20; k += 1) g.advance(null);
        g.advance(pts[20], { direction });
        expect(() => g.advance(null)).toThrow(/no player position/);
    });
});

describe('hammer-phase B2 — HAMMER_FIGHT (OFF by default)', () => {
    it('⛓⛓ OFF by default, its own deadline site (appended last), the switch restores, the trace off', () => {
        expect(HAMMER_FIGHT.enabled).toBe(false);
        expect(HAMMER_FIGHT.bounds).toBe(null);
        // ⛓ appended after `hammer-approach`; bobsoldier2 D3's `crusher-fork` was appended after it (a later row).
        expect(DEADLINE_SITES.indexOf('hammer-fight')).toBe(DEADLINE_SITES.indexOf('hammer-approach') + 1);
        expect(withHammerFight(true, () => HAMMER_FIGHT.enabled)).toBe(true);
        expect(HAMMER_FIGHT.enabled).toBe(false);
        expect(() => withHammerFight(true, () => { throw new Error('x'); })).toThrow('x');
        expect(HAMMER_FIGHT.enabled).toBe(false);
        expect(HAMMER_FIGHT_TRACE.sink).toBe(null);
    });

    it('⛓⛓ the bounds are the measured record\'s: the tail is the escape\'s horizon, a budget above the L18 searches', () => {
        expect(HAMMER_FIGHT_BOUNDS.tail).toBe(HAMMER_ESCAPE_BOUNDS.horizon);
        expect(HAMMER_FIGHT_BOUNDS.cell).toBe(HAMMER_FIGHT_MEASURED.cell);
        expect(HAMMER_FIGHT_BOUNDS.maxExpansions).toBeGreaterThan(HAMMER_FIGHT_MEASURED.l18.largestFound);
        expect(HAMMER_FIGHT_BOUNDS.maxExpansions).toBeGreaterThan(HAMMER_FIGHT_MEASURED.generated.largestFound);
        expect(HAMMER_FIGHT_MEASURED.generated.budgetCuts).toBe(0);
    });

    it('⛓⛓⛓ a certificate is TICK-EXACT on the run: its keys walk the run through its states and landings, every body of the order dies, no hit through the tail', () => {
        const run = runAt(40);
        const ids = run.entities('spinnerBodies').map((b) => b.id);
        const a = deriveFight(run, { targets: ids, lastPressAt: -100, caller: 'test' });
        expect(a.ok).toBe(true);
        const { fight } = a;
        expect(fight.end).toBe(fight.keys.length);
        expect(fight.keys.length - fight.goal).toBe(fight.tail);
        expect(fight.tail).toBe(HAMMER_FIGHT_BOUNDS.tail);
        for (let k = 0; k < fight.keys.length; k += 1) {
            expect(run.state).toEqual(fight.states[k]);
            if (k === fight.goal) {
                // ⛓ the goal: every body of the order dying or gone
                expect(run.entities('spinnerBodies').filter((b) => ids.includes(b.id) && !b.destroy)).toEqual([]);
            }
            run.advance(fight.keys[k]);
        }
        expect(run.playerHits).toEqual([]);
        const landed = run.spinnerPressHits.filter((h) => h.landed).map((h) => ({ t: h.t, id: h.id }));
        expect(landed).toEqual(fight.landings);
        expect(landed.length).toBe(ids.length * SPINNER.hitsMax);
    }, 120_000);

    it('⛓ a negative is never a refusal, and it names its bound', () => {
        const run = runAt(40);
        const r = deriveFight(run, { targets: ['spinner@0,0'], lastPressAt: -100, caller: 'test' });
        expect(r.ok).toBe(false);
        expect(r.bound).toBe('body');
        expect(r.claim).toBe(false);
        const cut = deriveFight(run, { targets: run.entities('spinnerBodies').map((b) => b.id), lastPressAt: -100,
            caller: 'test', bounds: { ...HAMMER_FIGHT_BOUNDS, maxExpansions: 10 } });
        expect(cut.bound).toBe('expansions');
        expect(cut.claim).toBe(false);
    }, 60_000);

    it('⛓⛓⛓ OFF is the switch-off walk byte for byte; ON solves the residue with no hit, the fight followed to its end', async () => {
        const off = await withHammerFight(false, () => solveR9At(40));
        expect(off.out.perTick.length).toBe(518);
        expect(off.out.records.filter((x) => x.arm === 'press').every((x) => x.fights === undefined)).toBe(true);
        const on = await withHammerFight(true, () => solveR9At(40));
        expect(HAMMER_FIGHT.enabled).toBe(false);
        const press = on.out.records.filter((x) => x.arm === 'press');
        expect(press.flatMap((x) => x.fights ?? []).some((f) => f.ok)).toBe(true);
        expect(press.reduce((s, x) => s + x.fightsLeft, 0)).toBe(0);
        expect(on.out.perTick.length).toBeLessThan(off.out.perTick.length);
        const replay = createRunForStaging({ ...R9, seam: seamAt(40), persistence: on.persistence, equips: [] },
            SOURCE);
        for (const held of on.out.perTick) replay.advance(held);
        expect(replay.playerHits).toEqual([]);
        expect(replay.transitions.map((x) => x.to_level)).toEqual([R9.boot.level + 1]);
    }, 300_000);
});

/**
 * ⛓⛓⛓ THE GAME WITNESS (`plan-seedling-hammer-b2-fight.mjs`, recorded on p4f): `r9-solve-18`'s staging (frozen at
 * hammer-phase A's base) at its own residue 40, solved with `HAMMER_FIGHT` on — the whole fight one certificate —
 * played by the game with no hit (`save.time` 10278 = the model's), reproduced here at 0 px.
 */
describe('hammer-phase B2 — the game witness hammer-b2-l18-fight40', () => {
    const NAME = 'hammer-b2-l18-fight40';
    it('⛓⛓⛓ the model reproduces the game\'s recording at 0 px, no hit, the crossing on the game\'s tick', () => {
        const tape = loadTape(NAME);
        const got = runTapeToStream(tape, { levelSource: SOURCE });
        const want = loadExpectation(NAME).stream;
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

    it('⛓⛓ it IS the solve: on, the staging solves to the witness\'s keys, ONE certificate held to its end', async () => {
        const tape = loadTape(NAME);
        const staging = stagingFromTape(tape);
        const makeRun = (persistence) => createRunForStaging({ ...staging, persistence, equips: [] }, SOURCE);
        const r = await withHammerFight(true, () => twoPassSolve({ makeRun,
            goals: [{ kind: 'reach-exit', exit: { x: 176, y: 112 } }], name: NAME, boot: staging.boot,
            persistence: staging.persistence.filter((c) => c.at === undefined),
            gameTick: async () => { throw new Error('no game oracle here'); } }));
        expect(r.out.perTick.length).toBe(tape.tick_count);
        for (let t = 0; t < tape.tick_count; t += 1) {
            expect([...r.out.perTick[t]].sort()).toEqual([...heldKeysAt(tape, t)].sort());
        }
        const press = r.out.records.filter((x) => x.arm === 'press');
        expect(press.flatMap((x) => x.fights).filter((f) => f.ok)).toHaveLength(1);
        expect(press.reduce((s, x) => s + x.fightsLeft, 0)).toBe(0);
        expect(press.flatMap((x) => x.landings)).toHaveLength(2 * SPINNER.hitsMax);
    }, 300_000);
});
