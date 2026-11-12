/**
 * flashPanel/seedlingSolveWatchView — ⛓ WATCHER VIEW (slice `seedling-solver-panel-view`, ⚖ Robert 2026-11-11):
 * **THE SOLVER SECTION'S DEFAULT VIEW**, for someone watching the bot play. The model is `seedlingSolveWatch.js`;
 * this file only draws. Top to bottom (the design's items 1–7):
 *
 *  1. the HEADLINE sentence, coloured by phase (running cyan, solved green, gave up orange), and its sub-line;
 *  2. the PASS STEPPER (done / now / not tried / failed);
 *  3. "TRYING NOW", in words, while running;
 *  6. the "WHY" box on a gave-up solve: the kind's template sentence; the raw solver sentence one click away;
 *  4. the EFFORT BAR, relabelled: effort in words, the dash window's caption, the elapsed time, the ETA while running;
 *  5. the MAP over the room's real tiles (the JS runtime page's world, in its own ink), the searched cells (gold: the
 *     ones that rose since the last drawn update), the stance, the goal ✕ and, on a gave-up solve, the blocker ⚠ —
 *     ⛓ ROUTE HOOK: `_drawRoute` draws the plan's line once `routeOf` returns one (the stream carries none yet);
 *  7. DEVELOPER DETAILS: a `<details>`, closed by default, holding the developer view's element
 *     (`SolveProgressView`) UNCHANGED — every line it drew before, byte for byte (its pins hold).
 *
 * It hears every accepted note's state (the developer view's `onState`, as the progress line does), keeps its memory
 * at once, and draws at most once per animation frame, only while shown (the Solver section open). Every solver
 * string is written as TEXT (`textContent`, a text node), never parsed as HTML.
 */

import {
    effortOf, emptyWatch, goalTileOf, headlineOf, observeWatch, passStepsOf, roomOf, routeOf, tryingNowOf,
    watchPhase, whyOf,
} from './seedlingSolveWatch.js';
import { tileIndex, tileShade } from './seedlingSolveProgress.js';

const MAP_WIDTH = 288;
const MAP_BACKGROUND = '#0a0a0a';
const ACCENT = '#e94560';
export const PHASE_COLOURS = Object.freeze({ none: '#aaa', running: '#4fc3f7', solved: '#4caf7a', 'gave-up': '#ff8c1a' });
const STEP_COLOURS = Object.freeze({ done: '#4caf7a', now: '#4fc3f7', skip: '#9aa0a8', fail: '#ff8c1a' });
const STANCE_COLOUR = '#4fc3f7';
const GOAL_COLOUR = '#ffffff';
const BLOCKER_COLOUR = '#ff8c1a';
const WINDOW_COLOUR = '#f5c518';
const SANS = 'font-family:system-ui,sans-serif;';

const el = (tag, css = '', text = null) => {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text !== null) e.textContent = text;
    return e;
};

const nextFrame = (fn) => (typeof globalThis.requestAnimationFrame === 'function'
    ? globalThis.requestAnimationFrame(fn) : setTimeout(fn, 16));

/** The legend under the map, by phase (what the map draws then). */
export function legendText(phase, { room, blocker }) {
    const parts = [];
    if (room) parts.push('room: the level\'s tiles');
    if (phase === 'running') parts.push('gold: searching here now', 'red: searched before');
    else parts.push('red: where it searched');
    if (phase === 'running') parts.push('cyan □: where it plans to stand');
    parts.push('✕ goal');
    if (blocker) parts.push('⚠ the blocker');
    return parts.join(' · ');
}

export class SolveWatchView {
    /**
     * @param {object} o
     * @param {?HTMLElement} [o.details]  the developer view's element, put under "Developer details" as it is
     * @param {(level: number) => ?object} [o.getRoom]  the JS runtime world on that level, or null (wasm: no room)
     * @param {() => number} [o.now]
     * @param {(fn: () => void) => void} [o.frame]
     */
    constructor({ details = null, getRoom = () => null, now = () => Date.now(), frame = nextFrame } = {}) {
        this.getRoom = getRoom;
        this.now = now;
        this.scheduleRender = frame;
        this.state = null;
        this.memory = emptyWatch();
        this.visible = false;
        this.stats = { updates: 0, renders: 0, roomDraws: 0, mapDraws: 0 };
        this._pending = false;
        this._dirty = true;
        this._whyRawOpen = false;
        this._room = null;
        this._roomWorld = null;
        this._roomKey = null;
        this._mapKey = null;
        this._drawn = null;
        this._prevCounts = new Map();
        this._counts = new Map();

        this.element = el('div', 'margin-top:6px;font-size:12px;background:#111;border:1px solid #333;border-radius:4px;'
            + 'padding:8px;display:flex;flex-direction:column;gap:6px;');
        this.element.className = 'flash-panel-solve-watch';
        this.headline = el('div', `${SANS}font-size:14px;font-weight:600;line-height:1.35;color:${PHASE_COLOURS.none};`);
        this.headline.className = 'flash-panel-solve-headline';
        this.sub = el('div', `${SANS}color:#9aa0a8;font-size:12.5px;`);
        this.sub.className = 'flash-panel-solve-sub';
        this.steps = el('div', 'display:flex;gap:6px;flex-wrap:wrap;');
        this.steps.className = 'flash-panel-solve-steps';
        this.nowLine = el('div', `${SANS}font-size:12.5px;color:#ddd;`);
        this.nowLine.className = 'flash-panel-solve-now';
        this.nowWhat = el('span', `color:${STANCE_COLOUR};`);
        this.nowWhere = el('span');
        this.nowLine.append(document.createTextNode('Trying now: '), this.nowWhat, this.nowWhere);
        // the why box: the template sentence, its kind/key and a toggle, the raw solver sentence behind it
        this.whyBox = el('div', `${SANS}font-size:12.5px;background:#1d1f23;border-left:3px solid ${BLOCKER_COLOUR};`
            + 'padding:6px 8px;border-radius:3px;display:none;');
        this.whyBox.className = 'flash-panel-solve-whybox';
        this.whySentence = el('div', 'color:#e6e6e6;');
        this.whyMeta = el('div', 'color:#9aa0a8;font-family:monospace;font-size:10.5px;margin-top:4px;cursor:pointer;');
        this.whyMeta.className = 'flash-panel-solve-whymeta';
        this.whyRaw = el('div', 'color:#ccc;font-family:monospace;font-size:10.5px;margin-top:4px;white-space:pre-wrap;'
            + 'overflow-wrap:anywhere;display:none;');
        this.whyRaw.className = 'flash-panel-solve-whyraw';
        this.whyBox.append(this.whySentence, this.whyMeta, this.whyRaw);
        this.whyMeta.addEventListener('click', () => { this._whyRawOpen = !this._whyRawOpen; this._invalidate(); });
        // the effort bar
        this.bar = el('div', 'position:relative;height:10px;background:#2b2d31;border-radius:3px;');
        this.bar.className = 'flash-panel-solve-effort';
        this.barFill = el('div', `position:absolute;left:0;top:0;bottom:0;background:${ACCENT};border-radius:3px;width:0;`);
        this.barWindow = el('div', `position:absolute;top:-3px;bottom:-3px;width:2px;background:${WINDOW_COLOUR};display:none;`);
        this.bar.append(this.barFill, this.barWindow);
        this.barCap = el('div', 'display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;color:#9aa0a8;font-size:11px;'
            + 'font-variant-numeric:tabular-nums;');
        this.barCap.className = 'flash-panel-solve-effort-caption';
        this.capEffort = el('span');
        this.capWindow = el('span', `color:${WINDOW_COLOUR};`);
        this.capTime = el('span');
        this.barCap.append(this.capEffort, this.capWindow, this.capTime);
        // the map: the room under, the overlay (cells, marks, the route hook) over it
        this.mapBox = el('div', `position:relative;width:${MAP_WIDTH}px;max-width:100%;`);
        this.mapBox.className = 'flash-panel-solve-map';
        this.roomCanvas = el('canvas', `background:${MAP_BACKGROUND};border:1px solid #333;image-rendering:pixelated;display:block;max-width:100%;`);
        this.roomCanvas.className = 'flash-panel-solve-map-room';
        this.roomCanvas.width = MAP_WIDTH;
        this.roomCanvas.height = 1;
        this.overlay = el('canvas', 'position:absolute;left:1px;top:1px;pointer-events:none;image-rendering:pixelated;max-width:100%;');
        this.overlay.className = 'flash-panel-solve-map-overlay';
        this.mapBox.append(this.roomCanvas, this.overlay);
        this.legend = el('div', 'color:#9aa0a8;font-size:10.5px;');
        this.legend.className = 'flash-panel-solve-legend';
        // developer details: the developer view's element, as it is
        this.details = el('details', 'border-top:1px solid #2a2d33;padding-top:6px;');
        this.details.className = 'flash-panel-solve-details';
        const summary = el('summary', 'cursor:pointer;color:#9aa0a8;font-size:11.5px;', 'Developer details');
        this.details.append(summary);
        if (details) this.details.append(details);
        this.element.append(this.headline, this.sub, this.steps, this.nowLine, this.whyBox, this.bar, this.barCap,
            this.mapBox, this.legend, this.details);
        this.render();
    }

    /** The Solver section's state: shown (open) or not. Showing draws the newest state at the next frame. */
    setVisible(visible) {
        const v = visible === true;
        if (v === this.visible) return;
        this.visible = v;
        this.element.dataset.visible = String(v);
        if (v) this._invalidate();
    }

    /** An accepted note's state (the developer view's `onState`): the memory at once, the drawing at the next frame. */
    update(state) {
        this.state = state;
        this.memory = observeWatch(this.memory, state, this.now());
        this.stats.updates += 1;
        const d = this.element.dataset;
        d.phase = watchPhase(state);
        d.solveId = String(state?.solveId ?? '');
        this._invalidate();
    }

    _invalidate() {
        this._dirty = true;
        if (!this.visible || this._pending) return;
        this._pending = true;
        this.scheduleRender(() => { this._pending = false; this.flush(); });
    }

    /** Draw the newest state now, if it changed and the view is shown. */
    flush() {
        if (!this._dirty || !this.visible) return;
        this._dirty = false;
        this.render();
    }

    _text(node, text) { if (node.textContent !== text) node.textContent = text; }

    render() {
        this.stats.renders += 1;
        const s = this.state;
        const h = headlineOf(s, this.memory);
        this._text(this.headline, h.head);
        this.headline.style.color = PHASE_COLOURS[h.phase];
        this.headline.dataset.phase = h.phase;
        this._text(this.sub, h.sub);
        this.sub.style.display = h.sub ? '' : 'none';
        this._renderSteps(passStepsOf(s, this.memory));
        const now = tryingNowOf(s);
        if (now) {
            this._text(this.nowWhat, now.what);
            this._text(this.nowWhere, now.where);
            this.nowLine.style.display = '';
        } else {
            this.nowLine.style.display = 'none';
        }
        this._renderWhy(whyOf(s, this.memory));
        this._renderEffort(effortOf(s, this.memory), h.phase);
        this._renderMap(h.phase);
    }

    _renderSteps(steps) {
        const want = steps.map((st) => `${st.status}|${st.text}`).join('\n');
        if (this._stepsShown === want) return;
        this._stepsShown = want;
        this.steps.textContent = '';
        for (const st of steps) {
            const c = STEP_COLOURS[st.status];
            const span = el('span', `border:1px ${st.status === 'skip' ? 'dashed' : 'solid'} ${st.status === 'skip' ? '#2a2d33' : c};`
                + `color:${c};border-radius:4px;padding:2px 7px;font-size:11.5px;`, st.text);
            span.dataset.status = st.status;
            span.className = 'flash-panel-solve-step';
            this.steps.append(span);
        }
        this.steps.style.display = steps.length ? 'flex' : 'none';
    }

    _renderWhy(why) {
        if (!why) { this.whyBox.style.display = 'none'; return; }
        this.whyBox.style.display = '';
        this._text(this.whySentence, `Why: ${why.sentence}`);
        const meta = `${why.kind ?? '?'} at ${why.key ?? '?'}${why.raw ? ` · ${this._whyRawOpen ? 'hide' : 'show'} solver text ${this._whyRawOpen ? '▾' : '▸'}` : ''}`;
        this._text(this.whyMeta, meta);
        this._text(this.whyRaw, why.raw ?? '');
        this.whyRaw.style.display = this._whyRawOpen && why.raw ? '' : 'none';
    }

    _renderEffort(e, phase) {
        const pct = e.fraction === null ? 0 : e.fraction * 100;
        this.barFill.style.width = `${pct.toFixed(1)}%`;
        this.barFill.style.background = phase === 'gave-up' && e.spentUp ? PHASE_COLOURS['gave-up'] : ACCENT;
        if (e.window !== null && e.limit) {
            this.barWindow.style.display = 'block';
            this.barWindow.style.left = `${Math.min(100, (e.window / e.limit) * 100).toFixed(1)}%`;
        } else this.barWindow.style.display = 'none';
        this._text(this.capEffort, e.caption);
        this._text(this.capWindow, e.windowCaption ? `${e.windowCaption} ▏` : '');
        this._text(this.capTime, e.timeCaption);
    }

    _cellPx(cols) { return Math.max(2, Math.min(16, Math.floor(MAP_WIDTH / Math.max(1, cols)))); }

    /** The room on `level` (cached by its world object), or null. */
    _roomFor(level) {
        let world = null;
        try { world = level === undefined || level === null ? null : this.getRoom(level) ?? null; } catch { world = null; }
        if (world !== this._roomWorld) { this._roomWorld = world; this._room = roomOf(world); }
        return this._room;
    }

    _renderMap(phase) {
        const snap = this.state?.snapshot ?? null;
        const tiles = snap?.tiles && snap.tiles.cols && snap.tiles.rows ? snap.tiles : null;
        const level = tiles?.level ?? snap?.segment?.level ?? null;
        const room = this._roomFor(level);
        const cols = tiles?.cols ?? room?.cols ?? 0;
        const rows = tiles?.rows ?? room?.rows ?? 0;
        if (!cols || !rows) {
            this.mapBox.style.display = 'none';
            this._text(this.legend, snap ? 'no map yet (nothing previewed)' : '');
            return;
        }
        this.mapBox.style.display = '';
        const px = this._cellPx(cols);
        const w = cols * px;
        const hgt = rows * px;
        // the room layer: redrawn only when the room or the map's size changes (a resize clears a canvas)
        const roomKey = `${level}:${cols}x${rows}@${px}:${room ? 'room' : 'none'}`;
        if (roomKey !== this._roomKey || this._roomDrawnFor !== room) {
            this._roomKey = roomKey;
            this._roomDrawnFor = room;
            this.roomCanvas.width = w;
            this.roomCanvas.height = hgt;
            this.overlay.width = w;
            this.overlay.height = hgt;
            this.mapBox.style.width = `${Math.max(w, MAP_WIDTH)}px`;
            const ctx = this.roomCanvas.getContext?.('2d') ?? null;
            if (ctx) {
                ctx.fillStyle = MAP_BACKGROUND;
                ctx.fillRect(0, 0, w, hgt);
                if (room) {
                    const k = px / 16;
                    for (const [x, y, ow, oh, colour, alpha] of room.ops) {
                        ctx.globalAlpha = alpha;
                        ctx.fillStyle = colour;
                        ctx.fillRect(x * k, y * k, ow * k, oh * k);
                    }
                    ctx.globalAlpha = 1;
                }
            }
            this.stats.roomDraws += 1;
            this._mapKey = null;
        }
        // the overlay: the searched cells, the route hook, the marks — redrawn when the snapshot or phase changes
        const mapKey = `${roomKey}|${phase}`;
        if (snap === this._drawn && mapKey === this._mapKey) return;
        if (snap !== this._drawn) {
            const recentKey = `${this.state?.service}:${this.state?.solveId}:${snap?.segment?.index}:${tiles?.level}`;
            this._prevCounts = recentKey === this._recentKey ? this._counts : new Map();
            this._recentKey = recentKey;
            this._counts = new Map((tiles?.cells ?? []).map((c) => [c[1] * 4096 + c[0], c[2]]));
            this._drawn = snap;
        }
        this._mapKey = mapKey;
        this.stats.mapDraws += 1;
        const ctx = this.overlay.getContext?.('2d') ?? null;
        const goal = goalTileOf(snap);
        const why = whyOf(this.state, this.memory);
        const blocker = why?.fromDanger ? why.at : null;
        this._text(this.legend, legendText(phase, { room: !!room, blocker: !!blocker }));
        if (!ctx) return;
        ctx.clearRect(0, 0, w, hgt);
        if (tiles) {
            const max = tileIndex(tiles).max;
            for (const [col, row, n] of tiles.cells) {
                if (col < 0 || row < 0 || col >= cols || row >= rows) continue;
                const before = this._prevCounts.get(row * 4096 + col) ?? 0;
                // the gold glow is "searching here NOW": only while running
                const rose = phase === 'running' && n > before && this._prevCounts.size > 0;
                ctx.fillStyle = rose ? `rgba(245,197,24,${(0.55 + 0.4 * tileShade(n - before, max)).toFixed(2)})`
                    : `rgba(233,69,96,${(0.25 + 0.4 * tileShade(n, max)).toFixed(2)})`;
                ctx.fillRect(col * px, row * px, px, px);
            }
        }
        this._drawRoute(ctx, routeOf(snap), px, phase);
        ctx.lineWidth = Math.max(1, Math.floor(px / 6));
        const inside = (t) => t && t[0] >= 0 && t[1] >= 0 && t[0] < cols && t[1] < rows;
        const stance = phase === 'running' ? snap?.frame?.stance : null;
        if (inside(stance)) {
            ctx.strokeStyle = STANCE_COLOUR;
            ctx.strokeRect(stance[0] * px + 1, stance[1] * px + 1, px - 2, px - 2);
        }
        if (inside(goal)) {
            const [c, r] = goal;
            ctx.strokeStyle = GOAL_COLOUR;
            ctx.beginPath();
            ctx.moveTo(c * px, r * px);
            ctx.lineTo((c + 1) * px, (r + 1) * px);
            ctx.moveTo((c + 1) * px, r * px);
            ctx.lineTo(c * px, (r + 1) * px);
            ctx.stroke();
        }
        if (inside(blocker)) {
            const [c, r] = blocker;
            ctx.fillStyle = BLOCKER_COLOUR;
            ctx.font = `bold ${Math.max(9, px + 4)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⚠', c * px + px / 2, r * px + px / 2);
        }
    }

    /**
     * ⛓ ROUTE HOOK — the plan in hand as a line (dashed while running, solid when final) with its dash points. `route`
     * is `routeOf(snapshot)`: `null` until the stream carries the plan's tile path, so today this draws nothing.
     */
    _drawRoute(ctx, route, px, phase) {
        if (!route || !Array.isArray(route.cells) || route.cells.length < 2) return;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1, Math.floor(px / 4));
        ctx.setLineDash?.(phase === 'running' ? [4, 3] : []);
        ctx.beginPath();
        route.cells.forEach(([c, r], i) => {
            const x = c * px + px / 2;
            const y = r * px + px / 2;
            if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        });
        ctx.stroke();
        ctx.setLineDash?.([]);
    }
}
