/**
 * apworldEditor/apworldBuild — **THE HUB'S EXIT TO AN .APWORLD.** Turns the
 * document being edited into a downloadable `.apworld` by running the real
 * `world_generator` package (Python) in the browser under Pyodide.
 *
 * ── HOW THE PYTHON GETS HERE ───────────────────────────────────────────
 *
 * Nothing is re-implemented in JavaScript. The worker
 * (`apworldBuildWorker.js`) loads Pyodide from its CDN, fetches each file of
 * `world_generator/` listed in `worldGeneratorFiles.json` (generated from
 * `git ls-files` by `scripts/build/world-generator-files.mjs`; a static site
 * cannot list a directory), writes them into Pyodide's filesystem and calls
 * `world_generator.apworld.build_apworld` — the same function behind
 * `python -m world_generator rules.json --apworld DIR`, so the CLI and the
 * page cannot drift. `test/test_world_generator_apworld.py` holds the package
 * to the standard library, which is all Pyodide has.
 *
 * Where `world_generator/` is served from: the REPO ROOT when the dev server
 * serves this tree (the page is `/frontend/index.html`), and the site root on
 * GitHub Pages, where `deploy-gh-pages.yml` stages a copy into the artifact
 * beside `index.html` (see `worldGeneratorBaseUrl`).
 *
 * ── COST ───────────────────────────────────────────────────────────────
 *
 * Nothing loads until the first build. Pyodide's first boot is a few
 * seconds and ~10 MB from the CDN; the worker is kept, so later builds only
 * pay for the generation (about a second for alttp, measured in node).
 */

/**
 * ⛓ Pyodide is pinned exactly. 0.28.3 (CPython 3.13) is the version the
 * generator was proved under (node, 2026-10-01: adventure and alttp built,
 * byte-identical to a native run apart from the packing stamp). Moving it is a
 * re-check, not a pointer bump.
 */
export const PYODIDE_VERSION = '0.28.3';

export function pyodideIndexUrl(version = PYODIDE_VERSION) {
    return `https://cdn.jsdelivr.net/pyodide/v${version}/full/`;
}

/** ⛓ The worker file, relative to `frontend/modules/`. */
export const BUILD_WORKER_PATH = 'apworldEditor/apworldBuildWorker.js';

/**
 * ⛓ `resolveRegenerateWorkerUrl`'s rule: in bundled mode `import.meta.url`
 * points into `dist/`, so resolve against the page; the worker then loads
 * from its source location, where its own imports resolve.
 */
export function resolveBuildWorkerUrl() {
    const isBundled = import.meta.url.includes('/dist/');
    return isBundled
        ? new URL(`./modules/${BUILD_WORKER_PATH}`, globalThis.location.href)
        : new URL('./apworldBuildWorker.js', import.meta.url);
}

/**
 * Where `world_generator/` is served, given the app page's URL. The app page
 * lives in `frontend/`; when that directory is called `frontend` the server
 * is serving the repo root and the package is its sibling, otherwise
 * `frontend/` IS the site (Pages) and the deploy put the package inside it.
 *
 *     http://localhost:8000/frontend/index.html → http://localhost:8000/world_generator/
 *     https://x.github.io/Archipelago-CC/       → https://x.github.io/Archipelago-CC/world_generator/
 */
export function worldGeneratorBaseUrl(pageHref = globalThis.location?.href) {
    const dir = new URL('./', pageHref);
    return dir.pathname.endsWith('/frontend/')
        ? new URL('../world_generator/', dir).href
        : new URL('world_generator/', dir).href;
}

/**
 * The override the build is asked for: blank means "keep the document's own
 * game name". The generator derives the directory (and so the file name)
 * from whichever name it uses.
 */
export function normaliseGameName(input) {
    const name = String(input ?? '').trim();
    return name || null;
}

let sharedWorker = null;
let nextJobId = 1;

/** The page's one build worker, created on first use. */
export function sharedBuildWorker() {
    if (!sharedWorker) sharedWorker = new Worker(resolveBuildWorkerUrl(), { type: 'module' });
    return sharedWorker;
}

/**
 * Build an `.apworld` from a rules document. Resolves to
 * `{ fileName, gameName, gameDirectory, bytes: Uint8Array, ms }`; rejects with
 * the Python error's text when the generator refuses the document.
 *
 * `onProgress(stage)` receives `'loading-python'`, `'loading-generator'`,
 * `'generating'`. The worker is shared across calls (Pyodide boots once);
 * tests pass their own.
 */
export function buildApworld(doc, {
    gameName = null,
    playerId = '1',
    onProgress = () => {},
    worker = sharedBuildWorker(),
    packageBaseUrl = worldGeneratorBaseUrl(),
} = {}) {
    const id = nextJobId++;
    return new Promise((resolve, reject) => {
        const onMessage = (event) => {
            const msg = event.data || {};
            if (msg.id !== id) return;
            if (msg.type === 'progress') {
                onProgress(msg.stage);
                return;
            }
            if (msg.type !== 'result') return;
            worker.removeEventListener('message', onMessage);
            worker.removeEventListener('error', onError);
            if (msg.ok) {
                resolve({
                    fileName: msg.fileName,
                    gameName: msg.gameName,
                    gameDirectory: msg.gameDirectory,
                    bytes: new Uint8Array(msg.bytes),
                    ms: msg.ms,
                });
            } else {
                reject(new Error(msg.error || 'apworld build failed'));
            }
        };
        const onError = (event) => {
            worker.removeEventListener('message', onMessage);
            worker.removeEventListener('error', onError);
            // A worker that failed to load is useless for the next attempt too.
            if (sharedWorker === worker) sharedWorker = null;
            reject(new Error(event?.message || 'apworld build worker failed to load'));
        };
        worker.addEventListener('message', onMessage);
        worker.addEventListener('error', onError);
        worker.postMessage({
            type: 'build',
            id,
            rulesText: JSON.stringify(doc),
            gameName: normaliseGameName(gameName),
            playerId: String(playerId ?? '1'),
            packageBaseUrl,
        });
    });
}

/** Save bytes as a file — `downloadJson`'s four DOM lines, for a zip. */
export function downloadBytes(fileName, bytes) {
    const blob = new Blob([bytes], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return { fileName, bytes: blob.size };
}
