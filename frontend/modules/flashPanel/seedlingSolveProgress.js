/**
 * flashPanel/seedlingSolveProgress — ⛓ SOLVE PROGRESS (JS half): **THE FEED AND THE MODEL BEHIND THE PANEL'S VIEW**.
 *
 * ⚖ The user (2026-10-11): *"Both, plus extras"* — the solver's goal/rung TREE (attempts, successes, rejection
 * tallies per node), the TILE map (a count and an earliest-arrival tick per tile) and a work-BUDGET meter, live.
 * The snapshot schema is `docs/json/developer/procgen/seedling-solve-progress.md`; the worker's stamps
 * (`budget.spent`, `budget.limit`, `segment.pass`) are `seedlingDemo/solveProgressTap.js`'s.
 *
 * DOM-free (the panel's renderer is `seedlingSolveProgressView.js`), so node's rows pin it whole:
 *
 *  - `createSolveProgressFeed` — subscribes to every live solve service the panel can reach (the JS page's worker
 *    service, the wasm engines'), re-resolving them each `pollMs` (a preset switch or a runtime change replaces
 *    them), and ⛔ UNSUBSCRIBES EVERY ONE on `close()`: with the view closed, no service has a listener, so no solve
 *    asks its worker for the stream (`jsRuntimeSolveService.subscribeProgress`).
 *  - `applyProgress(state, note, now)` — the reducer. A new solve (service × solveId) starts a fresh state; a note
 *    of an OLDER solve than the one shown is dropped (the service drops stale ids too — this is the view's own
 *    guard, for a note that crossed a service swap); within a solve, `seq` orders: an older or repeated `seq` is
 *    dropped (a FINAL repeat of the last seq is kept — it is the same state, now known finished). A new
 *    `segment.index` resets the tree and tiles (they are per segment); the meter reads `budget.spent`, the
 *    attempt's sum across segments.
 *  - `treeRows(tree, {expanded, cap})` — the tree flattened for display: a FINISHED subtree (no active node in it)
 *    is collapsed unless the viewer expanded it, an active path is always open, and at most `cap` rows are listed
 *    (the rest counted).
 *  - `solveProgressMode(value)` and `autoVisibility(mode, visible, note)` — ⛓ AUTO-SHOW (slice `solve-progress-auto`,
 *    ⚖ the user 2026-10-15): the setting is `off | auto | always` (default `auto`). In `auto` the feed stays
 *    SUBSCRIBED while the view is hidden (the progress ask rides the solve's envelope, so a listener made mid-solve
 *    would only hear the NEXT solve); a solve's first note shows the view and its FINAL note hides it at once. Hiding
 *    is NOT closing: the feed keeps listening, so the next solve is asked too. `always` never auto-hides.
 *  - ⛓ TIER A (slice S2, ⚖ the user 2026-10-17 — what the snapshot ALREADY carries, shown; no schema change):
 *    `asksBySite` (the deadline sites' asks, which under a deadline are the work units), `workCounters` (the
 *    segment's other counters), `activePath` (the active path and its climb depth) and `reasonsText` (a node's
 *    rejection tallies inline — `treeRows` marks the rungs of an active climb with `reasons`).
 */

/** The feed's re-resolve interval (ms): also the "last update N s ago" refresh. */
export const SOLVE_PROGRESS_POLL_MS = 1000;
/** The tree rows listed before the rest are counted ("… N more"). */
export const SOLVE_PROGRESS_TREE_CAP = 160;

/** The empty state: nothing received yet. */
export function emptyProgress() {
    return { service: null, solveId: null, snapshot: null, final: false, seq: null, segmentIndex: null,
        receivedAt: null, received: 0, dropped: { stale: 0, order: 0 } };
}

/**
 * Apply one note (`{solveId, snapshot, final}` from a service, tagged with `service`) at `now` (ms, the page's
 * clock — only "last update N s ago" reads it). Returns the new state, or the SAME state object when dropped.
 */
export function applyProgress(state, note, now) {
    const snap = note?.snapshot;
    if (!snap || typeof snap !== 'object') return state;
    const sameService = state.service === note.service;
    if (sameService && state.solveId !== null && note.solveId < state.solveId) {
        state.dropped.stale += 1;
        return state;
    }
    const fresh = !sameService || note.solveId !== state.solveId;
    if (!fresh && state.seq !== null && Number.isFinite(snap.seq)) {
        if (snap.seq < state.seq || (snap.seq === state.seq && !(note.final && !state.final))) {
            state.dropped.order += 1;
            return state;
        }
    }
    return {
        service: note.service, solveId: note.solveId, snapshot: snap, final: note.final === true,
        seq: Number.isFinite(snap.seq) ? snap.seq : null, segmentIndex: snap.segment?.index ?? null,
        // a new segment (or solve) is a new tree: the viewer's expansions belong to the old one
        segmentChanged: fresh || (snap.segment?.index ?? null) !== state.segmentIndex,
        receivedAt: now, received: fresh ? 1 : state.received + 1,
        dropped: fresh ? { stale: 0, order: 0 } : state.dropped,
    };
}

/** The meter: `{spent, limit, window, fraction}` from a snapshot's stamps (`limit` null in place). */
export function meterOf(snapshot) {
    const b = snapshot?.budget ?? {};
    const spent = b.spent?.shouldStop ?? b.work?.shouldStop ?? 0;
    const limit = Number.isFinite(b.limit?.shouldStop) ? b.limit.shouldStop : null;
    const window = Number.isFinite(b.limit?.window) ? b.limit.window : null;
    return { spent, limit, window, fraction: limit ? Math.min(1, spent / limit) : null };
}

const rejectedOf = (n) => Object.values(n.rejections ?? {}).reduce((a, b) => a + b, 0);

function hasActive(n) {
    if (n.active) return true;
    for (const c of n.children ?? []) if (hasActive(c)) return true;
    return false;
}

/**
 * The tree as display rows `{key, depth, node, open, hidden, collapsible, rejected, reasons}`: an active subtree is
 * always open; a finished one is collapsed unless `expanded` has its key; `hidden` counts the nodes a collapsed row
 * hides. ⛓ TIER A — `reasons` is true for a rung with rejections whose parent is an ACTIVE climb (the view writes
 * its `reasonsText` inline, not only in the tooltip).
 * At most `cap` rows; the result is `{rows, more}` (`more` = rows not listed).
 */
export function treeRows(tree, { expanded = new Set(), cap = SOLVE_PROGRESS_TREE_CAP } = {}) {
    const rows = [];
    let more = 0;
    const count = (n) => (n.children ?? []).reduce((a, c) => a + 1 + count(c), 0);
    // ⛓ TIER A — `inClimb`: the parent is an ACTIVE climb, so a rung row carries its reasons inline (`reasons`)
    const walk = (n, depth, inClimb) => {
        const kids = n.children ?? [];
        const live = hasActive(n);
        const inActiveClimb = inClimb && n.role === 'rung' && rejectedOf(n) > 0;
        const open = kids.length > 0 && (live || expanded.has(n.key));
        if (rows.length >= cap) {
            more += 1 + (open ? 0 : count(n));
            if (open) for (const c of kids) walk(c, depth + 1, false);
            return;
        }
        rows.push({ key: n.key, depth, node: n, open, collapsible: kids.length > 0 && !live,
            hidden: open ? 0 : count(n), rejected: rejectedOf(n), reasons: inActiveClimb });
        if (open) for (const c of kids) walk(c, depth + 1, n.role === 'climb' && n.active === true);
    };
    if (tree) walk(tree, 0, false);
    return { rows, more };
}

/** ⛓ TIER A — a node's rejection tallies as one line, the most frequent first (ties by reason): `4× a · 1× b`. */
export function reasonsText(rejections) {
    return Object.entries(rejections ?? {}).filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
        .map(([k, n]) => `${n}× ${k}`).join(' · ');
}

/**
 * ⛓ TIER A — `budget.asks` as `{rows: [[site, n], …], total}`, the most asked site first (ties by name). The asks
 * are the segment's (a new segment starts them over); under a deadline they are the work units (`shouldStop` =
 * their sum, §4 of the schema page).
 */
export function asksBySite(snapshot) {
    const rows = Object.entries(snapshot?.budget?.asks ?? {}).filter(([, n]) => Number.isFinite(n) && n > 0)
        .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    return { rows, total: rows.reduce((a, [, n]) => a + n, 0) };
}

/** ⛓ TIER A — the work counters `workCounters` lists, in this order, with their display names. */
export const WORK_COUNTER_LABELS = Object.freeze({
    ticks: 'ticks', previews: 'previews', previewStates: 'preview states', searchStates: 'search states',
    expansions: 'expansions', waypointsPlanned: 'waypoints', replans: 'replans', dashesPressed: 'dashes',
});

/**
 * ⛓ TIER A — `budget.work` but `shouldStop` (the meter's) as `[[label, n], …]`: the known units in
 * `WORK_COUNTER_LABELS`' order, then any unit this view does not know by its own name (sorted), so a counter added
 * to the schema is shown, not lost.
 */
export function workCounters(snapshot) {
    const work = snapshot?.budget?.work ?? {};
    const known = Object.keys(WORK_COUNTER_LABELS).filter((k) => Number.isFinite(work[k]))
        .map((k) => [WORK_COUNTER_LABELS[k], work[k]]);
    const other = Object.keys(work).filter((k) => k !== 'shouldStop' && !(k in WORK_COUNTER_LABELS)
        && Number.isFinite(work[k])).sort().map((k) => [k, work[k]]);
    return [...known, ...other];
}

/**
 * ⛓ TIER A — the ACTIVE path: from the root, the active child at each step (the first, should two be marked), as
 * `{nodes, climbDepth}` — `nodes` excludes the root (the header names the segment); `climbDepth` counts the
 * `climb` roles on it (a climb nested inside a rung's stance walk is depth 2). An idle tree is `{nodes: [], 0}`.
 */
export function activePath(tree) {
    const nodes = [];
    let n = tree?.active ? tree : null;
    while (n) {
        n = (n.children ?? []).find((c) => c.active) ?? null;
        if (n) nodes.push(n);
    }
    return { nodes, climbDepth: nodes.filter((x) => x.role === 'climb').length };
}

/** The tile map's cells as a lookup and its maximum count: `{max, at(col,row) → [col,row,reached,firstTick]|null}`. */
export function tileIndex(tiles) {
    const map = new Map();
    let max = 0;
    for (const c of tiles?.cells ?? []) {
        map.set(c[1] * 4096 + c[0], c);
        if (c[2] > max) max = c[2];
    }
    return { max, at: (col, row) => map.get(row * 4096 + col) ?? null };
}

/** A cell's shade in [0, 1]: log-scaled by the map's maximum, so a 455-count tile does not wash out a 3. */
export function tileShade(reached, max) {
    if (!(reached > 0) || !(max > 0)) return 0;
    return max === 1 ? 1 : Math.log1p(reached) / Math.log1p(max);
}

/**
 * The feed. `getServices()` → the solve services the panel can reach now (`subscribeProgress`-capable; others
 * are skipped). `onNote(note)` hears every note tagged `{service}`. `open()` subscribes and starts the re-resolve
 * timer; `close()` unsubscribes from every service and stops it. `tick` is called each poll (the view's
 * "N s ago" refresh). `intervalMs` (ms, or a function read at each solve's start — ⚖ the panel's setting
 * `flashPanel.seedlingSolveProgressIntervalMs`) is the progress rate the feed asks each service for.
 */
export function createSolveProgressFeed({ getServices, onNote, tick = () => {}, pollMs = SOLVE_PROGRESS_POLL_MS,
    intervalMs,
    timers = { setInterval: (fn, ms) => setInterval(fn, ms), clearInterval: (h) => clearInterval(h) } }) {
    /** service -> its unsubscribe */
    const subs = new Map();
    let timer = null;
    let tags = new WeakMap();
    let nextTag = 1;
    const tagOf = (svc) => { if (!tags.has(svc)) tags.set(svc, nextTag++); return tags.get(svc); };

    function resolve() {
        let live = [];
        try { live = (getServices() ?? []).filter((s) => s && typeof s.subscribeProgress === 'function'); } catch { live = []; }
        const want = new Set(live);
        for (const [svc, off] of subs) {
            if (!want.has(svc)) { try { off(); } catch { /* gone */ } subs.delete(svc); }
        }
        for (const svc of want) {
            if (subs.has(svc)) continue;
            const tag = tagOf(svc);
            subs.set(svc, svc.subscribeProgress((note) => onNote({ ...note, service: tag }), { intervalMs }));
        }
    }

    return {
        /** ⛔ Not `open`: an object literal's `open()` method below would REPLACE a getter of that name. */
        get isOpen() { return timer !== null; },
        get subscribed() { return subs.size; },
        open() {
            if (timer !== null) return;
            resolve();
            timer = timers.setInterval(() => { resolve(); tick(); }, pollMs);
        },
        close() {
            if (timer !== null) { timers.clearInterval(timer); timer = null; }
            for (const [, off] of subs) { try { off(); } catch { /* gone */ } }
            subs.clear();
            tags = new WeakMap();
        },
        /** Re-resolve now (the panel calls it when it re-mounts its page). */
        refresh() { if (timer !== null) resolve(); },
    };
}

/** ⛓ AUTO-SHOW — the setting's values, in the order the panel's button cycles them. */
export const SOLVE_PROGRESS_MODES = Object.freeze(['off', 'auto', 'always']);
/** ⛓ AUTO-SHOW — the schema default (⚖ the user 2026-10-15). */
export const SOLVE_PROGRESS_DEFAULT_MODE = 'auto';

/**
 * A stored setting as a mode. The setting was a boolean before AUTO-SHOW: a stored `true` (the view opened by hand)
 * reads as `always`, a stored `false` as `off`, so an explicit choice survives; anything else is the default.
 */
export function solveProgressMode(value) {
    if (value === true) return 'always';
    if (value === false) return 'off';
    return SOLVE_PROGRESS_MODES.includes(value) ? value : SOLVE_PROGRESS_DEFAULT_MODE;
}

/** The button's next mode: off → auto → always → off. */
export const nextSolveProgressMode = (mode) =>
    SOLVE_PROGRESS_MODES[(SOLVE_PROGRESS_MODES.indexOf(solveProgressMode(mode)) + 1) % SOLVE_PROGRESS_MODES.length];

/**
 * ⛓ AUTO-SHOW — whether the view is shown after a note the model ACCEPTED (a dropped note changes nothing):
 * `always` shows, `off` hides, `auto` shows on a running note and hides on the final one. A solve that only ever
 * posts its final note (none in practice: the worker posts at its first hook call) is never shown.
 */
export function autoVisibility(mode, visible, note) {
    if (mode === 'always') return true;
    if (mode !== 'auto') return false;
    if (!note) return visible;
    return note.final !== true;
}
