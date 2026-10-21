/**
 * helperScript/helperScript — **PYTHON ⇄ THE RULES.JSON `helpers` FORMAT, IN
 * THE PAGE.** Converts a script of Python functions to a `helpers` block and
 * back by running the exporter's real analyzer and world_generator's real
 * helper codegen (`exporter/script_api.py`) under Pyodide. Nothing is
 * re-implemented in JavaScript, so the page and an export cannot disagree.
 *
 * Shared, not a panel: the Rule Converter's Exact mode is the first caller;
 * any feature that takes a helper script uses the same service.
 *
 * ── WHAT A SCRIPT IS ───────────────────────────────────────────────────
 *
 * A helper is a top-level `def name(state, player, ...)`; extra parameters and
 * their defaults become the helper's `params` / `defaults`, and calls between
 * the script's own functions stay `{"type": "helper"}` references. The script
 * is IMPORTED to be analysed, so its top-level statements run — in this tab's
 * worker, which is the user's own code in their own page.
 *
 * ── HOW THE PYTHON GETS HERE ───────────────────────────────────────────
 *
 * `helperScriptWorker.js` boots Pyodide via `pyodideRuntime/` and fetches two
 * packages from the site: the exporter SUBSET `helperScriptFiles.json` lists
 * (`scripts/build/helper-script-files.mjs`) and, for Python generation only,
 * `world_generator/` (`apworldBuild/worldGeneratorFiles.json`). Locally both
 * are the repo-root directories; on Pages, `deploy-gh-pages.yml` stages them
 * inside the site.
 *
 * ── COST ───────────────────────────────────────────────────────────────
 *
 * Nothing loads until the first conversion: then Pyodide (a few seconds,
 * ~10 MB from the CDN) and the package files. The worker is kept; measured in
 * Node, the 36 alttp_worldgen helpers convert in ~3 s each way cold
 * (2026-10-20). Convert on demand, not per keystroke.
 */
import { sitePackageBaseUrl } from '../pyodideRuntime/pyodideRuntime.js';

/** ⛓ The worker file, relative to `frontend/modules/`. */
export const HELPER_SCRIPT_WORKER_PATH = 'helperScript/helperScriptWorker.js';

/**
 * ⛓ `resolveBuildWorkerUrl`'s rule: in bundled mode `import.meta.url` points
 * into `dist/`, so resolve against the page; the worker then loads from its
 * source location, where its own imports resolve.
 */
export function resolveHelperScriptWorkerUrl() {
    const isBundled = import.meta.url.includes('/dist/');
    return isBundled
        ? new URL(`./modules/${HELPER_SCRIPT_WORKER_PATH}`, globalThis.location.href)
        : new URL('./helperScriptWorker.js', import.meta.url);
}

let sharedWorker = null;
let nextJobId = 1;

/** The page's one helper-script worker, created on first use. */
export function sharedHelperScriptWorker() {
    if (!sharedWorker) sharedWorker = new Worker(resolveHelperScriptWorkerUrl(), { type: 'module' });
    return sharedWorker;
}

function convert(op, payload, {
    onProgress = () => {},
    worker = sharedHelperScriptWorker(),
    exporterBaseUrl = sitePackageBaseUrl('exporter'),
    worldGeneratorBaseUrl = sitePackageBaseUrl('world_generator'),
} = {}) {
    const id = nextJobId++;
    return new Promise((resolve, reject) => {
        const detach = () => {
            worker.removeEventListener('message', onMessage);
            worker.removeEventListener('error', onError);
        };
        const onMessage = (event) => {
            const msg = event.data || {};
            if (msg.id !== id) return;
            if (msg.type === 'progress') {
                onProgress(msg.stage);
                return;
            }
            if (msg.type !== 'result') return;
            detach();
            if (msg.ok) resolve({ ...msg.result, ms: msg.ms });
            else reject(new Error(msg.error || 'helper-script conversion failed'));
        };
        const onError = (event) => {
            detach();
            // A worker that failed to load is useless for the next attempt too.
            if (sharedWorker === worker) sharedWorker = null;
            reject(new Error(event?.message || 'helper-script worker failed to load'));
        };
        worker.addEventListener('message', onMessage);
        worker.addEventListener('error', onError);
        worker.postMessage({ type: 'convert', id, op, payload, exporterBaseUrl, worldGeneratorBaseUrl });
    });
}

/**
 * Python source → `{ helpers, warnings, errors, ms }`. A function the
 * analyzer cannot convert is left out of `helpers` and named in `errors`; the
 * promise rejects only when Python itself fails (loading, a bug).
 *
 * `onProgress(stage)` receives `'loading-python'`, `'loading-exporter'`,
 * `'converting'`.
 */
export function pythonToHelpers(source, options = {}) {
    return convert('toHelpers', { source: String(source ?? '') }, options);
}

/**
 * A `helpers` dict → `{ code, warnings, errors, ms }`. `rules` (a rules.json
 * document) supplies the game's option definitions; without them an option
 * reads back as a world attribute. `playerId` picks the slot in `rules`.
 *
 * `onProgress(stage)` also receives `'loading-generator'`.
 */
export function helpersToPython(helpers, { rules = null, playerId = '1', ...options } = {}) {
    return convert('toPython', { helpers: helpers ?? {}, rules, playerId: String(playerId ?? '1') }, options);
}
