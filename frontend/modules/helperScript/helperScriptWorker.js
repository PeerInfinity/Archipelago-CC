/**
 * helperScript/helperScriptWorker — runs `exporter.script_api` under Pyodide
 * (see `helperScript.js` for the why). One Pyodide per worker, booted on the
 * first conversion and kept (`pyodideRuntime/`); each package is fetched the
 * first time an operation needs it.
 *
 * In:  `{ type: 'convert', id, op: 'toHelpers'|'toPython', payload,
 *         exporterBaseUrl, worldGeneratorBaseUrl }`
 * Out: `{ type: 'progress', id, stage }`, then
 *      `{ type: 'result', id, ok: true, result, ms }` (result: script_api's object)
 *      or `{ type: 'result', id, ok: false, error }`.
 */
import { getPyodide, loadPackage, pythonErrorSummary } from '../pyodideRuntime/pyodideRuntime.js';
import { PACKAGES_FOR, convertInPyodide } from './helperScriptCore.js';

const PACKAGES = {
    exporter: {
        manifestUrl: new URL('./helperScriptFiles.json', import.meta.url),
        baseUrlKey: 'exporterBaseUrl',
        stage: 'loading-exporter',
    },
    world_generator: {
        manifestUrl: new URL('../apworldBuild/worldGeneratorFiles.json', import.meta.url),
        baseUrlKey: 'worldGeneratorBaseUrl',
        stage: 'loading-generator',
    },
};

async function convert(msg) {
    const started = performance.now();
    const post = stage => self.postMessage({ type: 'progress', id: msg.id, stage });
    const py = await getPyodide(post);
    for (const name of PACKAGES_FOR[msg.op] ?? []) {
        const pkg = PACKAGES[name];
        await loadPackage(py, {
            manifestUrl: pkg.manifestUrl,
            packageBaseUrl: msg[pkg.baseUrlKey],
            stage: pkg.stage,
        }, post);
    }
    post('converting');
    const result = convertInPyodide(py, msg.op, msg.payload);
    self.postMessage({
        type: 'result',
        id: msg.id,
        ok: true,
        result,
        ms: Math.round(performance.now() - started),
    });
}

// Conversions run one at a time: they share one interpreter.
let queue = Promise.resolve();
self.addEventListener('message', (event) => {
    const msg = event.data || {};
    if (msg.type !== 'convert') return;
    queue = queue.then(() => convert(msg)).catch((err) => {
        console.error('[helperScriptWorker]', String(err?.message ?? err));
        self.postMessage({ type: 'result', id: msg.id, ok: false, error: pythonErrorSummary(err) });
    });
});
