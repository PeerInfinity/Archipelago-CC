/**
 * flashPanel/seedlingSolveWatch — ⛓ WATCHER VIEW (slice `seedling-solver-panel-view`, ⚖ Robert 2026-11-11, design
 * the readability design, session `seedling-solver-panel-readability`): **THE MODEL BEHIND THE SOLVER SECTION'S DEFAULT VIEW**,
 * written for someone watching the bot play. DOM-free, so node's rows pin it whole; the DOM half is
 * `seedlingSolveWatchView.js`.
 *
 * It reads ONLY what the progress stream already carries (`seedling-solve-progress.md` §2, §7): the solver, the tap,
 * the worker and the stream are unchanged. Every number here is one the developer view
 * (`seedlingSolveProgressView.js`, now under "Developer details") also draws.
 *
 *  - `observeWatch(memory, state, now)` — the watcher's MEMORY of one solve, folded note by note (the view's
 *    `onState`): per pass, the plan it put in hand (`best` while `best.pass` was that pass), whether it ran, how it
 *    ended, its last refusal kind; the upgrade window last seen; the last `frame.danger` (the blocker); when the
 *    solve's first and last notes arrived. A new solve (service × solveId) starts it over.
 *  - `watchPhase(state)` — `none | running | solved | gave-up`.
 *  - `headlineOf(state, memory)` — the headline sentence and its sub-line by phase. ⛓ The panel's progress line under
 *    the game (`SolveProgressLine`) writes the same sentence.
 *  - `passStepsOf(state, memory)` — the pass stepper (`done | now | skip | fail`).
 *  - `tryingNowOf(state)` — the "trying now" line from `frame` and the active path's deepest node.
 *  - `effortOf(state, memory)` — the effort bar's words.
 *  - `whyOf(state, memory)` — the "why" box: a template per refusal KIND, only on a gave-up solve.
 *  - `goalTileOf(snapshot)` — the goal ✕ (the goal node's `(x,y)`, in tiles).
 *  - `roomOf(world)` — the room's tiles in the JS runtime page's own ink (`rectPalette.js`).
 *  - `routeOf(snapshot)` — ⛓ ROUTE HOOK: the plan in hand's tile path. The stream carries none yet (hammer-phase's
 *    follow-up), so it returns `null` and the view draws no route line.
 *
 * ⛓ Ticks vs seconds (the design's open point, this slice's call): plans are counted in TICKS (the solver's own unit,
 * what the developer view's `best` line says), and the solved sub-line adds the game time in brackets at the game's
 * 30 ticks a second (`561 ticks, 18.7 s of play`). Elapsed and ETA are wall seconds, as the tap measured them.
 */

import { activePath, formatMs, meterOf } from './seedlingSolveProgress.js';
// ⚠ a cycle (that file's `SolveProgressLine` imports `headlineOf`): safe, `frameTargetTile` is a hoisted function
// declaration, initialised before either module body runs — keep it one (never a `const` arrow).
import { frameTargetTile } from './seedlingSolveProgressView.js';
import { FLOOR_COLOUR, SOLID_COLOUR, TILE_COLOURS, objectSolidColour } from '../seedlingDemo/rectPalette.js';

/** The JS runtime page's teleporter ink (`jsRuntimePage.js` `TELEPORTER_COLOUR`, a page-local constant). */
const TELEPORTER_COLOUR = '#3fd8ce';

/** The game's tick rate (ticks per second of play): the JS runtime page's clock and the wasm game's. */
export const GAME_TICKS_PER_SECOND = 30;

/** A pass's name in words (`jsRuntimeSolver.ANYTIME_PASSES`); a pass not listed is shown by its own name. */
export const PASS_LABELS = Object.freeze({ dashless: 'Plain walk', full: 'With dashes' });
/** What a running pass is looking for, in words. */
const PASS_SEEKS = Object.freeze({ dashless: 'a plain walking route', full: 'sword-dash shortcuts' });

/** A goal kind (`request.goal`, `solverGoal.kind`) as the place the sentence names. */
export const GOAL_WORDS = Object.freeze({
    'reach-exit': 'the exit', 'reach-pit': 'the pit', 'collect-placement': 'the item', encounter: 'the encounter',
    'clear-tag': 'its target',
});

/**
 * ⛓ "Trying now" — the active path's deepest node in words, by role (and label for a rung, an arm or a search),
 * until the stream carries a label of its own (`frame.label`, the hammer planner's optional follow-up: when present
 * it is used verbatim).
 */
export const RUNG_WORDS = Object.freeze({ avoid: 'a way around the danger', pull: 'pulling the danger away',
    time: 'waiting for an opening', bait: 'baiting an enemy', kill: 'a kill' });
export const ARM_WORDS = Object.freeze({ light: 'a light attack', 'static-sword': 'a sword strike',
    press: 'a press kill', chaser: 'chasing an enemy down' });

/**
 * ⛓ THE "WHY" TEMPLATES — one sentence per refusal kind (`seedlingDemo/solveProgress.js` `REFUSAL_KINDS`); a kind not
 * listed reads as `other`. `{at}` is replaced with ` near (c, r)` when the refusal has a place, else nothing.
 */
export const WHY_TEMPLATES = Object.freeze({
    deadline: 'it used up its search effort before it found a route{at}.',
    pending: 'it needs another pass to measure something first{at}.',
    danger: 'every route it found would take a hit{at}.',
    bound: 'the search grew past its size limit before it found a route{at}.',
    exhausted: 'it ran out of options: no safe place to stand or path was left to try{at}.',
    'does-not-apply': 'the action it chose does not fit its target{at}.',
    precondition: 'the way needs something this run does not have yet (an item, a key or an opened door){at}.',
    'already-true': 'the step it planned was already done{at}.',
    unmodelled: 'the way needs something the solver does not model yet{at}.',
    diverged: 'the game did not do what the plan expected{at}.',
    error: 'the solver hit an internal error{at}.',
    'soft-lock': 'going on would leave the game stuck (a soft-lock){at}.',
    other: 'the solver refused for a reason it does not classify{at}.',
});

const cellText = (c) => `(${c[0]}, ${c[1]})`;
const isCell = (c) => Array.isArray(c) && c.length >= 2 && Number.isInteger(c[0]) && Number.isInteger(c[1]);
const passLabel = (p) => PASS_LABELS[p] ?? String(p ?? '?');
const goalWords = (kind) => (kind ? GOAL_WORDS[kind] ?? `its goal (${kind})` : 'its goal');
const playSeconds = (ticks) => `${(ticks / GAME_TICKS_PER_SECOND).toFixed(1)} s of play`;

/** The memory of no solve. */
export function emptyWatch() {
    return { key: null, passes: {}, window: null, danger: null, firstAt: null, lastAt: null };
}

/** One pass's record in the memory, made on first use. */
const passRec = (m, p) => (m.passes[p] ??= { ran: false, ticks: null, outcome: null, kind: null });

/**
 * Fold one accepted note's state into the memory (a NEW object when the solve changed, else the same one, updated).
 * Pure in its inputs: `now` is the page clock (ms), read only for the elapsed-time fallback.
 */
export function observeWatch(memory, state, now) {
    const snap = state?.snapshot;
    if (!snap) return memory;
    const key = `${state.service ?? ''}:${state.solveId ?? ''}`;
    const m = memory && memory.key === key ? memory : { ...emptyWatch(), key, firstAt: now };
    m.lastAt = now;
    const seg = snap.segment ?? {};
    if (seg.pass) {
        const r = passRec(m, seg.pass);
        r.ran = true;
        if (seg.outcome && seg.outcome !== 'running') {
            r.outcome = seg.outcome;
            if (seg.outcome !== 'solved') r.kind = snap.lastWhy?.kind ?? r.kind;
        }
    }
    const best = snap.best;
    if (best && typeof best === 'object' && best.ok === true && best.pass && Number.isFinite(best.ticks)) {
        passRec(m, best.pass).ticks = best.ticks;
    }
    const w = snap.budget?.limit?.window;
    if (Number.isFinite(w)) m.window = w;
    const d = snap.frame?.danger;
    if (d && typeof d === 'object') m.danger = { source: d.source ?? null, kind: d.kind ?? null, at: isCell(d.at) ? [d.at[0], d.at[1]] : null };
    return m;
}

/** `none` (no snapshot), `running`, `solved` (final, with a plan in hand or a solved last segment) or `gave-up`. */
export function watchPhase(state) {
    const snap = state?.snapshot;
    if (!snap) return 'none';
    if (!state.final) return 'running';
    return snap.best?.ok === true || snap.segment?.outcome === 'solved' ? 'solved' : 'gave-up';
}

/** The solve's elapsed wall ms: the tap's `wallBySite` Σ (the attempt's wall), else the page's first → last note. */
export function elapsedMsOf(state, memory) {
    const wall = state?.snapshot?.budget?.wallBySite;
    if (wall && typeof wall === 'object') {
        const ms = Object.values(wall).filter((v) => Number.isFinite(v) && v > 0).reduce((a, b) => a + b, 0);
        if (ms > 0) return ms;
    }
    return memory && memory.firstAt !== null && memory.lastAt !== null ? Math.max(0, memory.lastAt - memory.firstAt) : null;
}

/** The level the solve is ABOUT: the request's boot level (kept for the solve), else the segment's (it moves with the run). */
const levelOf = (state) => state?.request?.level ?? state?.snapshot?.request?.level ?? state?.snapshot?.segment?.level ?? '?';

/**
 * ⛓ THE HEADLINE — `{phase, head, sub}`. The sub-line is '' when there is nothing to add. The head is the line's
 * first words (`SolveProgressLine` writes `head` and `sub` on one line).
 */
export function headlineOf(state, memory) {
    const phase = watchPhase(state);
    const snap = state?.snapshot;
    if (phase === 'none') return { phase, head: 'solver: no solve yet', sub: '' };
    const goal = goalWords(state.request?.goal ?? snap.request?.goal ?? null);
    const level = levelOf(state);
    const best = snap.best && typeof snap.best === 'object' ? snap.best : null;
    const elapsed = elapsedMsOf(state, memory);
    const took = elapsed === null ? '' : ` ${formatMs(elapsed)}`;
    if (phase === 'running') {
        const pass = snap.segment?.pass ?? null;
        const seeks = PASS_SEEKS[pass] ?? (pass ? `a route (${pass} pass)` : 'a route');
        const sub = best?.ok === true
            ? `A route is already in hand (${best.ticks ?? '?'} ticks). Now looking for ${seeks}.`
            : `Looking for ${seeks}.`;
        return { phase, head: `Planning a route on level ${level} to ${goal}…`, sub };
    }
    if (phase === 'solved') {
        const ticks = best?.ok === true ? best.ticks : null;
        const plain = memory?.passes?.dashless?.ticks ?? null;
        let sub = '';
        if (Number.isFinite(ticks)) {
            // the dashes the plan pressed: the final segment's own counter, when that segment is the pass that found it
            const dashes = snap.segment?.pass === best.pass ? snap.budget?.work?.dashesPressed : null;
            const withDashes = Number.isFinite(dashes) && dashes > 0 ? `with ${dashes} sword-dash${dashes === 1 ? '' : 'es'}` : 'with sword-dashes';
            sub = best.pass === 'full'
                ? `Found a ${ticks}-tick route (${playSeconds(ticks)}) ${withDashes}`
                    + (Number.isFinite(plain) && plain > ticks ? `, ${plain - ticks} ticks faster than the plain walk (${plain}).` : '.')
                : `Found a ${ticks}-tick route (${playSeconds(ticks)})${best.pass === 'dashless' ? ' without sword-dashes' : ''}.`;
        }
        return { phase, head: `✓ Solved in${took || ' ?'}`, sub };
    }
    const sub = snap.segment?.outcome === 'threw'
        ? `The solver stopped with an error on level ${level}.`
        : `Couldn't find a safe way to ${goal} on level ${level}.`;
    return { phase, head: `✗ Gave up after${took || ' ?'}`, sub };
}

/**
 * ⛓ THE PASS STEPPER — one step per pass the request names (`request.passes`; the running pass alone when the
 * request is not known): `{n, pass, label, status: done|now|skip|fail, text}`.
 */
export function passStepsOf(state, memory) {
    const snap = state?.snapshot;
    if (!snap) return [];
    const req = state.request ?? snap.request ?? null;
    const current = snap.segment?.pass ?? null;
    const passes = Array.isArray(req?.passes) && req.passes.length ? req.passes : current ? [current] : [];
    const curAt = passes.indexOf(current);
    const usedPass = state.final && snap.best?.ok === true ? snap.best.pass : null;
    return passes.map((p, i) => {
        const r = memory?.passes?.[p] ?? { ran: false, ticks: null, outcome: null, kind: null };
        const label = passLabel(p);
        const n = i + 1;
        const ticks = Number.isFinite(r.ticks) ? ` · ${r.ticks} ticks` : '';
        let status;
        let text;
        if (!state.final && p === current) {
            status = 'now';
            text = `● ${n} · ${label} · searching`;
        } else if (!r.ran && (state.final || i > curAt)) {
            status = 'skip';
            text = `${n} · ${label} · not tried`;
        } else if (Number.isFinite(r.ticks) || r.outcome === 'solved') {
            status = 'done';
            const used = state.final && Number.isFinite(r.ticks) ? (usedPass === p ? ' · used' : ' · not used') : '';
            text = `✓ ${n} · ${label}${ticks}${used}`;
        } else if (r.kind === 'deadline') {
            status = 'fail';
            text = `✗ ${n} · ${label} · out of effort`;
        } else {
            status = 'fail';
            text = `✗ ${n} · ${label}`;
        }
        return { n, pass: p, label, status, text };
    });
}

/** The active path's deepest node in words (see `RUNG_WORDS`), or null with nothing active. */
export function activeWords(tree, pass = null) {
    const { nodes } = activePath(tree);
    const n = nodes.at(-1);
    if (!n) return null;
    const label = String(n.label ?? '');
    switch (n.role) {
        case 'rung': return RUNG_WORDS[label] ?? `the ${label} rung`;
        case 'arm': return ARM_WORDS[label] ?? `a ${label} attack`;
        case 'verb': return `${label.replace(/^verb:/, '')} (a way past an obstacle)`;
        case 'climb': return 'getting past a danger';
        case 'search': return /^escape/.test(label) ? 'an escape' : label === 'approach' ? 'an approach' : label === 'fight' ? 'a fight' : `a ${label} search`;
        case 'walk': return pass === 'full' ? 'a walk, with sword-dashes allowed' : 'a walk';
        case 'goal': return 'heading for the goal';
        default: return `${n.role} ${label}`.trim();
    }
}

/** ⛓ "TRYING NOW" — while running only: `{what, where}` (each text, `where` '' with no tile), or null. */
export function tryingNowOf(state) {
    const snap = state?.snapshot;
    if (!snap || state.final) return null;
    const f = snap.frame && typeof snap.frame === 'object' ? snap.frame : null;
    const what = (typeof f?.label === 'string' && f.label) || activeWords(snap.tree, snap.segment?.pass ?? null);
    if (!what) return null;
    const stance = isCell(f?.stance) ? f.stance : null;
    const where = stance ? ` near ${cellText(stance)}` : '';
    return { what, where };
}

/**
 * ⛓ THE EFFORT BAR — `{fraction, window, used, left, caption, windowCaption, timeCaption, spentUp}`: the meter
 * (`meterOf`) relabelled. `windowCaption` names the dash window (running: "stops at", after: "stopped at … (kept
 * what it found)" when the solve reached it); `timeCaption` is the elapsed wall time, and the ETA only while running.
 */
export function effortOf(state, memory) {
    const snap = state?.snapshot;
    const m = meterOf(snap);
    const phase = watchPhase(state);
    const window = m.window ?? (phase === 'running' ? null : memory?.window ?? null);
    let caption;
    if (!snap) caption = 'Search effort —';
    else if (m.noLimit) caption = `Search effort ${m.spent} · no limit`;
    else if (m.limit === null) caption = `Search effort ${m.spent}`;
    else caption = `Search effort ${m.spent} of ${m.limit}`;
    const spentUp = m.limit !== null && m.spent >= m.limit;
    if (phase === 'gave-up' && spentUp) caption += ' · budget used up';
    let windowCaption = '';
    if (window !== null && m.limit !== null) {
        windowCaption = phase === 'running' ? `dash search stops at ${window}`
            : m.spent >= window ? `dash search stopped at ${window} (kept what it found)` : '';
    }
    const elapsed = phase === 'none' ? null : elapsedMsOf(state, memory);
    const toLimit = snap?.budget?.rate?.toLimitMs;
    const eta = phase === 'running' && Number.isFinite(toLimit) && toLimit > 0 ? ` · ≈ ${formatMs(toLimit)} left at most` : '';
    return {
        fraction: m.fraction, window: m.limit !== null ? window : null, limit: m.limit, spent: m.spent, spentUp, caption,
        windowCaption, timeCaption: elapsed === null ? '' : `${formatMs(elapsed)}${eta}`,
    };
}

/**
 * ⛓ The refusal kinds whose sentence names a PLACE (`{at}`): the frame's stance, else its target's tile. `danger`
 * names the blocker's tile instead (below). The rest (`deadline`, `bound`, `pending`, `error`, `other`) are about the
 * search, not a place: no tile is named and nothing is marked.
 */
export const PLACE_KINDS = Object.freeze(['exhausted', 'does-not-apply', 'precondition', 'already-true', 'unmodelled',
    'diverged', 'soft-lock']);

/**
 * ⛓ THE "WHY" BOX — only on a GAVE-UP solve (a solved one's refusals were dropped options: they stay under the
 * developer details): `{kind, sentence, at, blocker, fromDanger, raw, key}`, or null. A `danger` refusal names the
 * blocker's tile (`frame.danger.at`, the last one seen in the solve) and source, and `fromDanger` is true (the map marks
 * it ⚠); a `PLACE_KINDS` refusal names the frame's stance or target tile; any other kind names no place.
 */
export function whyOf(state, memory) {
    if (watchPhase(state) !== 'gave-up') return null;
    const snap = state.snapshot;
    const lw = snap.lastWhy && typeof snap.lastWhy === 'object' ? snap.lastWhy : null;
    const kind = lw?.kind ?? null;
    const template = WHY_TEMPLATES[kind] ?? WHY_TEMPLATES.other;
    const f = snap.frame && typeof snap.frame === 'object' ? snap.frame : null;
    let at = null;
    let blocker = null;
    let fromDanger = false;
    if (kind === 'danger') {
        const danger = f?.danger && isCell(f.danger.at) ? f.danger : memory?.danger ?? null;
        if (danger && isCell(danger.at)) { at = [danger.at[0], danger.at[1]]; blocker = danger.source ?? null; fromDanger = true; }
    } else if (PLACE_KINDS.includes(kind)) {
        const target = typeof f?.target === 'string' ? frameTargetTile(f.target) : null;
        at = isCell(f?.stance) ? [f.stance[0], f.stance[1]] : target;
    }
    const place = at ? ` near ${cellText(at)}${blocker ? ` (${blocker})` : ''}` : '';
    return { kind, sentence: template.replace('{at}', place), at, blocker, fromDanger, raw: lw?.why ?? null, key: lw?.key ?? null };
}

/** ⛓ THE GOAL ✕ — the goal node's `(x,y)` (pixels, in its label: `reach-exit (432,352)`) as a tile, or null. */
export function goalTileOf(snapshot) {
    const goal = (snapshot?.tree?.children ?? []).find((c) => c.role === 'goal' && c.active) ?? (snapshot?.tree?.children ?? []).find((c) => c.role === 'goal');
    const p = /\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)/.exec(String(goal?.label ?? ''));
    return p ? [Math.floor(Number(p[1]) / 16), Math.floor(Number(p[2]) / 16)] : null;
}

/**
 * ⛓ ROUTE HOOK — the plan in hand's tile path, for the route line (design item 5). The stream does not carry it yet:
 * it is the hammer planner's follow-up (the readability design's "Who takes what" (a)). The
 * shape this view will read, once it does: `best.route = {level, cells: [[col, row], …], dashes: [[col, row], …]}`,
 * the waypoints of the plan `best` names, in order, in `tiles.cells`' grid. Until then: `null`, and no line is drawn.
 */
export function routeOf(snapshot) {
    void snapshot;
    return null;
}

/**
 * ⛓ THE ROOM — a JS runtime world (`runtime.view().world`: `width`/`height` in tiles, `tiles`, `solids`,
 * `objectSolids`, `teleporters`, each with a pixel `rect`) as paint ops `{cols, rows, ops: [[x, y, w, h, colour,
 * alpha], …]}` in PIXELS, in the page's own ink (`rectPalette.js`), or null with no world.
 */
export function roomOf(world) {
    if (!world || !Array.isArray(world.tiles) || !(world.width > 0) || !(world.height > 0)) return null;
    const ops = [];
    const r = (rect, colour, alpha = 1) => { if (rect) ops.push([rect.x, rect.y, rect.right - rect.x, rect.bottom - rect.y, colour, alpha]); };
    const solid = new Set((world.solids ?? []).map((s) => `${s.rect?.x},${s.rect?.y}`));
    for (const t of world.tiles) r(t.rect, solid.has(`${t.rect?.x},${t.rect?.y}`) ? SOLID_COLOUR : (TILE_COLOURS[t.t] ?? FLOOR_COLOUR));
    for (const s of world.objectSolids ?? []) r(s.rect, objectSolidColour(s), 0.85);
    for (const tp of world.teleporters ?? []) if (!tp.deactivated) r(tp.rect, TELEPORTER_COLOUR, 0.45);
    return { cols: world.width, rows: world.height, ops };
}
