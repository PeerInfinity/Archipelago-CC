/**
 * wasmArrivalComposite — solver-walk W4: the two ARRIVAL COMPOSITES the wasm
 * runtime gains.
 *
 *   · a PIT exit (S4's arm in `wasmArrival.arrivalSolverGoal`): no teleporter on
 *     the exit's cells → the nearest live pit → `reach-pit`;
 *   · an arrival LATCHED ON its goal door (S5): the worker's `step-off`
 *     producer (`wasmWalkTape.stepOffSolveFromStaging`) — the walker's step-off
 *     ++ the solver's walk back, ONE plan from the arrival.
 *
 * The arrivals are booted the way the node pre-pass boots them (the JS page's
 * own `new Game(level, x, y)`), at the spawns the committed atlas worlds name.
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *
 *   m1 no pit arm (`arrivalSolverGoal` maps a pit exit as before)
 *        -> 'a PIT exit maps to reach-pit' + 'the pit plans fall' red (2)
 *   m2 no step-off prefix (the composite solves from the arrival itself)
 *        -> every 'crosses' row red (the solver's walk to where it stands
 *           fires nothing: the plan never leaves the room) — 9 red, the worker row too
 *   m3 expected rows not concatenated (the plan's rows only)
 *        -> 'the composite IS one trajectory' red (expected ≠ the fresh replay), and
 *           every 'crosses' row (expected no longer starts at the arrival) — 7 red
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
import { arrivalSolveRequest, arrivalSolverGoal, STEP_OFF_PRODUCER } from './wasmArrival.js';
import { createInPlaceProduceService, stepOffSolveFromStaging, WalkTapeRefusal } from './wasmWalkTape.js';
import { replayTape } from './jsRuntimeSolver.js';
import { latchedOn } from './jsRuntimeWalker.js';
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
        scratchPersistence: true, stepOffGoal: mapped.stepOff ? goal : null });
    return { mapped, request, result: createInPlaceProduceService().start(request).result };
}

/** Every row a FRESH run from the arrival stands on, replaying the plan's whole solution. */
function replayRows(staging, solution) {
    const run = createRunForStaging(staging, SOURCE, { scratchPersistence: true });
    const rows = [rowOf(run)];
    for (const held of solution) { run.advance(held); rows.push(rowOf(run)); }
    return rows;
}

// The committed atlas arrivals latched on their goal door (the pre-pass's `latched` legs), the house first.
const HOUSE_DOOR = { goal: { kind: 'exit', level: 86, tiles: [[3, 4]], name: 'door' }, at: [48, 64], to: 0 };
const CROSSES = [
    HOUSE_DOOR,
    // S5's five rooms (`jsRuntimeArrivalOnDoor.test.js` 'crosses'), each by its own door tile
    { goal: { kind: 'exit', level: 87, tiles: [[27, 19]], name: 'L87 door' }, at: [432, 304], to: 88 },
    { goal: { kind: 'exit', level: 101, tiles: [[6, 1]], name: 'out_teleporter_104_24' }, at: [96, 16] },
    { goal: { kind: 'exit', level: 102, tiles: [[14, 6]], name: 'L102 door' }, at: [224, 96] },
    { goal: { kind: 'exit', level: 106, tiles: [[4, 3]], name: 'L106 door' }, at: [64, 48] },
    { goal: { kind: 'exit', level: 109, tiles: [[10, 3]], name: 'L109 door' }, at: [160, 48] },
];

describe('⛓ W4 — a latched door: ONE composite plan from the arrival (walker step-off ++ the solver)', () => {
    for (const { goal, at, to } of CROSSES) {
        it(`level ${goal.level} from (${at.join(', ')}): mapped to the door's reach-exit WITH a step-off; the composite crosses`, () => {
            const staging = arrival(goal.level, ...at);
            expect(latchedOn(createRunForStaging(staging, SOURCE), arrivalSolverGoal(goal, { staging, levelSource: SOURCE,
                record: RECORDS.get(goal.level) }).stepOff.index)).toBe(true);
            const { mapped, request, result } = serve(goal, staging);
            expect(mapped.goal.kind).toBe('reach-exit');
            expect(request).toMatchObject({ producer: STEP_OFF_PRODUCER, goal: { kind: 'exit', level: goal.level }, perTick: [] });
            expect(result.ok).toBe(true);
            const p = result.plan;
            expect(p.producer).toBe(STEP_OFF_PRODUCER);
            expect(p.prefixLength).toBe(0); // shipped from the ARRIVAL, not from a held point
            expect(p.stepOff.ticks).toBeGreaterThan(0);
            expect(p.stepOff.ticks).toBeLessThan(40);
            expect(p.join).toBe(p.stepOff.ticks);
            expect(p.solution.length).toBeGreaterThan(p.stepOff.ticks);
            expect(p.expected).toHaveLength(p.solution.length + 1);
            expect(p.expected[0]).toEqual(rowOf(createRunForStaging(staging, SOURCE)));
            expect(p.expected.at(-1).level).not.toBe(goal.level); // crossed
            if (to !== undefined) expect(p.expected.at(-1).level).toBe(to);
            expect(p.expected.every((r) => r.deaths === 0)).toBe(true);
        });
    }

    it('the composite IS one trajectory: a fresh run replaying the WHOLE solution stands on expected, row for row (the house door)', () => {
        const staging = arrival(86, ...HOUSE_DOOR.at);
        const { result } = serve(HOUSE_DOOR.goal, staging);
        const p = result.plan;
        expect(replayRows(staging, p.solution)).toEqual(p.expected);
        // the join: the walker's last row is the plan's first, ONE row (no duplicate, no gap)
        expect(p.expected[p.join]).toEqual(p.stepOff.to);
        expect(p.stepOff.from).toEqual(p.expected[0]);
        // and the latch dropped exactly at the join (the step-off stops the tick the box is off)
        const run = replayTape({ staging, perTick: p.solution.slice(0, p.join), levelSource: SOURCE, scratchPersistence: true });
        expect(latchedOn(run, p.stepOff.index)).toBe(false);
        const before = replayTape({ staging, perTick: p.solution.slice(0, p.join - 1), levelSource: SOURCE, scratchPersistence: true });
        expect(latchedOn(before, p.stepOff.index)).toBe(true);
    });

    it('the composite is the S5 page\'s own: the step-off keys are the walker\'s, the plan the solver\'s walk back (verbs walk)', () => {
        const staging = arrival(86, ...HOUSE_DOOR.at);
        const p = serve(HOUSE_DOOR.goal, staging).result.plan;
        expect(p.verbs).toEqual(['walk']);
        // a direct call gives the same plan, key for key
        const direct = stepOffSolveFromStaging({ staging, levelSource: SOURCE, goal: HOUSE_DOOR.goal,
            solverGoal: { kind: 'reach-exit', exit: { x: 48, y: 64 } }, name: 'wasm-exit-86' });
        expect(direct.solution.map((h) => [...h].sort())).toEqual(p.solution.map((h) => [...h].sort()));
    });

    it('a CLOSED pocket is refused BY NAME at the mapping, before any solve (L3 bare under the rock; L37 ringed by lava)', () => {
        for (const [goal, at] of [
            [{ kind: 'exit', level: 3, tiles: [[6, 8]], name: 'out_teleporter_96_128' }, [96, 128]],
            [{ kind: 'exit', level: 37, tiles: [[36, 9]], name: 'out_stairsdown_576_144' }, [576, 144]],
        ]) {
            const { mapped, request } = serve(goal, arrival(goal.level, ...at));
            expect(request).toBeUndefined();
            expect(mapped.walker).toMatch(new RegExp(`^level ${goal.level}: the arrival stands latched on the teleporter at .* `
                + 'no cell next to it can be walked to — a crossing needs the player to step off it and back on'));
        }
    });

    it('an arrival NOT latched maps to a plain solve (no producer); a step-off request for one is refused by name', () => {
        const staging = arrival(86, 48, 48);
        const { mapped, request, result } = serve(HOUSE_DOOR.goal, staging);
        expect(mapped).toEqual({ goal: { kind: 'reach-exit', exit: { x: 48, y: 64 } } });
        expect(request.producer).toBeUndefined();
        expect(result.ok).toBe(true);
        expect(() => stepOffSolveFromStaging({ staging, levelSource: SOURCE, goal: HOUSE_DOOR.goal,
            solverGoal: mapped.goal })).toThrow(WalkTapeRefusal);
        expect(() => stepOffSolveFromStaging({ staging, levelSource: SOURCE, goal: HOUSE_DOOR.goal,
            solverGoal: mapped.goal })).toThrow(/is not latched on the goal door/);
    });

    it('the S2 WORKER (the real entry over worker_threads) answers `producer: step-off` with the in-place plan, row for row', async () => {
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
            expect(h.result.plan.producer).toBe(STEP_OFF_PRODUCER);
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
