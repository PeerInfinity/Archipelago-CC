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

/**
 * How often each cache answered (`hit`) or computed (`miss`) — an INSTRUMENT, read by the gate rows to prove a cache
 * was exercised (a differential over a walk that never hit would be vacuous) and by the report for its hit rates.
 * Written only with the switch ON; nothing reads it to decide anything. `resetPressKillCostCounts()` zeroes it.
 */
export const PRESS_KILL_COST_COUNTS = {
    cellsHit: 0, cellsMiss: 0,
    forecastShifted: 0, forecastCut: 0,
    hammerSkipped: 0, hammerAsked: 0,
    lineHit: 0, lineMiss: 0,
};
export function resetPressKillCostCounts() {
    for (const k of Object.keys(PRESS_KILL_COST_COUNTS)) PRESS_KILL_COST_COUNTS[k] = 0;
}

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

/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE P2 — THE STRIKE SCAN'S COST, A SIBLING SWITCH (`STRIKE_SCAN_COST`, ON).
 *
 * After P1, `previewWalk` is half of C1's staging A, and none of its cost is cacheable from here: the preview's
 * stepper and its four forecasts bind run state no reader exposes (measured: the same `run.state` and target two ticks
 * apart previewed to a different length 104 times). P2 takes the two EXACT levers left inside `deriveStrike`:
 *   · the strike LINE, carried ACROSS derivations — `run.collideLineSolid` truncates its four coordinates and reads
 *     the world's solids under `normalizeLiveOpts(liveSolidOpts())`, which is `run.liveGeometryOpts()`; so one answer
 *     per (world by identity, the bag by value, the four integers) is the answer (97 % of P1's per-derivation misses
 *     on staging A were lines an earlier derivation had asked);
 *   · the scan's REACH BOX — a (cell, tick) pair whose cell lies outside the body's rect grown by the press's reach
 *     fails `opportunityAt`'s first test, `distanceRectPoint > reach`, before anything is counted, so only the cells in
 *     that box are asked (`cellRowsOf`, `cellsInBox`), in the list's own order; the ETA floor's skip count is counted
 *     for every cell all the same (`unreachable` rides the refusal).
 *
 * ⛓ WHY A SIBLING AND NOT P1'S SWITCH: the A/B is then P2 alone (OFF is P1's head, byte for byte), and a mutant or a
 * bisection can hold P1 ON while it moves P2. ON by default — a cost change, no flip; OFF is the control
 * (`SEEDLING_STRIKE_SCAN_COST=0`, or `withStrikeScanCost(false, fn)`). OFF, both levers are bypassed and `deriveStrike`
 * scans and asks exactly what it did at P1.
 */
export const STRIKE_SCAN_COST = {
    enabled: globalThis.process?.env?.SEEDLING_STRIKE_SCAN_COST !== '0',
};
export const STRIKE_SCAN_COST_DEFAULT = true;

/** P2's instrument, `PRESS_KILL_COST_COUNTS`' shape: written only with the switch ON, read by nothing that decides. */
export const STRIKE_SCAN_COST_COUNTS = {
    lineCarried: 0, lineAsked: 0, booksOpened: 0,
    cellsBoxed: 0, cellsSkipped: 0, scansUnboxed: 0,
};
export function resetStrikeScanCostCounts() {
    for (const k of Object.keys(STRIKE_SCAN_COST_COUNTS)) STRIKE_SCAN_COST_COUNTS[k] = 0;
}

/** Run `fn` with `STRIKE_SCAN_COST` set to `enabled`, restoring the previous value (`withPressKillCost`'s shape). */
export function withStrikeScanCost(enabled, fn) {
    const was = STRIKE_SCAN_COST.enabled;
    STRIKE_SCAN_COST.enabled = enabled === true;
    const restore = () => { STRIKE_SCAN_COST.enabled = was; };
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

/**
 * ⛓ hammer-phase P2 — THE ROW INDEX OF A CELL LIST, or `null` when the list is not row-major (rows strictly increasing
 * in `y`, `x` strictly increasing within a row, every coordinate finite). `walkableCells` builds its list that way
 * (`ty` outer, `tx` inner); a list that is not is scanned whole, as before. Kept per list (`WeakMap`): P1's memo hands
 * the SAME array out until its key moves, and nothing writes to it.
 */
const CELL_ROWS = new WeakMap();

export function cellRowsOf(cells) {
    let rows = CELL_ROWS.get(cells);
    if (rows === undefined) {
        rows = cellRowsBuild(cells);
        CELL_ROWS.set(cells, rows);
    }
    return rows;
}

function cellRowsBuild(cells) {
    const ys = [];
    const starts = [];
    for (let j = 0; j < cells.length; j += 1) {
        const c = cells[j];
        if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) return null;
        const last = ys.length - 1;
        if (last < 0 || c.y !== ys[last]) {
            if (last >= 0 && !(c.y > ys[last])) return null;
            ys.push(c.y);
            starts.push(j);
        } else if (!(c.x > cells[j - 1].x)) {
            return null;
        }
    }
    starts.push(cells.length);
    return { cells, ys, starts };
}

/** Every cell with `x0 <= x <= x1` and `y0 <= y <= y1`, in the list's own order (rows top-down, each left-right). */
export function cellsInBox(rows, x0, y0, x1, y1) {
    const { cells, ys, starts } = rows;
    const out = [];
    let lo = 0;
    let hi = ys.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (ys[mid] < y0) lo = mid + 1;
        else hi = mid;
    }
    for (let r = lo; r < ys.length && ys[r] <= y1; r += 1) {
        let a = starts[r];
        let b = starts[r + 1];
        const end = b;
        while (a < b) {
            const mid = (a + b) >> 1;
            if (cells[mid].x < x0) a = mid + 1;
            else b = mid;
        }
        for (let j = a; j < end && cells[j].x <= x1; j += 1) out.push(cells[j]);
    }
    return out;
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

/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE BW — THE PRESS KILL'S WAITS SEE THE LOBBER'S BOMBS.
 *
 * Fidelity MOVINGWAIT's hand-over, measured again here: with `SEEDLING_MOVING_WAIT=1`, divergence leg 381 (L40) walks
 * to the strike cell (248,184) on `spinner@192,128` that `deriveStrike` chose at t1099 (press +54), arrives about
 * t1127 and STANDS there until the press at t1156. `bombpusher@112,128` launches `#7` at t1125 at the arriving
 * player; it explodes at (255,187) on t1156, on the player. The strike's WALK was priced against the bombs
 * (`dangerDuringTransit` reads the walk's own `spits`), but its DWELL and its TRAIN were priced against the hammers
 * only, and so was every refuge.
 *
 * ⇒ ON, the press kill's waits read the lobber the way a walk does: the run's own lobber forecast
 * (`run.spitForecast()`, the bombs aimed at the PREVIEWED player, `bombPusher.js`'s functions on copies) is stepped
 * along the previewed walk and then with the player standing where the wait stands. A blast that lands on that
 * stance is a wait the kill does not take:
 *   · `deriveStrike` skips a (cell, tick) window whose dwell or train is inside a forecast blast
 *     (`solverBot.strikeStandBlast`) — this is the arm that moves 381's t1156 hit out of the plan;
 *   · `deriveRefuge` skips a refuge whose walk or wait is (`solverBot.refugeBlast`).
 * Two more guards were built and MEASURED, and are not here: a live aim that refuses a train a blast lands on, and a
 * held strike dropped when a bomb is aimed at its stance after the derivation. Over leg 381 (both stagings) neither
 * refused once (0 of 66 asks) — the derivation's forecast already holds the stance — and alone neither removes the hit
 * (the re-derivation picks the same stance). Unmeasured behaviour is not shipped (the BW report, D1).
 *
 * ⛓ THE SWITCH — `PRESS_KILL_BOMBS`, OFF (`SEEDLING_PRESS_KILL_BOMBS=1` opts a process in, or
 * `withPressKillBombs(true, fn)`). OFF, nothing here is asked and every walk is byte-identical. It reads nothing
 * while the room holds no lobber and no bomb (`solverBot.bombsInPlay`), and the forecast is `null` while
 * `CONTACT_FIDELITY.bombPusherLive` is OFF, so ON it is inert outside the lobber's rooms too.
 *
 * ⛔ A BEHAVIOUR SWITCH IN A COST FILE, AND WHY HERE. P1/P2 above move not one plan; this one does, so it is its own
 * switch, OFF, and the P1/P2 A/B stays theirs alone. It lives in this file because of the solver's door
 * (`solverView.js`): the door re-exports only modules in `levelRun.js`'s import closure, and this file is one; a new
 * module only `solverBot` imports would be a solver-FAMILY file instead (`census-seedling-solver-surface`). The two
 * reads (`solverBot.bombsInPlay`, `solverBot.firstBlastOn`) read the run, so they live in the solver.
 * No P1/P2 cache gains an input: every read is a fresh forecast per question, never memoised (P1's ⚠ "a stored key
 * is a COPY" has nothing to copy here).
 */

export const PRESS_KILL_BOMBS = {
    enabled: globalThis.process?.env?.SEEDLING_PRESS_KILL_BOMBS === '1',
};
export const PRESS_KILL_BOMBS_DEFAULT = false;

/** Run `fn` with `PRESS_KILL_BOMBS` set to `enabled`, restoring the previous value (`withPressKillCost`'s shape). */
export function withPressKillBombs(enabled, fn) {
    const was = PRESS_KILL_BOMBS.enabled;
    PRESS_KILL_BOMBS.enabled = enabled === true;
    const restore = () => { PRESS_KILL_BOMBS.enabled = was; };
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

/**
 * How often each question was asked and refused (`*Asked` / `*Refused`) — an INSTRUMENT, written only with the
 * switch ON and read by nothing that decides (the gate rows prove an arm was exercised; the report quotes it).
 */
export const PRESS_KILL_BOMBS_COUNTS = {
    strikeAsked: 0, strikeRefused: 0,
    refugeAsked: 0, refugeRefused: 0,
};
export function resetPressKillBombsCounts() {
    for (const k of Object.keys(PRESS_KILL_BOMBS_COUNTS)) PRESS_KILL_BOMBS_COUNTS[k] = 0;
}

/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE RE — THE REFUGE'S BEST-ETA CUT (`REFUGE_ETA_CUT`, OFF).
 *
 * `deriveRefuge` previews its `REFUGE_CANDIDATES` (12) nearest clear cells on every tick the press kill has nowhere to
 * stand, and keeps the one whose walk ARRIVES soonest (ties to the larger clearance). A candidate is previewed to its
 * arrival, a crossing, a lethal floor or `DEFAULT_MAX_TICKS_PER_TARGET` (400) stalled ticks — and most are cells behind
 * a wall, pressed into for 400 ticks. Measured on C1's staging A (sword): 2,145,515 previewed states, of which 26,721
 * come before the best ETA found so far (P2, re-measured here to the state).
 *
 * ⇒ ON, once a best is held, each later candidate's preview is STOPPED at its `best.eta + 1`-th sample
 * (`previewWalk`'s own `stopWhen`, `kind: 'stopped'`, which the refuge skips like any truncated walk). Such a walk
 * cannot win: its ETA is at least `best.eta + 1`, and a tie must ARRIVE at `best.eta` (so `>`, never `>=`). The bound
 * is the best's, and the best has passed every test a refuge passes (BW's `refugeBlast` included), so a refused
 * candidate never cuts another. The CHOSEN cell is therefore never cut, and a guard that re-ran the chosen cell in full
 * would never run.
 *
 * ⛔ WHAT THE CUT CAN CHANGE, BY NAME — it is a behaviour switch, not a cost one, because a cut preview skips every
 * stepper and forecast call past the cut:
 *   · a THROW past the cut, in a candidate that would have lost, is not raised: the stepper's death refusal
 *     (`levelRun.deathRefusal`), a forecast's own refusal (`chaserForecast`'s shake band) — the full preview would have
 *     aborted the solve there, and the cut lets it go on. MEASURED: 0 of 57,312 refuge previews on every D1 workload
 *     (staging A sword and ghost, legs 397/414 ghost, 381 with MOVING_WAIT and PRESS_KILL_BOMBS) threw anywhere;
 *   · a lethal pit or a drowning past the cut: none is raised and none could matter (the candidate is skipped either
 *     way);
 *   · `solveProgress`'s preview units (`progressPreview`): `previewStates` and the tile map count only the states taken
 *     (the `previews` count is unchanged), and BW's instrument asks `refugeBlast` of fewer candidates (the cut ones are
 *     skipped before it). No reader decides on either.
 * The chosen refuge is the full preview's on every one of the 4,776 measured derivations.
 *
 * ⛓ THE SWITCH — `REFUGE_ETA_CUT`, OFF (`SEEDLING_REFUGE_ETA_CUT=1` opts a process in, or `withRefugeEtaCut(true, fn)`).
 * OFF, every candidate is previewed with exactly the arguments it was before. The flip is the user's.
 */
export const REFUGE_ETA_CUT = {
    enabled: globalThis.process?.env?.SEEDLING_REFUGE_ETA_CUT === '1',
};
export const REFUGE_ETA_CUT_DEFAULT = false;

/** Run `fn` with `REFUGE_ETA_CUT` set to `enabled`, restoring the previous value (`withPressKillCost`'s shape). */
export function withRefugeEtaCut(enabled, fn) {
    const was = REFUGE_ETA_CUT.enabled;
    REFUGE_ETA_CUT.enabled = enabled === true;
    const restore = () => { REFUGE_ETA_CUT.enabled = was; };
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

/**
 * The cut, as `previewWalk`'s `stopWhen`: `false` for the first `eta` samples, `true` from the `eta + 1`-th on. A walk
 * that arrives at `eta` has taken `eta` samples and is never stopped, so a tie still reaches the clearance test. One
 * predicate per preview (it counts its own calls).
 */
export function refugeEtaCut(eta) {
    let taken = 0;
    return () => {
        taken += 1;
        return taken > eta;
    };
}

/** The cut's instrument (`PRESS_KILL_COST_COUNTS`' shape): written only with the switch ON, read by nothing that decides. */
export const REFUGE_ETA_CUT_COUNTS = {
    previews: 0, cut: 0,
};
export function resetRefugeEtaCutCounts() {
    for (const k of Object.keys(REFUGE_ETA_CUT_COUNTS)) REFUGE_ETA_CUT_COUNTS[k] = 0;
}
