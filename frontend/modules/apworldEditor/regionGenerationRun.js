/**
 * apworldEditor/regionGenerationRun — **ONE REGION GENERATED OFF THE MAIN
 * THREAD, UNDER A TIME LIMIT THE READER SETS** (APWORLD SUBSTRATE CHANGE R2;
 * plan §9.3–§9.4, ⚖ user 2026-09-23: *"we should set a time limit for the
 * generation attempt. This limit should be a configurable setting … a default
 * of one minute per region. And we should display time elapsed while the
 * region is generating."*).
 *
 * ── ⛓⛓⛓ WHY A WORKER ─────────────────────────────────────────────────
 *
 * `regenerateRegionEntry` is synchronous, and ONE zone realise can run past
 * ten minutes (trap 1393: `procgen_topdown/AP_4` start region `C` → bounce).
 * On the page that is a frozen tab with no Cancel. In a module worker it is a
 * `terminate()` away: the budget is a page-side timer, and a timed-out or
 * cancelled worker is killed, so no second answer can arrive.
 *
 * ⛓ The worker starts with an EMPTY registry. It imports the eight substrate
 * libraries itself (`REGENERATE_WORKER_LIBRARIES` — the same list
 * `scripts/procgen/reference/registry.mjs` declares as `REGISTRY_LIBRARIES`,
 * held equal by a row), then `regionRegenerate.js`. A library that refuses to
 * load is REPORTED, and a target none of the loaded ones registers is answered
 * by name — the list of what the worker can generate is derived, not typed.
 *
 * ⛔ No DOM here and no substrate named: this module is imported by the panel,
 * by the worker, and by node rows alike.
 */

/** ⛓ The setting's key under the module's block, and its full settings path. */
export const REGION_GENERATION_TIMEOUT_KEY = 'regionGenerationTimeoutSeconds';
export const REGION_GENERATION_TIMEOUT_SETTING = `moduleSettings.apworldEditor.${REGION_GENERATION_TIMEOUT_KEY}`;

/** ⛓ ONE minute per region (⚖ user 2026-09-23). The schema and the reader both use it. */
export const REGION_GENERATION_TIMEOUT_DEFAULT_S = 60;

/** ⛓ Where a reader finds the setting — the Options panel's schema-driven list. */
export const REGION_GENERATION_TIMEOUT_WHERE = 'Options › All Settings › apworldEditor';

/**
 * ⛓ The schema property `apworldEditor/index.js` registers. `label` and
 * `description` are what the Options panel draws.
 */
export const REGION_GENERATION_TIMEOUT_SCHEMA = Object.freeze({
    type: 'integer',
    minimum: 1,
    default: REGION_GENERATION_TIMEOUT_DEFAULT_S,
    label: 'Region generation time limit (seconds)',
    description: 'How long the APWorld Editor\'s Region generation → Generate ▸ lets ONE region\'s '
        + 'realiser run (in a worker) before giving up. A zone realiser (bounce, runner) can run '
        + 'unbounded on some regions; the attempt is stopped and nothing is recorded.',
});

/**
 * ⛓ The budget a stored setting value means, in seconds: a whole number ≥ 1,
 * else the default (a hand-edited settings file is not trusted to be one).
 */
export function regionGenerationTimeoutSeconds(value) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : REGION_GENERATION_TIMEOUT_DEFAULT_S;
}

/** ⛓ The timeout sentence's fixed words. EXPORTED so rows assert the constant. */
export const REGION_GENERATION_GAVE_UP = 'gave up after';

/**
 * ⛓⛓ **THE TIMEOUT SENTENCE** — it quotes the setting's name and value, so the
 * reader knows which knob bounded the attempt and where it lives.
 */
export function regionGenerationTimeoutSentence(seconds, substrate, region) {
    return `apworld: the \`${substrate}\` realiser ${REGION_GENERATION_GAVE_UP} ${seconds} s on region `
        + `"${region}" — \`${REGION_GENERATION_TIMEOUT_KEY}\` = ${seconds} (${REGION_GENERATION_TIMEOUT_WHERE}). `
        + 'The worker was stopped; nothing was recorded.';
}

/**
 * ⛓ The bound on the worker's LIBRARY LOAD, in ms — separate from the setting,
 * which bounds the realiser. Measured (plan §10 R2, task 0): the eight libraries
 * load in ≈1.2 s cold, so a one-second setting applied to the load would time
 * out every generation before its realiser started (the in-app timeout row
 * found exactly that). The load gets `max(budget, this)`; a load that never
 * finishes still ends.
 */
export const REGION_GENERATION_LOAD_BOUND_MS = 30000;

/** ⛓ The sentence for a worker whose libraries did not load within their bound. */
export function regionGenerationLoadTimeoutSentence(ms) {
    return `apworld: the generation worker did not load its substrate libraries within ${Math.round(ms / 1000)} s `
        + '— the worker was stopped; nothing was recorded.';
}

/** ⛓ The Cancel sentence. EXPORTED for the rows. */
export const REGION_GENERATION_CANCELLED = 'generation cancelled — the worker was stopped; nothing was recorded';

/** ⛓ A worker that could not start or crashed (not a realiser refusal). */
export const REGION_GENERATION_WORKER_FAILED = 'the generation worker failed';

/**
 * ⛓⛓ **THE LIBRARIES THE WORKER IMPORTS**, relative to `frontend/modules/`.
 * ⛔ Equal to `REGISTRY_LIBRARIES` (`scripts/procgen/reference/registry.mjs`),
 * which a browser cannot import (it reads the disk) — a row holds the two equal.
 */
export const REGENERATE_WORKER_LIBRARIES = Object.freeze([
    'mazeRoom/mazeRoomLibrary.js',
    'bounceDemo/bounceDemoLibrary.js',
    'runnerDemo/runnerDemoLibrary.js',
    'textAdventureSubstrateWrapper/textAdventureSubstrateWrapperLibrary.js',
    'flashSubstrate/flashSubstrateLibrary.js',
    'flashPanel/flashSeedlingLibrary.js',
    'flashPanel/flashSeedlingGenBuild.js',
    'jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js',
    'omsiSubstrateWrapper/omsiSubstrateWrapperLibrary.js',
]);

/** ⛓ The worker file, relative to `frontend/modules/`. The bundler copies it. */
export const REGENERATE_WORKER_PATH = 'apworldEditor/regionRegenerateWorker.js';

/**
 * ⛓ The worker's URL — `stateManagerProxy.initializeWorker`'s rule: in bundled
 * mode `import.meta.url` points into `dist/`, so resolve against the page; the
 * worker then loads from its source location, where its imports resolve.
 */
export function resolveRegenerateWorkerUrl() {
    const isBundled = import.meta.url.includes('/dist/');
    return isBundled
        ? new URL(`./modules/${REGENERATE_WORKER_PATH}`, globalThis.location.href)
        : new URL('./regionRegenerateWorker.js', import.meta.url);
}

/**
 * ⛓⛓ **THE WORKER'S SIDE, AS A FUNCTION** (the worker file is a thin shell
 * around it, so the protocol is testable without a Worker). Loads the
 * libraries (once per worker), posts `{type: 'ready', registered, failed,
 * loadMs}`, runs the job and posts `{type: 'result', …}`:
 * `{ok: true, entry, freeItems, hostsSurplus, exitsRelinked, spec, stranded, ms}`
 * or `{ok: false, threw, freeItems, hostsSurplus, ms}`, or — a target the loaded
 * libraries do not register — `{ok: false, unavailable: true, threw, …}`.
 *
 * @param {object} args `{doc, player, region, substrate, seed, regionParams,
 *   hazardOpts, size, freeItems}`
 * @param {{post: Function, loadLibraries: Function, regenerate: Function,
 *   now?: Function}} io
 */
export async function runRegenerateJob(args, { post, loadLibraries, regenerate, now = () => performance.now() }) {
    const t0 = now();
    const { registered, failed } = await loadLibraries();
    post({ type: 'ready', registered, failed, loadMs: now() - t0 });
    const t1 = now();
    if (!registered.includes(args.substrate)) {
        post({
            type: 'result', ok: false, unavailable: true, freeItems: [], hostsSurplus: false, ms: 0,
            threw: `the worker has no \`${args.substrate}\` — its libraries registered `
                + `[${registered.join(', ')}]${failed.length ? `; ${failed.map((f) => `${f.library} refused to load `
                + `(${f.error})`).join('; ')}` : ''}`,
        });
        return;
    }
    let res;
    try {
        res = regenerate(args);
    } catch (e) {
        // ⛓ `regenerateRegionEntry` answers a realiser throw itself; a throw that
        //   escapes it is a defect of the op's own code, reported as the realiser's.
        res = { ok: false, threw: String(e?.message ?? e), freeItems: [], hostsSurplus: false };
    }
    post({ type: 'result', ...res, ms: now() - t1 });
}

/**
 * ⛓⛓⛓ **THE PAGE'S SIDE** — start a worker, hand it one job, and answer ONE
 * outcome: the worker's result; `{ok: false, timedOut: true, ms, budgetMs}`
 * when the budget runs out; `{ok: false, cancelled: true, ms}` on `cancel()`;
 * `{ok: false, workerFailed: true, threw}` when the worker errors. On every
 * outcome but a result the worker is `terminate()`d, and after ANY outcome a
 * late message is ignored.
 *
 * ⛓ While the libraries load (`phase` `loading`) the bound is
 * `max(budget, REGION_GENERATION_LOAD_BOUND_MS)`; when the worker says `ready`
 * the clock RESTARTS at the budget for the realiser (`phase` `running`,
 * `startedAt` moved) — so the setting bounds the realiser, not the cold start
 * (measured ≈1.2 s for the eight libraries, plan §10 R2 task 0).
 *
 * @param {object} args the job (`runRegenerateJob`'s)
 * @param {{timeoutMs: number, createWorker?: Function, now?: Function,
 *   setTimer?: Function, clearTimer?: Function, onPhase?: Function}} opts
 * @returns {{promise: Promise<object>, cancel: Function, phase: Function,
 *   startedAt: Function, budgetMs: number, late: Function, terminated: Function}}
 */
export function runRegenerateInWorker(args, {
    timeoutMs,
    createWorker = () => new Worker(resolveRegenerateWorkerUrl(), { type: 'module' }),
    now = () => performance.now(),
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (t) => clearTimeout(t),
    onPhase = () => {},
    loadBoundMs = REGION_GENERATION_LOAD_BOUND_MS,
} = {}) {
    const budgetMs = timeoutMs;
    let phase = 'loading';
    let startedAt = now();
    const pressedAt = startedAt;
    let worker = null;
    let timer = null;
    let settle = null;
    let settled = false;
    let late = 0;
    let terminated = false;
    const promise = new Promise((resolve) => { settle = resolve; });
    const finish = (outcome, { kill }) => {
        if (settled) return;
        settled = true;
        if (timer !== null) clearTimer(timer);
        timer = null;
        if (kill && worker) {
            worker.terminate();
            terminated = true;
        }
        worker = null;
        phase = 'done';
        settle(outcome);
    };
    const arm = (ms) => {
        if (timer !== null) clearTimer(timer);
        timer = setTimer(() => finish({
            ok: false, timedOut: true, phase, ms: now() - startedAt, budgetMs: ms,
        }, { kill: true }), ms);
    };
    try {
        worker = createWorker();
    } catch (e) {
        finish({ ok: false, workerFailed: true, threw: String(e?.message ?? e), ms: 0 }, { kill: false });
        return {
            promise, cancel: () => {}, phase: () => phase, startedAt: () => startedAt, budgetMs,
            late: () => late, terminated: () => terminated,
        };
    }
    worker.onmessage = (ev) => {
        if (settled) {
            late += 1;
            return;
        }
        const msg = ev?.data ?? {};
        if (msg.type === 'ready') {
            phase = 'running';
            startedAt = now();
            onPhase(phase, msg);
            arm(budgetMs);
        } else if (msg.type === 'result') {
            const { type, ...res } = msg;
            finish({ ...res, loadMs: startedAt - pressedAt }, { kill: true });
        }
    };
    worker.onerror = (ev) => {
        finish({
            ok: false, workerFailed: true, ms: now() - startedAt,
            threw: `${REGION_GENERATION_WORKER_FAILED}: ${ev?.message ?? 'unknown error'}`
                + `${ev?.filename ? ` (${ev.filename}:${ev.lineno})` : ''}`,
        }, { kill: true });
    };
    arm(Math.max(budgetMs, loadBoundMs));
    worker.postMessage({ type: 'run', args });
    return {
        promise,
        cancel: () => finish({ ok: false, cancelled: true, phase, ms: now() - startedAt }, { kill: true }),
        phase: () => phase,
        startedAt: () => startedAt,
        budgetMs,
        /** ⛓ Messages that arrived AFTER the outcome (ignored) — a row's "no second answer". */
        late: () => late,
        /** ⛓ Whether this run `terminate()`d its worker. */
        terminated: () => terminated,
    };
}
