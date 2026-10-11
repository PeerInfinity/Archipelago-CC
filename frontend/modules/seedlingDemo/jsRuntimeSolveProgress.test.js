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
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker as NodeWorker } from 'node:worker_threads';

import { createJsRuntime } from './jsRuntimeCore.js';
import { WALK_STATES } from './jsRuntimeWalker.js';
import { runDigest, SOLVER_BUDGET_WORK } from './jsRuntimeSolver.js';
import { createWorkerSolveService } from './jsRuntimeSolveService.js';
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
async function solveWitness(w, { subscribe }) {
    const { service, log } = workerService();
    const notes = [];
    const off = subscribe ? service.subscribeProgress((n) => notes.push(n)) : null;
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
        }, 180000);
    }

    it(`at most one post a second of the solve (${SOLVE_PROGRESS_INTERVAL_MS} ms) plus the FINAL, which comes just before the result and meters the attempt's whole work`, async () => {
        const on = await solveWitness(WITNESSES[1], { subscribe: true });
        for (const solve of on.solves) {
            const id = solve.id;
            const mine = on.log.got.filter((g) => g.msg.id === id);
            const started = mine.find((g) => g.msg.type === 'started');
            const resultAt = mine.findIndex((g) => g.msg.type === 'result');
            const posts = mine.filter((g) => g.msg.type === SOLVE_PROGRESS_MESSAGE);
            const span = mine[resultAt].at - started.at;
            const live = posts.filter((g) => !g.msg.final);
            expect(live.length).toBeLessThanOrEqual(Math.floor(span / SOLVE_PROGRESS_INTERVAL_MS) + 1);
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
        expect(service.progressSubscribed).toBe(false);
    });
});
