/**
 * apworldBuild/apworldBuildWorker — runs `world_generator` under Pyodide
 * (see `apworldBuild.js` for the why). One Pyodide per worker, booted on the
 * first build and kept.
 *
 * In:  `{ type: 'build', id, rulesText, gameName, playerId, packageBaseUrl }`
 * Out: `{ type: 'progress', id, stage }`, then
 *      `{ type: 'result', id, ok: true, fileName, gameName, gameDirectory, bytes, ms }`
 *      (bytes: a transferred ArrayBuffer) or `{ type: 'result', id, ok: false, error }`.
 */
import { pyodideIndexUrl } from './apworldBuild.js';

const PACKAGE_ROOT = '/home/pyodide/apworld-build/lib';
const WORK_DIR = '/home/pyodide/apworld-build/job';

let pyodidePromise = null;
let loadedFrom = null;

async function getPyodide(post) {
    if (!pyodidePromise) {
        post('loading-python');
        pyodidePromise = (async () => {
            const indexURL = pyodideIndexUrl();
            const { loadPyodide } = await import(`${indexURL}pyodide.mjs`);
            return loadPyodide({ indexURL });
        })();
        pyodidePromise.catch(() => { pyodidePromise = null; });
    }
    return pyodidePromise;
}

async function loadPackage(py, packageBaseUrl, post) {
    if (loadedFrom === packageBaseUrl) return;
    post('loading-generator');
    const manifestUrl = new URL('./worldGeneratorFiles.json', import.meta.url);
    const manifestResponse = await fetch(manifestUrl);
    if (!manifestResponse.ok) throw new Error(`${manifestUrl}: HTTP ${manifestResponse.status}`);
    const manifest = await manifestResponse.json();
    const files = await Promise.all(manifest.files.map(async (rel) => {
        const url = new URL(rel, packageBaseUrl);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
        return [rel, new Uint8Array(await response.arrayBuffer())];
    }));
    const pkgDir = `${PACKAGE_ROOT}/${manifest.package}`;
    for (const [rel, data] of files) {
        const target = `${pkgDir}/${rel}`;
        py.FS.mkdirTree(target.slice(0, target.lastIndexOf('/')));
        py.FS.writeFile(target, data);
    }
    // A reload from a different base must not run stale modules.
    py.runPython(`
import sys
for _name in [m for m in sys.modules if m == 'world_generator' or m.startswith('world_generator.')]:
    del sys.modules[_name]
if ${JSON.stringify(PACKAGE_ROOT)} not in sys.path:
    sys.path.insert(0, ${JSON.stringify(PACKAGE_ROOT)})
`);
    loadedFrom = packageBaseUrl;
}

async function build(msg) {
    const started = performance.now();
    const post = stage => self.postMessage({ type: 'progress', id: msg.id, stage });
    const py = await getPyodide(post);
    await loadPackage(py, msg.packageBaseUrl, post);

    post('generating');
    py.FS.mkdirTree(WORK_DIR);
    py.FS.writeFile(`${WORK_DIR}/rules.json`, msg.rulesText);
    py.globals.set('_apworld_game_name', msg.gameName ?? null);
    py.globals.set('_apworld_player_id', msg.playerId ?? '1');
    const meta = JSON.parse(py.runPython(`
import json
from world_generator.apworld import build_apworld
_built = build_apworld(${JSON.stringify(`${WORK_DIR}/rules.json`)},
                       game_name=_apworld_game_name, player_id=_apworld_player_id)
with open(${JSON.stringify(`${WORK_DIR}/out.apworld`)}, 'wb') as _f:
    _f.write(_built['data'])
json.dumps({k: v for k, v in _built.items() if k != 'data'})
`));
    const bytes = py.FS.readFile(`${WORK_DIR}/out.apworld`);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    self.postMessage({
        type: 'result',
        id: msg.id,
        ok: true,
        fileName: meta.file_name,
        gameName: meta.game_name,
        gameDirectory: meta.game_directory,
        bytes: buffer,
        ms: Math.round(performance.now() - started),
    }, [buffer]);
}

// Builds run one at a time: they share one interpreter and one work dir.
let queue = Promise.resolve();
self.addEventListener('message', (event) => {
    const msg = event.data || {};
    if (msg.type !== 'build') return;
    queue = queue.then(() => build(msg)).catch((err) => {
        // A PythonError's message carries the whole traceback; the last line
        // is the one a person can act on, the rest goes to the console.
        const text = String(err?.message ?? err);
        console.error('[apworldBuildWorker]', text);
        const lines = text.trim().split('\n');
        self.postMessage({ type: 'result', id: msg.id, ok: false, error: lines[lines.length - 1] });
    });
});
