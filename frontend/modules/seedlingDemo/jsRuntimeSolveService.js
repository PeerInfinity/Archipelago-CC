/**
 * seedlingDemo/jsRuntimeSolveService — **THE SOLVER MODE'S WORKER, PAGE SIDE**
 * (solver-walk S2).
 *
 * `createWorkerSolveService()` is the `solveService` the JS runtime page hands
 * `jsRuntimeSolver.createRuntimeSolver` (through `createJsRuntime`): `start`
 * posts one solve to a module Worker (`jsRuntimeSolveWorker.js`) and returns a
 * HANDLE the solver polls once per page tick —
 *
 *   `settled`    false until the worker answers;
 *   `result`     `{ok, plan | kind, message}` once settled;
 *   `started`    true once the worker said it began (the budget runs from
 *                there — a cold worker's module load is not charged to the
 *                solve); `startedAt` is that moment on this service's clock;
 *   `cancel()`   TERMINATES the worker (a solve cannot be interrupted any
 *                other way); the next `start` builds a fresh one;
 *   `provisional` ⛓ ANYTIME — the best answer of the solver passes that
 *                have landed (`jsRuntimeSolver.betterAnswer`), null until
 *                one did; `answered` how many (⛓ SHOULD-STOP: leading passes
 *                with a final word — a refusal cut by its deadline is not
 *                one); `passes` one row each. A
 *                budget expiry plays a provisional PLAN instead of declining.
 *
 * One solve is in flight at a time (the solver keeps one). The room records
 * are posted once per worker, by id. A worker that errors (a module that
 * fails to load) settles the solve in flight as a refusal NAMING the error,
 * so the walker declines by name — never a silent hang.
 *
 * ⛔ The Worker constructor is injected (`createWorker`): node's rows pass a
 * `worker_threads` adapter; the page uses the default, a module worker beside
 * this file (`new URL(…, import.meta.url)` — this module is never bundled,
 * see `jsRuntimeSolveWorker.js`).
 */

import { killLockBodiesStamp } from './killLockBodies.js';

export const SOLVE_WORKER_URL = new URL('./jsRuntimeSolveWorker.js', import.meta.url);

const defaultCreateWorker = () => new Worker(SOLVE_WORKER_URL, { type: 'module', name: 'seedling-js-solver' });
const defaultClock = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());

/**
 * @param {object} [opts]
 * @param {() => object} [opts.createWorker]  `{postMessage, terminate, onmessage, onerror}`
 * @param {() => number} [opts.clock]
 */
export function createWorkerSolveService({ createWorker = defaultCreateWorker, clock = defaultClock } = {}) {
    let worker = null;
    let current = null;
    let nextId = 1;
    let nextSource = 1;
    /** records Map -> source id. */
    const sourceIds = new WeakMap();
    /** source ids the CURRENT worker holds. */
    let sent = new Set();
    const stats = { workers: 0, solves: 0, terminated: 0, errors: 0 };

    function drop() {
        if (!worker) return;
        try { worker.terminate(); } catch { /* already gone */ }
        worker = null;
        sent = new Set();
    }

    function settle(handle, result) {
        if (handle.settled) return;
        handle.settled = true;
        handle.result = result;
        if (current === handle) current = null;
    }

    function ensure() {
        if (worker) return worker;
        const w = createWorker();
        stats.workers += 1;
        w.onmessage = (event) => {
            if (w !== worker) return;
            const msg = event.data;
            if (!current || msg?.id !== current.id) return;
            if (msg.type === 'started') { current.started = true; current.startedAt = clock(); }
            else if (msg.type === 'pass') {
                // ⛓ ANYTIME — the best answer so far: what an expiry plays (a plan) or says (a refusal).
                // ⛓ SHOULD-STOP — `answered` counts the LEADING passes that gave a final word: a refusal
                // raised after its deadline tripped (the dashless pass bounded at the budget) was cut, not
                // answered, so a held retry (`passesAfter`) runs that pass again with its larger budget.
                const cutByDeadline = msg.answer?.ok === false && msg.answer?.deadline;
                if (current.answered === msg.index && !cutByDeadline) current.answered = msg.index + 1;
                current.provisional = msg.best ?? null;
                const tripped = (msg.answer?.ok ? msg.answer?.plan?.deadline : msg.answer?.deadline)?.first ?? null;
                current.passes.push({ pass: msg.pass, ok: msg.answer?.ok === true, kind: msg.answer?.kind ?? null,
                    ...(tripped ? { deadline: tripped } : {}) });
            }
            else if (msg.type === 'result') {
                const { type, id, ...result } = msg;
                settle(current, result);
            }
        };
        w.onerror = (event) => {
            if (w !== worker) return;
            stats.errors += 1;
            const why = event?.message ?? String(event?.error?.message ?? event);
            if (event?.preventDefault) event.preventDefault();
            drop();
            if (current) settle(current, { ok: false, kind: 'refusal', message: `the solver worker failed — ${why}` });
        };
        worker = w;
        return w;
    }

    function sourceIdOf(records) {
        if (!records || typeof records !== 'object') return 0;
        if (!sourceIds.has(records)) sourceIds.set(records, nextSource++);
        return sourceIds.get(records);
    }

    return {
        kind: 'worker',
        get stats() { return { ...stats, live: worker !== null }; },
        /** Build the worker now (the module graph loads while nobody waits on it). */
        warm() { ensure(); },
        start(request) {
            if (current && !current.settled) current.cancel();
            const handle = {
                id: nextId++, settled: false, started: false, result: null, startedAt: null,
                // ⛓ ANYTIME — the passes that landed, and the best answer among them (null until one did)
                answered: 0, provisional: null, passes: [],
                cancel() {
                    if (handle.settled) return;
                    settle(handle, { ok: false, kind: 'budget', message: 'cancelled' });
                    stats.terminated += 1;
                    drop();
                },
            };
            const w = ensure();
            current = handle;
            const { levelSource, source, ...tape } = request;
            // ⛓ KILLLOCK HOOK — the worker imports its own `killLockBodies`: an off-default switch set of THIS
            // instance travels with the request (at the defaults nothing is added — the request is today's).
            const killLock = tape.killLockBodies ?? killLockBodiesStamp();
            if (killLock) tape.killLockBodies = killLock;
            const id = sourceIdOf(source?.records);
            const msg = { type: 'solve', id: handle.id, request: { ...tape, source: { id, ...(sent.has(id) ? {} : { records: source?.records ?? null }) } } };
            sent.add(id);
            stats.solves += 1;
            try {
                w.postMessage(msg);
            } catch (err) {
                drop();
                settle(handle, { ok: false, kind: 'refusal', message: `the solve could not be posted to its worker — ${err.message}` });
            }
            return handle;
        },
        dispose() { if (current) current.cancel(); drop(); },
    };
}
