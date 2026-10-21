/**
 * helperScript/helperScriptCore — the ONE place JavaScript calls
 * `exporter.script_api` inside a Pyodide. Shared by the worker
 * (`helperScriptWorker.js`) and the Node check
 * (`scripts/test/check-helper-script-pyodide.mjs`), so what the check proves
 * is what the page runs. No browser globals: Node imports this file.
 */

/**
 * The repo packages each operation needs on `sys.path`. `script_api` lives in
 * the exporter; only Python generation needs world_generator too.
 */
export const PACKAGES_FOR = Object.freeze({
    toHelpers: Object.freeze(['exporter']),
    toPython: Object.freeze(['exporter', 'world_generator']),
});

/**
 * Run one conversion in `py` (a Pyodide with the packages `PACKAGES_FOR[op]`
 * names importable) and return script_api's result object:
 *
 *   toHelpers  payload `{ source }`                       → `{ helpers, warnings, errors }`
 *   toPython   payload `{ helpers, rules?, playerId? }`   → `{ code, warnings, errors }`
 *
 * A conversion the script cannot make comes back in `errors`; this throws only
 * when Python itself fails (an import, a bug).
 */
export function convertInPyodide(py, op, payload) {
    if (!PACKAGES_FOR[op]) throw new Error(`unknown helper-script operation: ${op}`);
    py.globals.set('_helper_script_op', op);
    py.globals.set('_helper_script_payload', JSON.stringify(payload ?? {}));
    try {
        return JSON.parse(py.runPython(`
import json
from exporter import script_api as _script_api
_payload = json.loads(_helper_script_payload)
if _helper_script_op == 'toHelpers':
    _result = _script_api.python_to_helpers(_payload.get('source', ''))
else:
    _result = _script_api.helpers_to_python(
        _payload.get('helpers') or {},
        rules=_payload.get('rules'),
        player_id=str(_payload.get('playerId') or '1'),
    )
json.dumps(_result)
`));
    } finally {
        py.globals.delete('_helper_script_op');
        py.globals.delete('_helper_script_payload');
    }
}
