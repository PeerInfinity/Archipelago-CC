/**
 * seedlingDemo/axeDodgeAskHook — ⛓ AXE_DODGE HOOK (slice `seedling-js-axe-dodge`, ⚖ the user 2026-10-11; the
 * KILLLOCK / CONTACT hooks' pattern). Fidelity's SOLVECOST D2b switch `solverBot.AXE_DODGE_ASK_PER_PREVIEW`
 * (where the AXE arm asks its `axe-dodge` deadline: once per stall length, or once per preview) settable in the
 * browser, so the page and the divergence sweep can measure it OFF vs ON without a code edit. The switch's value and
 * semantics stay fidelity's: this file only reads and sets it.
 *
 * Where the value goes: the JS runtime page (`?axeDodgeAskPerPreview=on|off`, `jsRuntimePage.js`), the panel's
 * wasm engine instance (the flashPanel setting `seedlingAxeDodgeAskPerPreview`, `flashPanel/seedlingAxeDodgeSettings.js`)
 * and every solve WORKER (its own module copy): an off-default value travels on the request as
 * `axeDodgeAskPerPreview` (a boolean), and the worker solves under it and stamps the answer and the plan. At the
 * default nothing is stamped, so the request is byte-identical to the one before the hook.
 *
 * ⚠ This module imports the solver (the switch lives there), so only a graph that already holds the model imports
 * it — never the flashPanel's static closure (the panel loads it by a computed URL, as it loads the wasm engine).
 */
import { AXE_DODGE_ASK_PER_PREVIEW } from './solverBot.js';

/**
 * The module constant's OWN default, read once at import (never restated here): the shipped value in the browser and
 * its worker; under node, whatever `SEEDLING_AXE_DODGE_ASK_PER_PREVIEW` made it (the env opt-out is node-only and its
 * workers inherit it, so a node run's default is the same on both sides).
 */
export const AXE_DODGE_ASK_PER_PREVIEW_DEFAULT = AXE_DODGE_ASK_PER_PREVIEW.enabled;

/** `on` / `off` → the switch's value; an unknown value throws, naming `what`. */
export function parseAxeDodgeAsk(value, what = 'axeDodgeAskPerPreview') {
    if (value === 'on') return true;
    if (value === 'off') return false;
    throw new Error(`axeDodgeAskHook: ${what} is "${value}"; the values are on, off`);
}

/** The inverse of `parseAxeDodgeAsk`. */
export const formatAxeDodgeAsk = (enabled) => (enabled ? 'on' : 'off');

/** Set THIS module instance's switch (null / undefined = the default). Returns the value it now holds. */
export function applyAxeDodgeAsk(enabled) {
    AXE_DODGE_ASK_PER_PREVIEW.enabled = typeof enabled === 'boolean' ? enabled : AXE_DODGE_ASK_PER_PREVIEW_DEFAULT;
    return AXE_DODGE_ASK_PER_PREVIEW.enabled;
}

/**
 * The stamp a solve request carries: this instance's value when it is OFF-default, else null (nothing is stamped,
 * so a default request is byte-identical to the one before the hook).
 */
export function axeDodgeAskStamp() {
    return AXE_DODGE_ASK_PER_PREVIEW.enabled === AXE_DODGE_ASK_PER_PREVIEW_DEFAULT ? null : AXE_DODGE_ASK_PER_PREVIEW.enabled;
}

/** Run `fn` with the switch set (null / undefined = the default), then restore it (also on a throw; after a promise). */
export function withAxeDodgeAsk(enabled, fn) {
    const before = AXE_DODGE_ASK_PER_PREVIEW.enabled;
    applyAxeDodgeAsk(enabled);
    let out;
    try {
        out = fn();
    } catch (e) {
        AXE_DODGE_ASK_PER_PREVIEW.enabled = before;
        throw e;
    }
    if (out && typeof out.then === 'function') return out.finally(() => { AXE_DODGE_ASK_PER_PREVIEW.enabled = before; });
    AXE_DODGE_ASK_PER_PREVIEW.enabled = before;
    return out;
}
