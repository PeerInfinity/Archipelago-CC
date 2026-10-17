/**
 * ⛓ AUTO-SHOW (slice `solve-progress-auto`, ⚖ the user 2026-10-15) — the view's three modes on a REAL L6 solve
 * through the real worker entry (`jsRuntimeSolveWorker.js`, node `worker_threads`), with the panel's real
 * `SolveProgressView` (over a stub DOM) as the subscriber.
 *
 * The default became `auto`, so every panel solve now asks for the progress stream. Pinned here (js-6's gate):
 *   - the solve REQUEST is byte-identical with the view `off`, `auto` and `always` (the ask rides the ENVELOPE),
 *     and so are the plan, the keys played and the end digest;
 *   - `off` asks nothing; `auto` and `always` ask; `auto` shows the view on the first note and hides it on the
 *     final one, `always` keeps it shown.
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *   a1 the progress flag leaks into the request (`msg.request.progress = true` in `jsRuntimeSolveService.js`)
 *        -> 'off / auto / always: the REQUEST …' reds
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker as NodeWorker } from 'node:worker_threads';

import { createJsRuntime } from '../seedlingDemo/jsRuntimeCore.js';
import { WALK_STATES } from '../seedlingDemo/jsRuntimeWalker.js';
import { runDigest } from '../seedlingDemo/jsRuntimeSolver.js';
import { createWorkerSolveService } from '../seedlingDemo/jsRuntimeSolveService.js';
import { SolveProgressView } from './seedlingSolveProgressView.js';
import { SOLVE_DEMOS, solveDemoStage } from './seedlingSolveDemo.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const ENTRY = new URL('../seedlingDemo/jsRuntimeSolveWorker.js', import.meta.url).href;
const SETTLED = [WALK_STATES.DONE, WALK_STATES.FAILED];

/** A browser-Worker-shaped adapter over `worker_threads`, running the real entry and recording what it is sent. */
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
        onmessage: null, onerror: null,
        postMessage: (m) => { log.sent.push(structuredClone(m)); w.postMessage(m); },
        terminate: () => { w.terminate(); },
    };
    w.on('message', (data) => { log.got.push(data); adapter.onmessage?.({ data }); });
    w.on('error', (err) => adapter.onerror?.({ message: err.message }));
    return adapter;
}

/** The least DOM the view draws into (vitest runs in node). */
function stubDocument() {
    const node = (tag) => {
        const n = { tagName: tag, style: {}, dataset: {}, children: [], textContent: '', className: '', title: '',
            width: 0, height: 0,
            append(...c) { n.children.push(...c); }, remove() {}, addEventListener() {}, querySelectorAll: () => [] };
        return n;
    };
    return { createElement: node, createDocumentFragment: () => node('#fragment'), createTextNode: (data) => ({ data }) };
}

const cleanups = [];
afterEach(() => { while (cleanups.length) cleanups.pop()(); });
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

/** The L6 demo the panel stages (`SOLVE_DEMOS['l6-enemy-room']`), solved with the view in `mode`. */
async function solveL6(mode) {
    const log = { sent: [], got: [] };
    const service = createWorkerSolveService({ createWorker: () => nodeWorker(log) });
    const prev = globalThis.document;
    globalThis.document = stubDocument();
    const view = new SolveProgressView({ getServices: () => [service], now: () => Date.now() });
    cleanups.push(() => { view.close(); service.dispose(); globalThis.document = prev; });
    view.setMode(mode);
    const stage = solveDemoStage(MAP, 'l6-enemy-room');
    expect(stage.ok).toBe(true);
    const rt = createJsRuntime({ solveService: service });
    rt.setVanilla(MAP);
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [stage.level, stage.spawn.x, stage.spawn.y] }]);
    rt.tick();
    expect(rt.run.level).toBe(SOLVE_DEMOS['l6-enemy-room'].level);
    rt.playback.setSolverWalk(true);
    expect(rt.playback.walkTo(stage.goal)).toEqual({ ok: true });
    rt.playback.play();
    for (let steps = 0, holds = 0; steps < 3000 && holds < 40000 && !SETTLED.includes(rt.playback.state);) {
        if (rt.tick().solving) { holds += 1; await sleep(2); } else steps += 1;
    }
    expect(`${rt.playback.state} ${rt.playback.reason ?? ''}`).toBe(`${WALK_STATES.DONE} `);
    const solves = log.sent.filter((m) => m.type === 'solve');
    const plans = log.got.filter((m) => m.type === 'result')
        .map((m) => JSON.stringify(m.plan, (k, v) => (/^ms$|Ms$/.test(k) ? undefined : v)));
    return { rt, view, solves, plans };
}

describe('⛓ AUTO-SHOW — the view\'s modes on a real L6 solve (the panel\'s solve demo)', () => {
    it('off / auto / always: the REQUEST is byte-identical (the ask rides the envelope), and so is the plan; auto shows then hides, always stays shown', async () => {
        const off = await solveL6('off');
        const auto = await solveL6('auto');
        const always = await solveL6('always');
        expect(off.solves.length).toBeGreaterThan(0);
        for (const run of [auto, always]) {
            expect(run.solves.length).toBe(off.solves.length);
            for (let i = 0; i < off.solves.length; i += 1) {
                expect(JSON.stringify(run.solves[i].request)).toBe(JSON.stringify(off.solves[i].request));
                expect(run.solves[i].progress).toBe(true);
            }
            expect(run.plans).toEqual(off.plans);
            expect(run.rt.session.perTick.map((h) => [...h].sort())).toEqual(off.rt.session.perTick.map((h) => [...h].sort()));
            expect(runDigest(run.rt.run)).toBe(runDigest(off.rt.run));
        }
        for (const m of off.solves) expect(m).not.toHaveProperty('progress');
        expect([off.view.lifecycle.length, off.view.state.received]).toEqual([0, 0]);
        // auto: shown on a RUNNING note, hidden on the final one (one show/hide per solve), still listening
        const ev = auto.view.lifecycle.map((e) => `${e.event}:${e.final}`);
        expect(ev.length).toBe(2 * auto.solves.length);
        expect(ev.every((e, i) => e === (i % 2 === 0 ? 'show:false' : 'hide:true'))).toBe(true);
        expect([auto.view.isOpen, auto.view.isListening, auto.view.state.final]).toEqual([false, true, true]);
        expect(auto.view.state.snapshot?.segment?.outcome).toBe('solved');
        // always: never hidden
        expect([always.view.isOpen, always.view.lifecycle.map((e) => e.event)]).toEqual([true, ['show']]);
    }, 180000);
});
