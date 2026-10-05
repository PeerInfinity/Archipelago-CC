/**
 * seedlingDemo/jsRuntimeSolveWorker — **THE SOLVER MODE'S WORKER ENTRY**
 * (solver-walk S2).
 *
 * A module Worker that runs `jsRuntimeSolver.solveFromTape` — the shadow
 * replay and `solveSegment` with the session as `prefix` — OFF the page's main
 * thread, so a long solve never freezes the page and can be TERMINATED at its
 * budget (a synchronous `solveSegment` cannot be interrupted; a worker can).
 * The page side is `jsRuntimeSolveService.createWorkerSolveService`.
 *
 * Protocol (every message structured-cloned):
 *   page → worker  `{type: 'solve', id, request}` — `request` is the tape
 *                  (`staging`, `perTick`, `live`, `solverGoal`, `name`,
 *                  `scratchPersistence`, `equips`; ⛓ WG: or `producer: 'walker'`
 *                  + `goal` — `wasmWalkTape.walkTapeFromStaging`) and `source: {id,
 *                  records?}`: the room records arrive ONCE per worker and are
 *                  kept by id (`records` omitted on later solves).
 *   worker → page  `{type: 'started', id}` the moment the solve begins (the
 *                  budget runs from here, not from a cold module load);
 *                  ⛓ ANYTIME `{type: 'pass', id, index, pass, answer, best}`
 *                  as each solver pass lands (`jsRuntimeSolver.ANYTIME_PASSES`:
 *                  dashless, then full) — `best` is the PROVISIONAL answer;
 *                  `{type: 'result', id, ok, plan | kind, message}` —
 *                  `jsRuntimeSolver.settleSolve`'s answer.
 *
 * ⛔ NO BUNDLE ENTRY. The JS runtime page (`jsRuntime.html`) is an unbundled
 * module page in BOTH flavours — the bundled build bundles the host
 * (`init-bundled.js`), and the deployed site serves `frontend/` whole — so
 * this file is loaded as an ES module by URL, beside `jsRuntimeSolver.js`.
 *
 * ⛔ It runs where `self` is the worker scope; node's rows run it through
 * `worker_threads` with a `self` shim (`jsRuntimeSolveService.test.js`).
 */

import { levelSourceFromAtlas } from './atlasSource.js';
import { ANYTIME_PASSES, settleSolve, solveAnytime } from './jsRuntimeSolver.js';
import { walkTapeFromStaging, WALK_TAPE_PRODUCER } from './wasmWalkTape.js';

/** source id -> `{levelSource, records}`: the room records this worker has been sent. */
const sources = new Map();
const clock = () => (globalThis.performance?.now ? Math.round(globalThis.performance.now()) : Date.now());

self.onmessage = (event) => {
    const msg = event.data;
    if (msg?.type !== 'solve') return;
    const { id, request } = msg;
    const { source } = request;
    if (source.records) sources.set(source.id, { levelSource: levelSourceFromAtlas(source.records), records: source.records });
    const held = sources.get(source.id);
    self.postMessage({ type: 'started', id });
    // ⛓ WG — `producer: 'walker'` (a generated room on wasm): the J2 walker drives a fresh run
    // from the staging and its keys are the plan (`wasmWalkTape.js`); the plan has the same shape.
    // ⛓ STEP-OFF RETIRE — W4's `producer: 'step-off'` composite is gone: an arrival latched on its goal
    // door is a plain solve (`solveSegment` steps off a latched door itself, fidelity STEP-OFF).
    const produce = request.producer === WALK_TAPE_PRODUCER
        ? () => walkTapeFromStaging({ ...request, levelSource: held.levelSource, records: held.records, clock })
        : null;
    let answer;
    if (!held) answer = { ok: false, kind: 'refusal', message: `the solver worker was never sent room source ${source.id}` };
    else if (produce) answer = settleSolve(produce);
    else {
        // ⛓ ANYTIME — the solver's passes in order (`ANYTIME_PASSES`, or the request's own — a held retry
        // sends the passes not yet answered); each lands as a `pass` message, so the page holds the best
        // so far as its PROVISIONAL plan when a later pass is terminated at the budget.
        const { passes = ANYTIME_PASSES, ...tape } = request;
        answer = solveAnytime({ ...tape, levelSource: held.levelSource, clock }, {
            passes, clock,
            onPass: (one, best, index) => self.postMessage({ type: 'pass', id, index, pass: one.pass, answer: one, best }),
        });
    }
    self.postMessage({ type: 'result', id, ...answer });
};
