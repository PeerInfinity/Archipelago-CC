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
 * The panel's own idiom: inline styles on its dark monospace palette, no stylesheet.
 */

import {
    applyProgress, createSolveProgressFeed, emptyProgress, meterOf, SOLVE_PROGRESS_TREE_CAP, tileIndex, tileShade,
    treeRows,
} from './seedlingSolveProgress.js';

const ACCENT = '#e94560';
const MAP_WIDTH = 288;

const el = (tag, css = '', text = null) => {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text !== null) e.textContent = text;
    return e;
};

/**
 * @param {object} o
 * @param {() => object[]} o.getServices  the solve services the panel can reach now
 * @param {() => number} [o.now]
 */
export class SolveProgressView {
    constructor({ getServices, now = () => Date.now() }) {
        this.now = now;
        this.state = emptyProgress();
        this.expanded = new Set();
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
        this.canvas = el('canvas', 'background:#0a0a0a;border:1px solid #333;image-rendering:pixelated;display:block;');
        this.canvas.className = 'flash-panel-solve-progress-tiles';
        this.canvas.width = MAP_WIDTH;
        this.canvas.height = 1;
        this.tileText = el('div', 'color:#aaa;margin-top:2px;min-height:1.2em;');
        mapBox.append(this.canvas, this.tileText);
        this.tree = el('div', 'flex:1 1 220px;min-width:200px;max-height:320px;overflow:auto;white-space:pre;');
        this.tree.className = 'flash-panel-solve-progress-tree';
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
            tick: () => this._renderHeader(),
        });
    }

    get isOpen() { return this.feed.isOpen; }

    /** Show the view and subscribe (a solve already in flight reports from the next solve on). */
    open() {
        this.state = emptyProgress();
        this.expanded = new Set();
        this.element.style.display = 'block';
        this.feed.open();
        this.render();
    }

    /** Hide the view and UNSUBSCRIBE from every service. */
    close() {
        this.feed.close();
        this.element.style.display = 'none';
    }

    receive(note) {
        const next = applyProgress(this.state, note, this.now());
        if (next === this.state) return;
        if (next.segmentChanged) this.expanded = new Set();
        this.state = next;
        this.render();
    }

    render() {
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

    _renderTiles() {
        const tiles = this.state.snapshot?.tiles ?? null;
        const ctx = this.canvas.getContext?.('2d') ?? null;
        if (!tiles || !tiles.cols || !tiles.rows) {
            this.canvas.width = MAP_WIDTH;
            this.canvas.height = 24;
            if (ctx) { ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, MAP_WIDTH, 24); }
            this.tileText.textContent = 'no previewed states yet';
            this._index = null;
            return;
        }
        const px = this._cellPx(tiles);
        this.canvas.width = tiles.cols * px;
        this.canvas.height = tiles.rows * px;
        this._index = tileIndex(tiles);
        this._px = px;
        if (ctx) {
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            for (const [col, row, reached] of tiles.cells) {
                const t = tileShade(reached, this._index.max);
                ctx.fillStyle = `rgba(233,69,96,${(0.15 + 0.85 * t).toFixed(3)})`;
                ctx.fillRect(col * px, row * px, px, px);
            }
        }
        this.tileText.textContent = this._tileSummary();
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

    _renderTree() {
        const tree = this.state.snapshot?.tree ?? null;
        this.tree.textContent = '';
        if (!tree) return;
        const { rows, more } = treeRows(tree, { expanded: this.expanded, cap: SOLVE_PROGRESS_TREE_CAP });
        const frag = document.createDocumentFragment();
        for (const row of rows) {
            const n = row.node;
            const line = el('div', `color:${n.active ? '#fff' : '#bbb'};${n.active ? `background:#3a1520;` : ''}`);
            const mark = row.collapsible ? (row.open ? '▾ ' : '▸ ') : (n.children?.length ? '▾ ' : '  ');
            const reasons = Object.entries(n.rejections ?? {});
            line.textContent = `${'  '.repeat(row.depth)}${mark}${n.role}: ${n.label}  ${n.attempts}a ${n.successes}✓`
                + (row.rejected ? ` ${row.rejected}✗` : '') + (row.hidden ? `  (+${row.hidden})` : '');
            if (reasons.length) line.title = reasons.map(([k, v]) => `${v}× ${k}`).join('\n');
            if (row.collapsible) { line.dataset.key = n.key; line.style.cursor = 'pointer'; }
            frag.append(line);
        }
        if (more) frag.append(el('div', 'color:#777;', `… ${more} more node(s) not listed`));
        this.tree.append(frag);
    }
}
