/**
 * wasmArrivalComposite — solver-walk W4: the ARRIVALS the wasm runtime once
 * served with a composite, now plain solver plans.
 *
 *   · a PIT exit (S4's arm in `wasmArrival.arrivalSolverGoal`): no teleporter on
 *     the exit's cells → the nearest live pit → `reach-pit`;
 *   · an arrival LATCHED ON its goal door (S5): ⛓ STEP-OFF RETIRE — the door's
 *     plain `reach-exit`. `solveSegment` steps off the latched door and walks
 *     back (fidelity STEP-OFF: a `step-off` verb in the plan), ONE plan from the
 *     arrival; a closed pocket is the solver's own `closed` refusal. W4's
 *     walker-prefix composite (the worker's `step-off` producer,
 *     `stepOffSolveFromStaging`) is retired.
 *
 * The arrivals are booted the way the node pre-pass boots them (the JS page's
 * own `new Game(level, x, y)`), at the spawns the committed atlas worlds name.
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *
 *   m1 no pit arm (`arrivalSolverGoal` maps a pit exit as before)
 *        -> 'a PIT exit maps to reach-pit' + 'the pit plans fall' red (2)
 *   m2 the composite path back on (W4's latched arm: `arrivalSolverGoal` answers
 *      `stepOff`, the request names a `step-off` producer)
 *        -> 9 red (measured, the base's four files restored): every latched
 *           'crosses' row (6), the closed row, the continuation row, and
 *           `wasmArrival.test.js`'s latched mapping row (the mapping is no
 *           longer the door's plain reach-exit)
 *   (m4, the repeat check off, is caught in `wasmPlayback.test.js` and the
 *   engine's `seedlingWasmPlayback.test.js` — 3 red: the policy row, the
 *   engine's exact-repeat row and the WG walker row.)
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker as NodeWorker } from 'node:worker_threads';

import { createJsRuntime } from './jsRuntimeCore.js';
import { arrivalSolveRequest, arrivalSolverGoal, continuationSolveRequest } from './wasmArrival.js';
import { createInPlaceProduceService } from './wasmWalkTape.js';
import { createInPlaceSolveService, replayTape } from './jsRuntimeSolver.js';
import { latchedOn, nearestTeleporterAt } from './jsRuntimeWalker.js';
import { createRunForStaging } from './tapeRunner.js';
import { createWorkerSolveService } from './jsRuntimeSolveService.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const RECORDS = indexLevels(MAP);
const SOURCE = levelSourceFromAtlas(RECORDS);

/** The staging of a fresh arrival at (x, y) in `level` — the JS page's own boot. */
function arrival(level, x, y) {
    const rt = createJsRuntime();
    rt.setVanilla(MAP);
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [level, x, y] }]);
    rt.tick();
    expect(rt.run?.level).toBe(level);
    return rt.session.staging;
}
const rowOf = (run) => ({ level: run.level, x: run.state.x, y: run.state.y, deaths: run.playerDeaths.length });

/** Map + request + solve, as the engine's `arrive()` does it (the in-place twin of the worker). */
function serve(goal, staging) {
    const mapped = arrivalSolverGoal(goal, { staging, levelSource: SOURCE, record: RECORDS.get(goal.level) });
    if (!mapped.goal) return { mapped };
    const request = arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource: SOURCE, records: RECORDS,
        scratchPersistence: true });
    return { mapped, request, result: createInPlaceProduceService().start(request).result };
}

/** Every row a FRESH run from the arrival stands on, replaying the plan's whole solution. */
function replayRows(staging, solution) {
    const run = createRunForStaging(staging, SOURCE, { scratchPersistence: true });
    const rows = [rowOf(run)];
    for (const held of solution) { run.advance(held); rows.push(rowOf(run)); }
    return rows;
}

/** Whether a fresh run at the staging stands latched on the goal's door (the arrival's own latch). */
function latchedAtArrival(goal, staging) {
    const run = createRunForStaging(staging, SOURCE);
    const hit = nearestTeleporterAt(run.world, goal.tiles, run.state);
    return Boolean(hit) && latchedOn(run, hit.index);
}

// The committed atlas arrivals latched on their goal door (the pre-pass's `latched` legs), the house first.
// ⛓ STAGED: the rules arc's arrival spawns (2026-10-04, ⚖ L101/L106/L109) moved those three arrivals off
// their doors, so no committed arrival boots there any more (`jsRuntimeArrivalOnDoor.test.js` pins that):
// they stay as staged boots on the door tile — a step-off over different geometry than L87 and L102.
const HOUSE_DOOR = { goal: { kind: 'exit', level: 86, tiles: [[3, 4]], name: 'door' }, at: [48, 64], to: 0 };
const CROSSES = [
    HOUSE_DOOR,
    // S5's two natural crossings (`jsRuntimeArrivalOnDoor.test.js` 'crosses'), each by its own door tile
    { goal: { kind: 'exit', level: 87, tiles: [[27, 19]], name: 'L87 door' }, at: [432, 304], to: 88 },
    { goal: { kind: 'exit', level: 102, tiles: [[14, 6]], name: 'L102 door' }, at: [224, 96] },
    { goal: { kind: 'exit', level: 101, tiles: [[6, 1]], name: 'out_teleporter_104_24' }, at: [96, 16], staged: true },
    { goal: { kind: 'exit', level: 106, tiles: [[4, 3]], name: 'L106 door' }, at: [64, 48], staged: true },
    { goal: { kind: 'exit', level: 109, tiles: [[10, 3]], name: 'L109 door' }, at: [160, 48], staged: true },
];
const DOOR_GOAL = { kind: 'reach-exit', exit: { x: 48, y: 64 } };

describe('⛓ STEP-OFF RETIRE — a latched door: the solver\'s OWN plan from the arrival (no walker prefix)', () => {
    for (const { goal, at, to, staged } of CROSSES) {
        it(`level ${goal.level} from (${at.join(', ')})${staged ? ' (STAGED)' : ''}: latched, mapped to the door's plain reach-exit; the solver steps off and crosses`, () => {
            const staging = arrival(goal.level, ...at);
            expect(latchedAtArrival(goal, staging)).toBe(true);
            const { mapped, request, result } = serve(goal, staging);
            expect(Object.keys(mapped)).toEqual(['goal']);
            expect(mapped.goal.kind).toBe('reach-exit');
            expect(request.producer).toBeUndefined();
            expect(request.perTick).toEqual([]);
            expect(result.ok, result.message).toBe(true);
            const p = result.plan;
            expect(p.producer).toBeUndefined();
            expect(p.prefixLength).toBe(0); // shipped from the ARRIVAL, not from a held point
            expect(p.verbs).toEqual(['step-off', 'walk']);
            expect(p.expected).toHaveLength(p.solution.length + 1);
            expect(p.expected[0]).toEqual(rowOf(createRunForStaging(staging, SOURCE)));
            expect(p.expected.at(-1).level).not.toBe(goal.level); // crossed
            if (to !== undefined) expect(p.expected.at(-1).level).toBe(to);
            expect(p.expected.every((r) => r.deaths === 0)).toBe(true);
        });
    }

    it('the plan IS one trajectory: a fresh run replaying the WHOLE solution stands on expected, row for row, and the latch drops on the way (the house door)', () => {
        const staging = arrival(86, ...HOUSE_DOOR.at);
        const p = serve(HOUSE_DOOR.goal, staging).result.plan;
        expect(replayRows(staging, p.solution)).toEqual(p.expected);
        const run = createRunForStaging(staging, SOURCE, { scratchPersistence: true });
        let dropped = -1;
        for (let i = 0; i < p.solution.length && dropped < 0; i += 1) {
            run.advance(p.solution[i]);
            if (run.state.latched.size === 0) dropped = i;
        }
        expect(dropped).toBeGreaterThanOrEqual(0);
        expect(dropped).toBeLessThan(p.solution.length - 1);
    });

    it('a CLOSED pocket is the SOLVER\'s named refusal (L3 bare under the rock; L37 ringed by lava)', () => {
        for (const [goal, at] of [
            [{ kind: 'exit', level: 3, tiles: [[6, 8]], name: 'out_teleporter_96_128' }, [96, 128]],
            [{ kind: 'exit', level: 37, tiles: [[36, 9]], name: 'out_stairsdown_576_144' }, [576, 144]],
        ]) {
            const staging = arrival(goal.level, ...at);
            expect(latchedAtArrival(goal, staging)).toBe(true);
            const { mapped, request, result } = serve(goal, staging);
            expect(mapped.goal.kind).toBe('reach-exit');
            expect(request.producer).toBeUndefined();
            expect(result).toMatchObject({ ok: false, kind: 'refusal' });
            expect(result.message).toMatch(new RegExp(`closed — the run stands LATCHED on (teleporter|stairs)@\\d+,\\d+ in level ${goal.level} `
                + '.*no standable cell next to it can be walked to'));
        }
    });

    it('an arrival NOT latched maps to the same plain solve, with no step-off in it', () => {
        const staging = arrival(86, 48, 48);
        expect(latchedAtArrival(HOUSE_DOOR.goal, staging)).toBe(false);
        const { mapped, request, result } = serve(HOUSE_DOOR.goal, staging);
        expect(mapped).toEqual({ goal: DOOR_GOAL });
        expect(request.producer).toBeUndefined();
        expect(result.ok).toBe(true);
        expect(result.plan.verbs).toEqual(['walk']);
    });

    it('a CONTINUATION whose shadow stands latched on the goal door is solved (was refused: "a step-off composite starts at an arrival")', () => {
        const staging = arrival(86, ...HOUSE_DOOR.at);
        const shipped = [new Set(), new Set()]; // two idle ticks: the shadow still stands on the door, latched
        const c = continuationSolveRequest({ staging, shipped, goal: HOUSE_DOOR.goal, levelSource: SOURCE, records: RECORDS,
            record: RECORDS.get(86) });
        expect(c.refusal).toBeUndefined();
        expect(c.mapped).toEqual({ goal: DOOR_GOAL });
        expect(latchedOn(replayTape({ staging, perTick: shipped, levelSource: SOURCE, scratchPersistence: true }), 0)).toBe(true);
        const r = createInPlaceSolveService().start({ ...c.request }).result;
        expect(r.ok, r.message).toBe(true);
        expect(r.plan.prefixLength).toBe(2);
        expect(r.plan.verbs).toEqual(['step-off', 'walk']);
        expect(r.plan.expected.at(-1).level).toBe(0);
    });

    it('the S2 WORKER (the real entry over worker_threads) answers a latched arrival with the in-place plan, row for row', async () => {
        const ENTRY = new URL('./jsRuntimeSolveWorker.js', import.meta.url).href;
        const nodeWorker = () => {
            const w = new NodeWorker(`
                const { parentPort } = require('node:worker_threads');
                globalThis.self = {
                    postMessage: (m) => parentPort.postMessage(m),
                    set onmessage(fn) { parentPort.on('message', (data) => fn({ data })); },
                };
                import(${JSON.stringify(ENTRY)});
            `, { eval: true });
            const adapter = { onmessage: null, onerror: null, postMessage: (m) => w.postMessage(m), terminate: () => w.terminate() };
            w.on('message', (data) => adapter.onmessage?.({ data }));
            w.on('error', (e) => adapter.onerror?.({ message: e.message }));
            return adapter;
        };
        const staging = arrival(86, ...HOUSE_DOOR.at);
        const { request, result } = serve(HOUSE_DOOR.goal, staging);
        const service = createWorkerSolveService({ createWorker: nodeWorker });
        try {
            const h = service.start(request);
            const t0 = Date.now();
            while (!h.settled && Date.now() - t0 < 60000) await new Promise((r) => setTimeout(r, 20));
            expect(h.result.ok).toBe(true);
            expect(h.result.plan.producer).toBeUndefined();
            expect(h.result.plan.verbs).toEqual(['step-off', 'walk']);
            expect(h.result.plan.expected).toEqual(result.plan.expected);
            expect(h.result.plan.solution.map((s) => [...s].sort())).toEqual(result.plan.solution.map((s) => [...s].sort()));
        } finally { service.dispose(); }
    }, 90000);
});

describe('⛓ W4 — a PIT exit: S4\'s arm on the wasm mapping', () => {
    const PITS = [
        { goal: { kind: 'exit', level: 48, tiles: [[11, 3]], name: 'out_pit_2_2' }, at: [176, 48] },
        { goal: { kind: 'exit', level: 83, tiles: [[2, 1]], name: 'out_pit_2_2' }, at: [32, 48] },
        { goal: { kind: 'exit', level: 84, tiles: [[1, 1]], name: 'out_pit_2_3' }, at: [16, 16] },
    ];
    it('a PIT exit maps to reach-pit at the pit tile (no teleporter on its cells); a door exit is unchanged', () => {
        for (const { goal, at } of PITS) {
            const staging = arrival(goal.level, ...at);
            const [tx, ty] = goal.tiles[0];
            expect(arrivalSolverGoal(goal, { staging, levelSource: SOURCE, record: RECORDS.get(goal.level) }))
                .toEqual({ goal: { kind: 'reach-pit', pit: { tx, ty, x: tx * 16, y: ty * 16 } } });
        }
        expect(arrivalSolverGoal(HOUSE_DOOR.goal, { staging: arrival(86, 48, 48), levelSource: SOURCE, record: RECORDS.get(86) }))
            .toEqual({ goal: { kind: 'reach-exit', exit: { x: 48, y: 64 } } });
    });
    it('the pit plans fall: a plain solver plan (no producer), the trajectory leaves the room, no death, = the fresh replay', () => {
        for (const { goal, at } of PITS) {
            const staging = arrival(goal.level, ...at);
            const { request, result } = serve(goal, staging);
            expect(request.producer).toBeUndefined();
            expect(result.ok).toBe(true);
            const p = result.plan;
            expect(p.verbs).toContain('walk');
            expect(p.expected.at(-1).level).not.toBe(goal.level);
            expect(p.expected.every((r) => r.deaths === 0)).toBe(true);
            expect(replayRows(staging, p.solution)).toEqual(p.expected);
        }
    });
    it('an exit with neither a teleporter nor a pit on its cells still has no solver goal, named', () => {
        const staging = arrival(86, 48, 48);
        expect(arrivalSolverGoal({ kind: 'exit', level: 86, tiles: [[1, 1]] }, { staging, levelSource: SOURCE,
            record: RECORDS.get(86) })).toEqual({ walker: 'no live teleporter resolved for the exit' });
    });
});
