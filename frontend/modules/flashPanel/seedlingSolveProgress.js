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
 *  - ⛓ RK VIEW (slice `seedling-js-rk-view`, reads hammer-phase RK's `v: 2`): `kindChips` (a node's
 *    `rejectionKinds` in `REFUSAL_KINDS`' order, a kind not in the list after them by name), `kindTotals` (the
 *    segment's refusals by kind, each counted ONCE: on the node where it was tallied deepest — never a sum over every
 *    node) and `lastWhyText` (`‹kind› at ‹key›: ‹why›`, the why verbatim). A v1 snapshot has neither field, and each
 *    reads as "nothing to draw".
 *  - ⛓ STAMPS VIEW (slice `seedling-js-stamps-view`, draws S3's Tier B tap stamps; the tap is unchanged):
 *    `wallBySiteRows` (`budget.wallBySite`, the most wall first, Σ = the attempt's wall), `etaText` (`budget.rate`
 *    as written — never recomputed), `requestText` (the request identity, which `applyProgress` KEEPS from the solve's
 *    first post for the rest of that solve, and drops on a new solve) and `bestText` (the plan in hand). A snapshot
 *    without the stamps reads as "nothing to draw" for each.
 */

import { REFUSAL_KINDS } from '../seedlingDemo/solveProgress.js';

/** The feed's re-resolve interval (ms): also the "last update N s ago" refresh. */
export const SOLVE_PROGRESS_POLL_MS = 1000;
/** The tree rows listed before the rest are counted ("… N more"). */
export const SOLVE_PROGRESS_TREE_CAP = 160;

/** The empty state: nothing received yet. */
export function emptyProgress() {
    return { service: null, solveId: null, snapshot: null, final: false, seq: null, segmentIndex: null,
        request: null, receivedAt: null, received: 0, dropped: { stale: 0, order: 0 } };
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
        // ⛓ STAMPS VIEW — the tap stamps `request` on a solve's FIRST post only: kept for the rest of the solve, and
        // forgotten by a new one (a new solve whose first post was dropped has no identity — never the old one's)
        request: snap.request && typeof snap.request === 'object' ? snap.request : (fresh ? null : state.request ?? null),
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

/**
 * ⛓ RK VIEW — a node's `rejectionKinds` as `[[kind, n], …]`: the kinds of `REFUSAL_KINDS` (imported, so a kind the
 * emitter adds is ordered with it) in that order, then any kind NOT in the list by name — shown, never dropped. Zero
 * and non-numeric counts are skipped. A node with no kinds (every v1 node) is `[]`.
 */
export function kindChips(rejectionKinds) {
    const kinds = rejectionKinds ?? {};
    const live = (k) => Number.isFinite(kinds[k]) && kinds[k] > 0;
    const known = REFUSAL_KINDS.filter(live).map((k) => [k, kinds[k]]);
    const other = Object.keys(kinds).filter((k) => !REFUSAL_KINDS.includes(k) && live(k)).sort()
        .map((k) => [k, kinds[k]]);
    return [...known, ...other];
}

/**
 * ⛓ RK VIEW — the segment's refusals by kind, each counted ONCE, as `{rows: [[kind, n], …] (kindChips' order),
 * total}`; `null` for a v1 tree (no `rejectionKinds` on its root).
 *
 * ⛔ NOT a sum over every node: the emitter tallies a refusal on more than one node. A rung's row refusal and a
 * search's bound are tallied on that node alone, but a THROWN error is tallied on EVERY frame it unwinds through
 * (`progressLeave`: L18's `levelRun` refusal sits on segment → goal → walk → verb → arm, five times), and a climb
 * that unwinds also tallies its cursor (the rung, and the arm under it). The node where a refusal was tallied
 * DEEPEST is where it happened, and every node above it holds the same tally again. So each node counts, per kind,
 * only what its children do not already hold: `max(0, own − Σ children)`. That is every rung row refusal and
 * search bound (no child holds them) plus each error's deepest node (its frames above count 0) — what hammer-phase
 * RK's report asks for, derived from the tally rules rather than from a role list. Its one blind spot: a frame
 * whose own refusal has the kind of refusals its children took and SURVIVED reads that one as theirs (a lower bound).
 */
export function kindTotals(tree) {
    if (!tree || typeof tree.rejectionKinds !== 'object' || tree.rejectionKinds === null) return null;
    const totals = {};
    const visit = (n) => {
        const kids = n.children ?? [];
        const below = {};
        for (const c of kids) {
            for (const [k, v] of Object.entries(c.rejectionKinds ?? {})) {
                if (Number.isFinite(v)) below[k] = (below[k] ?? 0) + v;
            }
        }
        for (const [k, v] of Object.entries(n.rejectionKinds ?? {})) {
            const own = Number.isFinite(v) ? v - (below[k] ?? 0) : 0;
            if (own > 0) totals[k] = (totals[k] ?? 0) + own;
        }
        for (const c of kids) visit(c);
    };
    visit(tree);
    const rows = kindChips(totals);
    return { rows, total: rows.reduce((a, [, n]) => a + n, 0) };
}

/**
 * ⛓ RK VIEW — the segment's last refusal as one line, `‹kind› at ‹key›: ‹why›`, the why VERBATIM (the view clamps
 * it and escapes it — it only ever writes text); `null` when there is none (`lastWhy: null`, or a v1 snapshot).
 * Fields the line does not name (`name`, should the emitter add it) are ignored.
 */
export function lastWhyText(lastWhy) {
    if (!lastWhy || typeof lastWhy !== 'object') return null;
    return `${lastWhy.kind ?? '?'} at ${lastWhy.key ?? '?'}: ${lastWhy.why ?? ''}`;
}

/** ⛓ RK VIEW — `text` cut to at most `max` characters, the cut marked with `…` (a short text is unchanged). */
export function clampText(text, max) {
    return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * ⛓ STAMPS VIEW — a wall-clock span for a line: `850 ms`, `4.2 s` (under 10 s), `37 s`. Never a budget: the
 * budgets are work units.
 */
export function formatMs(ms) {
    if (!Number.isFinite(ms)) return '?';
    if (ms < 1000) return `${Math.round(ms)} ms`;
    return ms < 10000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms / 1000)} s`;
}

/**
 * ⛓ STAMPS VIEW — `budget.wallBySite` as `{rows: [['from→to', ms], …], total}`, the most wall first (ties by name);
 * `total` is the sum over EVERY pair (the attempt's wall ms so far — the tap charges every hook call). The stamp is
 * per ATTEMPT (summed across segments), unlike the asks (per segment). `null` when the snapshot has no stamp.
 */
export function wallBySiteRows(snapshot) {
    const wall = snapshot?.budget?.wallBySite;
    if (!wall || typeof wall !== 'object') return null;
    const rows = Object.entries(wall).filter(([, ms]) => Number.isFinite(ms) && ms > 0)
        .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    return { rows, total: rows.reduce((a, [, ms]) => a + ms, 0) };
}

/**
 * ⛓ STAMPS VIEW — `budget.rate` as one line: `41.2 units/s · ≈ 3.1 s to window · ≈ 12 s to limit`, each ETA only
 * when the tap wrote it (`toWindowMs` only while the window bounds the pass; neither before anything is spent),
 * `0` as `reached`. Read as written, never recomputed from `spent`/`limit`. `null` when there is nothing to say
 * (no `rate`, or nothing spent and no ETA).
 */
export function etaText(snapshot) {
    const rate = snapshot?.budget?.rate;
    if (!rate || typeof rate !== 'object') return null;
    const eta = (ms, what) => (ms > 0 ? `≈ ${formatMs(ms)} to ${what}` : `${what} reached`);
    const parts = [];
    if (Number.isFinite(rate.unitsPerSec) && rate.unitsPerSec > 0) parts.push(`${rate.unitsPerSec} units/s`);
    if (Number.isFinite(rate.toWindowMs)) parts.push(eta(rate.toWindowMs, 'window'));
    if (Number.isFinite(rate.toLimitMs)) parts.push(eta(rate.toLimitMs, 'limit'));
    return parts.length ? parts.join(' · ') : null;
}

/** ⛓ STAMPS VIEW — a switch stamp's value for the header: a scalar as is, an object as compact JSON (clamped). */
const switchValue = (v) => (v !== null && typeof v === 'object' ? clampText(JSON.stringify(v), 80) : String(v));

/**
 * ⛓ STAMPS VIEW — the request identity (S3's `request`, the solve's first post) as one line: the tape name, the boot
 * level, `seamTime` (when the staging has one), the goal kind, the passes, the OFF-DEFAULT switches (`{}` = the
 * defaults → not mentioned) and the attempt (`request.attempt.label`; `retry N` when it is a held retry). Solver text
 * is returned as is: the view writes it as text only. `null` without a request.
 */
export function requestText(request) {
    if (!request || typeof request !== 'object') return null;
    const parts = [`${request.name ?? '?'}`];
    if (request.level !== null && request.level !== undefined) parts.push(`boot L${request.level}`);
    if (Number.isFinite(request.seamTime)) parts.push(`seamTime ${request.seamTime}`);
    if (request.goal) parts.push(`goal ${request.goal}`);
    if (Array.isArray(request.passes) && request.passes.length) {
        parts.push(`passes ${request.passes.map((p) => p ?? '?').join(' → ')}`);
    }
    const switches = Object.entries(request.switches ?? {});
    if (switches.length) parts.push(`switches ${switches.map(([k, v]) => `${k}=${switchValue(v)}`).join(', ')}`);
    const a = request.attempt;
    if (a && typeof a === 'object' && a.label) parts.push(`attempt ${a.label}${a.retry > 0 ? ` (retry ${a.retry})` : ''}`);
    return `request: ${parts.join(' · ')}`;
}

/**
 * ⛓ STAMPS VIEW — the plan in hand (S3's `best`, `onPass`'s best so far — not a pass's own answer): `best: ok · N
 * ticks (pass P)`, `best: refused (pass P)`, or `best: none yet` when no pass has landed.
 */
export function bestText(best) {
    if (!best || typeof best !== 'object') return 'best: none yet';
    const pass = best.pass ? ` (pass ${best.pass})` : '';
    return best.ok === true ? `best: ok · ${best.ticks ?? '?'} ticks${pass}` : `best: refused${pass}`;
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
