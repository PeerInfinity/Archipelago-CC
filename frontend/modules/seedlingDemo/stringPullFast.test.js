/**
 * ⛓⛓ SEEDLING HAMMER-PHASE SP — `STRING_PULL_FAST`: the string-pull's point memo is ANSWER-IDENTICAL.
 *
 * `planWaypoints` is shared by the walker, the solver and the page, so the switch must change nothing but time.
 * The rows, each of which a mutant in `CC/docs/cloud-reports/seedling-hammer-string-pull.md` (D2) turns red:
 *   1. the contract: default OFF, and `withStringPullFast` restores the previous value on every exit;
 *   2. a CRUSHER STEP (L42, `crusher@96,144`, 1 px/tick): the same query on either side of one tick of its charge,
 *      through ONE options object whose `crushers` map moves in place — the answer changes across the step, and ON
 *      equals OFF on both sides, interleaved (a memo that outlived its call would hand the second ask the first's);
 *   3. a PUSH (L8, `pushableblock@96,112`, pushed one tile down) mid-leg: the same shape, `pushables`;
 *   4. committed solves under the `audit` seam — every real `planWaypoints` call runs BOTH pulls on the same points
 *      and they must agree — and OFF vs ON end to end: the answer digest, `shouldStop`, every segment's final
 *      `budget.asks`, and the whole progress stream (heartbeats included). L40 (the kill rung, the lever's target),
 *      L18 (the hammer room), L6, L3, and the L42 crusher witness (a moving-solid room solved with the bait).
 * The ≥ 500-call corpus over the six producers and the killgate census is `check-seedling-string-pull-fast.mjs`.
 */
import { describe, expect, it } from 'vitest';

import { atlasLevelSource } from './levelSource.js';
import { ROLES, buildLevelWorld } from './levelWorld.js';
import { loadTape } from './fixtures/index.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { twoPassSolve } from './twoPassSolve.js';
import { SPINNER } from './spinner.js';
import { withSolveDeadline } from './solverBot.js';
import { withSolveProgress } from './solveProgress.js';
import { BotDriverV2Error, STRING_PULL_FAST, planWaypoints, withStringPullFast } from './botDriverV2.js';
import { answerDigest } from '../../../scripts/procgen/probe-seedling-solve-progress.mjs';
import { CRUSHER_WITNESSES, crusherPlan } from '../../../scripts/procgen/plan-seedling-crusher-witness.mjs';

const SOURCE = atlasLevelSource();

/** `planWaypoints`' answer as bytes: its waypoints, or the refusal's message. */
function planBytes(world, from, to, opts) {
    try {
        return JSON.stringify(planWaypoints(world, from, to, null, opts));
    } catch (e) {
        if (!(e instanceof BotDriverV2Error)) throw e;
        return `THROW ${e.message}`;
    }
}
const planAs = (on, ...args) => withStringPullFast(on, () => planBytes(...args));

/** Run `fn` with the audit seam counting every pull pair; `{ out, calls, mismatches }`. */
async function audited(fn) {
    const was = STRING_PULL_FAST.audit;
    const seen = { calls: 0, mismatches: [] };
    STRING_PULL_FAST.audit = (row) => {
        seen.calls += 1;
        if (JSON.stringify(row.off) !== JSON.stringify(row.on)) seen.mismatches.push(row);
    };
    try {
        return { out: await fn(), ...seen };
    } finally {
        STRING_PULL_FAST.audit = was;
    }
}

describe('SP — the switch\'s contract', () => {
    it.skipIf(process.env.SEEDLING_STRING_PULL_FAST === '0')('ON by default, no audit', () => {
        expect(STRING_PULL_FAST.enabled).toBe(true);
        expect(STRING_PULL_FAST.audit).toBe(null);
    });

    it('`withStringPullFast` restores the previous value: sync, async and throwing', async () => {
        const prior = STRING_PULL_FAST.enabled;
        expect(withStringPullFast(true, () => STRING_PULL_FAST.enabled)).toBe(true);
        expect(STRING_PULL_FAST.enabled).toBe(prior);
        expect(await withStringPullFast(true, async () => STRING_PULL_FAST.enabled)).toBe(true);
        expect(STRING_PULL_FAST.enabled).toBe(prior);
        expect(() => withStringPullFast(true, () => { throw new Error('x'); })).toThrow('x');
        expect(STRING_PULL_FAST.enabled).toBe(prior);
    });
});

describe('SP — a live solid that moves between two plans: the memo does not outlive its call', () => {
    /**
     * Each case: one world, ONE options object, one live map mutated IN PLACE between the asks (the way a run's own
     * bag changes under a caller holding it), and a query whose answer the move changes. Found by search (D2): the
     * crusher's one-pixel step takes the straight drop down the corridor at x=94 off the table; the push opens the
     * diagonal past the block.
     */
    const cases = [
        { what: 'a crusher step (L42 `crusher@96,144`, one tick of a leftward charge at 1 px/tick)', level: 42,
            family: 'crushers', id: 'crusher@96,144', lattice: 8,
            before: (r) => ({ rect: r }), after: (r) => ({ rect: { ...r, x: r.x - 1, right: r.right - 1 } }),
            from: { x: 94, y: 190 }, to: { x: 94, y: 112 } },
        { what: 'a push (L8 `pushableblock@96,112`, one tile down)', level: 8,
            family: 'pushables', id: 'pushableblock@96,112', lattice: 16,
            before: (r) => ({ rect: r, removed: false }),
            after: (r) => ({ rect: { ...r, y: r.y + 16, bottom: r.bottom + 16 }, removed: false }),
            from: { x: 92, y: 72 }, to: { x: 116, y: 114 } },
    ];
    for (const c of cases) {
        it(c.what, () => {
            const world = buildLevelWorld(SOURCE(c.level), { roles: ROLES });
            const spawn = world.solids.find((s) => (s.crusherId ?? s.pushableId) === c.id).rect;
            const live = new Map([[c.id, c.before(spawn)]]);
            const opts = { [c.family]: live, lattice: c.lattice };
            const args = [world, c.from, c.to, opts];
            const offBefore = planAs(false, ...args);
            const onBefore = planAs(true, ...args);
            live.set(c.id, c.after(spawn));
            const onAfter = planAs(true, ...args);
            const offAfter = planAs(false, ...args);
            // the move changes the answer (else the row could not see a stale memo), and neither side refuses
            expect(offAfter).not.toBe(offBefore);
            expect(offBefore.startsWith('THROW')).toBe(false);
            expect(offAfter.startsWith('THROW')).toBe(false);
            expect(onBefore).toBe(offBefore);
            expect(onAfter).toBe(offAfter);
            // and back: the step undone is the first answer again, ON and OFF
            live.set(c.id, c.before(spawn));
            expect(planAs(true, ...args)).toBe(offBefore);
            expect(planAs(false, ...args)).toBe(offBefore);
        });
    }
});

describe('SP — the X-first corner sample decides these plans, so the fast arm must still ask it', () => {
    /**
     * `controllerPathClear` tests `(p.x, prev.y)` as well as `(p.x, p.y)` on every sample (within a tick `moveX`
     * resolves before `moveY`). On the committed solves no answer turns on that corner (mutant m4 — the fast arm
     * dropping it — passed all of them), so these four do: found by sampling free points on the atlas (D2,
     * `tools/m4search.mjs`). Each plan's OFF bytes are pinned, and ON must equal them.
     */
    const cases = [
        { level: 1, lattice: 16, from: { x: 124, y: 55 }, to: { x: 55.5, y: 26.5 },
            off: [{ x: 120, y: 24 }, { x: 55.5, y: 26.5 }] },
        { level: 2, lattice: 8, from: { x: 45.5, y: 33.5 }, to: { x: 68.5, y: 24.5 },
            off: [{ x: 44, y: 36 }, { x: 68, y: 36 }, { x: 68.5, y: 24.5 }] },
        { level: 3, lattice: 8, from: { x: 73.5, y: 25.5 }, to: { x: 38.5, y: 42 },
            off: [{ x: 68, y: 36 }, { x: 38.5, y: 42 }] },
        { level: 3, lattice: 16, from: { x: 67.5, y: 31.5 }, to: { x: 50.5, y: 107.5 },
            off: [{ x: 72, y: 40 }, { x: 40, y: 40 }, { x: 40, y: 104 }, { x: 50.5, y: 107.5 }] },
    ];
    for (const c of cases) {
        it(`L${c.level} at lattice ${c.lattice}: (${c.from.x},${c.from.y}) → (${c.to.x},${c.to.y})`, () => {
            const world = buildLevelWorld(SOURCE(c.level), { roles: ROLES });
            const args = [world, c.from, c.to, { lattice: c.lattice }];
            expect(planAs(false, ...args)).toBe(JSON.stringify(c.off));
            expect(planAs(true, ...args)).toBe(JSON.stringify(c.off));
        });
    }
});

/** A fixture's staging, honest (`solveProgress.test.js`' shape). */
function stagingOf(name, residue = null) {
    const base = stagingFromTape(loadTape(name));
    let seam = base.seam;
    if (residue !== null) {
        const P = SPINNER.hammerPeriod;
        const was = ((base.seam.time % P) + P) % P;
        seam = { ...base.seam, time: base.seam.time + ((((residue - was) % P) + P) % P) - P };
    }
    return { ...base, seam, noclip: false, noDamage: false, equips: [],
        persistence: base.persistence.filter((c) => c.at === undefined) };
}

/** One solve under a deadline that never trips, hooked: its digest, `shouldStop`, final asks and whole stream. */
async function solveOf(s) {
    const staging = stagingOf(s.tape, s.residue ?? null);
    let shouldStops = 0;
    const stream = [];
    const finals = [];
    const hook = (site, peek) => {
        const snap = peek();
        stream.push([site, snap === null ? null : JSON.stringify(snap)]);
        if (site === 'done') finals.push(snap?.budget?.asks ?? null);
    };
    const go = () => twoPassSolve({ makeRun: (rows) => createRunForStaging({ ...staging, persistence: rows }, SOURCE),
        goals: s.goals, name: s.tape, boot: staging.boot, persistence: staging.persistence,
        gameTick: () => { throw new Error('no game oracle here'); } });
    let r;
    try {
        const value = await withSolveProgress(hook, () => withSolveDeadline(
            { shouldStop: () => { shouldStops += 1; return false; }, fineCheckpoints: true }, go));
        r = { ok: true, out: value.out };
    } catch (error) {
        r = { ok: false, error };
    }
    return { digest: answerDigest(r), ok: r.ok, shouldStops, finals: JSON.stringify(finals), stream };
}

describe('SP — committed solves: OFF and ON end to end, and every real pull audited', () => {
    const SOLVES = [
        { what: 'L40 kill rung (the lever\'s target)', tape: 'r5-l40-part5',
            goals: [{ kind: 'collect-placement', placement: { x: 160, y: 640 } }], digest: '3addc379', minCalls: 20 },
        { what: 'L18 hammer room (residue 21)', tape: 'r9-solve-18', residue: 21,
            goals: [{ kind: 'reach-exit', exit: { x: 176, y: 112 } }], digest: '230dc0ff', minCalls: 1 },
        { what: 'L6 ladder climb', tape: 'r8-solve-6', goals: [{ kind: 'reach-exit', exit: { x: 224, y: 32 } }],
            minCalls: 1 },
        { what: 'L3 plain walk', tape: 'r8-solve-3', goals: [{ kind: 'reach-exit', exit: { x: 128, y: 48 } }],
            minCalls: 1 },
    ];
    for (const s of SOLVES) {
        it(s.what, async () => {
            const off = await withStringPullFast(false, () => solveOf(s));
            const a = await audited(() => withStringPullFast(true, () => solveOf(s)));
            const on = a.out;
            expect(off.ok).toBe(true);
            if (s.digest) expect(off.digest.slice(0, 8)).toBe(s.digest);
            expect(on.digest).toBe(off.digest);
            expect(on.shouldStops).toBe(off.shouldStops);
            expect(on.finals).toBe(off.finals);
            expect(on.stream.length).toBe(off.stream.length);
            expect(on.stream).toEqual(off.stream);
            expect(a.mismatches).toEqual([]);
            expect(a.calls).toBeGreaterThanOrEqual(s.minCalls);
        }, 240_000);
    }

    it('the L42 crusher witness (a moving crusher, solved with the bait): OFF = ON, every pull audited', async () => {
        const W = CRUSHER_WITNESSES[0];
        const bytes = ({ solved }) => JSON.stringify({ perTick: solved.out.perTick.map((h) => [...h].sort()),
            trace: solved.out.trace, waypointsPlanned: solved.out.waypointsPlanned });
        const off = bytes(await withStringPullFast(false, () => crusherPlan(W, true)));
        const a = await audited(() => withStringPullFast(true, () => crusherPlan(W, true)));
        expect(bytes(a.out)).toBe(off);
        expect(a.mismatches).toEqual([]);
        expect(a.calls).toBeGreaterThan(0);
    }, 240_000);
});
