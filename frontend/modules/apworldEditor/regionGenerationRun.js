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
 * ⛓ The worker starts with an EMPTY registry. It imports the substrate
 * libraries itself (`REGENERATE_WORKER_LIBRARIES` — the one list,
 * `procgenCore/substrateLibraries.js`, that the docs generator and the
 * pipeline drivers read too), then `regionRegenerate.js`. A library that refuses to
 * load is REPORTED, and a target none of the loaded ones registers is answered
 * by name — the list of what the worker can generate is derived, not typed.
 *
 * ⛔ No DOM here and no substrate named: this module is imported by the panel,
 * by the worker, and by node rows alike.
 */

import { SUBSTRATE_LIBRARIES } from '../procgenCore/substrateLibraries.js';

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

/* ── R7: the WHOLE-SLOT budget (Initialise procgen data) ─────────────── */

/**
 * ⛓ The initialise setting's key and path (APWORLD SUBSTRATE CHANGE R7, ⚖ user
 * 2026-09-26 #3: a SEPARATE setting — the per-region limit is the wrong unit for
 * a 445-region slot, measured ≈41 s of realise as `maze`).
 */
export const INITIALISE_TIMEOUT_KEY = 'initialiseTimeoutSeconds';
export const INITIALISE_TIMEOUT_SETTING = `moduleSettings.apworldEditor.${INITIALISE_TIMEOUT_KEY}`;

/** ⛓ Five minutes for the whole slot (⚖ #3). The schema and the reader both use it. */
export const INITIALISE_TIMEOUT_DEFAULT_S = 300;

/** ⛓ The schema property `apworldEditor/index.js` registers beside R2's. */
export const INITIALISE_TIMEOUT_SCHEMA = Object.freeze({
    type: 'integer',
    minimum: 1,
    default: INITIALISE_TIMEOUT_DEFAULT_S,
    label: 'Initialise procgen data time limit (seconds)',
    description: 'How long the APWorld Editor\'s Initialise procgen data → Generate ▸ lets the WHOLE slot '
        + '(every region laid out and realised, in a worker) run before giving up. The attempt is stopped '
        + 'and nothing is recorded.',
});

/** ⛓ The initialise budget a stored value means: a whole number ≥ 1, else the default. */
export function initialiseTimeoutSeconds(value) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : INITIALISE_TIMEOUT_DEFAULT_S;
}

/**
 * ⛓⛓ **THE INITIALISE TIMEOUT SENTENCE** — the setting's name and value, and how
 * far the build got (`built N / M` from the last progress message).
 */
export function initialiseTimeoutSentence(seconds, substrate, player, progress = null) {
    const got = progress && Number.isInteger(progress.index)
        ? ` after building ${progress.index} / ${progress.total} regions` : '';
    return `apworld: initialising player ${player}'s slot as \`${substrate}\` ${REGION_GENERATION_GAVE_UP} `
        + `${seconds} s${got} — \`${INITIALISE_TIMEOUT_KEY}\` = ${seconds} (${REGION_GENERATION_TIMEOUT_WHERE}). `
        + 'The worker was stopped; nothing was recorded.';
}

/**
 * ⛓ P5d — an initialise FINISHED ON THE PAGE stopped no worker (the page cannot
 * stop a generation it started): its own timeout sentence.
 */
export function initialisePageTimeoutSentence(seconds, substrate, player, progress = null) {
    const got = progress && Number.isInteger(progress.index)
        ? ` after building ${progress.index} / ${progress.total} regions` : '';
    return `apworld: initialising player ${player}'s slot as \`${substrate}\` on this page ${REGION_GENERATION_GAVE_UP} `
        + `${seconds} s${got} — \`${INITIALISE_TIMEOUT_KEY}\` = ${seconds} (${REGION_GENERATION_TIMEOUT_WHERE}). `
        + 'Nothing was recorded; the generation already started keeps running and is cached.';
}

/** ⛓ The job kind the worker dispatches an initialise on. */
export const INITIALISE_JOB = 'initialise';

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
 * ⛓⛓ **THE LIBRARIES THE WORKER IMPORTS**, relative to `frontend/modules/` —
 * the one list every headless caller reads (`procgenCore/substrateLibraries.js`).
 */
export const REGENERATE_WORKER_LIBRARIES = SUBSTRATE_LIBRARIES;

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
 * ⛓ R7 — `regenerate(args, {progress})`: a job may post `{type: 'progress', event}`
 * messages (an initialise posts one per region) before its result.
 *
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
        // ⛓ R5c — a zone job may FETCH (the atlas intake) before it extracts, so it
        //   answers a promise; a realiser job answers synchronously, and awaiting a
        //   value is that value.
        res = await regenerate(args, { progress: (event) => post({ type: 'progress', event }) });
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
 * ⛓ R7 — a `progress` message is handed to `onProgress` (never after the outcome).
 *
 * @param {{timeoutMs: number, createWorker?: Function, now?: Function,
 *   setTimer?: Function, clearTimer?: Function, onPhase?: Function, onProgress?: Function}} opts
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
    onProgress = () => {},
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
        } else if (msg.type === 'progress') {
            // ⛓ R7 — one per region the job builds (an initialise's ticker).
            onProgress(msg.event);
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

/* ── P5c: a generation the worker cannot wait on, finished on the PAGE ─── */

/**
 * ⛓⛓ **A REALISER WHOSE GENERATION RUNS OUTSIDE JS** (cloudberry's game page)
 * yields the promise of that work and, drained synchronously, refuses: it could not
 * wait. The worker has no such generator (it lives on the page), so it answers the
 * refusal with `pendingGeneration: true`; the page then runs the same job itself
 * (`runRegenerateOnPage`), awaiting what the realiser yielded. Derived from what the
 * realiser DID, not declared: a substrate that never yields `await` is never flagged.
 *
 * @param {Function} run a synchronous job answering `{ok, …}`
 * @param {Function} collect `procgenPipelineEngine.collectPendingGenerations`
 * @returns {object} the job's answer, with `pendingGeneration: true` on a refusal that left work pending
 */
export function flagPendingGeneration(run, collect) {
    const { value, pending } = collect(run);
    return value && !value.ok && pending.length > 0 ? { ...value, pendingGeneration: true } : value;
}

/**
 * ⛓⛓ **THE WORKER'S DISPATCH** (`regionRegenerateWorker.js`; here so it is pinned
 * without a Worker): an initialise (R7) and a region regenerate are each flagged
 * when they left work pending (P5c; P5d for the initialise), so the page finishes
 * them; a ZONE source (R5b) is answered as it stands (its realise is the zone fetch).
 *
 * @param {object} args the job
 * @param {{progress?: Function, initialiseSlot: Function, zoneJobAnswer: Function,
 *   regenerateRegionEntry: Function, collect: Function, fetchJson: Function}} libs
 */
export function workerJobAnswer(args, { progress, initialiseSlot, zoneJobAnswer, regenerateRegionEntry, collect, fetchJson }) {
    if (args?.job === INITIALISE_JOB) {
        return flagPendingGeneration(() => initialiseSlot({ ...args, onProgress: progress }), collect);
    }
    return args?.source?.kind === 'zone'
        ? zoneJobAnswer(args, { fetchJson })
        : flagPendingGeneration(() => regenerateRegionEntry(args), collect);
}

/** ⛓ The refusal when the retries the bound allows still find work pending. EXPORTED for the rows. */
export const REGION_GENERATION_STILL_PENDING = 'the generation finished, but the realiser asked again still found '
    + 'work pending';

/** ⛓ P5d — the refusal when a retry yields work it ALREADY awaited (it settled, yet the realiser is still waiting on it). */
export const REGION_GENERATION_NO_PROGRESS = 'the realiser asked again yielded the same work it had already '
    + 'awaited (no progress)';

/**
 * ⛓⛓⛓ **AWAIT THE YIELDED WORK, THEN ASK AGAIN — WITHIN A NAMED BOUND.** Runs
 * `run` under `collect`; a success, or a refusal with nothing pending, is the
 * answer as it stands (a synchronous substrate: one call, its own answer). A
 * refusal with work pending awaits EXACTLY that work (the promises the realiser
 * yielded — no timer, no poll) and runs `run` again.
 *
 * **The bound** is `maxRetries` (P5c: 1 — one region's regenerate yields one
 * generation). P5d: a whole-slot Initialise stops at the FIRST region still
 * generating, so each ask finishes one more region; its bound is the slot's
 * region count (`initialisePageRetryBound`). A retry still pending once the
 * bound is spent is refused as `REGION_GENERATION_STILL_PENDING`; a retry that
 * yields a promise it ALREADY awaited is refused at once as
 * `REGION_GENERATION_NO_PROGRESS` (that work settled and the realiser did not
 * advance — never re-awaited). A generation that FAILED is the retry's own named
 * refusal (the substrate reports it; cloudberry: `CloudberryLevelRefused`, or the
 * generator's failure).
 *
 * @param {Function} run a synchronous job answering `{ok, threw?|why?, …}`
 * @param {{collect: Function, onPending?: Function, maxRetries?: number}} io
 *   `onPending(promises)` is told each time it waits
 * @returns {Promise<object>} the job's answer, `retried: true` and `retries: n` when it waited
 */
export async function regenerateAwaitingGeneration(run, { collect, onPending = () => {}, maxRetries = 1 }) {
    let res = collect(run);
    if (res.value?.ok || res.pending.length === 0) return res.value;
    const awaited = new Set();
    let retries = 0;
    const refuse = (head) => {
        const last = res.value?.threw ?? res.value?.why ?? 'none';
        const threw = `${head} (retried ${retries} of its bound ${maxRetries}); its last refusal: ${last}`;
        return { ...res.value, ok: false, retried: true, retries, stillPending: true, threw, ...(res.value && 'why' in res.value ? { why: threw } : {}) };
    };
    while (retries < maxRetries) {
        onPending(res.pending);
        for (const p of res.pending) awaited.add(p);
        // eslint-disable-next-line no-await-in-loop
        await Promise.all(res.pending);
        retries += 1;
        res = collect(run);
        if (res.value?.ok || res.pending.length === 0) return { ...res.value, retried: true, retries };
        if (res.pending.some((p) => awaited.has(p))) return refuse(REGION_GENERATION_NO_PROGRESS);
    }
    return refuse(REGION_GENERATION_STILL_PENDING);
}

/**
 * ⛓ P5d — **THE BOUND OF A WHOLE-SLOT INITIALISE FINISHED ON THE PAGE**: the
 * number of regions the slot has. Each ask realises the regions in placement
 * order and stops at the first still generating, so each awaited generation
 * moves it at least one region on; a slot of N regions needs at most N retries.
 */
export function initialisePageRetryBound(doc, player) {
    return Math.max(1, Object.keys(doc?.regions?.[String(player)] ?? {}).length);
}

/** ⛓ The Cancel and timeout sentences of a page run (the page cannot stop the generation it started). */
export const REGION_GENERATION_CANCELLED_ON_PAGE = 'generation cancelled — nothing was recorded (the generation '
    + 'already started keeps running and is cached)';
export function regionGenerationPageTimeoutSentence(seconds, substrate, region) {
    return `apworld: the \`${substrate}\` generation ${REGION_GENERATION_GAVE_UP} ${seconds} s on region `
        + `"${region}" — \`${REGION_GENERATION_TIMEOUT_KEY}\` = ${seconds} (${REGION_GENERATION_TIMEOUT_WHERE}). `
        + 'Nothing was recorded; the generation already started keeps running and is cached.';
}

/**
 * ⛓⛓⛓ **THE PAGE'S RUN** — `runRegenerateInWorker`'s handle shape, for a job the
 * worker flagged `pendingGeneration`: `regenerateAwaitingGeneration` on the page,
 * whose own registry has the generator. One outcome: the job's answer (with `ms`
 * and `onPage: true`); `{ok: false, timedOut: true, onPage: true}` when the budget
 * (the same setting) runs out while it waits; `{ok: false, cancelled: true,
 * onPage: true}` on `cancel()`. After any outcome a late answer is ignored.
 *
 * @param {object} args the job
 * @param {{timeoutMs: number, regenerate: Function, collect: Function, now?: Function,
 *   setTimer?: Function, clearTimer?: Function, onPhase?: Function, maxRetries?: number}} opts
 *   `maxRetries` = `regenerateAwaitingGeneration`'s bound (1; an initialise: `initialisePageRetryBound`)
 */
export function runRegenerateOnPage(args, {
    timeoutMs,
    regenerate,
    collect,
    now = () => performance.now(),
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (t) => clearTimeout(t),
    onPhase = () => {},
    maxRetries = 1,
} = {}) {
    let phase = 'running';
    const startedAt = now();
    let settled = false;
    let late = 0;
    let timer = null;
    let settle = null;
    const promise = new Promise((resolve) => { settle = resolve; });
    const finish = (outcome) => {
        if (settled) {
            late += 1;
            return;
        }
        settled = true;
        if (timer !== null) clearTimer(timer);
        timer = null;
        phase = 'done';
        settle({ ...outcome, onPage: true });
    };
    timer = setTimer(() => finish({ ok: false, timedOut: true, phase: 'running', ms: now() - startedAt, budgetMs: timeoutMs }),
        timeoutMs);
    onPhase(phase);
    regenerateAwaitingGeneration(() => regenerate(args), { collect, maxRetries })
        .catch((e) => ({ ok: false, threw: String(e?.message ?? e), freeItems: [], hostsSurplus: false }))
        .then((res) => finish({ ...res, ms: now() - startedAt }));
    return {
        promise,
        cancel: () => finish({ ok: false, cancelled: true, phase, ms: now() - startedAt }),
        phase: () => phase,
        startedAt: () => startedAt,
        budgetMs: timeoutMs,
        late: () => late,
        terminated: () => false,
    };
}
