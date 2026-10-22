/**
 * apworldBuild/apworldBuildWorker — runs `world_generator` under Pyodide
 * (see `apworldBuild.js` for the why). One Pyodide per worker, booted on the
 * first build and kept (`pyodideRuntime/`).
 *
 * In:  `{ type: 'build', id, rulesText, gameName, playerId, packageBaseUrl }`
 * Out: `{ type: 'progress', id, stage }`, then
 *      `{ type: 'result', id, ok: true, fileName, gameName, gameDirectory, bytes, ms }`
 *      (bytes: a transferred ArrayBuffer) or `{ type: 'result', id, ok: false, error }`.
 */
import { getPyodide, loadPackage, pythonErrorSummary } from '../pyodideRuntime/pyodideRuntime.js';

const WORK_DIR = '/home/pyodide/apworld-build/job';
const MANIFEST_URL = new URL('./worldGeneratorFiles.json', import.meta.url);

async function build(msg) {
    const started = performance.now();
    const post = stage => self.postMessage({ type: 'progress', id: msg.id, stage });
    const py = await getPyodide(post);
    await loadPackage(py, { manifestUrl: MANIFEST_URL, packageBaseUrl: msg.packageBaseUrl, stage: 'loading-generator' }, post);

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
        console.error('[apworldBuildWorker]', String(err?.message ?? err));
        self.postMessage({ type: 'result', id: msg.id, ok: false, error: pythonErrorSummary(err) });
    });
});
