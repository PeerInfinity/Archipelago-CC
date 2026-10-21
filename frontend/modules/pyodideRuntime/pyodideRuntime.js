/**
 * pyodideRuntime/pyodideRuntime — **RUNNING THIS REPO'S PYTHON IN THE PAGE.**
 * The shared half of every feature that runs a repo package under Pyodide
 * instead of re-implementing it in JavaScript:
 *
 *   - apworldBuild/  — `world_generator` (rules.json → .apworld)
 *   - helperScript/  — `exporter.script_api` + `world_generator`
 *                      (Python ⇄ the rules.json `helpers` format)
 *
 * The page half (`pyodideIndexUrl`, `sitePackageBaseUrl`) says where things
 * are served; the worker half (`getPyodide`, `loadPackage`) boots one Pyodide
 * per worker and writes a package's files into its filesystem.
 *
 * ── HOW A PACKAGE GETS HERE ────────────────────────────────────────────
 *
 * A static site cannot list a directory, so each package ships a manifest —
 * `{ package, files: [paths relative to the package] }`, generated from
 * `git ls-files` by a `scripts/build/*-files.mjs` script and held fresh by a
 * vitest. The worker fetches every listed file from the package's base URL
 * and writes it under `PACKAGE_ROOT/<package>/`.
 *
 * Where a package is served from: the REPO ROOT when the dev server serves
 * this tree (the page is `/frontend/index.html`), and the site root on GitHub
 * Pages, where `deploy-gh-pages.yml` stages a copy into the artifact beside
 * `index.html` (see `sitePackageBaseUrl`).
 *
 * ── COST ───────────────────────────────────────────────────────────────
 *
 * Nothing loads until first use. Pyodide's first boot is a few seconds and
 * ~10 MB from the CDN; a worker keeps its interpreter, so later jobs pay only
 * for the work.
 */

/**
 * ⛓ Pyodide is pinned exactly. 0.28.3 (CPython 3.13) is the version both
 * packages were proved under (node: world_generator 2026-10-01 — adventure and
 * alttp built byte-identical to a native run apart from the packing stamp;
 * exporter.script_api 2026-10-20 — the alttp_worldgen helpers round trip
 * identical). Moving it is a re-check of both, not a pointer bump. ⚠ CPython
 * 3.14 removes `ast.Str`, which the exporter analyzer still uses.
 */
export const PYODIDE_VERSION = '0.28.3';

export function pyodideIndexUrl(version = PYODIDE_VERSION) {
    return `https://cdn.jsdelivr.net/pyodide/v${version}/full/`;
}

/**
 * Where a repo-root package directory is served, given the app page's URL.
 * The app page lives in `frontend/`; when that directory is called `frontend`
 * the server is serving the repo root and the package is its sibling,
 * otherwise `frontend/` IS the site (Pages) and the deploy put the package
 * inside it.
 *
 *     http://localhost:8000/frontend/index.html → http://localhost:8000/<dir>/
 *     https://x.github.io/Archipelago-CC/       → https://x.github.io/Archipelago-CC/<dir>/
 */
export function sitePackageBaseUrl(packageDir, pageHref = globalThis.location?.href) {
    const dir = new URL('./', pageHref);
    return dir.pathname.endsWith('/frontend/')
        ? new URL(`../${packageDir}/`, dir).href
        : new URL(`${packageDir}/`, dir).href;
}

// ── Worker half ──────────────────────────────────────────────────────────

/** Where packages are written in Pyodide's filesystem (on `sys.path`). */
export const PACKAGE_ROOT = '/home/pyodide/repo-packages/lib';

let pyodidePromise = null;
/** manifest URL → the base URL its package was last loaded from. */
const loadedFrom = new Map();

/**
 * This realm's one Pyodide, booted on first call. `onStage('loading-python')`
 * fires only when this call starts the boot. A failed boot is forgotten, so
 * the next call retries.
 */
export function getPyodide(onStage = () => {}) {
    if (!pyodidePromise) {
        onStage('loading-python');
        pyodidePromise = (async () => {
            const indexURL = pyodideIndexUrl();
            const { loadPyodide } = await import(`${indexURL}pyodide.mjs`);
            return loadPyodide({ indexURL });
        })();
        pyodidePromise.catch(() => { pyodidePromise = null; });
    }
    return pyodidePromise;
}

/**
 * Fetch the files `manifestUrl` lists from `packageBaseUrl` and write them
 * under `PACKAGE_ROOT/<manifest.package>/`. A no-op (no fetch at all) when
 * that manifest was already loaded from the same base; a reload from a different base drops
 * the package's modules first, so stale code never runs.
 * `onStage(stage)` fires before the fetch.
 */
export async function loadPackage(py, { manifestUrl, packageBaseUrl, stage = 'loading-package' }, onStage = () => {}) {
    const key = String(manifestUrl);
    if (loadedFrom.get(key) === packageBaseUrl) return;
    onStage(stage);
    const manifestResponse = await fetch(manifestUrl);
    if (!manifestResponse.ok) throw new Error(`${manifestUrl}: HTTP ${manifestResponse.status}`);
    const manifest = await manifestResponse.json();
    const name = manifest.package;
    const files = await Promise.all(manifest.files.map(async (rel) => {
        const url = new URL(rel, packageBaseUrl);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
        return [rel, new Uint8Array(await response.arrayBuffer())];
    }));
    const pkgDir = `${PACKAGE_ROOT}/${name}`;
    for (const [rel, data] of files) {
        const target = `${pkgDir}/${rel}`;
        py.FS.mkdirTree(target.slice(0, target.lastIndexOf('/')));
        py.FS.writeFile(target, data);
    }
    py.runPython(`
import sys
for _name in [m for m in sys.modules if m == ${JSON.stringify(name)} or m.startswith(${JSON.stringify(`${name}.`)})]:
    del sys.modules[_name]
if ${JSON.stringify(PACKAGE_ROOT)} not in sys.path:
    sys.path.insert(0, ${JSON.stringify(PACKAGE_ROOT)})
`);
    loadedFrom.set(key, packageBaseUrl);
}

/**
 * The line of a Python error a person can act on. A PythonError's message
 * carries the whole traceback; the last line is the exception itself.
 */
export function pythonErrorSummary(err) {
    const lines = String(err?.message ?? err).trim().split('\n');
    return lines[lines.length - 1];
}
