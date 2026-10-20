/**
 * flashPanel/seedlingSolveProgressView — ⛓ SOLVE PROGRESS (JS half): **THE PANEL'S VIEW** of the solver's progress
 * stream. The model and the feed are `seedlingSolveProgress.js`; this file only draws.
 *
 *  - the header: which solve, segment and pass, its outcome, the stream's `seq`, and "last update N s ago" — the
 *    solver reports only at its own sites, so a quiet stretch is shown as quiet, never as live;
 *  - the work meter: the attempt's work units against the budget, with the upgrade window marked while it bounds
 *    the pass;
 *  - the tile map on ONE canvas (a cell per reached tile, shaded by count; hover names the count and the earliest
 *    tick);
 *  - the tree, finished subtrees collapsed (click a ▸ to open one), capped at `SOLVE_PROGRESS_TREE_CAP` rows.
 *
 * ⛓ TIER A (slice S2, ⚖ the user 2026-10-17 — what the snapshot already carries; the snapshot, the tap, the worker
 * and the request are unchanged): under the meter, the segment's ASKS BY SITE (the work units under a deadline) and
 * its WORK COUNTERS; above the tree, the ACTIVE PATH as one line with its CLIMB DEPTH; on a rung of an active climb,
 * its rejection reasons INLINE (the tooltip keeps them on every row); on the map, TILE RECENCY — a cell whose count
 * rose since the map was last drawn is painted in a second (gold) palette, shaded by that rise, so the map shows
 * where the search is NOW over where it has been in total. The rise is a delta between two drawn snapshots of the
 * same solve, segment and level (a re-render of the same snapshot keeps it; anything else starts from nothing).
 *
 * ⛓ RK VIEW (slice `seedling-js-rk-view`, reads hammer-phase RK's `v: 2`; the snapshot, the tap and the worker are
 * unchanged): each tree row shows its `rejectionKinds` as CHIPS (`kind n`, in `REFUSAL_KINDS`' order, a kind not in
 * the list after them by name — `kindChips`); under the active path, the segment's REFUSALS BY KIND, each counted
 * once (`kindTotals` — never a sum over every node), and its LAST WHY, `‹kind› at ‹key›: ‹why›`, clamped to one line
 * (the full sentence in the tooltip; a click opens it). Every why is solver text: it is only ever written as text
 * (`textContent`, `title`, a text node), never parsed as HTML. A v1 snapshot has none of these fields, so it draws
 * nothing new: the two lines are inserted on the first snapshot that has them, and a row grows its chip box on the
 * first kind it shows — a v1 stream's DOM is the S2 view's, byte for byte (pinned).
 *
 * ⛓ STAMPS VIEW (slice `seedling-js-stamps-view`, draws S3's Tier B tap stamps; the tap, the worker and the service
 * are unchanged): under the header, the REQUEST IDENTITY (kept from the solve's first post — `requestText`) and the
 * PLAN IN HAND (`bestText`); beside the meter, the RATE and its ETAs to the window and the limit, as the tap wrote
 * them (`etaText`); under that, WHERE THE TIME WENT — `budget.wallBySite`, the most wall first, Σ = the attempt's wall
 * (per ATTEMPT, so labelled; the asks below are per segment). The lines are inserted on the first snapshot that
 * carries a stamp, so a snapshot without them draws the RK view's bytes (pinned). Each line is one `_line` write, only
 * when its text changes; the wall line is one clipped line (its full list in the tooltip), so its moving digits never
 * change its height; every line is a full-width block, never a flex item sized by its text (S2's lesson).
 *
 * ⛓ FRAME VIEW (slice `seedling-js-frame-view`, draws hammer-phase TC2's `frame`; the snapshot, the tap and the worker
 * are unchanged): while `frame !== null`, the map MARKS what the solver's active frame is aimed at — its STANCE tile
 * (a cyan square), its TARGET at the tile of the placement in its id (a white cross; `frameTargetTile`), and its
 * DANGER at the tile where the corridor met it (`danger.at`), with a glyph per kind (`DANGER_GLYPHS`) and its source
 * id — and the tree row whose key is `frame.key` is OUTLINED. A line under the map says the same in words. The marks
 * are drawn only when `tiles.level === segment.level` (a crossing can leave the map a level behind); a `null` frame
 * clears them. They live on a second canvas over the map, so the cell canvas's incremental paint is untouched; it and
 * the line are inserted on the first snapshot that carries a frame, so a frame-less stream draws the stamps view's
 * bytes (pinned), and the marks are redrawn only when what they show changes (`stats.marksDrawn`).
 *
 * ⛓ CACHES VIEW (slice `seedling-js-caches-view`, draws hammer-phase PR's `caches`, `churn` and `soft-lock`; the
 * snapshot, the tap and the worker are unchanged — the solver hands the escape counters in itself, so nothing here
 * calls `progressCaches`): at the end of the meter, the segment's CACHES (`cachesText`: each cache's hits and misses
 * and its hit rate) and its CHURN (`churnText`: frames opened, succeeded, rejected and still open, and the climb
 * cursor's moves). Both lines are made and inserted on the first snapshot that carries either object, so a
 * snapshot without them draws the frame view's bytes (pinned). A kind in `DANGER_KINDS` (`soft-lock`: the action would wedge the
 * GAME) is drawn in the frame view's danger colour wherever a kind is drawn — its tree chip, its entry in the
 * refusals by kind (a span; a line without it stays one text write) and the last why when it is that kind.
 *
 * ⛓ INCREMENTAL (slice S1, ⚖ the user 2026-10-17 — the rate setting `flashPanel.seedlingSolveProgressIntervalMs`
 * depends on it): a note updates the STATE (and the show/hide lifecycle) at once, but the DOM at most once per
 * animation frame (the `frame` option, kept here as `scheduleRender`; default `requestAnimationFrame`) — the notes of one frame coalesce into one render of the
 * newest state. A HIDDEN view renders nothing (the state is kept; showing it renders the newest at the next frame).
 * The canvas is resized only when the room's size changes (a resize clears it), and only the cells whose colour
 * changed are painted (a cell gone since the last paint is painted back to the background). The tree's rows are
 * kept and DIFFED: a row element is written only where its text, colour, tooltip or key changed. `flush()` renders
 * a pending frame now; `stats` counts notes, renders, coalesced and hidden-skipped notes, resizes, cells painted
 * and rows written (and ⛓ FRAME VIEW's frame counts) — what the pins read.
 *
 * ⛓ AUTO-SHOW — `setMode(off | auto | always)` (the panel's setting). `isOpen` is whether the view is SHOWN,
 * `isListening` whether its feed is subscribed: in `auto` the feed listens while the view is hidden, the first note
 * of a solve shows it and the final note hides it (the feed keeps listening). `lifecycle` keeps the last
 * `LIFECYCLE_CAP` show/hide transitions `{event, mode, solveId, seq, final, at}`. The element mirrors them as
 * `data-*` attributes (`mode`, `visible`, `listening`, `shows`, `hides`, `shown-at`, `hidden-at`, `shown-final`,
 * `final`, `outcome`) — what the feature check `seedling-solve-progress-auto-show` reads.
 *
 * The panel's own idiom: inline styles on its dark monospace palette, no stylesheet.
 */

import {
    activePath, applyProgress, asksBySite, autoVisibility, bestText, clampText, createSolveProgressFeed, emptyProgress,
    cachesText, churnText, etaText, formatMs, kindChips, kindTotals, lastWhyText, meterOf, reasonsText, requestText, SOLVE_PROGRESS_TREE_CAP,
    tileIndex, tileShade, treeRows, wallBySiteRows, workCounters,
} from './seedlingSolveProgress.js';
import { progressIntervalMs, SOLVE_PROGRESS_INTERVAL_MS } from '../seedlingDemo/solveProgressTap.js';

/** The show/hide transitions `lifecycle` keeps. */
const LIFECYCLE_CAP = 64;

const ACCENT = '#e94560';
/** ⛓ TIER A — the recency palette's hue (the meter's window marker's gold). */
const RECENT = [245, 197, 24];
const MAP_WIDTH = 288;
const MAP_BACKGROUND = '#0a0a0a';
/**
 * Every tree row: the tree scrolls in a 320 px box, so most of its 160 rows are off screen — `content-visibility`
 * lets the browser skip their layout and paint (an off-screen row keeps its last height).
 */
const TREE_ROW_CSS = 'content-visibility:auto;contain-intrinsic-size:auto 14px;';
const EMPTY_TILES = 'empty';
/** ⛓ RK VIEW — a refusal-kind chip on a tree row. */
const CHIP_CSS = 'display:inline-block;margin-left:4px;padding:0 3px;border:1px solid #555;border-radius:3px;'
    + 'background:#222;color:#ddd;font-size:10px;line-height:12px;';
/**
 * ⛓ RK VIEW — the last why's length while it is closed (some whys run to 900+ characters): the line is also clipped
 * to one line with an ellipsis by its style, and the full sentence is its tooltip.
 */
export const LAST_WHY_CHARS = 200;
const WHY_CLOSED_CSS = 'color:#ccc;margin:0 0 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;';
const WHY_OPEN_CSS = 'color:#ccc;margin:0 0 4px;white-space:pre-wrap;overflow-wrap:anywhere;cursor:pointer;';
/** ⛓ STAMPS VIEW — the site pairs the wall line names before it counts the rest (Σ is always over every pair). */
export const WALL_SITES_SHOWN = 6;

/** ⛓ FRAME VIEW — a danger's glyph per kind (TC2's `dangerKindOf`); a kind not listed draws `?`. */
export const DANGER_GLYPHS = Object.freeze({ forecast: '»', volume: '■', phase: '◐' });
const STANCE_COLOUR = '#4fc3f7';
const TARGET_COLOUR = '#ffffff';
/** The danger colour: the frame view's danger mark, and ⛓ CACHES VIEW's `DANGER_KINDS`. */
export const DANGER_COLOUR = '#ff8c1a';
/** ⛓ FRAME VIEW — the outline on the tree row the frame belongs to. */
const FRAME_ROW_CSS = `outline:1px solid ${STANCE_COLOUR};outline-offset:-1px;`;
const MARKS_CSS = 'position:absolute;left:1px;top:1px;pointer-events:none;';

/**
 * ⛓ CACHES VIEW — the refusal kinds drawn in the danger colour (`DANGER_COLOUR`, the frame view's danger mark): a
 * `soft-lock` refusal says the action would wedge the game, not that the search failed.
 */
export const DANGER_KINDS = Object.freeze(['soft-lock']);
const DANGER_CHIP_CSS = `${CHIP_CSS}border-color:${DANGER_COLOUR};color:${DANGER_COLOUR};`;
const DANGER_TEXT_CSS = `color:${DANGER_COLOUR};`;
/** ⛓ CACHES VIEW — the last why's style: open or closed, in the danger colour when its kind is one. */
const whyCss = (open, danger) => (open ? WHY_OPEN_CSS : WHY_CLOSED_CSS) + (danger ? DANGER_TEXT_CSS : '');

/**
 * ⛓ FRAME VIEW — the tile a `frame.target` id names: `tile:col,row` and `pit:col,row` are tiles already; any other id
 * carrying `@x,y` (a body `puncher@128,624`, a lock `lock@144,112 {t 0, tag 3}`, a rope `Rope@64,32`) is its census
 * placement in pixels, `[floor(x / 16), floor(y / 16)]`. An id with neither (`tile:Stone`) has no tile: `null`.
 */
export function frameTargetTile(id) {
    if (typeof id !== 'string') return null;
    const t = /^(?:tile|pit):(-?\d+),(-?\d+)$/.exec(id);
    if (t) return [Number(t[1]), Number(t[2])];
    const p = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(id);
    return p ? [Math.floor(Number(p[1]) / 16), Math.floor(Number(p[2]) / 16)] : null;
}

const isCell = (c) => Array.isArray(c) && c.length === 2 && Number.isInteger(c[0]) && Number.isInteger(c[1]);

/**
 * ⛓ FRAME VIEW — what the map marks for a snapshot: `null` with no frame; otherwise `{key, onMap, stance, target,
 * danger}`, where `onMap` is whether the tiles are the segment's level, and each mark is `null` when the frame has
 * none (a target whose id names no tile keeps its id with `at: null`). Unknown fields are ignored.
 */
export function frameMarks(snap) {
    const f = snap?.frame;
    if (!f || typeof f !== 'object') return null;
    const level = snap.tiles?.level;
    const d = f.danger && typeof f.danger === 'object' ? f.danger : null;
    return {
        key: f.key ?? null,
        onMap: level !== undefined && level !== null && level === snap.segment?.level,
        stance: isCell(f.stance) ? [f.stance[0], f.stance[1]] : null,
        target: typeof f.target === 'string' ? { id: f.target, at: frameTargetTile(f.target) } : null,
        danger: d ? { source: d.source ?? null, kind: d.kind ?? null, tick: d.tick ?? null, at: isCell(d.at) ? [d.at[0], d.at[1]] : null,
            glyph: DANGER_GLYPHS[d.kind] ?? '?' } : null,
    };
}

/** ⛓ FRAME VIEW — the line under the map. */
export function frameText(m) {
    if (m === null) return '';
    const cell = (c) => (c ? `(${c[0]},${c[1]})` : '—');
    const parts = [`stance ${cell(m.stance)}`];
    if (m.target) parts.push(`target ${m.target.id} ${m.target.at ? `at ${cell(m.target.at)}` : '(no tile)'}`);
    if (m.danger) parts.push(`danger ${m.danger.glyph} ${m.danger.kind ?? '?'} ${m.danger.source ?? '?'} at ${cell(m.danger.at)}`
        + (m.danger.tick !== null ? ` t${m.danger.tick}` : ''));
    return `frame: ${parts.join(' · ')}${m.onMap ? '' : ' (not marked: the map is another level)'}`;
}

const el = (tag, css = '', text = null) => {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text !== null) e.textContent = text;
    return e;
};

/** The shade levels a cell is painted in (a shade in [0, 1] is quantized to one of them). */
const SHADE_LEVELS = 256;

/**
 * A reached cell's colour: the accent at alpha `0.15 + 0.85·shade`, composited over the map's background into an
 * OPAQUE colour — so a changed cell is repainted with one `fillRect`, without the old colour bleeding through.
 */
export function cellColour(shade, [r, g, b] = [233, 69, 96]) {
    const a = 0.15 + 0.85 * shade;
    const mix = (fg, bg) => Math.round(bg + a * (fg - bg));
    return `rgb(${mix(r, 10)},${mix(g, 10)},${mix(b, 10)})`;
}

/**
 * `cellColour` at each of the `SHADE_LEVELS` levels, built once: a render indexes it, never builds a string. Levels
 * `SHADE_LEVELS …` are ⛓ TIER A's recency palette (the same shades in `RECENT`'s hue).
 */
const PALETTE = [
    ...Array.from({ length: SHADE_LEVELS }, (_, i) => cellColour(i / (SHADE_LEVELS - 1))),
    ...Array.from({ length: SHADE_LEVELS }, (_, i) => cellColour(i / (SHADE_LEVELS - 1), RECENT)),
];

/** A shade's palette level. */
export const shadeLevel = (shade) => Math.round(shade * (SHADE_LEVELS - 1));

/** ⛓ TIER A — a RECENT cell's palette level: its rise, shaded against the map's largest rise. */
export const recentLevel = (shade) => SHADE_LEVELS + shadeLevel(shade);

/** The palette colour of a level (`shadeLevel`). */
export const levelColour = (level) => PALETTE[level];

/** "Nothing painted here" in the cell buffers (the background). */
const UNPAINTED = -1;

/** The next animation frame, or a 16 ms timer where there is none (node). */
const nextFrame = (fn) => (typeof globalThis.requestAnimationFrame === 'function'
    ? globalThis.requestAnimationFrame(fn) : setTimeout(fn, 16));

/**
 * @param {object} o
 * @param {() => object[]} o.getServices  the solve services the panel can reach now
 * @param {() => number} [o.now]
 * @param {(fn: () => void) => void} [o.frame]  schedules a render (default: the next animation frame)
 */
export class SolveProgressView {
    constructor({ getServices, now = () => Date.now(), frame = nextFrame }) {
        this.now = now;
        // the option is named `frame` (an animation frame); kept as `scheduleRender` so it never reads as the
        // snapshot's `frame` (⛓ FRAME VIEW)
        this.scheduleRender = frame;
        /** ⚖ `flashPanel.seedlingSolveProgressIntervalMs`: the rate this view asks its services for (`setIntervalMs`). */
        this.intervalMs = SOLVE_PROGRESS_INTERVAL_MS;
        this.stats = { notes: 0, renders: 0, coalesced: 0, hiddenSkipped: 0, resizes: 0, cellsPainted: 0, rowsWritten: 0,
            linesWritten: 0,
            // ⛓ FRAME VIEW — notes that carried a frame, renders that marked one on the map, marks-canvas redraws
            framesReceived: 0, framesMarked: 0, marksDrawn: 0 };
        this._dirty = true;
        this._pending = false;
        this._tilesKey = null;
        /** per cell (row·cols + col): the palette level painted there, or UNPAINTED — and the buffer a render fills. */
        this._painted = new Int16Array(0);
        this._next = new Int16Array(0);
        /**
         * ⛓ TIER A — per cell, the count of the snapshot drawn LAST (`_reached`) and of the one drawn before it
         * (`_base`): the rise between them is the cell's recency. `_drawn` is the snapshot `_reached` holds and
         * `_recentKey` its stream (solve, segment, level): a snapshot of another stream starts from an empty base.
         */
        this._reached = new Int32Array(0);
        this._base = new Int32Array(0);
        this._drawn = null;
        this._recentKey = null;
        this.recent = { cells: 0, max: 0 };
        /** the tree's row elements, in order; each remembers what it shows (`_shown`). */
        this._lines = [];
        /** ⛓ FRAME VIEW — the marks canvas and line (made on the first frame), and what they show now. */
        this.marksCanvas = null;
        this.frameLine = null;
        this.marks = null;
        this._marksKey = null;
        this.state = emptyProgress();
        this.expanded = new Set();
        this.mode = 'off';
        this.visible = false;
        this.lifecycle = [];
        this.element = el('div', 'flex-shrink:0;margin-top:6px;font-size:11px;background:#111;border:1px solid #333;'
            + 'border-radius:4px;padding:6px;display:none;');
        this.element.className = 'flash-panel-solve-progress';
        const title = el('div', `color:${ACCENT};margin-bottom:4px;`, 'Solve progress');
        this.header = el('div', 'color:#aaa;white-space:pre-wrap;');
        this.meter = el('div', 'margin:4px 0;');
        this.meterBar = el('div', 'position:relative;height:8px;background:#222;border:1px solid #444;border-radius:2px;');
        this.meterFill = el('div', `position:absolute;left:0;top:0;bottom:0;background:${ACCENT};width:0;`);
        this.meterWindow = el('div', 'position:absolute;top:-2px;bottom:-2px;width:2px;background:#f5c518;display:none;');
        this.meterBar.append(this.meterFill, this.meterWindow);
        this.meterText = el('div', 'color:#aaa;margin-top:2px;');
        // ⛓ TIER A — the segment's asks by site and its work counters
        this.asksText = el('div', 'color:#888;white-space:pre-wrap;');
        this.asksText.className = 'flash-panel-solve-progress-asks';
        this.workText = el('div', 'color:#888;white-space:pre-wrap;');
        this.workText.className = 'flash-panel-solve-progress-work';
        this.meter.append(this.meterBar, this.meterText, this.asksText, this.workText);
        // ⛓ STAMPS VIEW — the request identity and the plan in hand (under the header), the rate/ETA and the wall by
        // site (under the meter's text): inserted on the first snapshot that carries a Tier B stamp
        this.requestText = el('div', 'color:#aaa;white-space:pre-wrap;overflow-wrap:anywhere;');
        this.requestText.className = 'flash-panel-solve-progress-request';
        this.bestText = el('div', 'color:#aaa;');
        this.bestText.className = 'flash-panel-solve-progress-best';
        this.stampsHead = el('div');
        this.stampsHead.append(this.requestText, this.bestText);
        this.etaText = el('div', 'color:#888;');
        this.etaText.className = 'flash-panel-solve-progress-eta';
        this.wallText = el('div', 'color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;');
        this.wallText.className = 'flash-panel-solve-progress-wall';
        this._stampsShown = false;
        // ⛓ TIER A — the active path, one line, with its climb depth
        this.pathText = el('div', 'color:#ccc;margin:2px 0 4px;white-space:pre-wrap;');
        this.pathText.className = 'flash-panel-solve-progress-path';
        // ⛓ RK VIEW — the refusals by kind and the last why: inserted before the body on the first snapshot that
        // carries them (a v1 stream never sees them)
        this.kindsText = el('div', 'color:#888;white-space:pre-wrap;');
        this.kindsText.className = 'flash-panel-solve-progress-kinds';
        this.whyText = el('div', WHY_CLOSED_CSS);
        this.whyText.className = 'flash-panel-solve-progress-why';
        this._whyOpen = false;
        this.rkBox = el('div');
        this.rkBox.append(this.kindsText, this.whyText);
        this._rkShown = false;
        /** ⛓ CACHES VIEW — the danger entry the kinds line shows as a span (`null`: the line is one text). */
        this._kindsDanger = null;
        // ⛓ CACHES VIEW — the caches and the churn, at the end of the meter: made and inserted on the first snapshot
        // that carries either (until then `null`, so a stream without them makes no node)
        this.cachesBox = null;
        this.cachesText = null;
        this.churnText = null;
        this._cachesShown = false;
        this.whyText.addEventListener('click', () => {
            this._whyOpen = !this._whyOpen;
            this._renderRK();
        });
        const body = el('div', 'display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap;');
        this.body = body;
        // ⛓ TIER A — the map box's width is the CANVAS's (at least MAP_WIDTH), set on a resize only, and its caption
        // wraps inside it: a caption that sized the box (its counts change width every note) re-flexed the tree's
        // width every note, which re-laid out every row (S2's bench: churn layout ~6 → ~2 ms)
        const mapBox = el('div', `flex-shrink:0;width:${MAP_WIDTH}px;`);
        this.mapBox = mapBox;
        this.canvas = el('canvas', `background:${MAP_BACKGROUND};border:1px solid #333;image-rendering:pixelated;display:block;`);
        this.canvas.className = 'flash-panel-solve-progress-tiles';
        this.canvas.width = MAP_WIDTH;
        this.canvas.height = 1;
        this.tileText = el('div', 'color:#aaa;margin-top:2px;min-height:1.2em;white-space:normal;overflow-wrap:anywhere;');
        mapBox.append(this.canvas, this.tileText);
        this.tree = el('div', 'flex:1 1 220px;min-width:200px;max-height:320px;overflow:auto;white-space:pre;');
        this.tree.className = 'flash-panel-solve-progress-tree';
        this._moreLine = el('div', 'color:#777;');
        body.append(mapBox, this.tree);
        this.element.append(title, this.header, this.meter, this.pathText, body);

        this.canvas.addEventListener('mousemove', (e) => this._hover(e));
        this.canvas.addEventListener('mouseleave', () => { this.tileText.textContent = this._tileSummary(); });
        this.tree.addEventListener('click', (e) => {
            const key = e.target?.closest?.('[data-key]')?.dataset?.key;
            if (!key) return;
            if (this.expanded.has(key)) this.expanded.delete(key); else this.expanded.add(key);
            this._renderTree();
        });

        this.feed = createSolveProgressFeed({
            getServices,
            onNote: (note) => this.receive(note),
            tick: () => { if (this.visible) this._renderHeader(); },
            intervalMs: () => this.intervalMs,
        });
        this._mirror();
    }

    /** Whether the view is SHOWN. */
    get isOpen() { return this.visible; }
    /** Whether the feed is subscribed (`auto` listens while hidden). */
    get isListening() { return this.feed.isOpen; }

    /**
     * ⛓ AUTO-SHOW — apply the setting. `off` closes (UNSUBSCRIBES every service); `auto` subscribes and stays hidden
     * until a solve reports; `always` shows and subscribes (a solve already in flight reports from the next solve on).
     */
    setMode(mode) {
        if (mode === this.mode) return;
        const was = this.mode;
        this.mode = mode;
        if (mode === 'off') {
            this.feed.close();
            this._setVisible(false, null);
            this._mirror();
            return;
        }
        if (was === 'off') {
            this.state = emptyProgress();
            this.expanded = new Set();
        }
        this.feed.open();
        this._setVisible(mode === 'always' || (mode === 'auto' && this.visible && !this.state.final), null);
        this._mirror();
        // ⛓ INCREMENTAL — the catch-up: a view shown here draws the newest state (kept while it was hidden)
        this._invalidate();
    }

    /**
     * ⚖ `flashPanel.seedlingSolveProgressIntervalMs` — the progress rate to ask for (clamped to the list). It rides
     * the next solve's envelope: a solve already running keeps the rate it started with.
     */
    setIntervalMs(ms) { this.intervalMs = progressIntervalMs(ms); }

    /** Show the view pinned open (`always`). */
    open() { this.setMode('always'); }

    /** Hide the view and UNSUBSCRIBE from every service (`off`). */
    close() { this.setMode('off'); }

    _setVisible(visible, note) {
        if (visible === this.visible) return;
        this.visible = visible;
        this.element.style.display = visible ? 'block' : 'none';
        this.lifecycle.push({ event: visible ? 'show' : 'hide', mode: this.mode, solveId: note?.solveId ?? null,
            seq: note?.snapshot?.seq ?? null, final: note ? note.final === true : null, at: this.now() });
        if (this.lifecycle.length > LIFECYCLE_CAP) this.lifecycle.shift();
        const d = this.element.dataset;
        const key = visible ? 'shows' : 'hides';
        d[key] = String(Number(d[key] ?? 0) + 1);
        d[visible ? 'shownAt' : 'hiddenAt'] = String(this.lifecycle.at(-1).at);
        if (visible) d.shownFinal = String(note ? note.final === true : false);
    }

    /** The `data-*` mirror of the mode and the stream (the show/hide counts are written by `_setVisible`). */
    _mirror() {
        const d = this.element.dataset;
        d.mode = this.mode;
        d.visible = String(this.visible);
        d.listening = String(this.feed.isOpen);
        d.final = String(this.state.final === true);
        d.outcome = this.state.snapshot?.segment?.outcome ?? '';
    }

    receive(note) {
        const next = applyProgress(this.state, note, this.now());
        if (next === this.state) return;
        if (next.segmentChanged) this.expanded = new Set();
        this.state = next;
        this.stats.notes += 1;
        if (note?.snapshot?.frame) this.stats.framesReceived += 1;
        this._setVisible(autoVisibility(this.mode, this.visible, note), note);
        this._mirror();
        this._invalidate();
    }

    /** ⛓ INCREMENTAL — the state changed: render it at the next frame (once, however many notes arrive first). */
    _invalidate() {
        this._dirty = true;
        if (!this.visible) { this.stats.hiddenSkipped += 1; return; }
        if (this._pending) { this.stats.coalesced += 1; return; }
        this._schedule();
    }

    _schedule() {
        if (this._pending) return;
        this._pending = true;
        this.scheduleRender(() => { this._pending = false; this.flush(); });
    }

    /** Render the newest state now, if it changed since the last render and the view is shown. */
    flush() {
        if (!this._dirty || !this.visible) return;
        this._dirty = false;
        this.render();
    }

    render() {
        this.stats.renders += 1;
        this._renderHeader();
        this._renderMeter();
        this._renderTierA();
        this._renderStamps();
        this._renderCaches();
        this._renderRK();
        this._renderTiles();
        this._renderFrame();
        this._renderTree();
    }

    _renderHeader() {
        const s = this.state;
        const snap = s.snapshot;
        if (!snap) {
            this.header.textContent = this.feed.subscribed > 0
                ? 'waiting for the next solve (a solve already running when the view opened does not report)'
                : 'no solve service on this page yet (the Playback Bot\'s solver: runtime js or wasm)';
            return;
        }
        const seg = snap.segment ?? {};
        const age = s.receivedAt === null ? '?' : Math.max(0, Math.round((this.now() - s.receivedAt) / 1000));
        this.header.textContent = `solve #${s.solveId} · segment ${seg.index ?? '?'}${seg.pass ? ` (${seg.pass})` : ''}`
            + ` · ${seg.name ?? ''} L${seg.level ?? '?'} · ${s.final ? `${seg.outcome} — final` : seg.outcome}\n`
            + `seq ${snap.seq ?? '—'} · ${s.received} update(s) · last update ${age} s ago`;
    }

    _renderMeter() {
        const m = meterOf(this.state.snapshot);
        if (m.limit === null) {
            this.meterFill.style.width = '0';
            this.meterWindow.style.display = 'none';
            this.meterText.textContent = this.state.snapshot ? `work ${m.spent} units (no budget: in place)` : 'work —';
            return;
        }
        this.meterFill.style.width = `${(m.fraction * 100).toFixed(1)}%`;
        if (m.window !== null) {
            this.meterWindow.style.display = 'block';
            this.meterWindow.style.left = `${Math.min(100, (m.window / m.limit) * 100).toFixed(1)}%`;
        } else this.meterWindow.style.display = 'none';
        this.meterText.textContent = `work ${m.spent} / ${m.limit} units`
            + (m.window !== null ? ` · upgrade window ${m.window}` : '');
    }

    /** Write `text` into `node` only when it differs (a Tier A line is one text write, or none). */
    _line(node, text) {
        if (node.textContent === text) return;
        node.textContent = text;
        this.stats.linesWritten += 1;
    }

    /** ⛓ TIER A — the asks by site, the work counters, and the active path with its climb depth. */
    _renderTierA() {
        const snap = this.state.snapshot;
        if (!snap) {
            this._line(this.asksText, '');
            this._line(this.workText, '');
            this._line(this.pathText, '');
            return;
        }
        const asks = asksBySite(snap);
        this._line(this.asksText, asks.rows.length
            ? `asks by site (this segment): ${asks.rows.map(([k, n]) => `${k} ${n}`).join(' · ')} · Σ ${asks.total}`
            : 'asks by site (this segment): none yet');
        const work = workCounters(snap);
        this._line(this.workText, work.length ? `work: ${work.map(([k, n]) => `${k} ${n}`).join(' · ')}` : '');
        const { nodes, climbDepth } = activePath(snap.tree);
        this._line(this.pathText, nodes.length
            ? `active: ${nodes.map((n) => (n.label && n.label !== n.role ? `${n.role} ${n.label}` : n.role)).join(' › ')}`
                + ` · climb depth ${climbDepth}`
            : `active: — (${this.state.final ? 'finished' : 'nothing running'})`);
    }

    /**
     * ⛓ RK VIEW — the segment's refusals by kind (each once) and its last why, clamped unless opened. Nothing is
     * drawn or inserted until a snapshot carries `rejectionKinds` or a `lastWhy`.
     */
    _renderRK() {
        const snap = this.state.snapshot;
        const totals = snap ? kindTotals(snap.tree) : null;
        const why = snap ? lastWhyText(snap.lastWhy) : null;
        if (!this._rkShown) {
            if (totals === null && why === null) return;
            // before the body: the body is moved after it (append and remove only — every DOM the view meets has them)
            this.body.remove();
            this.element.append(this.rkBox, this.body);
            this._rkShown = true;
        }
        this._kindsLine(totals === null ? ''
            : `refusals by kind (this segment, each once): ${totals.rows.length
                ? `${totals.rows.map(([k, n]) => `${k} ${n}`).join(' · ')} · Σ ${totals.total}` : 'none yet'}`,
        totals?.rows.find(([k]) => DANGER_KINDS.includes(k)) ?? null);
        const text = why === null ? '' : `last why: ${this._whyOpen ? why : clampText(why, LAST_WHY_CHARS)}`;
        this._line(this.whyText, text);
        const title = why ?? '';
        if (this.whyText.title !== title) this.whyText.title = title;
        const css = whyCss(this._whyOpen, why !== null && DANGER_KINDS.includes(snap.lastWhy.kind));
        if (this.whyText.style.cssText !== css) this.whyText.style.cssText = css;
    }

    /**
     * ⛓ CACHES VIEW — the kinds line: one text write while no danger kind is listed (the RK view's bytes); with one,
     * [the text before it, a span in the danger colour, the text after it], rebuilt only when the line changes.
     */
    _kindsLine(text, danger) {
        const node = this.kindsText;
        if (danger === null) {
            if (this._kindsDanger !== null) { node.textContent = ''; this._kindsDanger = null; }
            this._line(node, text);
            return;
        }
        const entry = `${danger[0]} ${danger[1]}`;
        if (this._kindsDanger === entry && node.textContent === text) return;
        // the entry is `kind n` between ': ' or ' · ' and ' · ': no kind name contains another's, nor the prefix
        const at = text.indexOf(entry);
        node.textContent = '';
        node.append(document.createTextNode(text.slice(0, at)), el('span', DANGER_TEXT_CSS, entry),
            document.createTextNode(text.slice(at + entry.length)));
        this._kindsDanger = entry;
        this.stats.linesWritten += 1;
    }

    /**
     * ⛓ CACHES VIEW — the segment's caches and churn (hammer-phase PR). Nothing is made or inserted until a snapshot
     * carries `caches` or `churn`; then both lines go at the end of the meter (append and remove only), each one
     * `_line` write when its text changes. A later snapshot without them empties the lines.
     */
    _renderCaches() {
        const snap = this.state.snapshot;
        const caches = snap ? cachesText(snap) : null;
        const churn = snap ? churnText(snap) : null;
        if (!this._cachesShown) {
            if (caches === null && churn === null) return;
            this.cachesText = el('div', 'color:#888;white-space:pre-wrap;');
            this.cachesText.className = 'flash-panel-solve-progress-caches';
            this.churnText = el('div', 'color:#888;white-space:pre-wrap;');
            this.churnText.className = 'flash-panel-solve-progress-churn';
            this.cachesBox = el('div');
            this.cachesBox.append(this.cachesText, this.churnText);
            this.meter.append(this.cachesBox);
            this._cachesShown = true;
        }
        this._line(this.cachesText, caches ?? '');
        this._line(this.churnText, churn ?? '');
    }

    /**
     * ⛓ STAMPS VIEW — the request identity, the plan in hand, the rate/ETA and the wall by site. Nothing is drawn or
     * inserted until a snapshot carries a Tier B stamp (or the solve's kept request): the lines go in with append and
     * remove only (every DOM the view meets has them), after the header and after the meter's text.
     */
    _renderStamps() {
        const s = this.state;
        const snap = s.snapshot;
        const b = snap?.budget ?? {};
        if (!this._stampsShown) {
            if (!snap || !(s.request || snap.best || b.wallBySite || b.rate)) return;
            const after = [this.meter, this.pathText, ...(this._rkShown ? [this.rkBox] : []), this.body];
            for (const n of after) n.remove();
            this.element.append(this.stampsHead, ...after);
            this.asksText.remove();
            this.workText.remove();
            if (this._cachesShown) this.cachesBox.remove();
            this.meter.append(this.etaText, this.wallText, this.asksText, this.workText,
                ...(this._cachesShown ? [this.cachesBox] : []));
            this._stampsShown = true;
        }
        this._line(this.requestText, requestText(s.request) ?? '');
        this._line(this.bestText, snap ? bestText(snap.best) : '');
        this._line(this.etaText, (snap && etaText(snap)) ?? '');
        const wall = snap ? wallBySiteRows(snap) : null;
        let text = '';
        let title = '';
        if (wall) {
            const pair = ([k, ms]) => `${k} ${formatMs(ms)}`;
            const more = wall.rows.length - WALL_SITES_SHOWN;
            text = `wall by site (this attempt): ${wall.rows.length
                ? `${wall.rows.slice(0, WALL_SITES_SHOWN).map(pair).join(' · ')}${more > 0 ? ` · +${more} more` : ''}`
                    + ` · Σ ${formatMs(wall.total)}`
                : 'none yet'}`;
            title = wall.rows.map(pair).join('\n');
        }
        this._line(this.wallText, text);
        if (this.wallText.title !== title) this.wallText.title = title;
    }

    _cellPx(tiles) {
        return Math.max(2, Math.min(16, Math.floor(MAP_WIDTH / Math.max(1, tiles.cols ?? 1))));
    }

    /**
     * ⛓ INCREMENTAL — size the canvas for `key` (the room's size), only when it changed: assigning `width`/`height`
     * reallocates and CLEARS the canvas, even to the same value. A resize forgets every painted cell.
     */
    _sizeCanvas(key, width, height, cells, ctx) {
        if (key === this._tilesKey) return;
        this._tilesKey = key;
        this.canvas.width = width;
        this.canvas.height = height;
        this.mapBox.style.width = `${Math.max(width, MAP_WIDTH)}px`;
        this.stats.resizes += 1;
        this._painted = new Int16Array(cells).fill(UNPAINTED);
        this._next = new Int16Array(cells);
        this._reached = new Int32Array(cells);
        this._base = new Int32Array(cells);
        this._drawn = null;
        if (ctx) { ctx.fillStyle = MAP_BACKGROUND; ctx.fillRect(0, 0, width, height); }
    }

    _renderTiles() {
        const tiles = this.state.snapshot?.tiles ?? null;
        const ctx = this.canvas.getContext?.('2d') ?? null;
        if (!tiles || !tiles.cols || !tiles.rows) {
            this._sizeCanvas(EMPTY_TILES, MAP_WIDTH, 24, 0, ctx);
            this.tileText.textContent = 'no previewed states yet';
            this._index = null;
            this.recent = { cells: 0, max: 0 };
            return;
        }
        const px = this._cellPx(tiles);
        const { cols, rows } = tiles;
        this._sizeCanvas(`${cols}x${rows}@${px}`, cols * px, rows * px, cols * rows, ctx);
        this._index = tileIndex(tiles);
        this._px = px;
        this._advanceRecency(tiles);
        if (ctx) this._paintCells(ctx, tiles, px);
        this.tileText.textContent = this._tileSummary();
    }

    /**
     * ⛓ TIER A — a NEW snapshot (not a re-render of the drawn one): the counts drawn last become the base, and the
     * new counts are read in. A snapshot of another stream (solve, segment or level) starts from an empty base. Then
     * `recent` = how many cells rose since the base, and the largest rise.
     */
    _advanceRecency(tiles) {
        const snap = this.state.snapshot;
        if (snap !== this._drawn) {
            const key = `${this.state.service}:${this.state.solveId}:${snap.segment?.index ?? ''}:${tiles.level}`;
            const base = this._reached;
            this._reached = this._base;
            this._base = base;
            if (this._drawn === null || key !== this._recentKey) this._base.fill(0);
            this._recentKey = key;
            this._drawn = snap;
            const reached = this._reached;
            reached.fill(0);
            for (const [col, row, n] of tiles.cells) {
                if (col < 0 || row < 0 || col >= tiles.cols || row >= tiles.rows) continue;
                reached[row * tiles.cols + col] = n;
            }
        }
        let cells = 0;
        let max = 0;
        for (let i = 0; i < this._reached.length; i += 1) {
            const rise = this._reached[i] - this._base[i];
            if (rise > 0) { cells += 1; if (rise > max) max = rise; }
        }
        this.recent = { cells, max };
    }

    /**
     * ⛓ INCREMENTAL — paint only the cells whose palette level changed (a cell no longer reached — a new segment in
     * the same room — goes back to the background), GROUPED by colour: one `fillStyle` per colour, not per cell.
     */
    _paintCells(ctx, tiles, px) {
        const { cols, rows } = tiles;
        const painted = this._painted;
        const next = this._next;
        next.fill(UNPAINTED);
        const max = this._index.max;
        const base = this._base;
        const riseMax = this.recent.max;
        for (const [col, row, reached] of tiles.cells) {
            if (col < 0 || row < 0 || col >= cols || row >= rows) continue;
            const i = row * cols + col;
            // ⛓ TIER A — a cell that rose since the last drawn snapshot is painted in the recency palette
            const rise = reached - base[i];
            next[i] = rise > 0 ? recentLevel(tileShade(rise, riseMax)) : shadeLevel(tileShade(reached, max));
        }
        // a counting sort of the changed cells by level, into buffers kept across renders (no allocation per
        // render): level L counts in slot L + 2 (UNPAINTED = -1 in slot 1), so after the prefix sum slot L + 1 holds
        // where level L's run STARTS — the scatter's cursor
        const counts = this._levelCounts ?? (this._levelCounts = new Int32Array(PALETTE.length + 2));
        counts.fill(0);
        let changed = 0;
        for (let i = 0; i < next.length; i += 1) {
            if (next[i] === painted[i]) continue;
            counts[next[i] + 2] += 1;
            changed += 1;
        }
        if (changed === 0) { this._painted = next; this._next = painted; return; }
        for (let k = 1; k < counts.length; k += 1) counts[k] += counts[k - 1];
        if (!this._order || this._order.length < next.length) this._order = new Int32Array(next.length);
        const order = this._order;
        for (let i = 0; i < next.length; i += 1) {
            if (next[i] === painted[i]) continue;
            order[counts[next[i] + 1]] = i;
            counts[next[i] + 1] += 1;
        }
        // after the scatter, counts[k + 1] ends level k's run (k = -1 … PALETTE.length - 1)
        let at = 0;
        for (let level = UNPAINTED; level < PALETTE.length; level += 1) {
            const end = counts[level + 1];
            if (end === at) continue;
            ctx.fillStyle = level === UNPAINTED ? MAP_BACKGROUND : PALETTE[level];
            for (; at < end; at += 1) {
                const i = order[at];
                ctx.fillRect((i % cols) * px, Math.floor(i / cols) * px, px, px);
            }
        }
        this.stats.cellsPainted += changed;
        this._painted = next;
        this._next = painted;
    }

    /**
     * ⛓ FRAME VIEW — mark the active frame on the map. Nothing is made or inserted before the first snapshot that
     * carries a frame. The marks canvas is redrawn only when the marks or the map's size change.
     */
    _renderFrame() {
        const snap = this.state.snapshot;
        const m = frameMarks(snap);
        if (this.marksCanvas === null) {
            if (m === null) return;
            this.mapBox.style.position = 'relative';
            this.marksCanvas = el('canvas', MARKS_CSS);
            this.marksCanvas.className = 'flash-panel-solve-progress-marks';
            this.frameLine = el('div', 'color:#aaa;white-space:normal;overflow-wrap:anywhere;');
            this.frameLine.className = 'flash-panel-solve-progress-frame';
            this.mapBox.append(this.marksCanvas, this.frameLine);
        }
        this.marks = m;
        this._line(this.frameLine, frameText(m));
        const tiles = snap?.tiles;
        const draw = m !== null && m.onMap && this._index ? m : null;
        if (draw !== null) this.stats.framesMarked += 1;
        const key = JSON.stringify([this._tilesKey, draw && [draw.stance, draw.target?.at, draw.danger?.at, draw.danger?.glyph,
            draw.danger?.source]]);
        if (key === this._marksKey) return;
        this._marksKey = key;
        const c = this.marksCanvas;
        if (c.width !== this.canvas.width) c.width = this.canvas.width;
        if (c.height !== this.canvas.height) c.height = this.canvas.height;
        const ctx = c.getContext?.('2d') ?? null;
        this.stats.marksDrawn += 1;
        if (!ctx) return;
        ctx.clearRect(0, 0, c.width, c.height);
        if (draw === null) return;
        const px = this._px;
        const inside = (t) => t && t[0] >= 0 && t[1] >= 0 && t[0] < tiles.cols && t[1] < tiles.rows;
        ctx.lineWidth = Math.max(1, Math.floor(px / 8));
        if (inside(draw.danger?.at)) {
            const [col, row] = draw.danger.at;
            ctx.strokeStyle = DANGER_COLOUR;
            ctx.strokeRect(col * px + 0.5, row * px + 0.5, px - 1, px - 1);
            ctx.fillStyle = DANGER_COLOUR;
            ctx.font = `${Math.max(6, px - 2)}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(draw.danger.glyph, col * px + px / 2, row * px + px / 2);
            if (draw.danger.source) {
                ctx.font = `${Math.max(6, Math.min(10, px - 4))}px monospace`;
                ctx.textAlign = col * px > c.width / 2 ? 'right' : 'left';
                ctx.textBaseline = row > 0 ? 'bottom' : 'top';
                ctx.fillText(draw.danger.source, col * px > c.width / 2 ? col * px - 1 : (col + 1) * px + 1,
                    row > 0 ? row * px : (row + 1) * px);
            }
        }
        if (inside(draw.target?.at)) {
            const [col, row] = draw.target.at;
            ctx.strokeStyle = TARGET_COLOUR;
            ctx.beginPath();
            ctx.moveTo(col * px + 1, row * px + 1);
            ctx.lineTo((col + 1) * px - 1, (row + 1) * px - 1);
            ctx.moveTo((col + 1) * px - 1, row * px + 1);
            ctx.lineTo(col * px + 1, (row + 1) * px - 1);
            ctx.stroke();
        }
        if (inside(draw.stance)) {
            const [col, row] = draw.stance;
            ctx.strokeStyle = STANCE_COLOUR;
            ctx.strokeRect(col * px + 1.5, row * px + 1.5, px - 3, px - 3);
        }
    }

    _tileSummary() {
        const tiles = this.state.snapshot?.tiles;
        if (!tiles) return 'no previewed states yet';
        return `L${tiles.level}: ${tiles.cells.length} of ${tiles.cols}×${tiles.rows} tiles reached (max ${this._index?.max ?? 0})`
            + ` · ${this.recent.cells} rose since the last update drawn (gold; max +${this.recent.max})`;
    }

    _hover(e) {
        if (!this._index) return;
        const r = this.canvas.getBoundingClientRect();
        const sx = this.canvas.width / (r.width || this.canvas.width);
        const sy = this.canvas.height / (r.height || this.canvas.height);
        const col = Math.floor(((e.clientX - r.left) * sx) / this._px);
        const row = Math.floor(((e.clientY - r.top) * sy) / this._px);
        const c = this._index.at(col, row);
        const cols = this.state.snapshot?.tiles?.cols ?? 0;
        const rise = c ? c[2] - (this._base[row * cols + col] ?? 0) : 0;
        this.tileText.textContent = c ? `tile (${col},${row}): reached ${c[2]}`
            + `${rise > 0 ? ` (+${rise} since the last update drawn)` : ''}, earliest tick ${c[3]}`
            : `tile (${col},${row}): not reached`;
    }

    /**
     * ⛓ INCREMENTAL — the tree's rows are DIFFED, not rebuilt: row i reuses the i-th element and writes only what
     * changed (each element remembers what it shows); surplus elements are removed; "… N more" stays last.
     * ⛓ RK VIEW — a row with refusal kinds is [its text, its chips, its inline reasons]: the chip box and the tail
     * text node are made on the row's first chip (a v1 row is still ONE text node) and kept, emptied, after that.
     */
    _renderTree() {
        const tree = this.state.snapshot?.tree ?? null;
        // ⛓ FRAME VIEW — the row the active frame belongs to is outlined
        const frameKey = this.state.snapshot?.frame?.key ?? null;
        const { rows, more } = tree ? treeRows(tree, { expanded: this.expanded, cap: SOLVE_PROGRESS_TREE_CAP })
            : { rows: [], more: 0 };
        let added = false;
        rows.forEach((row, i) => {
            const n = row.node;
            const mark = row.collapsible ? (row.open ? '▾ ' : '▸ ') : (n.children?.length ? '▾ ' : '  ');
            const head = `${'  '.repeat(row.depth)}${mark}${n.role}: ${n.label}  ${n.attempts}a ${n.successes}✓`
                + (row.rejected ? ` ${row.rejected}✗` : '') + (row.hidden ? `  (+${row.hidden})` : '');
            // ⛓ TIER A — a rung of an active climb says WHY it refused, inline
            const reasons = row.reasons ? `  — ${reasonsText(n.rejections)}` : '';
            // ⛓ RK VIEW — the row's refusal kinds as chips, between its counts and its reasons
            const chips = kindChips(n.rejectionKinds);
            const want = {
                text: chips.length ? head : head + reasons,
                tail: chips.length ? reasons : '',
                chips: chips.map(([k, v]) => `${k} ${v}`).join('|'),
                css: `${TREE_ROW_CSS}color:${n.active ? '#fff' : '#bbb'};${n.active ? 'background:#3a1520;' : ''}`
                    + (row.collapsible ? 'cursor:pointer;' : '') + (frameKey !== null && n.key === frameKey ? FRAME_ROW_CSS : ''),
                title: Object.entries(n.rejections ?? {}).map(([k, v]) => `${v}× ${k}`).join('\n'),
                key: row.collapsible ? n.key : null,
            };
            let line = this._lines[i];
            if (!line) {
                line = el('div');
                // the row's text is ONE text node, updated in place (`data`), never replaced
                line._text = document.createTextNode('');
                line.append(line._text);
                line._shown = {};
                this._lines.push(line);
                this.tree.append(line);
                added = true;
            }
            const shown = line._shown;
            if (shown.text === want.text && shown.css === want.css && shown.title === want.title
                && shown.key === want.key && (shown.chips ?? '') === want.chips && (shown.tail ?? '') === want.tail) return;
            if (shown.text !== want.text) line._text.data = want.text;
            if ((shown.chips ?? '') !== want.chips) {
                if (!line._chips) {
                    line._chips = el('span');
                    line._tail = document.createTextNode('');
                    line.append(line._chips, line._tail);
                }
                line._chips.textContent = '';
                for (const [k, v] of chips) {
                    line._chips.append(el('span', DANGER_KINDS.includes(k) ? DANGER_CHIP_CSS : CHIP_CSS, `${k} ${v}`));
                }
            }
            if ((shown.tail ?? '') !== want.tail) line._tail.data = want.tail;
            if (shown.css !== want.css) line.style.cssText = want.css;
            if (shown.title !== want.title) line.title = want.title;
            if (shown.key !== want.key) {
                if (want.key === null) delete line.dataset.key; else line.dataset.key = want.key;
            }
            line._shown = want;
            this.stats.rowsWritten += 1;
        });
        while (this._lines.length > rows.length) this._lines.pop().remove();
        const moreText = more ? `… ${more} more node(s) not listed` : '';
        if (this._moreLine.textContent !== moreText) this._moreLine.textContent = moreText;
        if (more && (added || this._moreLine.parentNode !== this.tree)) this.tree.append(this._moreLine);
        else if (!more && this._moreLine.parentNode === this.tree) this._moreLine.remove();
    }
}
