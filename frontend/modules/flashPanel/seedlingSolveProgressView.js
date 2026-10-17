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
 * ⛓ INCREMENTAL (slice S1, ⚖ the user 2026-10-17 — the rate setting `flashPanel.seedlingSolveProgressIntervalMs`
 * depends on it): a note updates the STATE (and the show/hide lifecycle) at once, but the DOM at most once per
 * animation frame (`frame`, default `requestAnimationFrame`) — the notes of one frame coalesce into one render of the
 * newest state. A HIDDEN view renders nothing (the state is kept; showing it renders the newest at the next frame).
 * The canvas is resized only when the room's size changes (a resize clears it), and only the cells whose colour
 * changed are painted (a cell gone since the last paint is painted back to the background). The tree's rows are
 * kept and DIFFED: a row element is written only where its text, colour, tooltip or key changed. `flush()` renders
 * a pending frame now; `stats` counts notes, renders, coalesced and hidden-skipped notes, resizes, cells painted
 * and rows written — what the pins read.
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
    applyProgress, autoVisibility, createSolveProgressFeed, emptyProgress, meterOf, SOLVE_PROGRESS_TREE_CAP, tileIndex,
    tileShade, treeRows,
} from './seedlingSolveProgress.js';
import { progressIntervalMs, SOLVE_PROGRESS_INTERVAL_MS } from '../seedlingDemo/solveProgressTap.js';

/** The show/hide transitions `lifecycle` keeps. */
const LIFECYCLE_CAP = 64;

const ACCENT = '#e94560';
const MAP_WIDTH = 288;
const MAP_BACKGROUND = '#0a0a0a';
const EMPTY_TILES = 'empty';

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
export function cellColour(shade) {
    const a = 0.15 + 0.85 * shade;
    const mix = (fg, bg) => Math.round(bg + a * (fg - bg));
    return `rgb(${mix(233, 10)},${mix(69, 10)},${mix(96, 10)})`;
}

/** `cellColour` at each of the `SHADE_LEVELS` levels, built once: a render indexes it, never builds a string. */
const PALETTE = Array.from({ length: SHADE_LEVELS }, (_, i) => cellColour(i / (SHADE_LEVELS - 1)));

/** A shade's palette level. */
export const shadeLevel = (shade) => Math.round(shade * (SHADE_LEVELS - 1));

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
        this.frame = frame;
        /** ⚖ `flashPanel.seedlingSolveProgressIntervalMs`: the rate this view asks its services for (`setIntervalMs`). */
        this.intervalMs = SOLVE_PROGRESS_INTERVAL_MS;
        this.stats = { notes: 0, renders: 0, coalesced: 0, hiddenSkipped: 0, resizes: 0, cellsPainted: 0, rowsWritten: 0 };
        this._dirty = true;
        this._pending = false;
        this._tilesKey = null;
        /** per cell (row·cols + col): the palette level painted there, or UNPAINTED — and the buffer a render fills. */
        this._painted = new Int16Array(0);
        this._next = new Int16Array(0);
        /** the tree's row elements, in order; each remembers what it shows (`_shown`). */
        this._lines = [];
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
        this.meter.append(this.meterBar, this.meterText);
        const body = el('div', 'display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap;');
        const mapBox = el('div', 'flex-shrink:0;');
        this.canvas = el('canvas', `background:${MAP_BACKGROUND};border:1px solid #333;image-rendering:pixelated;display:block;`);
        this.canvas.className = 'flash-panel-solve-progress-tiles';
        this.canvas.width = MAP_WIDTH;
        this.canvas.height = 1;
        this.tileText = el('div', 'color:#aaa;margin-top:2px;min-height:1.2em;');
        mapBox.append(this.canvas, this.tileText);
        this.tree = el('div', 'flex:1 1 220px;min-width:200px;max-height:320px;overflow:auto;white-space:pre;');
        this.tree.className = 'flash-panel-solve-progress-tree';
        this._moreLine = el('div', 'color:#777;');
        body.append(mapBox, this.tree);
        this.element.append(title, this.header, this.meter, body);

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
        this.frame(() => { this._pending = false; this.flush(); });
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
        this._renderTiles();
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
        this.stats.resizes += 1;
        this._painted = new Int16Array(cells).fill(UNPAINTED);
        this._next = new Int16Array(cells);
        if (ctx) { ctx.fillStyle = MAP_BACKGROUND; ctx.fillRect(0, 0, width, height); }
    }

    _renderTiles() {
        const tiles = this.state.snapshot?.tiles ?? null;
        const ctx = this.canvas.getContext?.('2d') ?? null;
        if (!tiles || !tiles.cols || !tiles.rows) {
            this._sizeCanvas(EMPTY_TILES, MAP_WIDTH, 24, 0, ctx);
            this.tileText.textContent = 'no previewed states yet';
            this._index = null;
            return;
        }
        const px = this._cellPx(tiles);
        const { cols, rows } = tiles;
        this._sizeCanvas(`${cols}x${rows}@${px}`, cols * px, rows * px, cols * rows, ctx);
        this._index = tileIndex(tiles);
        this._px = px;
        if (ctx) this._paintCells(ctx, tiles, px);
        this.tileText.textContent = this._tileSummary();
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
        for (const [col, row, reached] of tiles.cells) {
            if (col < 0 || row < 0 || col >= cols || row >= rows) continue;
            next[row * cols + col] = shadeLevel(tileShade(reached, max));
        }
        // a counting sort of the changed cells by level, into buffers kept across renders (no allocation per
        // render): level L counts in slot L + 2 (UNPAINTED = -1 in slot 1), so after the prefix sum slot L + 1 holds
        // where level L's run STARTS — the scatter's cursor
        const counts = this._levelCounts ?? (this._levelCounts = new Int32Array(SHADE_LEVELS + 2));
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
        // after the scatter, counts[k + 1] ends level k's run (k = -1 … SHADE_LEVELS - 1)
        let at = 0;
        for (let level = UNPAINTED; level < SHADE_LEVELS; level += 1) {
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

    _tileSummary() {
        const tiles = this.state.snapshot?.tiles;
        if (!tiles) return 'no previewed states yet';
        return `L${tiles.level}: ${tiles.cells.length} of ${tiles.cols}×${tiles.rows} tiles reached (max ${this._index?.max ?? 0})`;
    }

    _hover(e) {
        if (!this._index) return;
        const r = this.canvas.getBoundingClientRect();
        const sx = this.canvas.width / (r.width || this.canvas.width);
        const sy = this.canvas.height / (r.height || this.canvas.height);
        const col = Math.floor(((e.clientX - r.left) * sx) / this._px);
        const row = Math.floor(((e.clientY - r.top) * sy) / this._px);
        const c = this._index.at(col, row);
        this.tileText.textContent = c ? `tile (${col},${row}): reached ${c[2]}, earliest tick ${c[3]}`
            : `tile (${col},${row}): not reached`;
    }

    /**
     * ⛓ INCREMENTAL — the tree's rows are DIFFED, not rebuilt: row i reuses the i-th element and writes only what
     * changed (each element remembers what it shows); surplus elements are removed; "… N more" stays last.
     */
    _renderTree() {
        const tree = this.state.snapshot?.tree ?? null;
        const { rows, more } = tree ? treeRows(tree, { expanded: this.expanded, cap: SOLVE_PROGRESS_TREE_CAP })
            : { rows: [], more: 0 };
        let added = false;
        rows.forEach((row, i) => {
            const n = row.node;
            const mark = row.collapsible ? (row.open ? '▾ ' : '▸ ') : (n.children?.length ? '▾ ' : '  ');
            const want = {
                text: `${'  '.repeat(row.depth)}${mark}${n.role}: ${n.label}  ${n.attempts}a ${n.successes}✓`
                    + (row.rejected ? ` ${row.rejected}✗` : '') + (row.hidden ? `  (+${row.hidden})` : ''),
                css: `color:${n.active ? '#fff' : '#bbb'};${n.active ? 'background:#3a1520;' : ''}`
                    + (row.collapsible ? 'cursor:pointer;' : ''),
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
                && shown.key === want.key) return;
            if (shown.text !== want.text) line._text.data = want.text;
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
