/**
 * seedlingDemo/dashShapeHook — ⛓ DASH-SHAPE STAMP (slice `seedling-js-dash-shape-stamp`, ⚖ the user 2026-10-16:
 * *"Prepare the flip"*; the DASH-ONLY WINDOW hook's pattern, `dashOnlyWindowHook.js`). Hammer's three SEEDLING DB
 * switches in `solverBot.js` (`DASH_LEG_PRECHECK`, `DASH_NO_SWING_PREFIX`, `DASH_KEEP_PARTIAL`) settable from the
 * browser, so the page and the divergence sweep can run them ON without a code edit. Their values and semantics stay
 * solverBot's: this file only reads them, and sets them ONLY through solverBot's own `with…(enabled, fn)` scopes.
 *
 * The stamp is ONE field, `dashShape: { legPrecheck?, noSwingPrefix?, keepPartial? }` (booleans), holding only the
 * OFF-default keys; at the defaults nothing is stamped, so the request is byte-identical to the one before the hook.
 * Only the off-default keys, not all three: an absent key IS the default where the request is solved (the worker
 * inherits the same env as its page), and a request that names one switch says which one moved.
 *
 * Where the value goes: the JS runtime page (`?dashShape=<spec>`, `jsRuntimePage.js`), the panel's wasm engine
 * instance (the flashPanel settings `seedlingDash{LegPrecheck,NoSwingPrefix,KeepPartial}`,
 * `flashPanel/seedlingDashShapeSettings.js`) and every solve WORKER (its own module copy): the worker solves inside
 * the three `with…` scopes and stamps the answer and the plan with the shape its switches READ.
 *
 * ⚠ This module imports the solver (the switches live there), so only a graph that already holds the model imports
 * it, as `axeDodgeAskHook.js` does — never the flashPanel's static closure.
 */
import {
    DASH_LEG_PRECHECK, DASH_NO_SWING_PREFIX, DASH_KEEP_PARTIAL,
    withDashLegPrecheck, withDashNoSwingPrefix, withDashKeepPartial,
} from './solverBot.js';

/** Each stamp key → solverBot's switch and its scope. */
const SWITCHES = Object.freeze({
    legPrecheck: { sw: DASH_LEG_PRECHECK, with: withDashLegPrecheck },
    noSwingPrefix: { sw: DASH_NO_SWING_PREFIX, with: withDashNoSwingPrefix },
    keepPartial: { sw: DASH_KEEP_PARTIAL, with: withDashKeepPartial },
});

/** The stamp's keys, in their one canonical order. */
export const DASH_SHAPE_KEYS = Object.freeze(Object.keys(SWITCHES));

/**
 * The switches' OWN defaults, read once at import (never restated). Since the dash flip (2026-10-16): legPrecheck and
 * keepPartial ON, noSwingPrefix OFF, in the browser and its worker; under node, whatever `SEEDLING_<NAME>=0|1` made
 * them (the workers inherit the env, so both sides share one default).
 */
export const DASH_SHAPE_DEFAULTS = Object.freeze(Object.fromEntries(DASH_SHAPE_KEYS.map((k) => [k, SWITCHES[k].sw.enabled])));

/** What THIS instance's solverBot switches hold right now (all three keys). */
export const dashShapeRead = () => Object.fromEntries(DASH_SHAPE_KEYS.map((k) => [k, SWITCHES[k].sw.enabled]));

/** The keys of `shape` that differ from the defaults (a partial shape; absent keys are the defaults). */
export const offDefaultDashShape = (shape = {}) => Object.fromEntries(DASH_SHAPE_KEYS
    .filter((k) => typeof shape[k] === 'boolean' && shape[k] !== DASH_SHAPE_DEFAULTS[k]).map((k) => [k, shape[k]]));

/** A partial shape, checked: known keys only, boolean values only. Throws naming `what`. */
export function normalizeDashShape(shape, what = 'dashShape') {
    if (!shape || typeof shape !== 'object' || Array.isArray(shape)) throw new Error(`dashShapeHook: ${what} is not an object`);
    const out = {};
    for (const [k, v] of Object.entries(shape)) {
        if (!DASH_SHAPE_KEYS.includes(k)) throw new Error(`dashShapeHook: ${what} has the unknown key "${k}"; the keys are ${DASH_SHAPE_KEYS.join(', ')}`);
        if (typeof v !== 'boolean') throw new Error(`dashShapeHook: ${what}.${k} is ${JSON.stringify(v)}; it must be a boolean`);
        out[k] = v;
    }
    return Object.fromEntries(DASH_SHAPE_KEYS.filter((k) => k in out).map((k) => [k, out[k]]));
}

/**
 * A spec → a partial shape. The spec is a comma list of `<key>:on|off` (a bare `<key>` = on), or `all` (all three
 * on). Empty → `{}`. Anything else throws, naming `what`. Shared by the page's `?dashShape=` and the sweep's
 * `--dash-shape`.
 */
export function parseDashShape(spec, what = 'dashShape') {
    const s = String(spec ?? '').trim();
    if (!s) return {};
    if (s === 'all') return Object.fromEntries(DASH_SHAPE_KEYS.map((k) => [k, true]));
    const out = {};
    for (const part of s.split(',').map((p) => p.trim()).filter(Boolean)) {
        const [k, v = 'on', extra] = part.split(':');
        if (extra !== undefined || !DASH_SHAPE_KEYS.includes(k) || (v !== 'on' && v !== 'off')) {
            throw new Error(`dashShapeHook: ${what} "${s}" has "${part}"; the spec is a comma list of <key>:on|off `
                + `(keys ${DASH_SHAPE_KEYS.join(', ')}), or all`);
        }
        if (k in out) throw new Error(`dashShapeHook: ${what} "${s}" names ${k} twice`);
        out[k] = v === 'on';
    }
    return normalizeDashShape(out, what);
}

/** A partial shape → its canonical spec (keys in `DASH_SHAPE_KEYS` order; `{}` → ''). The inverse of `parseDashShape`. */
export const formatDashShape = (shape = {}) => DASH_SHAPE_KEYS
    .filter((k) => typeof shape[k] === 'boolean').map((k) => `${k}:${shape[k] ? 'on' : 'off'}`).join(',');

/** THIS instance's chosen values (null = the switch's default): set by the page and the engine, read by the stamp. */
const CHOSEN = Object.fromEntries(DASH_SHAPE_KEYS.map((k) => [k, null]));

/**
 * Choose THIS module instance's shape (a partial shape; absent / null keys = the default). The solverBot switches are
 * not touched here: a solve runs under the choice through the request's stamp (`withDashShape`). Returns the
 * effective shape (all three keys).
 */
export function applyDashShape(shape = {}) {
    const s = normalizeDashShape(Object.fromEntries(Object.entries(shape ?? {}).filter(([, v]) => v !== null && v !== undefined)));
    for (const k of DASH_SHAPE_KEYS) CHOSEN[k] = k in s ? s[k] : null;
    return dashShapeEffective();
}

/** This instance's effective shape: the chosen value, else what its switch holds. */
export const dashShapeEffective = () => Object.fromEntries(DASH_SHAPE_KEYS.map((k) => [k, CHOSEN[k] ?? SWITCHES[k].sw.enabled]));

/** The stamp a solve request carries: this instance's off-default keys, else null (nothing is stamped). */
export function dashShapeStamp() {
    const off = offDefaultDashShape(dashShapeEffective());
    return Object.keys(off).length ? off : null;
}

/**
 * Run `fn` inside solverBot's three scopes, each set from `shape` (a partial shape; an absent key = that switch's
 * DEFAULT, so a stamp of one key runs the other two at theirs). solverBot's scopes restore on a throw and after a
 * promise.
 */
export function withDashShape(shape, fn) {
    const s = normalizeDashShape(shape ?? {});
    return DASH_SHAPE_KEYS.reduceRight((inner, k) => () => SWITCHES[k].with(k in s ? s[k] : DASH_SHAPE_DEFAULTS[k], inner), fn)();
}
