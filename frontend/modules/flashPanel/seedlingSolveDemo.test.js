/**
 * ⛓ SLOWSOLVE (slice `seedling-slowsolve-check`) — the panel's solve demos: `l12-dash-cut`'s stage, the `needs`
 * check, and the upgrade-window push a demo walk now makes (js-6's conditions, 2026-10-16):
 *   - the push of the DEFAULT window leaves the L6 demo's solve REQUEST byte-identical (a real worker solve);
 *   - a pushed window is stamped in the request (`upgradeWindowWork`), so an off-default one is visible;
 *   - `l12-dash-cut` stages divergence leg 108's arrival: level 0's door → (16, 80), the exit (432, 352).
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *   m1 `pushDemoWindow` pushes `windowWork + 1`              -> 'pushing the DEFAULT window …' and '… is stamped' red
 *   m2 `solveDemoMissing` checks the flag only, not the slot  -> 'needs: a flag without its slot …' reds
 *   m3 `solveDemoMoved` compares x only                      -> 'moved: …' reds
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker as NodeWorker } from 'node:worker_threads';

import { createJsRuntime } from '../seedlingDemo/jsRuntimeCore.js';
import { WALK_STATES } from '../seedlingDemo/jsRuntimeWalker.js';
import { SOLVER_UPGRADE_WINDOW_WORK } from '../seedlingDemo/jsRuntimeSolver.js';
import { createWorkerSolveService } from '../seedlingDemo/jsRuntimeSolveService.js';
import { SOLVE_DEMOS, pushDemoWindow, solveDemoMissing, solveDemoMoved, solveDemoStage } from './seedlingSolveDemo.js';

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

const cleanups = [];
afterEach(() => { while (cleanups.length) cleanups.pop()(); });
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

/** The L6 demo, solved through the real worker; `windowWork` is what the panel's setting holds (pushed as the panel does). */
async function solveL6(windowWork) {
    const log = { sent: [], got: [] };
    const service = createWorkerSolveService({ createWorker: () => nodeWorker(log) });
    cleanups.push(() => service.dispose());
    const stage = solveDemoStage(MAP, 'l6-enemy-room');
    expect(stage.ok).toBe(true);
    const rt = createJsRuntime({ solveService: service });
    rt.setVanilla(MAP);
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [stage.level, stage.spawn.x, stage.spawn.y] }]);
    rt.tick();
    rt.playback.setSolverWalk(true);
    const pushed = pushDemoWindow(rt.playback, windowWork);
    expect(rt.playback.walkTo(stage.goal)).toEqual({ ok: true });
    rt.playback.play();
    for (let steps = 0, holds = 0; steps < 3000 && holds < 40000 && !SETTLED.includes(rt.playback.state);) {
        if (rt.tick().solving) { holds += 1; await sleep(2); } else steps += 1;
    }
    expect(rt.playback.state).toBe(WALK_STATES.DONE);
    return { pushed, requests: log.sent.filter((m) => m.type === 'solve').map((m) => m.request) };
}

describe('⛓ SLOWSOLVE — the panel\'s solve demos', () => {
    it('l12-dash-cut stages leg 108: level 0\'s door → (16, 80), the teleporter (432, 352) → tile (27, 22)', () => {
        const stage = solveDemoStage(MAP, 'l12-dash-cut');
        expect(stage).toEqual({ ok: true, level: 12, spawn: { x: 16, y: 80 },
            goal: { kind: 'exit', level: 12, tiles: [[27, 22]] } });
        expect(MAP.levels.find((l) => l.level === 12).entities
            .filter((e) => Number(e.attrs?.to) === 0).map((e) => [e.x, e.y])).toEqual([[0, 80]]);
        expect(solveDemoStage(MAP, 'l6-enemy-room')).toMatchObject({ ok: true, level: 6 });
    });

    it('needs: missing when not held, or held as a flag without its slot (sword-dash would be SKIPPED); none for L6', () => {
        const page = (hasSword, inventorySlots) => ({ flags: { hasSword }, run: { inventorySlots } });
        expect(solveDemoMissing('l12-dash-cut', page(false, []))).toEqual(['Progressive Sword']);
        expect(solveDemoMissing('l12-dash-cut', page(true, []))).toEqual(['Progressive Sword']);
        expect(solveDemoMissing('l12-dash-cut', page(true, [0]))).toEqual([]);
        expect(solveDemoMissing('l6-enemy-room', page(false, []))).toEqual([]);
        expect(solveDemoMissing('l12-dash-cut', null)).toEqual(['Progressive Sword']);
        expect(SOLVE_DEMOS['l12-dash-cut'].needs.map((n) => n.flag)).toEqual(['hasSword']);
    });

    it('moved: null at the spawn or before a run; the boot point when the glue moved it (from L33: (432, 368))', () => {
        const stage = solveDemoStage(MAP, 'l12-dash-cut');
        expect(solveDemoMoved(stage, { worldCtor: { x: 16, y: 80 } })).toBe(null);
        expect(solveDemoMoved(stage, null)).toBe(null);
        expect(solveDemoMoved(stage, { worldCtor: { x: 432, y: 368 } })).toEqual({ x: 432, y: 368 });
        expect(solveDemoMoved(stage, { worldCtor: { x: 16, y: 368 } })).toEqual({ x: 16, y: 368 });
    });

    it('pushDemoWindow: unread / unset leave the page\'s own window; a number (0 = the whole budget) is pushed', () => {
        const calls = [];
        const playback = { setSolverUpgradeWindowWork: (n) => calls.push(n) };
        expect([pushDemoWindow(playback, undefined), pushDemoWindow(playback, null)]).toEqual([false, false]);
        expect([pushDemoWindow(playback, 0), pushDemoWindow(playback, 85)]).toEqual([true, true]);
        expect(calls).toEqual([0, 85]);
    });

    it('pushing the DEFAULT window leaves the L6 demo\'s solve REQUEST byte-identical; a pushed window is stamped', async () => {
        const none = await solveL6(null);
        const dflt = await solveL6(SOLVER_UPGRADE_WINDOW_WORK);
        expect([none.pushed, dflt.pushed]).toEqual([false, true]);
        expect(none.requests.length).toBeGreaterThan(0);
        expect(dflt.requests.map((r) => JSON.stringify(r))).toEqual(none.requests.map((r) => JSON.stringify(r)));
        expect(none.requests[0].upgradeWindowWork).toBe(SOLVER_UPGRADE_WINDOW_WORK);
        const whole = await solveL6(0);
        expect(whole.requests[0].upgradeWindowWork).toBe(null);
        const { upgradeWindowWork: a, ...restWhole } = whole.requests[0];
        const { upgradeWindowWork: b, ...restNone } = none.requests[0];
        expect([a, b]).toEqual([null, SOLVER_UPGRADE_WINDOW_WORK]);
        expect(JSON.stringify(restWhole)).toBe(JSON.stringify(restNone));
    }, 180000);
});
