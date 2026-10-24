/**
 * ⛓ SOLVE PROGRESS (JS half) — the worker → page transport of the solver's progress stream, on REAL solves through
 * the real worker entry (`jsRuntimeSolveWorker.js`, node `worker_threads` with a `self` shim, every message
 * structured-cloned as a browser Worker would), driven the way the page drives the runtime.
 *
 * The four invariants of the slice brief, each pinned:
 *   1 OBSERVATION ONLY — with and without a subscriber, the solve REQUEST is byte-identical (the progress flag rides
 *     on the envelope) and so is the plan (the session's keys, the end digest).
 *   2 OFF UNLESS SUBSCRIBED — with no subscriber the worker posts no `solve-progress` at all.
 *   3 STALE DROP — a progress message for any solve but the one in flight never reaches a listener.
 *   4 BOUNDED COST — at most one post a second of the solve, plus the final; and the measured overhead.
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *   p1 the hook always installed (the worker ignores the envelope's flag)
 *        -> 'with NO subscriber the worker posts no solve-progress …' reds
 *   p2 the throttle removed
 *        -> '… at most one post a second …' reds
 *   p3 the stale drop removed (the service delivers any id)
 *        -> 'a progress message of a cancelled / superseded / answered solve never reaches a listener' reds
 *   p4 the snapshot (or the flag) stamped into the request
 *        -> '… the REQUEST is byte-identical …' reds
 *   p5 ⛓ S1: the rate stamped into the REQUEST (not the envelope)
 *        -> '… at 100 ms and at 1000 ms: the REQUEST, the plan, the digest and the shouldStop total are identical' reds
 *   w1 ⛓ S1: the worker ignores the envelope's rate (the tap's default always; measured 10 live posts at 100 ms vs
 *        2 at 1000 ms on the L4 solve)
 *        -> '… at 100 ms and at 1000 ms …' reds (the 1000 ms run's posts exceed its span / 1000 + 1)
 *   p6 ⛓ S1: the service sends the SLOWEST listener's rate (or the first's), not the fastest
 *        -> 'the envelope carries the FASTEST rate any listener asked …' reds
 *   ⛓ S3 (Tier B stamps):
 *   p7 the service's attempt put into the REQUEST (not the envelope)
 *        -> '… the REQUEST is byte-identical with and without a subscriber …' and the retry rows red
 *   p8 a re-ask at the SAME budget recognised as a held retry
 *        -> 'the service RECOGNISES a held retry …' reds
 *   w2 the worker drops the envelope's attempt (no `request.attempt` on the first post)
 *        -> '… the Tier B stamps ride the posts …' reds
 *
 * ⛓ S1 (⚖ the user 2026-10-17) — the rate is a setting (`flashPanel.seedlingSolveProgressIntervalMs`), carried on
 * the ENVELOPE as `progressIntervalMs`. A defaults A/B is not needed: the request is byte-identical at every rate and
 * with no subscriber at all (pinned here), so the plan cannot move.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker as NodeWorker } from 'node:worker_threads';

import { createJsRuntime } from './jsRuntimeCore.js';
import { WALK_STATES } from './jsRuntimeWalker.js';
import { runDigest, SOLVER_BUDGET_WORK } from './jsRuntimeSolver.js';
import { createWorkerSolveService, explicitAttempt } from './jsRuntimeSolveService.js';
import { SOLVE_PROGRESS_INTERVAL_MS, SOLVE_PROGRESS_MESSAGE } from './solveProgressTap.js';
import { returnKey, returnSpawnTable } from '../flashPanel/seedlingReturnSpawns.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
const PLAYTHROUGH = readJson('frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json').preset_sidecars['1'];
const KIT = ['hasSword', 'hasShield', 'hasFire', 'hasWand', 'canSwim', 'hasSpear', 'hasFeather', 'hasTorch', 'hasDarkSuit'];
const RETURNS = returnSpawnTable(MAP);
const SETTLED = [WALK_STATES.DONE, WALK_STATES.FAILED];
const ENTRY = new URL('./jsRuntimeSolveWorker.js', import.meta.url).href;

/** A browser-Worker-shaped adapter over `worker_threads`, running the real entry — and RECORDING both directions. */
function nodeWorker(log) {
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
        postMessage: (m) => { log.sent.push(structuredClone(m)); w.postMessage(m); },
        terminate: () => { adapter.terminated = true; w.terminate(); },
    };
    w.on('message', (data) => { log.got.push({ at: Date.now(), msg: data }); adapter.onmessage?.({ data }); });
    w.on('error', (err) => adapter.onerror?.({ message: err.message }));
    return adapter;
}

const services = [];
function workerService() {
    const log = { sent: [], got: [] };
    const service = createWorkerSolveService({ createWorker: () => nodeWorker(log) });
    services.push(service);
    return { service, log };
}
afterEach(() => { while (services.length) services.pop().dispose(); });

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

function midRoom({ region, fromId, toId, walkTicks, kit = false, solveService }) {
    const pl = PLAYTHROUGH[region].playable_payload;
    const from = pl.exits.find((e) => e.exit_id === fromId);
    const spawn = RETURNS.get(returnKey(pl.level, ...from.exit_tiles[0])) ?? from.entrance_spawn;
    const to = pl.exits.find((e) => e.exit_id === toId);
    const rt = createJsRuntime({ solveService });
    rt.setVanilla(MAP);
    if (kit) rt.queueItems(KIT.map((p) => ({ class: 'Main', property: p, value: true })));
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [pl.level, spawn.x, spawn.y] }]);
    rt.tick();
    expect(rt.playback.walkTo({ kind: 'exit', level: pl.level, tiles: to.exit_tiles })).toEqual({ ok: true });
    rt.playback.play();
    for (let t = 0; t < walkTicks; t += 1) rt.tick();
    return rt;
}

async function settleAsync(rt, maxSteps = 3000) {
    let steps = 0;
    let holds = 0;
    while (steps < maxSteps && holds < 40000 && !SETTLED.includes(rt.playback.state)) {
        const out = rt.tick();
        if (out.solving) { holds += 1; await sleep(2); continue; }
        steps += 1;
    }
}

const WITNESSES = [
    { name: 'L6 bare (bait — ENEMIES), 150 walker ticks in', region: 'level_6', fromId: 'in_L5_48_112', toId: 'out_stairsup_224_32', walkTicks: 150 },
    { name: 'L4 kit (hold + shove), 40 walker ticks in', region: 'level_4', fromId: 'in_L3_128_48', toId: 'out_stairsdown_64_16', walkTicks: 40, kit: true },
];

/** One witness solved through the worker, with or without a progress subscriber. */
async function solveWitness(w, { subscribe, intervalMs }) {
    const { service, log } = workerService();
    const notes = [];
    const off = subscribe ? service.subscribeProgress((n) => notes.push(n), { intervalMs }) : null;
    const rt = midRoom({ ...w, solveService: service });
    rt.playback.setSolverWalk(true);
    const t0 = Date.now();
    await settleAsync(rt);
    const ms = Date.now() - t0;
    off?.();
    expect(`${rt.playback.state} ${rt.playback.reason ?? ''}`).toBe(`${WALK_STATES.DONE} `);
    const solves = log.sent.filter((m) => m.type === 'solve');
    const results = log.got.filter((g) => g.msg.type === 'result');
    const progress = log.got.filter((g) => g.msg.type === SOLVE_PROGRESS_MESSAGE);
    return { rt, log, notes, solves, results, progress, ms, service };
}

/** A plan minus its wall-clock fields (`ms`, `replayMs`, `solveMs`): what must be identical on every machine. */
const planOf = (result) => JSON.stringify(result.msg.plan, (k, v) => (/^ms$|Ms$/.test(k) ? undefined : v));

describe('solve progress — observation only, off unless subscribed', () => {
    for (const w of WITNESSES) {
        it(`${w.name}: the REQUEST is byte-identical with and without a subscriber, and so is the plan; with NO subscriber the worker posts no solve-progress`, async () => {
            const off = await solveWitness(w, { subscribe: false });
            const on = await solveWitness(w, { subscribe: true });
            expect(off.solves.length).toBeGreaterThan(0);
            expect(on.solves.length).toBe(off.solves.length);
            for (let i = 0; i < off.solves.length; i += 1) {
                // ⛔ invariant 1: the request itself is today's — the flag rides on the ENVELOPE
                expect(JSON.stringify(on.solves[i].request)).toBe(JSON.stringify(off.solves[i].request));
                expect(off.solves[i]).not.toHaveProperty('progress');
                expect(on.solves[i].progress).toBe(true);
                expect(JSON.stringify(on.solves[i].request)).not.toMatch(/"progress"|"seq"|"snapshot"/);
            }
            expect(on.results.map(planOf)).toEqual(off.results.map(planOf));
            expect(on.rt.session.perTick.map((h) => [...h].sort())).toEqual(off.rt.session.perTick.map((h) => [...h].sort()));
            expect(runDigest(on.rt.run)).toBe(runDigest(off.rt.run));
            // ⛔ invariant 2: no subscriber, no hook, no message
            expect(off.progress).toEqual([]);
            expect(off.service.stats).toMatchObject({ progress: 0, progressDropped: 0 });
            expect(on.progress.length).toBeGreaterThan(0);
            expect(on.notes.length).toBe(on.progress.length);
            // ⛓ S3 — with and without the Tier B stamps: each attempt's shouldStop total is identical too
            expect(on.results.map((g) => g.msg.work)).toEqual(off.results.map((g) => g.msg.work));
            for (let i = 0; i < on.solves.length; i += 1) {
                expect(JSON.stringify(on.solves[i].request)).not.toMatch(/progressAttempt|wallBySite|"attempt"/);
                expect(on.solves[i].progressAttempt).toEqual({ retry: 0, budgets: [SOLVER_BUDGET_WORK] });
            }
            // ⛓ S3 — the stamps ride the posts: the request identity on each solve's FIRST post only, read from its
            // request; the wall by site sums to (at most) the solve's span; the plan in hand on the final
            for (const solve of on.solves) {
                const posts = on.log.got.filter((g) => g.msg.id === solve.id && g.msg.type === SOLVE_PROGRESS_MESSAGE).map((g) => g.msg);
                expect(posts[0].snapshot.request).toMatchObject({ name: solve.request.name, level: solve.request.staging.boot.level,
                    budgetWork: SOLVER_BUDGET_WORK, switches: {}, attempt: { retry: 0, budgets: [SOLVER_BUDGET_WORK], label: `${SOLVER_BUDGET_WORK}` } });
                expect(posts[0].snapshot.request.seamTime).toBe(solve.request.staging.seam?.time ?? null);
                expect(posts.slice(1).every((m) => m.snapshot.request === undefined)).toBe(true);
                const fin = posts.at(-1).snapshot;
                const wall = Object.values(fin.budget.wallBySite).reduce((a, b) => a + b, 0);
                expect(Object.keys(fin.budget.wallBySite).some((k) => k.endsWith('→end'))).toBe(true);
                expect(wall).toBeGreaterThanOrEqual(0);
                const mine = on.log.got.filter((g) => g.msg.id === solve.id);
                const span = mine.find((g) => g.msg.type === 'result').at - mine.find((g) => g.msg.type === 'started').at;
                expect(wall).toBeLessThanOrEqual(span + 50);
                const result = mine.find((g) => g.msg.type === 'result').msg;
                expect(fin.best).toMatchObject({ ok: result.ok === true, ...(result.ok ? { ticks: result.plan.solution.length } : {}) });
                expect(fin.budget.rate.unitsPerSec).toBeGreaterThanOrEqual(0);
            }
        }, 180000);
    }

    it(`${WITNESSES[1].name}: at 100 ms and at 1000 ms: the REQUEST, the plan, the digest and the shouldStop total are identical; only the envelope's rate differs`, async () => {
        const fast = await solveWitness(WITNESSES[1], { subscribe: true, intervalMs: 100 });
        const slow = await solveWitness(WITNESSES[1], { subscribe: true, intervalMs: 1000 });
        expect(fast.solves.length).toBeGreaterThan(0);
        expect(slow.solves.length).toBe(fast.solves.length);
        for (let i = 0; i < fast.solves.length; i += 1) {
            expect(JSON.stringify(fast.solves[i].request)).toBe(JSON.stringify(slow.solves[i].request));
            expect(JSON.stringify(fast.solves[i].request)).not.toMatch(/progress|Interval/);
            expect([fast.solves[i].progress, fast.solves[i].progressIntervalMs]).toEqual([true, 100]);
            expect([slow.solves[i].progress, slow.solves[i].progressIntervalMs]).toEqual([true, 1000]);
        }
        expect(fast.results.map(planOf)).toEqual(slow.results.map(planOf));
        // the shouldStop total: each attempt's work units (the meter's `spent`, `passShouldStop`'s count)
        expect(fast.results.map((g) => g.msg.work)).toEqual(slow.results.map((g) => g.msg.work));
        expect(fast.results.every((g) => Number.isFinite(g.msg.work))).toBe(true);
        expect(runDigest(fast.rt.run)).toBe(runDigest(slow.rt.run));
        expect(fast.rt.session.perTick.map((h) => [...h].sort())).toEqual(slow.rt.session.perTick.map((h) => [...h].sort()));
        // and the worker THROTTLED at the envelope's rate: each solve's live posts ≤ its span / interval + 1
        for (const run of [fast, slow]) {
            for (const solve of run.solves) {
                const mine = run.log.got.filter((g) => g.msg.id === solve.id);
                const span = mine.find((g) => g.msg.type === 'result').at - mine.find((g) => g.msg.type === 'started').at;
                const live = mine.filter((g) => g.msg.type === SOLVE_PROGRESS_MESSAGE && !g.msg.final);
                expect(live.length).toBeLessThanOrEqual(Math.floor(span / solve.progressIntervalMs) + 1);
            }
        }
    }, 180000);

    it(`at most one post per the envelope's interval (default ${SOLVE_PROGRESS_INTERVAL_MS} ms) plus the FINAL, which comes just before the result and meters the attempt's whole work`, async () => {
        const on = await solveWitness(WITNESSES[1], { subscribe: true });
        for (const solve of on.solves) {
            const id = solve.id;
            const mine = on.log.got.filter((g) => g.msg.id === id);
            const started = mine.find((g) => g.msg.type === 'started');
            const resultAt = mine.findIndex((g) => g.msg.type === 'result');
            const posts = mine.filter((g) => g.msg.type === SOLVE_PROGRESS_MESSAGE);
            const span = mine[resultAt].at - started.at;
            const live = posts.filter((g) => !g.msg.final);
            expect(solve.progressIntervalMs).toBe(SOLVE_PROGRESS_INTERVAL_MS);
            expect(live.length).toBeLessThanOrEqual(Math.floor(span / solve.progressIntervalMs) + 1);
            expect(posts.filter((g) => g.msg.final)).toHaveLength(1);
            expect(mine[resultAt - 1].msg).toMatchObject({ type: SOLVE_PROGRESS_MESSAGE, final: true });
            const fin = mine[resultAt - 1].msg.snapshot;
            expect(fin.segment.outcome).not.toBe('running');
            // the meter: the attempt's units (Σ segments) = the work clock solveAnytime reports, against the budget
            expect(fin.budget.spent.shouldStop).toBe(mine[resultAt].msg.work);
            expect(fin.budget.limit.shouldStop).toBe(SOLVER_BUDGET_WORK);
            // seq strictly rises along the posts
            const seqs = posts.map((g) => g.msg.snapshot.seq);
            for (let i = 1; i < seqs.length; i += 1) expect(seqs[i]).toBeGreaterThanOrEqual(seqs[i - 1]);
        }
    }, 120000);
});

describe('solve progress — the stale drop (scripted worker)', () => {
    function scripted() {
        const workers = [];
        const service = createWorkerSolveService({ createWorker: () => {
            const w = { onmessage: null, onerror: null, sent: [], postMessage: (m) => w.sent.push(m), terminate: () => { w.dead = true; },
                emit: (data) => w.onmessage?.({ data }) };
            workers.push(w);
            return w;
        } });
        services.push(service);
        return { service, workers };
    }
    const snap = (seq) => ({ v: 1, seq, segment: { index: 0 }, budget: { work: {} } });

    it('a progress message of a cancelled / superseded / answered solve never reaches a listener', () => {
        const { service, workers } = scripted();
        const heard = [];
        service.subscribeProgress((n) => heard.push(n));
        const first = service.start({ source: { records: {} } });
        expect(workers[0].sent[0].progress).toBe(true);
        workers[0].emit({ type: SOLVE_PROGRESS_MESSAGE, id: first.id, snapshot: snap(1), final: false });
        expect(heard.map((n) => n.solveId)).toEqual([first.id]);
        // superseded: the second start cancels the first (its worker terminated, a new one built)
        const second = service.start({ source: { records: {} } });
        expect(workers).toHaveLength(2);
        workers[0].emit({ type: SOLVE_PROGRESS_MESSAGE, id: first.id, snapshot: snap(2), final: false });
        workers[1].emit({ type: SOLVE_PROGRESS_MESSAGE, id: first.id, snapshot: snap(3), final: false });
        expect(heard).toHaveLength(1);
        workers[1].emit({ type: SOLVE_PROGRESS_MESSAGE, id: second.id, snapshot: snap(1), final: true });
        expect(heard.map((n) => [n.solveId, n.final])).toEqual([[first.id, false], [second.id, true]]);
        // answered: after the result, the same id is stale
        workers[1].emit({ type: 'result', id: second.id, ok: false, kind: 'refusal', message: 'x' });
        workers[1].emit({ type: SOLVE_PROGRESS_MESSAGE, id: second.id, snapshot: snap(2), final: true });
        expect(heard).toHaveLength(2);
        expect(service.stats.progressDropped).toBe(2);
    });

    it('the envelope carries the FASTEST rate any listener asked, clamped to the list, read at each start (a function is re-read)', () => {
        const { service, workers } = scripted();
        let asked = 1000;
        const offA = service.subscribeProgress(() => {}, { intervalMs: () => asked });
        service.start({ source: { records: {} } });
        expect(workers.at(-1).sent.at(-1)).toMatchObject({ progress: true, progressIntervalMs: 1000 });
        const offB = service.subscribeProgress(() => {}, { intervalMs: 250 });
        service.start({ source: { records: {} } });
        expect(workers.at(-1).sent.at(-1).progressIntervalMs).toBe(250);
        asked = 60;   // between 100 and 50: clamped to the slower, 100
        service.start({ source: { records: {} } });
        expect(workers.at(-1).sent.at(-1).progressIntervalMs).toBe(100);
        offA();
        offB();
        service.subscribeProgress(() => {});   // no rate asked: the default
        service.start({ source: { records: {} } });
        expect(workers.at(-1).sent.at(-1).progressIntervalMs).toBe(SOLVE_PROGRESS_INTERVAL_MS);
        for (const w of workers) for (const m of w.sent) expect(Object.keys(m.request)).not.toContain('progressIntervalMs');
    });

    it('⛓ S3 — the service RECOGNISES a held retry (the same staging and goal, the same ticks, a LARGER budget) and labels it on the ENVELOPE only', () => {
        const { service, workers } = scripted();
        service.subscribeProgress(() => {});
        const staging = { boot: { level: 16 } };
        const solverGoal = { kind: 'exit' };
        const perTick = [[], []];
        const first = { staging, solverGoal, perTick, budgetWork: 640, source: { records: {} } };
        service.start(first);
        expect(workers.at(-1).sent.at(-1).progressAttempt).toEqual({ retry: 0, budgets: [640] });
        // the held retry: the request asked before, spread, at 4× the budget
        service.start({ ...first, passes: [{ pass: 'full' }], budgetWork: 2560 });
        expect(workers.at(-1).sent.at(-1).progressAttempt).toEqual({ retry: 1, budgets: [640, 2560] });
        // the same budget again is a new solve, not a retry; so is another staging, another goal, or a ticked session
        service.start({ ...first, budgetWork: 2560 });
        expect(workers.at(-1).sent.at(-1).progressAttempt).toEqual({ retry: 0, budgets: [2560] });
        service.start({ ...first, staging: { ...staging }, budgetWork: 10240 });
        expect(workers.at(-1).sent.at(-1).progressAttempt.retry).toBe(0);
        service.start({ ...first, staging, budgetWork: 640 });
        service.start({ ...first, solverGoal: { kind: 'exit' }, budgetWork: 2560 });
        expect(workers.at(-1).sent.at(-1).progressAttempt.retry).toBe(0);
        service.start({ ...first, budgetWork: 640 });
        service.start({ ...first, perTick: [[], [], []], budgetWork: 2560 });
        expect(workers.at(-1).sent.at(-1).progressAttempt.retry).toBe(0);
        for (const w of workers) for (const m of w.sent) expect(Object.keys(m.request)).not.toContain('progressAttempt');
    });

    it('⛓ S3 — no subscriber: no attempt on the envelope (today\'s message exactly), but a retry is still recognised for the next one', () => {
        const { service, workers } = scripted();
        const staging = {};
        const first = { staging, budgetWork: 640, source: { records: {} } };
        service.start(first);
        expect(workers.at(-1).sent.at(-1)).not.toHaveProperty('progressAttempt');
        const off = service.subscribeProgress(() => {});
        service.start({ ...first, budgetWork: 2560 });
        expect(workers.at(-1).sent.at(-1).progressAttempt).toEqual({ retry: 1, budgets: [640, 2560] });
        off();
    });

    it('⛓ RETRY ATTEMPT — an EXPLICIT attempt WINS over the recognition, both ways (a told retry 0 on a recognisable retry, a told retry 3 on a fresh start)', () => {
        const { service, workers } = scripted();
        service.subscribeProgress(() => {});
        const staging = {};
        const first = { staging, budgetWork: 640, source: { records: {} } };
        service.start(first);
        service.start({ ...first, budgetWork: 2560 }, { attempt: { retry: 0, budgets: [2560] } });
        expect(workers.at(-1).sent.at(-1).progressAttempt).toEqual({ retry: 0, budgets: [2560] });
        service.start({ staging: {}, budgetWork: 10240, source: { records: {} } }, { attempt: { retry: 3, budgets: [10, 40, 160, 640] } });
        expect(workers.at(-1).sent.at(-1).progressAttempt).toEqual({ retry: 3, budgets: [10, 40, 160, 640] });
    });

    it('⛓ RETRY ATTEMPT — a REBUILT retry (new objects, the same values) at a larger budget reads its TRUE retry when told (recognition calls it retry 0)', () => {
        const { service, workers } = scripted();
        service.subscribeProgress(() => {});
        const build = (budgetWork) => ({ staging: { boot: { level: 16 } }, solverGoal: { kind: 'exit' }, perTick: [[], []],
            budgetWork, source: { records: {} } });
        service.start(build(640), { attempt: { retry: 0, budgets: [640] } });
        service.start(build(2560), { attempt: { retry: 1, budgets: [640, 2560] } });
        expect(workers.at(-1).sent.at(-1).progressAttempt).toEqual({ retry: 1, budgets: [640, 2560] });
        // the same rebuilt pair, NOT told: the recognition's answer (the case it gets wrong)
        service.start(build(640));
        service.start(build(2560));
        expect(workers.at(-1).sent.at(-1).progressAttempt).toEqual({ retry: 0, budgets: [2560] });
    });

    it('⛓ RETRY ATTEMPT — metadata only: the posted REQUEST is byte-identical told or not, and a told attempt is a COPY (the caller\'s array mutated later moves nothing)', () => {
        const run = (attempt) => {
            const { service, workers } = scripted();
            service.subscribeProgress(() => {});
            const budgets = [640];
            service.start({ staging: { boot: { level: 6 } }, budgetWork: 640, passes: [{ pass: 'full' }], source: { records: {} } },
                attempt ? { attempt: { retry: 0, budgets } } : undefined);
            budgets.push(99);
            return workers.at(-1).sent.at(-1);
        };
        const told = run(true);
        const untold = run(false);
        expect(JSON.stringify(told.request)).toBe(JSON.stringify(untold.request));
        expect(told.progressAttempt).toEqual({ retry: 0, budgets: [640] });
        expect(Object.keys(told.request)).not.toContain('attempt');
    });

    it('⛓ RETRY ATTEMPT — no listener: a told attempt is NOT on the envelope (today\'s message exactly), and the recognition CHAINS from what was told', () => {
        const { service, workers } = scripted();
        const staging = {};
        const first = { staging, budgetWork: 2560, source: { records: {} } };
        service.start(first, { attempt: { retry: 1, budgets: [640, 2560] } });
        expect(workers.at(-1).sent.at(-1)).not.toHaveProperty('progressAttempt');
        expect(Object.keys(workers.at(-1).sent.at(-1)).sort()).toEqual(['id', 'request', 'type']);
        service.subscribeProgress(() => {});
        service.start({ ...first, budgetWork: 10240 });
        expect(workers.at(-1).sent.at(-1).progressAttempt).toEqual({ retry: 2, budgets: [640, 2560, 10240] });
    });

    it('⛓ RETRY ATTEMPT — what is not an attempt (a negative or fractional retry, a non-object) falls back to the recognition; non-finite budgets are dropped', () => {
        expect(explicitAttempt(undefined)).toBeNull();
        expect(explicitAttempt(3)).toBeNull();
        expect(explicitAttempt({ retry: -1, budgets: [1] })).toBeNull();
        expect(explicitAttempt({ retry: 1.5, budgets: [1] })).toBeNull();
        expect(explicitAttempt({ retry: 2, budgets: [640, NaN, '2560', 2560] })).toEqual({ retry: 2, budgets: [640, 2560] });
        expect(explicitAttempt({ retry: 0 })).toEqual({ retry: 0, budgets: [] });
        const { service, workers } = scripted();
        service.subscribeProgress(() => {});
        const first = { staging: {}, budgetWork: 640, source: { records: {} } };
        service.start(first);
        service.start({ ...first, budgetWork: 2560 }, { attempt: { retry: -1, budgets: [] } });
        expect(workers.at(-1).sent.at(-1).progressAttempt).toEqual({ retry: 1, budgets: [640, 2560] });
    });

    it('unsubscribed: the next solve does not ask (no flag on its envelope), and a late note is dropped', () => {
        const { service, workers } = scripted();
        const heard = [];
        const off = service.subscribeProgress((n) => heard.push(n));
        const h = service.start({ source: { records: {} } });
        off();
        workers[0].emit({ type: SOLVE_PROGRESS_MESSAGE, id: h.id, snapshot: snap(1), final: false });
        expect(heard).toEqual([]);
        workers[0].emit({ type: 'result', id: h.id, ok: false, kind: 'refusal', message: 'x' });
        service.start({ source: { records: {} } });
        expect(workers[0].sent.at(-1)).not.toHaveProperty('progress');
        expect(workers[0].sent.at(-1)).not.toHaveProperty('progressIntervalMs');
        expect(service.progressSubscribed).toBe(false);
    });
});
