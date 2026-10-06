/**
 * jsRuntimeSolveService — the solver mode's WORKER and BUDGET (solver-walk
 * S2; plan `seedling-js-solver-walk-plan.md` §3 S2).
 *
 * The worker rows run the REAL worker entry (`jsRuntimeSolveWorker.js`)
 * through node's `worker_threads` with a `self` shim — every request and
 * answer is structured-cloned exactly as a browser Worker would clone it.
 * Each witness is driven the way the page drives the runtime: `tick()` once
 * per page tick, and while a solve is in flight the tick is HELD (`{solving}`)
 * and the page simply ticks again later.
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *
 *   m1 the hold is dropped (the core steps the run while the worker thinks)
 *        -> '… worker round-trip ≡ the in-place solve …' reds (the plan is
 *           refuted as stale every time, or the tape differs)
 *   m2 the backstop is never checked
 *        -> 'the BACKSTOP …' reds (times out)
 *   d2 the backstop PLAYS the plan in hand instead of failing
 *        -> 'the BACKSTOP never plays the plan in hand …' reds
 *   m3 a stale answer is played (no run / session check at arrival)
 *        -> 'a re-boot while the worker thinks …' reds
 *   m4 no retry after a decline
 *        -> 'decline → retry → SOLVED on the L6 W=71 leg' reds
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker as NodeWorker } from 'node:worker_threads';

import { createJsRuntime } from './jsRuntimeCore.js';
import { createRuntimeWalker, WALK_STATES } from './jsRuntimeWalker.js';
import {
    ANYTIME_PASSES, createInPlaceSolveService, liveOf, runDigest, SOLVE_BACKSTOP_MS, SOLVER_RETRY_AFTER_TICKS, SOLVER_RETRY_MAX,
    SOLVER_UPGRADE_WINDOW_WORK,
} from './jsRuntimeSolver.js';
import { indexLevels } from './atlasSource.js';
import { createWorkerSolveService } from './jsRuntimeSolveService.js';
import { returnKey, returnSpawnTable } from '../flashPanel/seedlingReturnSpawns.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
const PLAYTHROUGH = readJson('frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json').preset_sidecars['1'];
const KIT = ['hasSword', 'hasShield', 'hasFire', 'hasWand', 'canSwim', 'hasSpear', 'hasFeather', 'hasTorch', 'hasDarkSuit'];
const RETURNS = returnSpawnTable(MAP);
const SETTLED = [WALK_STATES.DONE, WALK_STATES.FAILED];
const ENTRY = new URL('./jsRuntimeSolveWorker.js', import.meta.url).href;

/** A browser-Worker-shaped adapter over `worker_threads`, running the real entry. */
function nodeWorker() {
    const w = new NodeWorker(`
        const { parentPort } = require('node:worker_threads');
        globalThis.self = {
            postMessage: (m) => parentPort.postMessage(m),
            set onmessage(fn) { parentPort.on('message', (data) => fn({ data })); },
        };
        import(${JSON.stringify(ENTRY)});
    `, { eval: true });
    const adapter = {
        onmessage: null, onerror: null, terminated: false,
        postMessage: (m) => w.postMessage(m),
        terminate: () => { adapter.terminated = true; w.terminate(); },
    };
    w.on('message', (data) => adapter.onmessage?.({ data }));
    w.on('error', (err) => adapter.onerror?.({ message: err.message }));
    return adapter;
}

const services = [];
function workerService() {
    const workers = [];
    const service = createWorkerSolveService({ createWorker: () => { const w = nodeWorker(); workers.push(w); return w; } });
    services.push(service);
    return { service, workers };
}
afterEach(() => { while (services.length) services.pop().dispose(); });

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

/** As `jsRuntimeSolver.test.js`'s `midRoom`: a live runtime walked W ticks by the J2 walker. */
function midRoom({ region, fromId, toId, walkTicks, kit = false, solveService = null, solverBudgetWork, solverBackstopMs, solverUpgradeWindowWork }) {
    const pl = PLAYTHROUGH[region].playable_payload;
    const from = pl.exits.find((e) => e.exit_id === fromId);
    const spawn = RETURNS.get(returnKey(pl.level, ...from.exit_tiles[0])) ?? from.entrance_spawn;
    const to = pl.exits.find((e) => e.exit_id === toId);
    const rt = createJsRuntime({ solveService, solverBudgetWork, solverBackstopMs, solverUpgradeWindowWork });
    rt.setVanilla(MAP);
    if (kit) rt.queueItems(KIT.map((p) => ({ class: 'Main', property: p, value: true })));
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [pl.level, spawn.x, spawn.y] }]);
    rt.tick();
    expect(rt.playback.walkTo({ kind: 'exit', level: pl.level, tiles: to.exit_tiles })).toEqual({ ok: true });
    rt.playback.play();
    for (let t = 0; t < walkTicks; t += 1) rt.tick();
    return rt;
}

/**
 * The page's clock, compressed: tick; a HELD tick (a solve in flight) yields
 * to the event loop first, as the page's next animation frame would.
 */
async function settleAsync(rt, { maxSteps = 3000, maxHolds = 20000, each = () => {} } = {}) {
    const crossings = [];
    let steps = 0;
    let holds = 0;
    while (steps < maxSteps && holds < maxHolds && !SETTLED.includes(rt.playback.state)) {
        const run0 = rt.run;
        const t0 = run0?.ticksCompleted;
        const out = rt.tick();
        if (out.solving) {
            holds += 1;
            // ⛔ The hold: the run did not step (a re-boot on the hold's queue drain is a NEW run).
            if (rt.run === run0) expect(rt.run.ticksCompleted).toBe(t0);
            await sleep(2);
            continue;
        }
        if (out.crossing) crossings.push(out.crossing);
        each(steps, out);
        steps += 1;
    }
    return { steps, holds, crossings };
}

function settleSync(rt, maxSteps = 3000) {
    const crossings = [];
    for (let t = 0; t < maxSteps && !SETTLED.includes(rt.playback.state); t += 1) {
        const out = rt.tick();
        if (out.crossing) crossings.push(out.crossing);
    }
    return { crossings };
}

const WITNESSES = [
    { name: 'L6 bare (bait — ENEMIES), 150 walker ticks in', region: 'level_6', fromId: 'in_L5_48_112', toId: 'out_stairsup_224_32', walkTicks: 150, to: 7, verbs: ['bait'] },
    { name: 'L4 kit (hold + shove), 40 walker ticks in', region: 'level_4', fromId: 'in_L3_128_48', toId: 'out_stairsdown_64_16', walkTicks: 40, kit: true, to: 5, verbs: ['hold', 'shove'] },
    { name: 'L12 (the solver\'s walk), 120 walker ticks in', region: 'level_12__r0c19', fromId: 'out_teleporter_304_0', toId: 'out_teleporter_168_368', walkTicks: 120, to: 36, verbs: ['walk'] },
];

describe('jsRuntimeSolveService — the worker round-trip ≡ the in-place (S1) solve', () => {
    for (const w of WITNESSES) {
        it(`${w.name}: same keys, same end digest, the room HELD while the worker thinks`, async () => {
            const sync = midRoom(w);
            sync.playback.setSolverWalk(true);
            const syncOut = settleSync(sync);
            expect(sync.playback.state).toBe(WALK_STATES.DONE);

            const { service, workers } = workerService();
            // ⛔ Not a budget row: equivalence is asked with the work budget out of the way.
            const rt = midRoom({ ...w, solveService: service, solverBudgetWork: 1e9, solverUpgradeWindowWork: 0 });
            rt.playback.setSolverWalk(true);
            expect(workers.length).toBe(1); // warmed when the mode came on
            const before = rt.run.ticksCompleted;
            const reasons = new Set();
            rt.playback.onWalk(() => { if (rt.playback.reason) reasons.add(rt.playback.reason); });
            const out = await settleAsync(rt);
            const s = rt.playback.solverStats;
            expect(`${rt.playback.state} ${rt.playback.reason ?? ''}`).toBe(`${WALK_STATES.DONE} `);
            expect(out.holds).toBeGreaterThan(0);
            expect([...reasons].some((r) => /^solving… \(budget 1000000000 work units\)$/.test(r))).toBe(true);
            expect(s).toMatchObject({ solves: 1, refutations: 0, declines: 0, expiries: 0, stale: 0 });
            expect(s.lastSolve.where).toBe('worker');
            expect(s.lastSolve.verbs).toEqual(expect.arrayContaining(w.verbs));
            expect(s.played).toBe(s.lastSolve.keys);
            expect(out.crossings).toEqual(syncOut.crossings);
            expect(out.crossings).toEqual([expect.objectContaining({ to: w.to })]);
            // Same keys: the whole session tape, tick for tick; same end digest.
            expect(rt.session.perTick.map((h) => [...h].sort())).toEqual(sync.session.perTick.map((h) => [...h].sort()));
            expect(runDigest(rt.run)).toBe(runDigest(sync.run));
            expect(rt.run.ticksCompleted - before).toBe(s.lastSolve.keys);
            expect(sync.playback.solverStats.lastSolve.keys).toBe(s.lastSolve.keys);
            expect(rt.halted).toBeNull();
        }, 120000);
    }
});

describe('jsRuntimeSolveService — the budget, the retry, and no stale plan', () => {
    it('a solve that runs out of its WORK budget DECLINES BY NAME (the ⏱ clause) — the worker answered, nothing was terminated, and the walker takes the goal', async () => {
        // L4 kit: its shove is REQUIRED, so the block-route search consults the hook; a 1-unit budget trips it in
        // both passes (the full pass has no plan in hand), and the answer is a refusal by name.
        const { service, workers } = workerService();
        const rt = midRoom({ ...WITNESSES[1], solveService: service, solverBudgetWork: 1 });
        expect(rt.playback.solverBudgetWork).toBe(1);
        rt.playback.setSolverWalk(true);
        const t0 = Date.now();
        while (rt.playback.solverStats.declines === 0 && Date.now() - t0 < 60000) {
            rt.tick();
            await sleep(5);
        }
        const s = rt.playback.solverStats;
        expect(s).toMatchObject({ solves: 0, declines: 1, expiries: 1, played: 0, backstops: 0 });
        expect(s.lastDecline).toMatch(/⏱ DEADLINE/);
        // ⛓ RECALIBRATE — the WORKER asks the fine sites too: the first trip is the core `walk` site, and that
        // refusal is a NAMED DECLINE (no obstacle; not a divergence, not a failure) — the walker takes the goal.
        expect(s.lastDecline).toMatch(/was reached at the `walk` site/);
        expect(s.lastDeclineObstacle).toBeNull();
        expect(s.lastSolve ?? null).toBeNull();
        expect(rt.playback.reason).toMatch(/^the solver declined — .*⏱ DEADLINE.*; walking instead$/s);
        expect(workers[0].terminated).toBe(false);
        expect(service.stats).toMatchObject({ terminated: 0 });
        // The walker walks it now: its own planner runs, the run steps.
        const ticks = rt.run.ticksCompleted;
        for (let t = 0; t < 10; t += 1) rt.tick();
        expect(rt.run.ticksCompleted).toBe(ticks + 10);
        expect(rt.playback.stats.plans).toBeGreaterThan(0);
        expect(rt.playback.solving).toBe(false);
    }, 90000);

    it(`the BACKSTOP (default ${SOLVE_BACKSTOP_MS} ms): a solve past it is TERMINATED and the goal FAILS BY NAME — never walked, never played`, async () => {
        const { service, workers } = workerService();
        const rt = midRoom({ ...WITNESSES[2], walkTicks: 0, solveService: service, solverBudgetWork: 1e9, solverBackstopMs: 300 });
        expect(rt.playback.solverBackstopMs).toBe(300);
        rt.playback.setSolverWalk(true);
        const t0 = Date.now();
        while (rt.playback.state !== WALK_STATES.FAILED && Date.now() - t0 < 30000) {
            rt.tick();
            await sleep(5);
        }
        const s = rt.playback.solverStats;
        expect(rt.playback.state).toBe(WALK_STATES.FAILED);
        expect(s).toMatchObject({ solves: 0, declines: 0, played: 0, backstops: 1 });
        expect(rt.playback.reason).toMatch(/the solve exceeded the backstop on this machine \(0\.3 s\) on reach-exit in level 12 \(terminated; the solve's own budget is 1000000000 work units\)/);
        expect(workers[0].terminated).toBe(true);
    }, 60000);

    it('decline → retry → SOLVED on the L6 W=71 leg (each retry named)', async () => {
        const { service } = workerService();
        // ⛓ W=71, not §1.6's W=60: swim R4 (the i-frame preview carries facing +
        // recovery) made the solver SOLVE from W=60. Swept at R4 (W 0–240): W=71
        // is the danger-map decline this row needs. (W=70 declines on a solver
        // stack overflow — reported to the swim arc; not a witness.)
        const rt = midRoom({ ...WITNESSES[0], walkTicks: 71, solveService: service });
        rt.playback.setSolverWalk(true);
        const out = await settleAsync(rt);
        const s = rt.playback.solverStats;
        const w = rt.playback.stats;
        expect(rt.playback.state).toBe(WALK_STATES.DONE);
        expect(out.crossings).toEqual([expect.objectContaining({ from: 6, to: 7 })]);
        expect(s.declines).toBe(1);
        expect(s.solves).toBe(1);
        expect(s.lastDecline).toMatch(/reach-exit \(224,32\)->L7: the danger map forbids/);
        expect(w.retries).toBe(1);
        expect(w.retryLog).toEqual([expect.objectContaining({ n: 1, after: expect.stringMatching(/^(a death|a crossing|\d+ walked tick\(s\))$/) })]);
        expect(rt.events.filter((e) => e.type === 'walk').map((e) => e.message))
            .toEqual(expect.arrayContaining([expect.stringContaining('asking the solver again (retry 1/3, after ')]));
        expect(s.played).toBe(s.lastSolve.keys);
    }, 120000);

    it('a re-boot while the worker thinks: the answer is STALE — refuted, never played — and the goal re-solves', async () => {
        const { service } = workerService();
        const rt = midRoom({ ...WITNESSES[0], solveService: service });
        rt.playback.setSolverWalk(true);
        const firstRun = rt.run;
        rt.tick();
        expect(rt.playback.solving).toBe(true);
        // A host item flag lands mid-solve: the core re-boots the room on the next tick (the hold drains the queue).
        rt.queueItems([{ class: 'Main', property: 'hasFeather', value: true }]);
        const out = await settleAsync(rt);
        const s = rt.playback.solverStats;
        expect(rt.run).not.toBe(firstRun);
        expect(rt.playback.state).toBe(WALK_STATES.DONE);
        expect(out.crossings).toEqual([expect.objectContaining({ from: 6, to: 7 })]);
        expect(s).toMatchObject({ stale: 1, refutations: 1, solves: 1 });
        expect(s.lastRefutation).toBe('the run was re-booted while the solver thought (an item flag or a host teleport) '
            + '— its answer is stale');
        expect(rt.events.filter((e) => e.type === 'solver').map((e) => e.solver)).toEqual(['solving', 'refuted', 'solving', 'solved']);
        // Only the plan solved on the CURRENT run was played.
        expect(s.played).toBe(s.lastSolve.keys);
        expect(rt.run.ticksCompleted).toBe(s.lastSolve.keys + s.lastSolve.prefix);
    }, 120000);

    it('switching the mode off (or a new goal) mid-solve TERMINATES the worker; nothing of it is ever played', async () => {
        const { service, workers } = workerService();
        const rt = midRoom({ ...WITNESSES[2], walkTicks: 0, solveService: service });
        rt.playback.setSolverWalk(true);
        rt.tick();
        await sleep(50);
        rt.tick();
        expect(rt.playback.solving).toBe(true);
        rt.playback.setSolverWalk(false);
        expect(rt.playback.solving).toBe(false);
        expect(workers[0].terminated).toBe(true);
        const ticks = rt.run.ticksCompleted;
        for (let t = 0; t < 30; t += 1) rt.tick();
        expect(rt.run.ticksCompleted).toBe(ticks + 30);
        expect(rt.playback.solverStats).toMatchObject({ solves: 0, played: 0 });
        // A new goal mid-solve: the same.
        rt.playback.setSolverWalk(true);
        rt.tick();
        expect(rt.playback.solving).toBe(true);
        rt.playback.walkTo(rt.playback.goal);
        expect(rt.playback.solving).toBe(false);
        expect(workers.filter((w) => w.terminated).length).toBe(workers.length);
        await sleep(100);
        expect(rt.playback.solverStats).toMatchObject({ solves: 0, played: 0 });
    }, 60000);
});

describe('the decline-retry policy, unit (a scripted solver)', () => {
    // A real room (the vanilla first frame, level 0) — the walker plans over it; nothing steps it.
    const rt0 = createJsRuntime();
    rt0.setVanilla(MAP);
    const run = rt0.run;
    const GOAL = { kind: 'location', level: 0, tag: 3 };
    function scripted(answers) {
        const asked = [];
        return {
            asked, enabled: true, budgetWork: 400,
            keysFor() { asked.push(run.state.x); return answers.shift() ?? { declined: 'still no' }; },
            clear() {}, cancel() {},
        };
    }
    const walkerWith = (solver, opts) => createRuntimeWalker({ solver, apItemOf: () => null, isCollected: () => false,
        locationPointOf: () => ({ x: run.state.x + 64, y: run.state.y }) }, opts);

    it(`asks again after ${SOLVER_RETRY_AFTER_TICKS} walked ticks, at most ${SOLVER_RETRY_MAX} times, each retry named`, () => {
        const solver = scripted([]);
        const w = walkerWith(solver);
        w.setGoal(GOAL);
        w.play();
        for (let t = 0; t < SOLVER_RETRY_AFTER_TICKS * (SOLVER_RETRY_MAX + 2); t += 1) w.heldFor(run);
        expect(solver.asked.length).toBe(1 + SOLVER_RETRY_MAX);
        expect(w.stats.retryLog.map((r) => r.after)).toEqual(Array(SOLVER_RETRY_MAX).fill(`${SOLVER_RETRY_AFTER_TICKS} walked tick(s)`));
        expect(w.reason).toBe(`the solver declined — still no; walking instead (after ${SOLVER_RETRY_MAX} retries)`);
    });

    it('a death or a crossing triggers the retry at once', () => {
        const solver = scripted([]);
        const w = walkerWith(solver);
        w.setGoal(GOAL);
        w.play();
        w.heldFor(run);
        w.heldFor(run);
        w.observe({ death: 'enemy' });
        w.heldFor(run);
        w.observe({ crossing: { from: 2, to: 0 } });
        w.heldFor(run);
        expect(w.stats.retryLog.map((r) => r.after)).toEqual(['a death', 'a crossing']);
    });

    it('{solving} holds the tick: no keys, the give-up clock does not run, "solving…" in the status', () => {
        const solver = scripted([{ solving: true }, { solving: true }, { held: new Set(['right']) }]);
        const w = walkerWith(solver);
        w.setGoal(GOAL);
        w.play();
        expect(w.heldFor(run)).toBeNull();
        expect(w.solverHolding).toBe(true);
        expect(w.reason).toBe('solving… (budget 400 work units)');
        expect(w.describe()).toContain('solving…');
        expect(w.heldFor(run)).toBeNull();
        expect(w.stats.driven).toBe(0);
        expect([...w.heldFor(run)]).toEqual(['right']);
        expect(w.solverHolding).toBe(false);
        expect(w.reason).toBeNull();
        expect(w.stats.driven).toBe(1);
    });

    it('the in-place service is S1: settled at once', () => {
        expect(createInPlaceSolveService().kind).toBe('in-place');
    });
});

describe('⛓ ANYTIME — the worker posts each pass; the page plays the provisional plan at the budget', () => {
    const KIT_SRC = indexLevels(MAP);
    /** L11's chest from (32,16) with the kit (slice `seedling-js-l16-budget`'s census leg): dashless 180 t, full 160 t. */
    function l11ChestKit() {
        const rt = createJsRuntime();
        rt.setVanilla(MAP);
        rt.queueItems(KIT.map((p) => ({ class: 'Main', property: p, value: true })));
        rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [11, 32, 16] }]);
        rt.tick();
        const s = rt.session;
        return { staging: s.staging, perTick: s.perTick, live: liveOf(rt.run), name: 'anytime-worker-L11',
            solverGoal: { kind: 'collect-placement', placement: { x: 32, y: 48 } }, scratchPersistence: rt.run.scratchPersistence === true,
            source: { records: KIT_SRC } };
    }

    it('the REAL worker: the dashless plan lands first as the PROVISIONAL answer, then the full plan (fewer ticks) settles', async () => {
        const { service } = workerService();
        const h = service.start(l11ChestKit());
        let firstProvisional = null;
        const t0 = Date.now();
        while (!h.settled && Date.now() - t0 < 60000) {
            if (!firstProvisional && h.provisional) firstProvisional = { pass: h.provisional.pass, ticks: h.provisional.plan.solution.length, settled: h.settled };
            await sleep(2);
        }
        expect(firstProvisional).toEqual({ pass: 'dashless', ticks: 180, settled: false });
        expect(h.passes).toEqual([{ pass: 'dashless', ok: true, kind: null }, { pass: 'full', ok: true, kind: null }]);
        expect(h.result.ok).toBe(true);
        expect(h.result.plan.pass).toBe('full');
        expect(h.result.plan.solution.length).toBe(160);
        // structured-cloned across the boundary: still Sets and a Map
        expect(h.result.plan.solution[0]).toBeInstanceOf(Set);
        expect(h.provisional.plan.equipsAt).toBeInstanceOf(Map);
    }, 90000);

    /** A service whose solve never settles, with `provisional(request)` as the pass that already landed. */
    function stuckWith(provisional) {
        const inPlace = createInPlaceSolveService();
        const made = [];
        return {
            made, kind: 'stuck', warm() {}, dispose() {},
            start(request) {
                const p = provisional(request, inPlace);
                const h = { settled: false, started: true, result: null, provisional: p, answered: p ? 1 : 0, passes: [],
                    cancel() { h.settled = true; h.cancelled = true; } };
                made.push(h);
                return h;
            },
        };
    }

    /** A service that settles at once with `answer(request, inPlace)` (a worker's settled result). */
    function settledWith(answer) {
        const inPlace = createInPlaceSolveService();
        return { kind: 'scripted', warm() {}, dispose() {},
            start(request) { return { settled: true, started: true, result: answer(request, inPlace), provisional: null, answered: 0, passes: [], cancel() {} }; } };
    }

    it('a later pass CUT at the work budget: the page PLAYS the earlier pass\'s plan the worker answered — named `expired`, and it crosses (L6 bait)', async () => {
        const service = settledWith((request, inPlace) => {
            const r = inPlace.start({ ...request, levelSource: undefined, passes: [ANYTIME_PASSES[0]] }).result;
            const passes = [...r.passes, { pass: 'full', ok: false, kind: 'refusal', ticks: null, deadline: 'sword-dash', limit: 'budget' }];
            return { ...r, passes, plan: { ...r.plan, passes } };
        });
        const rt = midRoom({ ...WITNESSES[0], walkTicks: 150, solveService: service });
        rt.playback.setSolverWalk(true);
        const out = await settleAsync(rt);
        const s = rt.playback.solverStats;
        expect(rt.playback.state).toBe(WALK_STATES.DONE);
        expect(out.crossings).toEqual([expect.objectContaining({ from: 6, to: 7 })]);
        expect(s).toMatchObject({ solves: 1, declines: 0, expiries: 1, provisionalPlays: 1, backstops: 0 });
        expect(s.lastSolve).toMatchObject({ pass: 'dashless', expired: true });
        expect(rt.events.map((e) => e.message)).toEqual(expect.arrayContaining([
            expect.stringMatching(/solved reach-exit in level 6: .*; pass dashless, full stopped at its deadline \(sword-dash\), the later pass ran out of its work budget\)/),
        ]));
    }, 120000);

    it('the BACKSTOP never plays the plan in hand: a provisional dashless plan and a stuck later pass → the goal FAILS by name, 0 keys played', async () => {
        const inPlace = createInPlaceSolveService();
        const made = [];
        const service = { kind: 'stuck', warm() {}, dispose() {},
            start(request) {
                const p = inPlace.start({ ...request, levelSource: undefined, passes: [ANYTIME_PASSES[0]] }).result;
                const h = { settled: false, started: true, result: null, provisional: p, answered: 1, passes: [],
                    cancel() { h.settled = true; h.cancelled = true; } };
                made.push(h);
                return h;
            } };
        const rt = midRoom({ ...WITNESSES[0], walkTicks: 150, solveService: service, solverBackstopMs: 1 });
        rt.playback.setSolverWalk(true);
        for (let i = 0; i < 200 && rt.playback.state !== WALK_STATES.FAILED; i += 1) { rt.tick(); await sleep(2); }
        const s = rt.playback.solverStats;
        expect(rt.playback.state).toBe(WALK_STATES.FAILED);
        expect(rt.playback.reason).toMatch(/the solve exceeded the backstop on this machine/);
        expect(s).toMatchObject({ solves: 0, played: 0, provisionalPlays: 0, backstops: 1 });
        expect(made[0].cancelled).toBe(true);
    }, 120000);

    it('a refusal the worker answered is the decline said, by its first line', async () => {
        const declined = { ok: false, kind: 'refusal', pass: 'dashless', message: 'the danger map forbids it\nsecond line' };
        const rt = midRoom({ ...WITNESSES[0], walkTicks: 150, solveService: settledWith(() => declined) });
        rt.playback.setSolverWalk(true);
        for (let i = 0; i < 50 && rt.playback.solverStats.declines === 0; i += 1) { rt.tick(); await sleep(2); }
        expect(rt.playback.solverStats.lastDecline).toBe('the danger map forbids it');
    }, 120000);

    it('⛓ DETERMINISTIC BUDGET — the page sends its WORK budget and upgrade window with every solve (`?solverUpgradeWindowWork=` / the setting); 0 / null = the budget', async () => {
        const asked = [];
        const service = { kind: 'capture', warm() {}, dispose() {},
            start(request) { asked.push(request); return { settled: false, started: true, result: null, provisional: null, answered: 0, passes: [], cancel() {} }; } };
        const rt = midRoom({ ...WITNESSES[0], walkTicks: 150, solveService: service, solverBudgetWork: 300 });
        expect(rt.playback.solverUpgradeWindowWork).toBe(SOLVER_UPGRADE_WINDOW_WORK);
        rt.playback.setSolverUpgradeWindowWork(25);
        expect(rt.playback.solverUpgradeWindowWork).toBe(25);
        rt.playback.setSolverWalk(true);
        for (let i = 0; i < 5 && asked.length === 0; i += 1) rt.tick();
        expect(asked[0]).toMatchObject({ budgetWork: 300, upgradeWindowWork: 25 });
        expect(asked[0].budgetMs).toBeUndefined();
        rt.playback.setSolverUpgradeWindowWork(0);
        expect(rt.playback.solverUpgradeWindowWork).toBeNull();
        rt.playback.setSolverUpgradeWindowWork(null);
        expect(rt.playback.solverUpgradeWindowWork).toBeNull();
        expect(createJsRuntime({ solverUpgradeWindowWork: 75 }).playback.solverUpgradeWindowWork).toBe(75);
    }, 120000);

    it('⛓ SHOULD-STOP — a pass refusal CUT by its deadline is not "answered" (a held retry runs that pass again); a plain refusal is', () => {
        let w = null;
        const service = createWorkerSolveService({ createWorker: () => (w = { onmessage: null, onerror: null, postMessage() {}, terminate() {} }) });
        const post = (h, data) => w.onmessage({ data: { id: h.id, ...data } });
        const cut = { ok: false, kind: 'refusal', pass: 'dashless', message: '… ⏱ DEADLINE: …', deadline: { tripped: true, first: 'block-route', sites: { 'block-route': 1 } } };
        let h = service.start({ source: { records: null } });
        post(h, { type: 'started' });
        post(h, { type: 'pass', index: 0, pass: 'dashless', answer: cut, best: cut });
        expect(h.answered).toBe(0);
        expect(h.provisional).toBe(cut); // the best so far (what a backstop would NOT play)
        expect(h.passes).toEqual([{ pass: 'dashless', ok: false, kind: 'refusal', deadline: 'block-route' }]);
        post(h, { type: 'pass', index: 1, pass: 'full', answer: { ok: false, kind: 'refusal', pass: 'full', message: 'no' }, best: cut });
        expect(h.answered).toBe(0); // the cut pass still leads: nothing after it counts as answered
        // ⛓ RECALIBRATE — a `walk` trip (the core site: the segment REFUSES by name, no obstacle) is a cut too
        const walkCut = { ok: false, kind: 'refusal', pass: 'dashless', message: '… at the `walk` site … ⏱ DEADLINE: …', deadline: { tripped: true, first: 'walk', sites: { walk: 1 } } };
        h = service.start({ source: { records: null } });
        post(h, { type: 'pass', index: 0, pass: 'dashless', answer: walkCut, best: walkCut });
        expect(h.answered).toBe(0);
        expect(h.passes).toEqual([{ pass: 'dashless', ok: false, kind: 'refusal', deadline: 'walk' }]);
        h = service.start({ source: { records: null } });
        post(h, { type: 'pass', index: 0, pass: 'dashless', answer: { ok: false, kind: 'refusal', pass: 'dashless', message: 'no' }, best: null });
        expect(h.answered).toBe(1);
        expect(h.passes).toEqual([{ pass: 'dashless', ok: false, kind: 'refusal' }]);
        service.dispose();
    });
});
