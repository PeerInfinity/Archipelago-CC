/**
 * flashPanel/seedlingSolverEnvCarry — **THE HOST PAGE'S `?seedlingSolverEnv=` RIDES INTO THE JS RUNTIME FRAME**
 * (measurement only; ⚖ Robert 2026-11-20, "Pass them to JS too").
 *
 * The wasm runtime's solves run in the HOST page's solve worker (`jsRuntimeSolveService`'s default worker reads
 * `globalThis.location.search`), so `?seedlingSolverEnv=` on the app's URL already reaches it. The JS runtime's solves
 * run in the worker of its own frame (`seedlingDemo/jsRuntime.html` → `jsRuntimePage.js`), which reads the FRAME's
 * query. This carries the host's value into that frame's URL, so both runtimes honour the same switches.
 *
 * ⛔ VERBATIM: the value is carried as given, never parsed here, so a malformed spec is refused BY NAME by the JS
 * page's worker exactly as the wasm page's worker refuses it (`solverEnvChannel.solveWorkerUrl`, `solverEnvShim.js`).
 * ⛔ ABSENT (no param, or an empty / blank one, which the worker URL treats as absent too) → '' — the JS page's URL
 * is today's, byte for byte.
 */
import { SOLVER_ENV_PARAM } from '../seedlingDemo/solverEnvChannel.js';

/**
 * The host query (`location.search`) → the `seedlingSolverEnv=<value>` query part for the JS runtime frame's URL,
 * or '' when the host sets none.
 * @param {string|null|undefined} search
 * @returns {string}
 */
export function solverEnvPageParam(search) {
    let raw = null;
    try { raw = new URLSearchParams(search ?? '').get(SOLVER_ENV_PARAM); } catch { raw = null; }
    if (raw === null || !raw.trim()) return '';
    return `${SOLVER_ENV_PARAM}=${encodeURIComponent(raw)}`;
}
