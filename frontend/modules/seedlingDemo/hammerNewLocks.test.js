/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE NEW-LOCKS — the three lock legs the 2026-11-09 rules added (L18's kill-lock, L26's
 * rocklock, L53's kill-lock), each behind its own OFF switch. ⚖ The user, 2026-11-10: *"One slice, all three"*.
 *
 *   `KILLLOCK_CLEAR_WRITE`  a clear-tag on a kill-lock finishes on the run's own kill-lock write (`run.scratchClears`);
 *   `ROCKLOCK_KILL`         a `RockLock` with `tset == -1` is a kill-lock and the kill work order takes it;
 *   `KILLLOCK_LINE_STANCE`  a chaser PINNED from where the player stands is drawn from a cell it has a clear straight
 *                           line to (on top of `KILLLOCK_CHASER_REWIND`).
 *
 * MEASURED at main `a66a450e70` (`CC/docs/cloud-reports/seedling-hammer-new-locks.md`). The states are the page's own
 * captured requests for the legs (223; 286 and 289; 911), their atlas records cut to the leg's own level
 * (byte-identical answers to the uncut capture, OFF and ON). Each row solves as the worker does (`solveAnytime`, the
 * request's passes and budget). ⚖ 30(c): each plan is replayed on a FRESH run of its staging and its hits and its
 * flag's write are read from that run. Leg 910 (the held retry, the heaviest) is `hammerNewLocks.train.test.js`.
 */

import { describe, expect, it } from 'vitest';

import {
    KILLLOCK_CHASER_REWIND, KILLLOCK_CLEAR_WRITE, KILLLOCK_CLEAR_WRITE_DEFAULT, KILLLOCK_LINE_STANCE,
    KILLLOCK_LINE_STANCE_DEFAULT, KILLLOCK_LINE_STANCE_PER_BODY, KILLLOCK_LINE_STANCE_TRIES, OBSTACLE_STRATEGIES,
    ROCKLOCK_KILL, ROCKLOCK_KILL_DEFAULT, chaserLineStances, withRockLockKill,
} from './solverBot.js';
import { clearTagVerbOf, replayTape } from './jsRuntimeSolver.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { ALL, LEG_223, LEG_286, LEG_289, LEG_911, NONE, solveLeg, staged } from './hammerNewLocksLegs.js';

const ENV = globalThis.process?.env ?? {};

describe('hammer-phase NEW-LOCKS — the switches', () => {
    it('CLEAR_WRITE and ROCKLOCK_KILL ship OFF (`=1` turns each on); LINE_STANCE ships ON since the kill-lock flip (`=0` turns it off); the page channel knows the names', () => {
        expect([KILLLOCK_CLEAR_WRITE_DEFAULT, ROCKLOCK_KILL_DEFAULT, KILLLOCK_LINE_STANCE_DEFAULT]).toEqual([false, false, true]);
        expect(KILLLOCK_CLEAR_WRITE.enabled).toBe(ENV.SEEDLING_KILLLOCK_CLEAR_WRITE === '1');
        expect(ROCKLOCK_KILL.enabled).toBe(ENV.SEEDLING_ROCKLOCK_KILL === '1');
        expect(KILLLOCK_LINE_STANCE.enabled).toBe(ENV.SEEDLING_KILLLOCK_LINE_STANCE !== '0');
        for (const n of ['SEEDLING_KILLLOCK_CLEAR_WRITE', 'SEEDLING_ROCKLOCK_KILL', 'SEEDLING_KILLLOCK_LINE_STANCE']) {
            expect(SOLVER_ENV_NAMES).toContain(n);
        }
        expect([KILLLOCK_LINE_STANCE_TRIES, KILLLOCK_LINE_STANCE_PER_BODY]).toEqual([6, 3]);
    });

    it('`solid:rocklock` is a row only while `ROCKLOCK_KILL` is on, `Lock`\'s own (`hold`), and never enumerable', () => {
        withRockLockKill(false, () => {
            expect(OBSTACLE_STRATEGIES['solid:rocklock']).toBeUndefined();
            expect(clearTagVerbOf('solid:rocklock')).toEqual({ verb: null, registered: false });
        });
        withRockLockKill(true, () => {
            expect(OBSTACLE_STRATEGIES['solid:rocklock']).toBe(OBSTACLE_STRATEGIES['solid:lock']);
            expect(clearTagVerbOf('solid:rocklock')).toEqual({ verb: 'hold', registered: true });
            expect(Object.keys(OBSTACLE_STRATEGIES)).not.toContain('solid:rocklock');
        });
    });
});

describe('hammer-phase NEW-LOCKS — L18 `{18,0}` (leg 223): the kill-lock\'s write (`KILLLOCK_CLEAR_WRITE`)', () => {
    it('OFF: the kill runs, the lock leaves the world, and the order refuses `not-written`', () => {
        const off = solveLeg(LEG_223, NONE);
        expect(off.ok).toBe(false);
        expect(off.message).toMatch(/clear-tag \{18,0\} lock@144,112: 'kill' ran .* still does not hold \{18,0\} 120 ticks later/);
        expect(off.obstacle).toMatchObject({ kind: 'clear-tag', reason: 'not-written' });
    });

    it('ON: solved on the run\'s own kill-lock write (t360 = the last spinner\'s removal + the lock\'s fade), 0 hits', () => {
        const on = solveLeg(LEG_223, { ...NONE, write: true });
        expect(on).toMatchObject({ ok: true, ticks: 361, planSha: '46b04032411f', verbs: ['kill'], hits: 0, deaths: 0,
            level: 18, stillSolid: false });
        expect(on.writes).toEqual([{ level: 18, tag: 0, at: 360, lock: 'lock@144,112' }]);
        // the model's own ledger still has no kill-lock arm: the row the order finished on is the scratch layer's
        expect(on.earned).toEqual([]);
        // the other two switches change nothing here (no rocklock, no chaser)
        expect(solveLeg(LEG_223, ALL)).toMatchObject({ ok: true, ticks: 361, planSha: '46b04032411f' });
    });
});

describe('hammer-phase NEW-LOCKS — L26 `{26,0}` (legs 286, 289): the rocklock kill-lock (`ROCKLOCK_KILL`)', () => {
    it('OFF: `no-verb`, before the first tick', () => {
        for (const leg of [LEG_286, LEG_289]) {
            const off = solveLeg(leg, NONE);
            expect(off.ok).toBe(false);
            expect(off.message).toMatch(/clear-tag \{26,0\} rocklock@112,208: no strategy row exists for solid:rocklock/);
            expect(off.obstacle).toMatchObject({ kind: 'clear-tag', reason: 'no-verb' });
        }
    });

    it('`ROCKLOCK_KILL` alone: the kill work order takes it (its chaser arm asks about both punchers) and refuses there', () => {
        const rock = solveLeg(LEG_286, { ...NONE, rock: true });
        expect(rock.ok).toBe(false);
        expect(rock.message).toMatch(/rocklock@112,208 -> kill: the count is still waiting on \[puncher@32,208, puncher@80,168\]/);
    });

    it('with the rewind and no `KILLLOCK_CLEAR_WRITE`: both punchers die, the rocklock leaves the world, `not-written`', () => {
        const noWrite = solveLeg(LEG_289, { ...ALL, write: false });
        expect(noWrite.ok).toBe(false);
        expect(noWrite.message).toMatch(/rocklock@112,208: 'kill' ran .* still does not hold \{26,0\} 120 ticks later/);
    });

    it('ON (all four): both legs solved, 0 hits, the flag written by the run and the rocklock gone', () => {
        const a = solveLeg(LEG_286, ALL);
        expect(a).toMatchObject({ ok: true, ticks: 629, planSha: '2e67ef21dc8b', verbs: ['kill', 'walk'], hits: 0,
            deaths: 0, level: 26, stillSolid: false });
        expect(a.writes).toEqual([{ level: 26, tag: 0, at: 628, lock: 'rocklock@112,208' }]);
        const b = solveLeg(LEG_289, ALL);
        expect(b).toMatchObject({ ok: true, ticks: 315, planSha: 'c9fa81f02f3e', verbs: ['kill'], hits: 0, deaths: 0,
            level: 26, stillSolid: false });
        expect(b.writes).toEqual([{ level: 26, tag: 0, at: 314, lock: 'rocklock@112,208' }]);
    });
});

describe('hammer-phase NEW-LOCKS — L26, the door behind the rocklock (the frontier\'s order, not a clear-tag)', () => {
    // 289's own request (the L27 arrival) with its goal swapped for the L28 teleporter at (144,208), which stands
    // behind `rocklock@112,208`: the walk's own L26 crossing. The leg list holds no such leg (the rules gate that
    // edge on the flag), so the request is the page's and the goal is the row's.
    const DOOR = { kind: 'reach-exit', exit: { x: 144, y: 208 } };

    it('OFF: no corridor, and the rocklock on the frontier has no strategy row', () => {
        const off = solveLeg(LEG_289, NONE, { goal: DOOR });
        expect(off.ok).toBe(false);
        expect(off.message).toMatch(/no corridor for goal reach-exit toward \(152,216\) in level 26\. .*rocklock@112,208/);
    });

    it('`ROCKLOCK_KILL` + the rewind: the frontier kills the punchers, the rocklock fades, the walk crosses to L28, 0 hits', () => {
        const on = solveLeg(LEG_289, { ...NONE, rock: true, rewind: true }, { goal: DOOR });
        expect(on).toMatchObject({ ok: true, ticks: 357, planSha: 'ac2590edef0b', verbs: ['kill', 'walk'], hits: 0,
            deaths: 0, level: 28 });
        expect(on.writes).toEqual([{ level: 26, tag: 0, at: 314, lock: 'rocklock@112,208' }]);
        expect(solveLeg(LEG_289, ALL, { goal: DOOR })).toMatchObject({ ok: true, ticks: 357, planSha: 'ac2590edef0b' });
    });
});

describe('hammer-phase NEW-LOCKS — L53 `{53,2}` (legs 910, 911): the pinned chasers (`KILLLOCK_LINE_STANCE`)', () => {
    it('the line stances are derived from the body\'s own Solids: from 911\'s arrival every jellyfish\'s cells lie in '
        + 'the arena it is walled into, and the puncher\'s in its corridor', () => {
        const { tape, levelSource } = staged(LEG_911);
        const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource,
            scratchPersistence: tape.scratchPersistence });
        const bodies = run.entities('strikeBodies');
        const cellsOf = (id) => chaserLineStances(run, bodies.find((b) => b.id === id), new Set());
        for (const id of ['jellyfish@144,192', 'jellyfish@184,160', 'jellyfish@152,168']) {
            const cells = cellsOf(id);
            expect(cells.length).toBeGreaterThan(0);
            // the arena: x 128..208, y 144..208 (Ice Wall on every side; two breakable rocks on its west)
            expect(cells.every((c) => c.x > 128 && c.x < 208 && c.y > 144 && c.y < 208)).toBe(true);
        }
        const p = cellsOf('puncher@136,96');
        expect(p.length).toBeGreaterThan(0);
        expect(p.every((c) => c.y < 128)).toBe(true);
        // nearest the player first, and the order is total
        const d = (c) => Math.hypot(c.x - run.state.x, c.y - run.state.y);
        expect(p.map(d)).toEqual([...p.map(d)].sort((x, y) => x - y));
    });

    it('911 (from L51, the first ask): without the line stance the rewind refuses on a pinned body; ON solved, 0 hits', () => {
        const noLine = solveLeg(LEG_911, { ...ALL, line: false });
        expect(noLine.ok).toBe(false);
        const on = solveLeg(LEG_911, ALL);
        expect(on).toMatchObject({ ok: true, ticks: 606, planSha: '0af3161975c3', verbs: ['break', 'kill', 'walk'],
            hits: 0, deaths: 0, level: 53, stillSolid: false });
        expect(on.writes).toEqual([{ level: 53, tag: 2, at: 605, lock: 'lock@144,208' }]);
        expect(on.line.filter((r) => r.verdict === 'killed').slice(0, 2).map((r) => r.id))
            .toEqual(['puncher@136,96', 'jellyfish@184,160']);
        // the line stance without the clear's write: the count reaches 0 and the order refuses `not-written`
        const noWrite = solveLeg(LEG_911, { ...ALL, write: false });
        expect(noWrite.ok).toBe(false);
        expect(noWrite.message).toMatch(/lock@144,208: 'kill' ran .* still does not hold \{53,2\} 120 ticks later/);
    });

    it('the line stance needs the rewind: with `KILLLOCK_CHASER_REWIND` off it is not read (911 = OFF\'s refusal)', () => {
        const off = solveLeg(LEG_911, NONE);
        const lineOnly = solveLeg(LEG_911, { ...NONE, line: true });
        expect(lineOnly).toEqual(off);
        expect(off.ok).toBe(false);
        expect(KILLLOCK_CHASER_REWIND.enabled).toBe(ENV.SEEDLING_KILLLOCK_CHASER_REWIND !== '0');
    });
});
