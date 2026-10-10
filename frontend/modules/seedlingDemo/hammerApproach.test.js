/**
 * hammerApproach — SEEDLING HAMMER-PHASE B1: the strike APPROACH planned in space-time (`HAMMER_APPROACH`,
 * `solverBot.deriveApproach`), on the kernel of slice A (`spaceTimeReach`, its earliest mode).
 *
 * ⚖ The user (2026-10-07): *"fighting an enemy with a swinging hammer means that the target position we want to reach
 * to attack from changes over time, and so there are multiple (position, time) targets to choose from"*; (2026-10-09)
 * *"Yes"* to this slice — the approach to the next strike, behind its own flag, OFF by default.
 *
 * ── THE MUTATION LIST (run during development; each row's catcher named) ──
 *
 *   m1 the goal's escape admission off (a state in reach is a goal whatever `pressEscape` says)
 *        -> the certificate row below (its press must land with a way out) and the residue sweep
 *   m2 the approach's hazard prune off (`safe` accepts every state)
 *        -> the certificate row (no hit along the walk) and the residue sweep
 */
import { describe, expect, it } from 'vitest';

import { loadTape } from './fixtures/index.js';
import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { twoPassSolve } from './twoPassSolve.js';
import { SPINNER } from './spinner.js';
import {
    DEADLINE_SITES, HAMMER_APPROACH, HAMMER_APPROACH_BOUNDS, HAMMER_APPROACH_MEASURED, HAMMER_APPROACH_TRACE,
    HAMMER_ESCAPE, deriveApproach, withHammerApproach,
} from './solverBot.js';
import { coarseKey, SPACE_TIME_KEY_SETS, spaceTimeReach } from './spaceTimeReach.js';

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

/** A toy controller: one px per tick per held axis, no inertia (hammerEscape.test.js's). */
const toyStep = (st, keys) => {
    const vx = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
    const vy = (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0);
    return { x: st.x + vx, y: st.y + vy, vx, vy };
};

describe('hammer-phase B1 — the kernel hands the goal its path', () => {
    it('⛓ `goal(state, index, path)`: path() is the certificate that would end at that node, re-stepped exactly', () => {
        const start = { x: 0, y: 0, vx: 0, vy: 0 };
        const seen = [];
        const r = spaceTimeReach({ start, step: toyStep, safe: () => true, horizon: 20, mode: 'earliest',
            keySets: SPACE_TIME_KEY_SETS, keyOf: coarseKey(1),
            goal: (st, i, path) => {
                if (st.x !== 4 || st.y !== 2) return false;
                const p = path();
                seen.push({ i, p });
                let q = start;
                for (const k of p.keys) q = toyStep(q, k);
                return q.x === st.x && q.y === st.y && p.keys.length === i && p.states.length === i + 1;
            } });
        expect(r.ok).toBe(true);
        expect(r.endIndex).toBe(4);
        expect(seen.length).toBeGreaterThan(0);
        expect(r.keys.length).toBe(seen[seen.length - 1].p.keys.length);
    });
});

describe('hammer-phase B1 — HAMMER_APPROACH (OFF by default)', () => {
    it('⛓⛓ OFF by default, its own deadline site (appended last), the switch restores, the trace off', () => {
        expect(HAMMER_APPROACH.enabled).toBe(false);
        expect(DEADLINE_SITES[DEADLINE_SITES.length - 1]).toBe('hammer-approach');
        expect(withHammerApproach(true, () => HAMMER_APPROACH.enabled)).toBe(true);
        expect(HAMMER_APPROACH.enabled).toBe(false);
        expect(() => withHammerApproach(true, () => { throw new Error('x'); })).toThrow('x');
        expect(HAMMER_APPROACH.enabled).toBe(false);
        expect(HAMMER_APPROACH_TRACE.sink).toBe(null);
    });

    it('⛓⛓ the bounds are the measured record\'s: the key, the room\'s horizon, a budget above every search that ended on its own', () => {
        const m = HAMMER_APPROACH_MEASURED;
        expect(HAMMER_APPROACH_BOUNDS.cell).toBe(m.cell);
        expect(HAMMER_APPROACH_BOUNDS.horizon).toBe(null);
        expect(HAMMER_APPROACH_BOUNDS.maxExpansions).toBeGreaterThan(m.largestFound);
        expect(HAMMER_APPROACH_BOUNDS.maxExpansions).toBeGreaterThan(m.largestHorizon);
        expect(HAMMER_APPROACH_BOUNDS.maxExpansions).toBeGreaterThan(m.largestExhausted);
        expect(m.budgetCuts.l18).toBe(0);
    });

    it('⛓⛓⛓ a certificate is TICK-EXACT on the run: its keys walk the run through its states with no hit, and the press it aims lands', () => {
        const run = runAt(40);
        const body = run.entities('spinnerBodies')[0];
        const a = deriveApproach(run, { bodyId: body.id, lastPressAt: -100, caller: 'test' });
        expect(a.ok).toBe(true);
        const { approach } = a.strike;
        expect(approach.keys.length).toBe(approach.index);
        expect(a.strike.aimAt).toBe(approach.index);
        for (let k = 0; k < approach.keys.length; k += 1) {
            expect(run.state).toEqual(approach.states[k]);
            run.advance(approach.keys[k]);
        }
        expect(run.state).toEqual(approach.states[approach.index]);
        // the aim (the live arm's own key toward the body), the press, the train stood
        const rect = run.entities('spinnerBodies').find((b) => b.id === body.id).rect;
        const cx = (rect.x + rect.right) / 2 - run.state.x;
        const cy = (rect.y + rect.bottom) / 2 - run.state.y;
        const aim = Math.abs(cx) >= Math.abs(cy) ? (cx >= 0 ? 'right' : 'left') : (cy >= 0 ? 'down' : 'up');
        run.advance(new Set([aim]));
        run.advance(new Set(['primary']));
        for (let k = 0; k < 6; k += 1) run.advance(new Set());
        expect(run.playerHits).toEqual([]);
        expect(run.spinnerPressHits.some((h) => h.id === body.id && h.landed)).toBe(true);
        if (HAMMER_ESCAPE.enabled) expect(approach.escape).not.toBe(null);
    }, 120_000);

    it('⛓ a negative is never a refusal, and it names its bound: an unknown body, a press in flight that stands into a body', () => {
        const run = runAt(40);
        expect(deriveApproach(run, { bodyId: 'spinner@0,0', lastPressAt: -100, caller: 'test' }).bound).toBe('body');
    });

    it('⛓⛓⛓ OFF is the switch-off walk byte for byte; ON solves the same residue shorter, with no hit, every press planned in space-time', async () => {
        const off = await withHammerApproach(false, () => solveR9At(40));
        expect(off.out.perTick.length).toBe(518);
        expect(off.out.records.filter((x) => x.arm === 'press').every((x) => x.approaches === undefined)).toBe(true);
        const on = await withHammerApproach(true, () => solveR9At(40));
        expect(HAMMER_APPROACH.enabled).toBe(false);
        const press = on.out.records.filter((x) => x.arm === 'press');
        expect(on.out.perTick.length).toBeLessThan(off.out.perTick.length);
        expect(press.flatMap((x) => x.approaches ?? []).some((a) => a.ok)).toBe(true);
        const seam = seamAt(40);
        const replay = createRunForStaging({ ...R9, seam, persistence: on.persistence, equips: [] }, SOURCE);
        for (const held of on.out.perTick) replay.advance(held);
        expect(replay.playerHits).toEqual([]);
        expect(replay.transitions.map((x) => x.to_level)).toEqual([R9.boot.level + 1]);
    }, 300_000);
});
