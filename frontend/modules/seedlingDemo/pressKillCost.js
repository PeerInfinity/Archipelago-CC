/**
 * pressKillCost — ⛓⛓⛓ SEEDLING HAMMER-PHASE P1: THE SPINNER PRESS KILL'S COST, WITH NOT ONE PLAN MOVED.
 *
 * The press kill (`solverBot.execKillByPress`) asks `deriveStrike` on every tick it holds no strike and `deriveRefuge`
 * on every tick it has nowhere to stand, and each of those re-derived from scratch what the tick before had already
 * answered. Measured on C1's staging A (L40 south door → chest (880,816), the kill on `spinner@880,848`, 3,113 ticks
 * of refuge waits at `db221dc`): 90.7 % of the solve inside the kill, and of that `walkableCells` 24.4 % (asked twice
 * a tick), the forecast rebuild 18.0 %, the refuge's hammer test 16.2 % and the strike line 10.8 %.
 *
 * Four caches, each EXACT by construction (the argument is beside each one):
 *   · `solverBot.walkableCells` — memoised on everything `plannerObstacleAt` reads: the world, the live bag, the
 *     keys, the inventory, `noHazards` and the contacts, compared by VALUE (`sameValue`);
 *   · `solverBot.clearOfHammersAt` — a box the hammer line's sampled points cannot reach (outside the spinner's
 *     square grown by `hammerLength + 2`) skips `hammerHitsPlayer`, which could only have returned null;
 *   · `levelRun.spinnerForecast` — the tick before's forecast SHIFTED by one row when the live bodies are the state its
 *     row 0 predicted and every input of the spinner ctx is the value it had (`sameValue` again);
 *   · `solverBot.strikeLineBlocked` — one `collideLineSolid` per (from, to) per derivation (the run is not advanced
 *     inside one, so the query cannot change its answer).
 *
 * ⛓ THE SWITCH — `PRESS_KILL_COST`, ON. It is not a behaviour change, so it ships ON with no flip; OFF is the A/B's
 * control and the mutants' (`SEEDLING_PRESS_KILL_COST=0` for a process, or `withPressKillCost(false, fn)`). OFF, every
 * cache is bypassed and each reader computes exactly what it computed before.
 */

export const PRESS_KILL_COST = {
    enabled: globalThis.process?.env?.SEEDLING_PRESS_KILL_COST !== '0',
};
export const PRESS_KILL_COST_DEFAULT = true;

/** Run `fn` with `PRESS_KILL_COST` set to `enabled`, restoring the previous value (`withGhostSpinnerPress`'s shape). */
export function withPressKillCost(enabled, fn) {
    const was = PRESS_KILL_COST.enabled;
    PRESS_KILL_COST.enabled = enabled === true;
    const restore = () => { PRESS_KILL_COST.enabled = was; };
    try {
        const out = fn();
        if (out && typeof out.then === 'function') return out.finally(restore);
        restore();
        return out;
    } catch (e) {
        restore();
        throw e;
    }
}

/** `snapshotValue`'s answer for a value it cannot copy: a key holding one is never stored, so it never hits. */
export const UNCACHEABLE = Symbol('pressKillCost.uncacheable');

/**
 * ⛔ A KEY IS A COPY, NEVER AN ALIAS. A live bag can hand out its run's own state (`pulledRopeIdsNow` returns the rope
 * map itself), and a stored alias compares equal to the very map that moved under it. So a key is copied deep —
 * arrays, `Set`s, `Map`s and plain objects (symbol keys too) — and anything else (a class instance, a function) makes
 * the whole key `UNCACHEABLE`: identity cannot say whether such an object changed in place.
 */
export function snapshotValue(v) {
    if (v === null || typeof v !== 'object') return typeof v === 'function' ? UNCACHEABLE : v;
    if (Array.isArray(v)) {
        const out = new Array(v.length);
        for (let i = 0; i < v.length; i += 1) {
            const c = snapshotValue(v[i]);
            if (c === UNCACHEABLE) return UNCACHEABLE;
            out[i] = c;
        }
        return out;
    }
    if (v instanceof Set) {
        const out = new Set();
        for (const x of v) {
            const c = snapshotValue(x);
            if (c === UNCACHEABLE) return UNCACHEABLE;
            out.add(c);
        }
        return out.size === v.size ? out : UNCACHEABLE;
    }
    if (v instanceof Map) {
        const out = new Map();
        for (const [k, x] of v) {
            const ck = snapshotValue(k);
            const cx = snapshotValue(x);
            if (ck === UNCACHEABLE || cx === UNCACHEABLE) return UNCACHEABLE;
            out.set(ck, cx);
        }
        return out.size === v.size ? out : UNCACHEABLE;
    }
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) return UNCACHEABLE;
    const out = proto === null ? Object.create(null) : {};
    for (const k of Reflect.ownKeys(v)) {
        const d = Object.getOwnPropertyDescriptor(v, k);
        if ('get' in d) return UNCACHEABLE;
        const c = snapshotValue(d.value);
        if (c === UNCACHEABLE) return UNCACHEABLE;
        Object.defineProperty(out, k, { value: c, enumerable: d.enumerable, writable: true, configurable: true });
    }
    return out;
}

/**
 * ⛔ EQUAL BY VALUE, AND STRICTER THAN ANY READER NEEDS. Primitives by `Object.is`; arrays, `Set`s and `Map`s by size
 * and IN ORDER (a reader that stops at its first hit could answer differently over a reordered set, so a reordering is
 * a miss, never a hit); plain objects by their own enumerable string AND symbol keys (the live bag's brand is a
 * symbol); anything else (a function, a class instance) only by identity. A `false` costs a recompute; only a `true`
 * has to be right.
 */
export function sameValue(a, b) {
    if (Object.is(a, b)) return true;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a)) {
        if (!Array.isArray(b) || a.length !== b.length) return false;
        for (let i = 0; i < a.length; i += 1) if (!sameValue(a[i], b[i])) return false;
        return true;
    }
    if (a instanceof Set) {
        if (!(b instanceof Set) || a.size !== b.size) return false;
        const ib = b.values();
        for (const v of a) if (!sameValue(v, ib.next().value)) return false;
        return true;
    }
    if (a instanceof Map) {
        if (!(b instanceof Map) || a.size !== b.size) return false;
        const ib = b.entries();
        for (const [k, v] of a) {
            const [kb, vb] = ib.next().value;
            if (!sameValue(k, kb) || !sameValue(v, vb)) return false;
        }
        return true;
    }
    const pa = Object.getPrototypeOf(a);
    if ((pa !== Object.prototype && pa !== null) || Object.getPrototypeOf(b) !== pa) return false;
    const ka = Reflect.ownKeys(a);
    const kb = Reflect.ownKeys(b);
    if (ka.length !== kb.length) return false;
    for (let i = 0; i < ka.length; i += 1) {
        const k = ka[i];
        if (k !== kb[i]) return false;
        const da = Object.getOwnPropertyDescriptor(a, k);
        const db = Object.getOwnPropertyDescriptor(b, k);
        if (da.enumerable !== db.enumerable || 'get' in da || 'get' in db) return false;
        if (!sameValue(da.value, db.value)) return false;
    }
    return true;
}
