/**
 * seedlingDemo/dashOnlyWindowHook — ⛓ DASH-ONLY WINDOW (slice `seedling-js-dash-window`, ⚖ the user 2026-10-16:
 * hammer's dash economics (DS) → *"Build the best shape, OFF"*; the AXE_DODGE hook's pattern, `axeDodgeAskHook.js`).
 * The switch `DASH_ONLY_WINDOW` changes what the full pass's UPGRADE WINDOW counts (`jsRuntimeSolver.passShouldStop`):
 *
 *   OFF — ⛓ WINDOW WHOLE PASS exactly (⚖ 2026-10-06, *"Yes, stop the whole pass"*): with a plan in
 *       hand, EVERY site of the full pass trips once the attempt has spent the window's units.
 *   ON (the default since the dash flip, ⚖ the user 2026-10-16: *"Prepare the flip"*) — DS's shape (c): the window counts only the full pass's `sword-dash` asks (one dash preview = one unit) and
 *       trips only there; every other site of the full pass runs on the whole budget, as the dashless pass does. The
 *       budget still counts every ask. It partly reverses WINDOW WHOLE PASS, so the flip is the user's call.
 *
 * Where the value goes: the JS runtime page (`?dashOnlyWindow=on|off`, `jsRuntimePage.js`), the panel's wasm engine
 * instance (the flashPanel setting `seedlingDashOnlyWindow`, `flashPanel/seedlingDashOnlyWindowSettings.js`) and
 * every solve WORKER (its own module copy): an off-default value travels on the request as `dashOnlyWindow` (a
 * boolean), the worker solves under it and stamps the answer and the plan with the value it READ. At the default
 * nothing is stamped, so the request is byte-identical to the one before the hook.
 *
 * ⛔ No import: the switch lives here (it is the JS arc's, not the model's), so the solver, the worker and the
 * panel's static closure can all import it. Keep-partial (`planSwordDash` keeping the windows a trip had accepted) is
 * the solver's own switch, not this one; this switch works with it on, off or absent.
 */

/**
 * THE SWITCH. ⛓ dash flip (the user, 2026-10-16: *"Prepare the flip"*): ON by default, in the browser and its worker
 * (no env read there); under node `SEEDLING_DASH_ONLY_WINDOW=0` turns the default OFF for a producer run (its workers
 * inherit the env, so both sides share one default).
 */
export const DASH_ONLY_WINDOW = { enabled: globalThis.process?.env?.SEEDLING_DASH_ONLY_WINDOW !== '0' };

/** The switch's OWN default, read once at import (never restated). */
export const DASH_ONLY_WINDOW_DEFAULT = DASH_ONLY_WINDOW.enabled;

/** `on` / `off` → the switch's value; an unknown value throws, naming `what`. */
export function parseDashOnlyWindow(value, what = 'dashOnlyWindow') {
    if (value === 'on') return true;
    if (value === 'off') return false;
    throw new Error(`dashOnlyWindowHook: ${what} is "${value}"; the values are on, off`);
}

/** The inverse of `parseDashOnlyWindow`. */
export const formatDashOnlyWindow = (enabled) => (enabled ? 'on' : 'off');

/** Set THIS module instance's switch (null / undefined = the default). Returns the value it now holds. */
export function applyDashOnlyWindow(enabled) {
    DASH_ONLY_WINDOW.enabled = typeof enabled === 'boolean' ? enabled : DASH_ONLY_WINDOW_DEFAULT;
    return DASH_ONLY_WINDOW.enabled;
}

/**
 * The stamp a solve request carries: this instance's value when it is OFF-default, else null (nothing is stamped,
 * so a default request is byte-identical to the one before the hook).
 */
export function dashOnlyWindowStamp() {
    return DASH_ONLY_WINDOW.enabled === DASH_ONLY_WINDOW_DEFAULT ? null : DASH_ONLY_WINDOW.enabled;
}

/** Run `fn` with the switch set (null / undefined = the default), then restore it (also on a throw; after a promise). */
export function withDashOnlyWindow(enabled, fn) {
    const before = DASH_ONLY_WINDOW.enabled;
    applyDashOnlyWindow(enabled);
    let out;
    try {
        out = fn();
    } catch (e) {
        DASH_ONLY_WINDOW.enabled = before;
        throw e;
    }
    if (out && typeof out.then === 'function') return out.finally(() => { DASH_ONLY_WINDOW.enabled = before; });
    DASH_ONLY_WINDOW.enabled = before;
    return out;
}
