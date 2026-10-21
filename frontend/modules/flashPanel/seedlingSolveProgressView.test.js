/**
 * seedlingSolveProgressView — ⛓ SOLVE PROGRESS S1: the view renders INCREMENTALLY (⚖ the user 2026-10-17; the rate
 * setting `flashPanel.seedlingSolveProgressIntervalMs` depends on it). Over a RECORDING stub DOM (every element
 * created, every canvas resize and `fillRect` counted) and a manual frame queue, so each property is pinned exactly:
 *
 *   - COALESCING: the notes of one frame are ONE render, of the newest state;
 *   - HIDDEN SKIP: a hidden view renders nothing, and showing it renders the newest state (catch-up);
 *   - SIZE-ONLY RESIZE: the canvas is resized only when the room's size changes, and only changed cells are painted;
 *   - ROW DIFF: the tree's row elements are kept, and only a changed row is written.
 *
 * The render cost these buy is measured in Chromium by the slice's bench (worst case: 160 rows + 3480 tiles).
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *   r1 `_invalidate` schedules a frame for EVERY note (no coalescing)
 *        -> 'COALESCING: ten notes in one frame …' reds
 *   r2 `flush` renders a hidden view
 *        -> 'HIDDEN SKIP: …' reds
 *   r3 `setMode` does not invalidate (a view shown by the setting never catches up)
 *        -> 'HIDDEN SKIP: … showing it renders the NEWEST state' reds
 *   r4 `_sizeCanvas` assigns width/height on every render
 *        -> 'SIZE-ONLY RESIZE: …' reds
 *   r5 every reached cell painted on every render (no cell diff)
 *        -> 'only CHANGED cells are painted …' reds
 *   r6 the tree rebuilt every render (`_lines` cleared, fresh elements)
 *        -> 'ROW DIFF: …' reds
 *   r7 a row that stops being collapsible keeps its `data-key`
 *        -> 'ROW DIFF: … a row that stops being collapsible loses its data-key' reds
 *
 * ⛓ S2 — TIER A (asks by site, the work counters, the active path and climb depth, inline rung reasons, tile
 * recency). Its mutants (all RED; the model's rows on D1's streams in seedlingSolveProgress.test.js catch a1 too):
 *   a1 the asks sorted least-asked first            -> 'ASKS BY SITE: …' reds
 *   a2 a work unit the view does not know is dropped -> 'ASKS BY SITE: … an unknown unit kept' reds
 *   a3 a rung's reasons inline under ANY climb       -> 'INLINE REASONS: …' reds
 *   a4 the climb depth counts every climb in the tree -> 'ACTIVE PATH: …' reds
 *   a5 the recency base advances on every render     -> 'a RE-RENDER of the same snapshot …' reds
 *   a6 the recency base kept across segments/solves  -> 'a new SEGMENT or solve starts recency over …' reds
 *   a7 a Tier A line written on every render          -> 'an unchanged Tier A line is not written again …' reds
 *   a8 reasons inline on every rejecting row          -> 'INLINE REASONS: …' reds
 *   a9 no recency palette (a rise ignored)            -> 'a cell that ROSE …' and 'only CHANGED cells …' red
 *
 * ⛓ RK VIEW — the kind chips, the refusals by kind, the last why (hammer-phase RK's `v: 2`). Its mutants (all RED):
 *   k1 chips in the snapshot's order                  -> 'CHIPS: …' and 'TALLY: …' red
 *   k2 a kind not in REFUSAL_KINDS dropped            -> 'UNKNOWN KIND: …' and 'ESCAPING: …' red
 *   k3 the totals sum every node                      -> 'TALLY: …' reds
 *   k4 no clamp                                       -> 'CLAMP: …' reds
 *   k5 the RK lines inserted on a v1 snapshot         -> 'a v1 stream … the S2 view's bytes' reds
 *   k6 a chip box made on every row                   -> 'a v1 stream … the S2 view's bytes' and 'CHIPS: …' red
 *   k7 the chips after the inline reasons             -> 'INLINE REASONS stay after the chips …' reds
 *   k8 a row with chips rewritten every render        -> 'CHIPS: …' reds
 *   k9 the why written with innerHTML                 -> 'ESCAPING: …' reds (the source scan)
 *   k10 the why's tooltip not set                     -> 'CLAMP: …' reds
 *
 * ⛓ STAMPS VIEW — S3's Tier B stamps drawn (the request, best, the rate/ETA, the wall by site). Its mutants (all RED):
 *   w1 the wall by site smallest first                -> 'WALL: …' reds
 *   w2 the window's ETA read from `toLimitMs`         -> 'ETA: …' reds
 *   w3 the request dropped after the first post       -> 'REQUEST: … KEPT …' and 'written only when …' red
 *   w4 the request kept across solves                 -> 'REQUEST: … KEPT …' reds
 *   w5 best's pass read from the segment's pass       -> 'BEST: …' reds
 *   w6 the stamp lines inserted without a stamp       -> both no-stamps identity rows red
 *   w7 the wall line written every render             -> 'written only when …' reds
 *   w8 Σ over the listed pairs only                   -> 'WALL: …' reds
 *   w9 the default switches (`{}`) drawn               -> both 'REQUEST: …' rows red
 *   w10 a 0 ms ETA drawn as `≈ 0 ms to …`             -> 'ETA: …' reds
 *
 * ⛓ FRAME VIEW — hammer-phase TC2's `frame` marked on the map, its row outlined. Its mutants (all RED):
 *   f1 a `tile:`/`pit:` id divided by 16 like a placement -> 'the id → tile parse' reds
 *   f2 a placement rounded, not floored               -> 'the id → tile parse' reds
 *   f3 the level guard dropped                        -> 'LEVEL GUARD: …' reds
 *   f4 the marks canvas not cleared on a null frame   -> 'CLEAR ON NULL: …' and 'LEVEL GUARD: …' red
 *   f4b the frame line kept on a null frame           -> 'CLEAR ON NULL: …' reds
 *   f5 the marks redrawn on every render              -> 'DRAW ONLY ON CHANGE: …' reds
 *   f6 every active row outlined                      -> the row-highlight row and 'LEVEL GUARD: …' red
 *   f7 the marks inserted on a frame-less snapshot    -> the frame-less identity row (+ the RK and stamps identity rows) red
 *   f8 one glyph for every kind                       -> 'a glyph per kind …' and 'the stance square …' red
 *   f9 the danger drawn at its source's placement     -> 'the stance square …' reds
 *   f10 a work counter that is an object drawn         -> '`caches` / `churn` count objects …' reds
 *
 * ⛓ CACHES VIEW — hammer-phase PR's `caches` / `churn` drawn per segment, `soft-lock` in the danger colour. Its
 * mutants (all RED):
 *   c1 the hit rate over hits alone / misses alone      -> 'CACHES: …' reds
 *   c2 the caches lines made on a snapshot without them  -> 'a snapshot without `caches`/`churn` …' reds (+ every
 *                                                          identity row: a node made changes `rec.created`)
 *   c3 a `null` member drawn as `0 hit / 0 miss`         -> 'CACHES: a null member …' reds
 *   c4 every chip in the danger colour                   -> 'SOFT-LOCK: the chip …' and the RK/stamps identity rows red
 *   c5 the kinds line rebuilt on every render            -> 'SOFT-LOCK: the kinds line …' reds
 *   c6 the caches box left above the stamp lines         -> 'ORDER: …' reds
 *   c7 the last why in the danger colour whatever its kind -> 'SOFT-LOCK: the last why …' and the RK/stamps identity rows red
 *   c8 the lines kept when a later snapshot drops the fields -> 'a later snapshot without them …' reds
 *   c9 `open` left out of the churn line                 -> 'CHURN: …' and the PR golden red
 */
import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
    cellColour, DANGER_GLYPHS, DANGER_KINDS, frameTargetTile, levelColour, recentLevel, shadeLevel, SolveProgressView,
} from './seedlingSolveProgressView.js';
import { SOLVE_PROGRESS_INTERVAL_MS } from '../seedlingDemo/solveProgressTap.js';

/** A recording DOM: elements with parent links, canvases that count resizes and record their `fillRect`s. */
function recordingDocument() {
    const rec = { created: 0, resizes: 0, fills: [] };
    const node = (tag) => {
        rec.created += 1;
        let own = '';
        const n = { tagName: tag, style: { cssText: '' }, dataset: {}, children: [], className: '', title: '',
            parentNode: null,
            // the DOM's textContent: a set replaces the children with the text; a get joins the text below
            get textContent() { return own + n.children.map((c) => c.data ?? c.textContent).join(''); },
            set textContent(v) { for (const c of n.children) c.parentNode = null; n.children = []; own = String(v); },
            append(...cs) {
                for (const c of cs) {
                    if (c.parentNode) c.remove();
                    c.parentNode = n;
                    n.children.push(c);
                }
            },
            remove() {
                if (!n.parentNode) return;
                const sib = n.parentNode.children;
                sib.splice(sib.indexOf(n), 1);
                n.parentNode = null;
            },
            // ⛓ RK VIEW — listeners are kept, so a row can click (`n.click()`)
            listeners: {},
            addEventListener(type, fn) { (n.listeners[type] ??= []).push(fn); },
            click() { for (const fn of n.listeners.click ?? []) fn({ target: n }); },
            querySelectorAll: () => [] };
        if (tag === 'canvas') {
            let w = 0;
            let h = 0;
            Object.defineProperty(n, 'width', { get: () => w, set: (v) => { w = v; rec.resizes += 1; } });
            Object.defineProperty(n, 'height', { get: () => h, set: (v) => { h = v; rec.resizes += 1; } });
            // ⛓ FRAME VIEW — the marks canvas's strokes and text go to `ctx.ops` (never `rec.fills`)
            const ops = [];
            const op = (name) => (...a) => ops.push([name, ...a, name === 'fillText' ? ctx.fillStyle : ctx.strokeStyle]);
            const ctx = { fillStyle: '', strokeStyle: '', ops, fillRect: (x, y, fw, fh) => rec.fills.push([x, y, fw, fh, ctx.fillStyle]),
                clearRect: (...a) => ops.push(['clearRect', ...a]), strokeRect: op('strokeRect'), fillText: op('fillText'),
                beginPath: op('beginPath'), moveTo: op('moveTo'), lineTo: op('lineTo'), stroke: op('stroke') };
            n.getContext = () => ctx;
        }
        return n;
    };
    const text = (data) => {
        rec.created += 1;
        const t = { data, parentNode: null,
            remove() { if (t.parentNode) { t.parentNode.children.splice(t.parentNode.children.indexOf(t), 1); t.parentNode = null; } } };
        return t;
    };
    return { rec, doc: { createElement: node, createDocumentFragment: () => node('#fragment'), createTextNode: text } };
}

function setup(mode = 'always') {
    const { rec, doc } = recordingDocument();
    const prev = globalThis.document;
    globalThis.document = doc;
    const frames = [];
    const listeners = new Set();
    const svc = { subscribeProgress(fn, opts) { listeners.add(fn); svc.opts = opts; return () => listeners.delete(fn); } };
    const view = new SolveProgressView({ getServices: () => [svc], now: () => 0, frame: (fn) => frames.push(fn) });
    view.setMode(mode);
    const runFrames = () => { while (frames.length) frames.shift()(); };
    runFrames();
    return {
        view, rec, frames, svc, runFrames,
        emit: (n) => { for (const fn of [...listeners]) fn(n); },
        restore() { view.close(); globalThis.document = prev; },
    };
}

/** A tree: a root with `n` leaves, all active (so open and listed); `attempts` per leaf. */
const treeOf = (n, attempts = () => 1, { finished = false } = {}) => ({
    key: 'root', role: 'segment', label: 'seg', attempts: 1, successes: 0, active: !finished,
    children: Array.from({ length: n }, (_, i) => ({ key: `root/${i}`, role: 'rung', label: `r${i}`,
        attempts: attempts(i), successes: 0, active: !finished, children: finished && i === 0
            ? [{ key: `root/0/x`, role: 'walk', label: 'x', attempts: 1, successes: 1, active: false, children: [] }] : [] })),
});
/** ⛓ RK VIEW — the md5 of each v1 note's drawing, measured with the S2 view (main e37e9188a5). */
const V1_MD5S = ['60159777ae48d584d62fd0af73d22271', '51543130f75583522aa9db4cbea9c73f',
    '90291df755e6a133784bcb20f40e8745'];
const tilesOf = (cells, { cols = 10, rows = 6, level = 4 } = {}) => ({ level, tile: 16, cols, rows, cells });
const snap = (seq, { tree = null, tiles = null, outcome = 'running', index = 0 } = {}) => ({ v: 1, seq,
    segment: { name: 't', index, level: 4, outcome }, tree, tiles, budget: { work: { shouldStop: seq } } });

describe('⛓ S1 — the view asks for the rate setting', () => {
    it('the feed subscribes with the view\'s interval (a function: read at each solve\'s start), clamped to the list', () => {
        const t = setup();
        try {
            expect(t.svc.opts.intervalMs()).toBe(SOLVE_PROGRESS_INTERVAL_MS);
            t.view.setIntervalMs(1000);
            expect(t.svc.opts.intervalMs()).toBe(1000);
            t.view.setIntervalMs(120);
            expect(t.svc.opts.intervalMs()).toBe(250);
            t.view.setIntervalMs(undefined);
            expect(t.svc.opts.intervalMs()).toBe(SOLVE_PROGRESS_INTERVAL_MS);
        } finally { t.restore(); }
    });
});

describe('⛓ S1 — COALESCING', () => {
    it('COALESCING: ten notes in one frame are ONE render, of the newest state; the next frame renders nothing new', () => {
        const t = setup();
        try {
            const before = t.view.stats.renders;
            const coalesced = t.view.stats.coalesced;
            for (let i = 1; i <= 10; i += 1) t.emit({ solveId: 1, snapshot: snap(i), final: false });
            expect(t.view.stats.renders).toBe(before);           // nothing drawn synchronously
            expect(t.frames).toHaveLength(1);                    // one frame asked for
            expect(t.view.state.seq).toBe(10);                   // the state is current at once
            t.runFrames();
            expect(t.view.stats.renders).toBe(before + 1);
            expect(t.view.stats.coalesced - coalesced).toBe(9);
            expect(t.view.header.textContent).toMatch(/seq 10 · 10 update\(s\)/);
            t.runFrames();
            expect(t.view.stats.renders).toBe(before + 1);
        } finally { t.restore(); }
    });

    it('the lifecycle (show/hide, data-*) stays SYNCHRONOUS: only the drawing waits for the frame', () => {
        const t = setup('auto');
        try {
            t.emit({ solveId: 1, snapshot: snap(1), final: false });
            expect([t.view.isOpen, t.view.element.dataset.visible]).toEqual([true, 'true']);
            t.emit({ solveId: 1, snapshot: snap(2, { outcome: 'solved' }), final: true });
            expect([t.view.isOpen, t.view.element.dataset.final, t.view.element.dataset.outcome]).toEqual([false, 'true', 'solved']);
        } finally { t.restore(); }
    });
});

describe('⛓ S1 — HIDDEN SKIP', () => {
    it('HIDDEN SKIP: a hidden view renders nothing; showing it renders the NEWEST state at the next frame', () => {
        const t = setup('auto');
        try {
            const before = t.view.stats.renders;
            // a solve shows the view and hides it on its final note before the frame comes: nothing is drawn
            t.emit({ solveId: 1, snapshot: snap(1), final: false });
            t.emit({ solveId: 1, snapshot: snap(4, { outcome: 'solved' }), final: true });
            t.runFrames();
            expect(t.view.stats.renders).toBe(before);
            expect(t.view.stats.hiddenSkipped).toBeGreaterThanOrEqual(1);
            // pinned open while hidden: catches up on the newest (final) state
            t.view.setMode('always');
            t.runFrames();
            expect(t.view.stats.renders).toBe(before + 1);
            expect(t.view.header.textContent).toMatch(/solved — final/);
            expect(t.view.header.textContent).toMatch(/seq 4 /);
        } finally { t.restore(); }
    });
});

describe('⛓ S1 — the canvas: SIZE-ONLY RESIZE, changed cells only', () => {
    it('SIZE-ONLY RESIZE: notes in the same room never resize the canvas; a room of another size does, once', () => {
        const t = setup();
        try {
            t.emit({ solveId: 1, snapshot: snap(1, { tiles: tilesOf([[1, 1, 3, 0]]) }), final: false });
            t.runFrames();
            const resized = t.view.stats.resizes;
            const sets = t.rec.resizes;
            for (let i = 2; i <= 6; i += 1) {
                t.emit({ solveId: 1, snapshot: snap(i, { tiles: tilesOf([[1, 1, 3 + i, 0], [2, i % 6, 1, i]]) }), final: false });
                t.runFrames();
            }
            expect(t.view.stats.renders).toBeGreaterThanOrEqual(6);
            expect([t.view.stats.resizes, t.rec.resizes]).toEqual([resized, sets]);
            t.emit({ solveId: 1, snapshot: snap(7, { tiles: tilesOf([[1, 1, 3, 0]], { cols: 20, rows: 9 }) }), final: false });
            t.runFrames();
            expect(t.view.stats.resizes).toBe(resized + 1);
            expect(t.view.canvas.width / t.view._px).toBe(20);
            expect(t.view.canvas.height / t.view._px).toBe(9);
        } finally { t.restore(); }
    });

    it('only CHANGED cells are painted; a cell gone since the last paint is painted back to the background', () => {
        const t = setup();
        try {
            const cells = [[0, 0, 9, 0], [1, 0, 3, 0], [2, 0, 1, 0]];
            t.emit({ solveId: 1, snapshot: snap(1, { tiles: tilesOf(cells) }), final: false });
            t.runFrames();
            // ⛓ S2 — the identical map again: its cells stopped RISING, so each goes from the recency palette to
            // its total shade (three cells, once); the identical map a third time paints nothing
            const px = t.view._px;
            t.rec.fills.length = 0;
            t.emit({ solveId: 1, snapshot: snap(2, { tiles: tilesOf(cells.map((c) => [...c])) }), final: false });
            t.runFrames();
            expect(t.rec.fills).toHaveLength(3);
            t.rec.fills.length = 0;
            t.emit({ solveId: 1, snapshot: snap(3, { tiles: tilesOf(cells.map((c) => [...c])) }), final: false });
            t.runFrames();
            expect(t.rec.fills).toEqual([]);
            // one cell's count changes (the max does not): exactly that cell, in the recency palette (the only rise)
            t.emit({ solveId: 1, snapshot: snap(4, { tiles: tilesOf([[0, 0, 9, 0], [1, 0, 5, 0], [2, 0, 1, 0]]) }), final: false });
            t.runFrames();
            expect(t.rec.fills).toEqual([[px, 0, px, px, levelColour(recentLevel(1))]]);
            // the same map: that cell goes back to its total shade
            t.rec.fills.length = 0;
            t.emit({ solveId: 1, snapshot: snap(5, { tiles: tilesOf([[0, 0, 9, 0], [1, 0, 5, 0], [2, 0, 1, 0]]) }), final: false });
            t.runFrames();
            expect(t.rec.fills).toEqual([[px, 0, px, px, levelColour(shadeLevel(Math.log1p(5) / Math.log1p(9)))]]);
            // a new segment in the same room reached fewer cells: the lost one goes back to the background (and the
            // new segment's cells are all new — recency starts over)
            t.rec.fills.length = 0;
            t.emit({ solveId: 1, snapshot: snap(6, { index: 1, tiles: tilesOf([[0, 0, 9, 0], [1, 0, 5, 0]]) }), final: false });
            t.runFrames();
            expect(t.rec.fills.filter((f) => f[4] === '#0a0a0a')).toEqual([[2 * px, 0, px, px, '#0a0a0a']]);
        } finally { t.restore(); }
    });

    it('a cell colour is OPAQUE (the accent composited over the background), so a repaint never blends with the old one', () => {
        expect(cellColour(0)).toBe(`rgb(${Math.round(10 + 0.15 * 223)},${Math.round(10 + 0.15 * 59)},${Math.round(10 + 0.15 * 86)})`);
        expect(cellColour(1)).toBe('rgb(233,69,96)');
    });
});

describe('⛓ S1 — the tree: ROW DIFF', () => {
    it('ROW DIFF: the row elements are KEPT across renders; an unchanged tree writes nothing, one changed row writes one', () => {
        const t = setup();
        try {
            t.emit({ solveId: 1, snapshot: snap(1, { tree: treeOf(20) }), final: false });
            t.runFrames();
            const rows = [...t.view.tree.children];
            expect(rows).toHaveLength(21);
            const created = t.rec.created;
            const written = t.view.stats.rowsWritten;
            t.emit({ solveId: 1, snapshot: snap(2, { tree: treeOf(20) }), final: false });
            t.runFrames();
            expect(t.rec.created).toBe(created);
            expect(t.view.stats.rowsWritten).toBe(written);
            t.emit({ solveId: 1, snapshot: snap(3, { tree: treeOf(20, (i) => (i === 7 ? 4 : 1)) }), final: false });
            t.runFrames();
            expect(t.rec.created).toBe(created);
            expect(t.view.stats.rowsWritten).toBe(written + 1);
            expect([...t.view.tree.children]).toEqual(rows);
            expect(rows[8].textContent).toMatch(/rung: r7 {2}4a 0✓/);
        } finally { t.restore(); }
    });

    it('ROW DIFF: a shorter tree removes the surplus rows; "… N more" stays the LAST line; a row that stops being collapsible loses its data-key', () => {
        const t = setup();
        try {
            t.emit({ solveId: 1, snapshot: snap(1, { tree: treeOf(200) }), final: false });
            t.runFrames();
            expect(t.view.tree.children).toHaveLength(161);
            expect(t.view.tree.children.at(-1).textContent).toMatch(/… 41 more node\(s\) not listed/);
            // finished: the root's subtree collapses to one collapsible row
            t.emit({ solveId: 1, snapshot: snap(2, { tree: treeOf(3, () => 1, { finished: true }) }), final: false });
            t.runFrames();
            expect(t.view.tree.children).toHaveLength(1);
            expect(t.view.tree.children[0].dataset.key).toBe('root');
            expect(t.view.tree.children[0].textContent).toMatch(/^▸ segment: seg/);
            // expanded by the viewer: row 0 stays collapsible (▾), row 1 is the collapsible r0 (it has a child)
            t.view.expanded.add('root');
            t.view._renderTree();
            expect(t.view.tree.children.map((c) => c.dataset.key ?? null)).toEqual(['root', 'root/0', null, null]);
            // live again: nothing is collapsible, so no row keeps a key
            t.emit({ solveId: 1, snapshot: snap(3, { tree: treeOf(3) }), final: false });
            t.runFrames();
            expect(t.view.tree.children.map((c) => c.dataset.key ?? null)).toEqual([null, null, null, null]);
            expect(t.view.tree.children.some((c) => /more node/.test(c.textContent))).toBe(false);
        } finally { t.restore(); }
    });
});

// ── ⛓ S2 — TIER A: what the snapshot already carries, shown (no schema change) ──
const rung = (key, label, rejections, { active = false } = {}) => ({ key, role: 'rung', label, attempts: 3,
    successes: 0, rejections, active, children: [] });
const climb = (key, children, { active = true } = {}) => ({ key, role: 'climb', label: 'climb', attempts: 1,
    successes: 0, rejections: {}, active, children });

describe('⛓ S2 — TIER A: asks by site and the work counters', () => {
    it('ASKS BY SITE: the most asked site first, with their sum; WORK: the counters in order, shouldStop left to the meter, an unknown unit kept', () => {
        const t = setup();
        try {
            const s = snap(1);
            s.budget = { asks: { walk: 18, 'hammer-escape': 37, 'sword-dash': 9 },
                work: { shouldStop: 64, ticks: 445, previews: 411, previewStates: 26472, searchStates: 18362,
                    expansions: 10444, waypointsPlanned: 1, replans: 0, dashesPressed: 6, zNewUnit: 3 } };
            t.emit({ solveId: 1, snapshot: s, final: false });
            t.runFrames();
            expect(t.view.asksText.textContent)
                .toBe('asks by site (this segment): hammer-escape 37 · walk 18 · sword-dash 9 · Σ 64');
            expect(t.view.workText.textContent).toBe('work: ticks 445 · previews 411 · preview states 26472 · '
                + 'search states 18362 · expansions 10444 · waypoints 1 · replans 0 · dashes 6 · zNewUnit 3');
            // the meter's own line is untouched (the in-app row reads it)
            expect(t.view.meterText.textContent).toBe('work 64 units (no budget: in place)');
            const s2 = snap(2);
            s2.budget = { asks: {}, work: {} };
            t.emit({ solveId: 1, snapshot: s2, final: false });
            t.runFrames();
            expect(t.view.asksText.textContent).toBe('asks by site (this segment): none yet');
        } finally { t.restore(); }
    });

    it('an unchanged Tier A line is not written again (one text write per changed line)', () => {
        const t = setup();
        try {
            t.emit({ solveId: 1, snapshot: snap(1, { tree: treeOf(2) }), final: false });
            t.runFrames();
            const lines = t.view.stats.linesWritten;
            const s = snap(2, { tree: treeOf(2) });
            s.budget = { work: { shouldStop: 1 } };   // the meter moves, the asks / work / path lines do not
            t.emit({ solveId: 1, snapshot: s, final: false });
            t.runFrames();
            expect(t.view.stats.linesWritten).toBe(lines);
        } finally { t.restore(); }
    });
});

describe('⛓ S2 — TIER A: the active path, climb depth, inline rung reasons', () => {
    // segment → goal → walk → climb (active) → [rung:avoid ✗, rung:pull (passed over), rung:kill (active) → walk →
    // climb (active, nested) → rung:time ✗]; plus a FINISHED earlier climb whose rung's reasons stay in the tooltip
    const tree = () => ({ key: 's', role: 'segment', label: 'tape', attempts: 1, successes: 0, rejections: {},
        active: true, children: [{ key: 's/g', role: 'goal', label: 'reach-exit (1,2)', attempts: 1, successes: 0,
            rejections: {}, active: true, children: [{ key: 's/g/w', role: 'walk', label: 'walk', attempts: 2,
                successes: 0, rejections: {}, active: true, children: [
                    climb('s/g/w/c0', [rung('s/g/w/c0/r', 'avoid', { old: 2 })], { active: false }),
                    climb('s/g/w/c', [
                        rung('s/g/w/c/r:avoid', 'avoid', { 'no stance within puncher@#,#\'s leash': 1,
                            'the danger-forbidden corridor STILL probes dangerous at': 4 }),
                        rung('s/g/w/c/r:pull', 'pull', {}),
                        { ...rung('s/g/w/c/r:kill', 'kill', {}, { active: true }), children: [
                            { key: 's/g/w/c/r:kill/w', role: 'walk', label: 'walk', attempts: 1, successes: 0,
                                rejections: {}, active: true, children: [climb('s/g/w/c/r:kill/w/c', [
                                    rung('s/g/w/c/r:kill/w/c/r:time', 'time', { 'wait exhausted': 2 })])] }] },
                    ]),
                ] }] }] });

    it('ACTIVE PATH: one line from the goal down, and the CLIMB DEPTH counts only the climbs ON it', () => {
        const t = setup();
        try {
            t.emit({ solveId: 1, snapshot: snap(1, { tree: tree() }), final: false });
            t.runFrames();
            expect(t.view.pathText.textContent).toBe('active: goal reach-exit (1,2) › walk › climb › rung kill › walk'
                + ' › climb · climb depth 2');
            const done = tree();
            const idle = (n) => { n.active = false; (n.children ?? []).forEach(idle); };
            idle(done);
            t.emit({ solveId: 1, snapshot: snap(2, { tree: done, outcome: 'solved' }), final: true });
            t.runFrames();
            expect(t.view.pathText.textContent).toBe('active: — (finished)');
        } finally { t.restore(); }
    });

    it('INLINE REASONS: a rung of an ACTIVE climb says why inline (most frequent first); a finished climb\'s rung keeps them in the tooltip only', () => {
        const t = setup();
        try {
            t.view.expanded.add('s/g/w/c0');
            t.emit({ solveId: 1, snapshot: snap(1, { tree: tree() }), final: false });
            t.view.expanded.add('s/g/w/c0');   // a new segment clears expansions: open the finished climb again
            t.runFrames();
            const row = (label) => t.view.tree.children.find((c) => new RegExp(`rung: ${label} `).test(c.textContent));
            const rows = t.view.tree.children.filter((c) => /rung: avoid /.test(c.textContent));
            expect(rows).toHaveLength(2);
            const [old, live] = rows;
            expect(old.textContent).not.toMatch(/ — /);
            expect(old.title).toBe('2× old');
            expect(live.textContent).toMatch(/ 5✗ {2}— 4× the danger-forbidden corridor STILL probes dangerous at · 1× no stance within puncher@#,#'s leash$/);
            expect(row('pull').textContent).not.toMatch(/ — /);         // passed over: nothing to say
            expect(row('time').textContent).toMatch(/ — 2× wait exhausted$/);   // the nested active climb's rung
            expect(row('kill').textContent).not.toMatch(/ — /);
        } finally { t.restore(); }
    });
});

describe('⛓ S2 — TIER A: tile RECENCY (a delta between two drawn snapshots)', () => {
    const gold = (rise, max) => levelColour(recentLevel(Math.log1p(rise) / Math.log1p(max)));

    it('a cell that ROSE since the last drawn snapshot is gold, shaded by its rise; the count says how many rose', () => {
        const t = setup();
        try {
            t.emit({ solveId: 1, snapshot: snap(1, { tiles: tilesOf([[0, 0, 4, 0], [1, 0, 4, 0], [2, 0, 4, 0]]) }), final: false });
            t.runFrames();
            expect(t.view.recent).toEqual({ cells: 3, max: 4 });   // the first map: every cell is new
            t.rec.fills.length = 0;
            t.emit({ solveId: 1, snapshot: snap(2, { tiles: tilesOf([[0, 0, 5, 0], [1, 0, 4, 0], [2, 0, 12, 0]]) }), final: false });
            t.runFrames();
            const px = t.view._px;
            expect(t.view.recent).toEqual({ cells: 2, max: 8 });
            const byX = Object.fromEntries(t.rec.fills.map((f) => [f[0] / px, f[4]]));
            // cell 2 rose the most: the top gold, which it already was (every cell of a first map is top gold), so
            // it is not repainted; cell 1 stopped rising: back to its total shade
            expect(byX).toEqual({ 0: gold(1, 8), 1: levelColour(shadeLevel(Math.log1p(4) / Math.log1p(12))) });
            expect(t.view._painted[2]).toBe(recentLevel(1));
            expect(t.view.tileText.textContent).toMatch(/ · 2 rose since the last update drawn \(gold; max \+8\)$/);
        } finally { t.restore(); }
    });

    it('a RE-RENDER of the same snapshot (a catch-up, a mode change) keeps its recency: the base moves only with a new snapshot', () => {
        const t = setup();
        try {
            t.emit({ solveId: 1, snapshot: snap(1, { tiles: tilesOf([[0, 0, 4, 0]]) }), final: false });
            t.runFrames();
            t.emit({ solveId: 1, snapshot: snap(2, { tiles: tilesOf([[0, 0, 9, 0]]) }), final: false });
            t.runFrames();
            expect(t.view.recent).toEqual({ cells: 1, max: 5 });
            t.rec.fills.length = 0;
            t.view.render();
            t.view.render();
            expect(t.view.recent).toEqual({ cells: 1, max: 5 });
            expect(t.rec.fills).toEqual([]);
        } finally { t.restore(); }
    });

    it('a new SEGMENT or solve starts recency over (an old stream\'s counts are not the base); while hidden, the rise is since the last DRAWN map', () => {
        const t = setup();
        try {
            t.emit({ solveId: 1, snapshot: snap(1, { tiles: tilesOf([[0, 0, 4, 0], [1, 0, 4, 0]]) }), final: false });
            t.runFrames();
            t.emit({ solveId: 1, snapshot: snap(2, { tiles: tilesOf([[0, 0, 4, 0], [1, 0, 4, 0]]) }), final: false });
            t.runFrames();
            expect(t.view.recent.cells).toBe(0);
            // a new segment in the same room, with the same counts: every cell is new to it
            t.emit({ solveId: 1, snapshot: snap(3, { index: 1, tiles: tilesOf([[0, 0, 4, 0], [1, 0, 4, 0]]) }), final: false });
            t.runFrames();
            expect(t.view.recent).toEqual({ cells: 2, max: 4 });
            // a new solve, too
            t.emit({ solveId: 2, snapshot: snap(1, { index: 1, tiles: tilesOf([[0, 0, 4, 0], [1, 0, 4, 0]]) }), final: false });
            t.runFrames();
            expect(t.view.recent).toEqual({ cells: 2, max: 4 });
            t.emit({ solveId: 2, snapshot: snap(2, { index: 1, tiles: tilesOf([[0, 0, 4, 0], [1, 0, 4, 0]]) }), final: false });
            t.runFrames();
            expect(t.view.recent.cells).toBe(0);
            // three notes while coalesced into one frame: the rise is against the map drawn before them
            for (let i = 3; i <= 5; i += 1) {
                t.emit({ solveId: 2, snapshot: snap(i, { index: 1, tiles: tilesOf([[0, 0, 4 + i, 0], [1, 0, 4, 0]]) }), final: false });
            }
            t.runFrames();
            expect(t.view.recent).toEqual({ cells: 1, max: 5 });
        } finally { t.restore(); }
    });
});

// ── ⛓ RK VIEW — refusal kinds and the last why (hammer-phase RK's `v: 2`) ──

/**
 * The view's element tree as one string: every element's tag, class, style, title, data-* and own text, and every
 * text node's data, in document order. What a v1 snapshot draws is pinned by its md5 (measured with the S2 view,
 * before the RK view's change).
 */
function serialize(n) {
    if (n.tagName === undefined) return `#text(${JSON.stringify(n.data)})`;
    const own = n.children.length ? '' : JSON.stringify(n.textContent);
    const data = Object.keys(n.dataset).sort().map((k) => `${k}=${n.dataset[k]}`).join(',');
    return `<${n.tagName} c=${JSON.stringify(n.className)} s=${JSON.stringify(n.style.cssText)}`
        + ` t=${JSON.stringify(n.title)} d=${JSON.stringify(data)}>${own}${n.children.map(serialize).join('')}</>`;
}

/** A v1 stream with every Tier A feature drawn: asks, work, an active climb whose rungs refuse, tiles that rise. */
function v1Stream() {
    const tree = (active) => {
        const t = { key: 's', role: 'segment', label: 'tape', attempts: 1, successes: 0, rejections: {}, active,
            children: [{ key: 's/g', role: 'goal', label: 'reach-exit (1,2)', attempts: 1, successes: 0,
                rejections: {}, active, children: [climb('s/g/c', [
                    rung('s/g/c/r:avoid', 'avoid', { 'the danger-forbidden corridor STILL probes dangerous at': 4 }),
                    rung('s/g/c/r:time', 'time', { 'wait exhausted': 2 }, { active }),
                    { ...rung('s/g/c/r:kill', 'kill', {}), children: [{ key: 's/g/c/r:kill/w', role: 'walk',
                        label: 'walk', attempts: 1, successes: 1, rejections: {}, active: false, children: [] }] },
                ], { active })] }] };
        return tree;
    };
    return [1, 2, 3].map((seq) => {
        const s = snap(seq, { tree: tree(seq < 3), outcome: seq < 3 ? 'running' : 'solved',
            tiles: tilesOf([[0, 0, 4 * seq, 0], [1, 0, 4, 1], [2, seq, 1, seq]]) });
        s.budget = { asks: { walk: 3 * seq, 'hammer-escape': 5 }, work: { shouldStop: 5 + 3 * seq, ticks: 40 * seq } };
        return { solveId: 1, snapshot: s, final: seq === 3 };
    });
}

describe('⛓ RK VIEW — v1 still renders exactly as before', () => {
    it('a v1 stream (no `v: 2` fields) draws the S2 view\'s bytes, note by note', () => {
        const t = setup();
        try {
            const md5s = [];
            for (const n of v1Stream()) {
                t.emit(n);
                t.runFrames();
                md5s.push(createHash('md5').update(serialize(t.view.element)).digest('hex'));
            }
            expect(md5s).toEqual(V1_MD5S);
        } finally { t.restore(); }
    });
});

/** ⛓ RK VIEW — a v2 snapshot: `snap` with `v: 2`, kinds on every node and a `lastWhy`. */
const snap2 = (seq, { tree, lastWhy = null, ...rest } = {}) => ({ ...snap(seq, { tree, ...rest }), v: 2, lastWhy });
/** A v2 node: `rejections` and `rejectionKinds` with the same total (as the emitter writes them). */
const node2 = (key, role, kinds = {}, children = [], { active = false } = {}) => ({ key, role, label: key.split('/').pop(),
    attempts: 1, successes: 0, active, children,
    rejections: Object.fromEntries(Object.entries(kinds).map(([k, v]) => [`${k} reason`, v])), rejectionKinds: kinds });
const chipsOf = (line) => (line._chips?.children ?? []).map((c) => c.textContent);
const rowOf = (t, key) => t.view.tree.children.find((c) => c._shown?.text?.includes(`: ${key.split('/').pop()} `));

describe('⛓ RK VIEW — kind chips per row', () => {
    it('CHIPS: a row shows its kinds as `kind n` in REFUSAL_KINDS\' order (not the snapshot\'s); a row with none has no chip box', () => {
        const t = setup();
        try {
            // the snapshot lists them out of order; the list's order is deadline, pending, …, exhausted, …, error
            const tree = node2('s', 'segment', {}, [
                node2('s/r', 'rung', { error: 1, exhausted: 4, deadline: 2, pending: 3 }),
                node2('s/q', 'rung', {}),
            ], { active: true });
            t.emit({ solveId: 1, snapshot: snap2(1, { tree }), final: false });
            t.runFrames();
            expect(chipsOf(rowOf(t, 's/r'))).toEqual(['deadline 2', 'pending 3', 'exhausted 4', 'error 1']);
            expect(rowOf(t, 's/r').textContent).toMatch(/: r {2}1a 0✓ 10✗deadline 2pending 3exhausted 4error 1$/);
            expect(rowOf(t, 's/q')._chips).toBeUndefined();
            expect(rowOf(t, 's')._chips).toBeUndefined();
            // one count changes: that row alone is written, its chips follow
            const written = t.view.stats.rowsWritten;
            t.emit({ solveId: 1, snapshot: snap2(2, { tree: { ...tree, children: [
                node2('s/r', 'rung', { error: 1, exhausted: 5, deadline: 2, pending: 3 }), node2('s/q', 'rung', {})] } }),
            final: false });
            t.runFrames();
            expect(t.view.stats.rowsWritten).toBe(written + 1);
            expect(chipsOf(rowOf(t, 's/r'))).toEqual(['deadline 2', 'pending 3', 'exhausted 5', 'error 1']);
            // the same tree again: nothing is written
            t.emit({ solveId: 1, snapshot: snap2(3, { tree: { ...tree, children: [
                node2('s/r', 'rung', { error: 1, exhausted: 5, deadline: 2, pending: 3 }), node2('s/q', 'rung', {})] } }),
            final: false });
            t.runFrames();
            expect(t.view.stats.rowsWritten).toBe(written + 1);
        } finally { t.restore(); }
    });

    it('UNKNOWN KIND: a kind not in REFUSAL_KINDS (RK2\'s `precondition`, say) still renders, after the listed ones, by name', () => {
        const t = setup();
        try {
            const tree = node2('s', 'segment', {}, [node2('s/r', 'rung', { zeta: 1, precondition: 2, danger: 1 })],
                { active: true });
            t.emit({ solveId: 1, snapshot: snap2(1, { tree }), final: false });
            t.runFrames();
            expect(chipsOf(rowOf(t, 's/r'))).toEqual(['danger 1', 'precondition 2', 'zeta 1']);
            expect(t.view.kindsText.textContent)
                .toBe('refusals by kind (this segment, each once): danger 1 · precondition 2 · zeta 1 · Σ 4');
        } finally { t.restore(); }
    });

    it('INLINE REASONS stay after the chips: a refusing rung of an active climb reads counts, chips, reasons', () => {
        const t = setup();
        try {
            const r = node2('s/c/r', 'rung', { danger: 4 });
            const tree = node2('s', 'segment', {}, [node2('s/c', 'climb', {}, [r], { active: true })], { active: true });
            t.emit({ solveId: 1, snapshot: snap2(1, { tree }), final: false });
            t.runFrames();
            const line = rowOf(t, 's/c/r');
            expect(line.children.map((c) => c.data ?? 'chips')).toEqual(['      rung: r  1a 0✓ 4✗', 'chips', '  — 4× danger reason']);
        } finally { t.restore(); }
    });
});

describe('⛓ RK VIEW — the refusals by kind, each counted ONCE', () => {
    // L18's shape (hammer-phase RK's report): a `levelRun` refusal unwound segment → goal → walk → verb → arm and is
    // tallied on all five; the arm's escape search exhausted (a leaf, tallied there alone). A climb's rungs refused by
    // row (danger, bound); then the climb exhausted under its cursor (rung:kill → arm:chaser), which unwound to the root.
    const l18ish = () => node2('s', 'segment', { pending: 1, exhausted: 1 }, [
        node2('s/g0', 'goal', { pending: 1 }, [node2('s/g0/w', 'walk', { pending: 1 }, [
            node2('s/g0/w/v', 'verb', { pending: 1 }, [node2('s/g0/w/v/press', 'arm', { pending: 1 }, [
                node2('s/g0/w/v/press/esc', 'search', { exhausted: 1 })])])])]),
        node2('s/g1', 'goal', { exhausted: 1 }, [node2('s/g1/w', 'walk', { exhausted: 1 }, [
            node2('s/g1/w/c', 'climb', { exhausted: 1 }, [
                node2('s/g1/w/c/avoid', 'rung', { danger: 1 }),
                node2('s/g1/w/c/time', 'rung', { bound: 1 }),
                node2('s/g1/w/c/kill', 'rung', { exhausted: 1 }, [node2('s/g1/w/c/kill/chaser', 'arm', { exhausted: 1 })]),
            ])])]),
    ]);

    it('TALLY: each refusal once, on the node it was tallied deepest — not the sum over every node', async () => {
        const { kindTotals } = await import('./seedlingSolveProgress.js');
        // over every node: pending 5, exhausted 7, danger 1, bound 1 (Σ 14) — the double count
        const all = {};
        const visit = (n) => { for (const [k, v] of Object.entries(n.rejectionKinds)) all[k] = (all[k] ?? 0) + v; n.children.forEach(visit); };
        visit(l18ish());
        expect(all).toEqual({ pending: 5, exhausted: 7, danger: 1, bound: 1 });
        // once each: the levelRun refusal (at the arm), the escape search, the two rung rows, the climb's last arm
        expect(kindTotals(l18ish())).toEqual({ rows: [['pending', 1], ['danger', 1], ['bound', 1], ['exhausted', 2]], total: 5 });
        expect(kindTotals({ key: 's', role: 'segment', children: [], rejections: {} })).toBeNull();   // v1
        const t = setup();
        try {
            t.emit({ solveId: 1, snapshot: snap2(1, { tree: l18ish() }), final: false });
            t.runFrames();
            expect(t.view.kindsText.textContent)
                .toBe('refusals by kind (this segment, each once): pending 1 · danger 1 · bound 1 · exhausted 2 · Σ 5');
            t.emit({ solveId: 1, snapshot: snap2(2, { tree: node2('s', 'segment', {}, [], { active: true }) }), final: false });
            t.runFrames();
            expect(t.view.kindsText.textContent).toBe('refusals by kind (this segment, each once): none yet');
        } finally { t.restore(); }
    });
});

describe('⛓ RK VIEW — the last why', () => {
    const long = `levelRun: spinner@112,48's removal at tick 205 OPENS 1 kill lock(s) in level 18 ${'x'.repeat(900)} END`;

    it('CLAMP: a 900-char why is ONE line of LAST_WHY_CHARS with an ellipsis; the tooltip and a click give it whole', async () => {
        const { LAST_WHY_CHARS } = await import('./seedlingSolveProgressView.js');
        const t = setup();
        try {
            const lastWhy = { why: long, kind: 'pending', key: 's/g0/w/v/press' };
            t.emit({ solveId: 1, snapshot: snap2(1, { tree: node2('s', 'segment', { pending: 1 }), lastWhy }), final: false });
            t.runFrames();
            const full = `pending at s/g0/w/v/press: ${long}`;
            const shown = t.view.whyText.textContent;
            expect(shown.startsWith('last why: pending at s/g0/w/v/press: levelRun: spinner@112,48')).toBe(true);
            expect(shown).toHaveLength('last why: '.length + LAST_WHY_CHARS);
            expect(shown.endsWith('…')).toBe(true);
            expect(t.view.whyText.title).toBe(full);
            expect(t.view.whyText.style.cssText).toMatch(/white-space:nowrap;overflow:hidden;text-overflow:ellipsis;/);
            t.view.whyText.click();
            expect(t.view.whyText.textContent).toBe(`last why: ${full}`);
            expect(t.view.whyText.style.cssText).toMatch(/white-space:pre-wrap;/);
            t.view.whyText.click();
            expect(t.view.whyText.textContent).toBe(shown);
            // a short why is not cut
            t.emit({ solveId: 1, snapshot: snap2(2, { tree: node2('s', 'segment', { exhausted: 1 }),
                lastWhy: { why: 'exhausted', kind: 'exhausted', key: 's/esc' } }), final: false });
            t.runFrames();
            expect(t.view.whyText.textContent).toBe('last why: exhausted at s/esc: exhausted');
        } finally { t.restore(); }
    });

    it('`lastWhy: null` → no line; a field the line does not name (`name`) changes nothing; the lines sit under the active path', () => {
        const t = setup();
        try {
            t.emit({ solveId: 1, snapshot: snap2(1, { tree: node2('s', 'segment', {}, [], { active: true }) }), final: false });
            t.runFrames();
            expect(t.view.whyText.textContent).toBe('');
            expect(t.view.whyText.title).toBe('');
            const kids = t.view.element.children;
            expect(kids.indexOf(t.view.rkBox)).toBe(kids.indexOf(t.view.pathText) + 1);
            expect(kids.indexOf(t.view.body)).toBe(kids.indexOf(t.view.rkBox) + 1);
            const lastWhy = { why: 'no stance within puncher@128,624\'s leash', kind: 'exhausted', key: 's/c/bait' };
            t.emit({ solveId: 1, snapshot: snap2(2, { tree: node2('s', 'segment', {}), lastWhy }), final: false });
            t.runFrames();
            const plain = t.view.whyText.textContent;
            t.emit({ solveId: 1, snapshot: snap2(3, { tree: node2('s', 'segment', {}), lastWhy: { ...lastWhy, name: 'SolverRefusal' } }), final: false });
            t.runFrames();
            expect(t.view.whyText.textContent).toBe(plain);
            expect(plain).toBe('last why: exhausted at s/c/bait: no stance within puncher@128,624\'s leash');
        } finally { t.restore(); }
    });

    it('ESCAPING: a why, a key and a kind are written as TEXT — markup in them stays literal, no element is made from it', async () => {
        const t = setup();
        try {
            const evil = '<img src=x onerror="alert(1)">&amp;</div>';
            const tree = node2('s', 'segment', {}, [node2('s/r', 'rung', { [evil]: 1 })], { active: true });
            t.emit({ solveId: 1, snapshot: snap2(1, { tree, lastWhy: { why: evil, kind: evil, key: evil } }), final: false });
            t.runFrames();
            expect(t.view.whyText.textContent).toBe(`last why: ${evil} at ${evil}: ${evil}`);
            expect(t.view.whyText.children).toEqual([]);
            const chip = rowOf(t, 's/r')._chips.children[0];
            expect(chip.textContent).toBe(`${evil} 1`);
            expect(chip.children).toEqual([]);
            expect(t.view.kindsText.textContent).toContain(`${evil} 1`);
            // ⛔ the view never parses a string as HTML
            const { readFileSync } = await import('node:fs');
            const src = readFileSync(new URL('./seedlingSolveProgressView.js', import.meta.url), 'utf8');
            expect(src).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|createContextualFragment|DOMParser/);
        } finally { t.restore(); }
    });
});

describe('⛓ RK VIEW — v1 after v2, and v2 on the same row elements', () => {
    it('a v2 row reused for a v1 row drops its chips; a v2 stream after the identity stream draws its lines', () => {
        const t = setup();
        try {
            for (const n of v1Stream()) { t.emit(n); t.runFrames(); }
            expect(t.view.element.children.includes(t.view.rkBox)).toBe(false);
            const tree = node2('s', 'segment', {}, [node2('s/r', 'rung', { danger: 2 })], { active: true });
            t.emit({ solveId: 2, snapshot: snap2(1, { tree }), final: false });
            t.runFrames();
            expect(t.view.element.children.includes(t.view.rkBox)).toBe(true);
            expect(chipsOf(rowOf(t, 's/r'))).toEqual(['danger 2']);
            t.emit({ solveId: 3, snapshot: snap(1, { tree: treeOf(2) }), final: false });
            t.runFrames();
            expect(t.view.tree.children.every((c) => chipsOf(c).length === 0)).toBe(true);
            expect([t.view.kindsText.textContent, t.view.whyText.textContent]).toEqual(['', '']);
        } finally { t.restore(); }
    });
});

// ── ⛓ STAMPS VIEW — S3's Tier B tap stamps drawn: the request identity, the plan in hand, the rate/ETA, the wall ──

/** A v2 stream with no Tier B stamps: every RK and Tier A line drawn (kinds, a why, asks, work, tiles). */
function v2NoStampsStream() {
    return [1, 2, 3].map((seq) => {
        const tree = node2('s', 'segment', { danger: seq }, [node2('s/c', 'climb', { danger: seq }, [
            node2('s/c/avoid', 'rung', { danger: seq }), node2('s/c/time', 'rung', {}, [], { active: seq < 3 })],
        { active: seq < 3 })], { active: seq < 3 });
        const s = snap2(seq, { tree, lastWhy: { why: `the corridor probes dangerous at ${seq}`, kind: 'danger', key: 's/c/avoid' },
            outcome: seq < 3 ? 'running' : 'solved', tiles: tilesOf([[0, 0, 2 * seq, 0], [3, 1, 1, seq]]) });
        s.budget = { asks: { walk: 2 * seq }, work: { shouldStop: 2 * seq, ticks: 30 * seq },
            spent: { shouldStop: 2 * seq }, limit: { shouldStop: 640 } };
        return { solveId: 1, snapshot: s, final: seq === 3 };
    });
}
/** ⛓ STAMPS VIEW — the md5 of each no-stamps v2 note's drawing, measured with the RK view (main 004368c2a3). */
const V2_NO_STAMPS_MD5S = ['d0fda5497aa4ecc11328462081a4db29', 'da679ac03775dbdce5ff31416fe8376a',
    '7cac294851810d5aa033d11bd680b782'];

describe('⛓ STAMPS VIEW — a snapshot without the stamps draws exactly as before', () => {
    it('a v1 stream and a v2 stream with no Tier B stamps draw the RK view\'s bytes, note by note; no stamp line is inserted', () => {
        for (const [stream, want] of [[v1Stream, V1_MD5S], [v2NoStampsStream, V2_NO_STAMPS_MD5S]]) {
            const t = setup();
            try {
                const md5s = [];
                for (const n of stream()) {
                    t.emit(n);
                    t.runFrames();
                    md5s.push(createHash('md5').update(serialize(t.view.element)).digest('hex'));
                }
                expect(md5s).toEqual(want);
                expect(t.view.element.children.includes(t.view.stampsHead)).toBe(false);
                expect(t.view.meter.children.includes(t.view.wallText)).toBe(false);
            } finally { t.restore(); }
        }
    });
});

/**
 * A stamped snapshot (the tap's S3 stamps on a v2 snapshot): `request` only where given (the tap stamps it on the
 * solve's first post), `wall`, `rate` and `best` as given (`null` = not stamped).
 */
const stamped = (seq, { request, wall = { 'start→walk': 3, 'walk→walk': 40 }, rate = { unitsPerSec: 20, toLimitMs: 31000 },
    best, index = 0, pass = 'quick' } = {}) => {
    const s = snap2(seq, { tree: node2('s', 'segment', {}, [], { active: true }), index });
    s.segment.pass = pass;
    s.budget = { work: { shouldStop: seq }, asks: { walk: seq }, spent: { shouldStop: 10 + seq },
        limit: { shouldStop: 640 }, ...(wall ? { wallBySite: wall } : {}), ...(rate ? { rate } : {}) };
    if (request) s.request = request;
    if (best) s.best = best;
    return s;
};
const REQUEST = { name: 'r9-solve-18', level: 18, seamTime: 412.5, goal: 'reach-exit', passes: ['quick', 'full'],
    budgetWork: 640, windowAt: 85, switches: {}, attempt: { retry: 0, budgets: [640], label: '640' } };

describe('⛓ STAMPS VIEW — where did the time go (budget.wallBySite)', () => {
    it('WALL: the most wall first (ties by name), ms or s, Σ over EVERY pair = the attempt\'s wall; labelled per attempt; the full list in the tooltip', async () => {
        const { WALL_SITES_SHOWN } = await import('./seedlingSolveProgressView.js');
        const { formatMs, wallBySiteRows } = await import('./seedlingSolveProgress.js');
        expect([formatMs(0.4), formatMs(850), formatMs(4249), formatMs(37400)]).toEqual(['0 ms', '850 ms', '4.2 s', '37 s']);
        expect(wallBySiteRows(snap(1))).toBeNull();
        const wall = { 'a→b': 5, 'start→walk': 3, 'walk→walk': 12000, 'walk→hammer-escape': 900, 'b→a': 5, 'x→y': 1,
            'y→z': 2, 'z→end': 4 };
        expect(wallBySiteRows({ budget: { wallBySite: wall } }).rows.map(([k]) => k))
            .toEqual(['walk→walk', 'walk→hammer-escape', 'a→b', 'b→a', 'z→end', 'start→walk', 'y→z', 'x→y']);
        expect(wallBySiteRows({ budget: { wallBySite: wall } }).total).toBe(12920);   // every pair, the 2 unlisted too
        const t = setup();
        try {
            t.emit({ solveId: 1, snapshot: stamped(1, { wall }), final: false });
            t.runFrames();
            expect(WALL_SITES_SHOWN).toBe(6);
            expect(t.view.wallText.textContent).toBe('wall by site (this attempt): walk→walk 12 s · walk→hammer-escape 900 ms'
                + ' · a→b 5 ms · b→a 5 ms · z→end 4 ms · start→walk 3 ms · +2 more · Σ 13 s');
            expect(t.view.wallText.title.split('\n')).toHaveLength(8);
            expect(t.view.wallText.style.cssText).toMatch(/white-space:nowrap;overflow:hidden;text-overflow:ellipsis;/);
            // under the meter's text, before the (per segment) asks
            const kids = t.view.meter.children;
            expect(kids.map((c) => c.className || c)).toEqual([kids[0], kids[1], 'flash-panel-solve-progress-eta',
                'flash-panel-solve-progress-wall', 'flash-panel-solve-progress-asks', 'flash-panel-solve-progress-work']);
            t.emit({ solveId: 1, snapshot: stamped(2, { wall: {} }), final: false });
            t.runFrames();
            expect(t.view.wallText.textContent).toBe('wall by site (this attempt): none yet');
        } finally { t.restore(); }
    });
});

describe('⛓ STAMPS VIEW — the ETA beside the meter (budget.rate, as the tap wrote it)', () => {
    it('ETA: units/s and the ms left to the window and the limit, READ (never recomputed); an absent field says nothing; 0 = reached', async () => {
        const { etaText } = await import('./seedlingSolveProgress.js');
        const at = (rate) => etaText({ budget: { rate } });
        // the rate disagrees with spent/limit on purpose: the line is the stamp's, not a recomputation
        expect(at({ unitsPerSec: 41.25, toWindowMs: 3100, toLimitMs: 12400 })).toBe('41.25 units/s · ≈ 3.1 s to window · ≈ 12 s to limit');
        expect(at({ unitsPerSec: 20, toLimitMs: 900 })).toBe('20 units/s · ≈ 900 ms to limit');
        expect(at({ unitsPerSec: 20, toWindowMs: 0, toLimitMs: 5000 })).toBe('20 units/s · window reached · ≈ 5.0 s to limit');
        expect(at({ unitsPerSec: 0 })).toBeNull();        // nothing spent yet: no ETA
        expect(etaText({ budget: {} })).toBeNull();        // no rate (0 ms, or no stamps)
        expect(at({ unitsPerSec: 7.5 })).toBe('7.5 units/s');   // in place: no budget, no ETA
        const t = setup();
        try {
            t.emit({ solveId: 1, snapshot: stamped(1, { rate: { unitsPerSec: 41.25, toWindowMs: 3100, toLimitMs: 12400 } }), final: false });
            t.runFrames();
            expect(t.view.etaText.textContent).toBe('41.25 units/s · ≈ 3.1 s to window · ≈ 12 s to limit');
            expect(t.view.meterText.textContent).toBe('work 11 / 640 units');   // the meter's own line is untouched
            t.emit({ solveId: 1, snapshot: stamped(2, { rate: null }), final: false });
            t.runFrames();
            expect(t.view.etaText.textContent).toBe('');
        } finally { t.restore(); }
    });
});

describe('⛓ STAMPS VIEW — the request identity in the header (first post only — KEPT for the solve)', () => {
    it('REQUEST: drawn from the first post and KEPT while later posts lack it; a new solve forgets it', () => {
        const t = setup();
        try {
            t.emit({ solveId: 1, snapshot: stamped(1, { request: REQUEST }), final: false });
            t.runFrames();
            const line = 'request: r9-solve-18 · boot L18 · seamTime 412.5 · goal reach-exit · passes quick → full · attempt 640';
            expect(t.view.requestText.textContent).toBe(line);
            for (const seq of [2, 3]) {
                t.emit({ solveId: 1, snapshot: stamped(seq, { index: seq - 1 }), final: seq === 3 });
                t.runFrames();
                expect(t.view.state.request).toBe(REQUEST);
                expect(t.view.requestText.textContent).toBe(line);
            }
            // a new solve whose first post carried no request (say it was dropped) has NO identity — not the old one's
            t.emit({ solveId: 2, snapshot: stamped(1), final: false });
            t.runFrames();
            expect(t.view.state.request).toBeNull();
            expect(t.view.requestText.textContent).toBe('');
            // header order: the request and the plan sit under the header, above the meter
            const kids = t.view.element.children;
            expect(kids.indexOf(t.view.stampsHead)).toBe(kids.indexOf(t.view.header) + 1);
            expect(kids.indexOf(t.view.meter)).toBe(kids.indexOf(t.view.stampsHead) + 1);
        } finally { t.restore(); }
    });

    it('REQUEST: the switches only when OFF-default ({} says nothing), the held retry\'s label, no seamTime when null; solver text stays TEXT', async () => {
        const { requestText } = await import('./seedlingSolveProgress.js');
        expect(requestText(null)).toBeNull();
        const retry = { ...REQUEST, seamTime: null, switches: { dashOnlyWindow: false, killLockBodies: { spinner: true } },
            attempt: { retry: 1, budgets: [640, 2560], label: '640 → 2560' } };
        expect(requestText(retry)).toBe('request: r9-solve-18 · boot L18 · goal reach-exit · passes quick → full'
            + ' · switches dashOnlyWindow=false, killLockBodies={"spinner":true} · attempt 640 → 2560 (retry 1)');
        expect(requestText({ ...REQUEST, attempt: undefined })).not.toMatch(/attempt|switches/);
        const evil = '<img src=x onerror="alert(1)">';
        const t = setup();
        try {
            t.emit({ solveId: 1, snapshot: stamped(1, { request: { ...REQUEST, name: evil } }), final: false });
            t.runFrames();
            expect(t.view.requestText.textContent.startsWith(`request: ${evil} · `)).toBe(true);
            expect(t.view.requestText.children).toEqual([]);
        } finally { t.restore(); }
    });
});

describe('⛓ STAMPS VIEW — the plan in hand (best)', () => {
    it('BEST: `best: ok · N ticks (pass P)` from the stamp\'s own pass (not the segment\'s), `refused`, or `none yet`', () => {
        const t = setup();
        try {
            t.emit({ solveId: 1, snapshot: stamped(1, { pass: 'quick' }), final: false });
            t.runFrames();
            expect(t.view.bestText.textContent).toBe('best: none yet');
            // the full pass is running; the best so far is the quick pass's plan
            t.emit({ solveId: 1, snapshot: stamped(2, { pass: 'full', best: { ok: true, ticks: 412, pass: 'quick' } }), final: false });
            t.runFrames();
            expect(t.view.bestText.textContent).toBe('best: ok · 412 ticks (pass quick)');
            t.emit({ solveId: 2, snapshot: stamped(1, { best: { ok: false, ticks: null, pass: 'quick' } }), final: false });
            t.runFrames();
            expect(t.view.bestText.textContent).toBe('best: refused (pass quick)');
        } finally { t.restore(); }
    });
});

describe('⛓ STAMPS VIEW — a stamp line is written only when its text changes', () => {
    it('re-posts with the same stamps write no stamp line; one changed stamp writes one line', () => {
        const t = setup();
        try {
            const same = { request: REQUEST, best: { ok: true, ticks: 9, pass: 'quick' } };
            t.emit({ solveId: 1, snapshot: stamped(1, same), final: false });
            t.runFrames();
            const lines = [t.view.requestText, t.view.bestText, t.view.etaText, t.view.wallText];
            const sets = lines.map(() => 0);
            lines.forEach((n, i) => {
                let v = n.textContent;
                Object.defineProperty(n, 'textContent', { get: () => v, set: (x) => { v = x; sets[i] += 1; } });
            });
            for (const seq of [2, 3, 4]) {
                t.emit({ solveId: 1, snapshot: stamped(seq, { best: same.best }), final: false });
                t.runFrames();
            }
            expect(sets).toEqual([0, 0, 0, 0]);
            t.emit({ solveId: 1, snapshot: stamped(5, { best: same.best, wall: { 'walk→walk': 41 } }), final: false });
            t.runFrames();
            expect(sets).toEqual([0, 0, 0, 1]);
        } finally { t.restore(); }
    });
});

describe('⛓ STAMPS VIEW — stamps after the RK lines, and on a view that drew a no-stamps stream', () => {
    it('the stamp lines go in once, in place, whichever stream came first; the RK box keeps its place under the path', () => {
        const t = setup();
        try {
            for (const n of v2NoStampsStream()) { t.emit(n); t.runFrames(); }
            t.emit({ solveId: 2, snapshot: stamped(1, { request: REQUEST }), final: false });
            t.runFrames();
            t.emit({ solveId: 2, snapshot: stamped(2), final: false });
            t.runFrames();
            const order = t.view.element.children.map((c) => c === t.view.header ? 'header' : c === t.view.stampsHead ? 'stamps'
                : c === t.view.meter ? 'meter' : c === t.view.pathText ? 'path' : c === t.view.rkBox ? 'rk'
                    : c === t.view.body ? 'body' : 'title');
            expect(order).toEqual(['title', 'header', 'stamps', 'meter', 'path', 'rk', 'body']);
        } finally { t.restore(); }
    });
});

/** ⛓ FRAME VIEW — a stamped stream (no `frame`), for the frame-less identity row. */
function stampedStream() {
    return [1, 2, 3].map((seq) => {
        const s = stamped(seq, { request: seq === 1 ? REQUEST : undefined });
        s.tiles = tilesOf([[0, 0, seq, 0], [2, 1, 1, seq]]);
        return { solveId: 1, snapshot: s, final: seq === 3 };
    });
}
/** The md5 of everything a note's render leaves behind: the DOM, every canvas fill and resize, every node made, the stats. */
const drawnMd5 = (t) => createHash('md5').update(serialize(t.view.element) + JSON.stringify(t.rec.fills)
    + JSON.stringify([t.rec.resizes, t.rec.created, t.view.stats])).digest('hex');

/**
 * ⛓ FRAME VIEW — the md5 of each frame-less note's render (DOM, fills, resizes, nodes made, the stats the stamps view
 * had), measured with the stamps view (main c7fd4996db), before the frame view's change.
 */
const FRAMELESS_MD5S = {
    v1Stream: ['9add8ea8ee63bf945ffe0cf0a6d2bdae', '24afbaf8b5920896d39aa151daf89e67', 'c342d4273330b6b04f62a92984f87e5b'],
    v2NoStampsStream: ['0687ee943b8a81412a24f7c7b7c003b4', '613c7015fe773e964c4686eb908fbc77', '3d465732d470e656f7bc987ef1528b48'],
    stampedStream: ['1142affcabce09baed072e31ce5986cd', '8fea55927284dc82f34da9cc27262d77', 'adc66bf6c56c93ca92e4d42329f963a3'],
};
const STAMPS_VIEW_STATS = ['notes', 'renders', 'coalesced', 'hiddenSkipped', 'resizes', 'cellsPainted', 'rowsWritten', 'linesWritten'];
const framelessMd5 = (t) => createHash('md5').update(serialize(t.view.element) + JSON.stringify(t.rec.fills)
    + JSON.stringify([t.rec.resizes, t.rec.created, JSON.parse(JSON.stringify(t.view.stats, STAMPS_VIEW_STATS))])).digest('hex');

describe('⛓ FRAME VIEW — a frame-less snapshot renders exactly as before', () => {
    it('v1, v2 without stamps and a stamped stream: the stamps view\'s DOM, fills, resizes and nodes, note by note; no marks canvas', () => {
        for (const stream of [v1Stream, v2NoStampsStream, stampedStream]) {
            const t = setup();
            try {
                const md5s = [];
                for (const n of stream()) { t.emit(n); t.runFrames(); md5s.push(framelessMd5(t)); }
                expect(md5s, stream.name).toEqual(FRAMELESS_MD5S[stream.name]);
                expect(t.view.marksCanvas).toBe(null);
                expect([t.view.stats.framesReceived, t.view.stats.framesMarked, t.view.stats.marksDrawn]).toEqual([0, 0, 0]);
            } finally { t.restore(); }
        }
    });
});

describe('⛓ FRAME VIEW — the id → tile parse', () => {
    it('a body, a lock (with its suffix) and a rope are their census placement in tiles (floor of x/16, y/16); tile:/pit: are tiles', () => {
        expect(frameTargetTile('puncher@128,624')).toEqual([8, 39]);
        expect(frameTargetTile('spinner@143,31')).toEqual([8, 1]);          // floor, never round
        expect(frameTargetTile('lock@144,112 {t 0, tag 3}')).toEqual([9, 7]);
        expect(frameTargetTile('Rope@64,32')).toEqual([4, 2]);
        expect(frameTargetTile('tile:5,7')).toEqual([5, 7]);                // a tile already — not divided
        expect(frameTargetTile('pit:12,3')).toEqual([12, 3]);
        expect(frameTargetTile('tile:Stone')).toBe(null);                  // a tile NAME has no place
        expect(frameTargetTile(null)).toBe(null);
        expect(frameTargetTile(42)).toBe(null);
    });
});

/** ⛓ FRAME VIEW — a v2 snapshot on a 20×40 map (14 px cells) with a climb whose kill rung carries `frame`. */
const FRAME_KEY = 's/c/rung:kill/arm:chaser';
const frameTree = () => node2('s', 'segment', {}, [node2('s/c', 'climb', {}, [node2('s/c/rung:avoid', 'rung', { danger: 1 }),
    node2('s/c/rung:kill', 'rung', {}, [node2(FRAME_KEY, 'arm', {}, [], { active: true })], { active: true })],
{ active: true })], { active: true });
const L40_FRAME = { key: FRAME_KEY, target: 'puncher@128,624', stance: [8, 38],
    danger: { source: 'puncher@128,624', tick: 539, kind: 'forecast', at: [10, 39] } };
const framed = (seq, frame, { tilesLevel = 4, cells = [[1, 1, seq, 0]] } = {}) => {
    const s = snap2(seq, { tree: frameTree(), tiles: tilesOf(cells, { cols: 20, rows: 40, level: tilesLevel }) });
    s.frame = frame;
    return { solveId: 1, snapshot: s, final: false };
};
const marksOps = (t) => t.view.marksCanvas.getContext('2d').ops;
/** The ops since the marks canvas's last clear (what it shows now). */
const shown = (t) => { const ops = marksOps(t); return ops.slice(ops.map((o) => o[0]).lastIndexOf('clearRect') + 1); };
const strokes = (t, colour) => shown(t).filter((o) => o[0] === 'strokeRect' && o.at(-1) === colour).map((o) => o.slice(1, 5));

describe('⛓ FRAME VIEW — each mark from a hand-built frame', () => {
    it('the stance square, the target cross and the danger box with its glyph and source id, at their tiles; the line says them', () => {
        const t = setup();
        try {
            t.emit(framed(1, L40_FRAME));
            t.runFrames();
            const px = t.view._px;
            expect(px).toBe(14);
            expect(strokes(t, '#4fc3f7')).toEqual([[8 * px + 1.5, 38 * px + 1.5, px - 3, px - 3]]);
            expect(strokes(t, '#ff8c1a')).toEqual([[10 * px + 0.5, 39 * px + 0.5, px - 1, px - 1]]);
            const cross = shown(t).filter((o) => o[0] === 'moveTo' || o[0] === 'lineTo').map((o) => o.slice(0, 3));
            expect(cross).toEqual([['moveTo', 8 * px + 1, 39 * px + 1], ['lineTo', 9 * px - 1, 40 * px - 1],
                ['moveTo', 9 * px - 1, 39 * px + 1], ['lineTo', 8 * px + 1, 40 * px - 1]]);
            const texts = shown(t).filter((o) => o[0] === 'fillText').map((o) => o[1]);
            expect(texts).toEqual(['»', 'puncher@128,624']);
            expect(t.view.frameLine.textContent).toBe('frame: stance (8,38) · target puncher@128,624 at (8,39)'
                + ' · danger » forecast puncher@128,624 at (10,39) t539');
            expect(t.view.marksCanvas.width).toBe(t.view.canvas.width);
            expect(t.view.marksCanvas.height).toBe(t.view.canvas.height);
            expect(t.view.mapBox.children).toEqual([t.view.canvas, t.view.tileText, t.view.marksCanvas, t.view.frameLine]);
        } finally { t.restore(); }
    });

    it('a glyph per kind (forecast » · volume ■ · phase ◐); an unknown kind (`soft-lock`) draws `?`; additive fields are ignored', () => {
        const t = setup();
        try {
            const glyphs = [];
            for (const [i, kind] of ['forecast', 'volume', 'phase', 'soft-lock'].entries()) {
                t.emit(framed(i + 1, { ...L40_FRAME, caches: { hits: 3 }, danger: { ...L40_FRAME.danger, kind, extra: 1 } }));
                t.runFrames();
                glyphs.push(shown(t).find((o) => o[0] === 'fillText')[1]);
            }
            expect(glyphs).toEqual(['»', '■', '◐', '?']);
            expect(Object.keys(DANGER_GLYPHS)).toEqual(['forecast', 'volume', 'phase']);
        } finally { t.restore(); }
    });

    it('a frame with only some detail draws only those marks (a verb: target + stance; AVOID: danger only); a tile-less target draws no cross', () => {
        const t = setup();
        try {
            t.emit(framed(1, { key: FRAME_KEY, target: 'lock@144,112', stance: [3, 3], danger: null }));
            t.runFrames();
            expect(strokes(t, '#ff8c1a')).toEqual([]);
            expect(shown(t).filter((o) => o[0] === 'moveTo')).toHaveLength(2);
            t.emit(framed(2, { key: FRAME_KEY, target: null, stance: null, danger: L40_FRAME.danger }));
            t.runFrames();
            expect([strokes(t, '#4fc3f7'), shown(t).filter((o) => o[0] === 'moveTo')]).toEqual([[], []]);
            expect(strokes(t, '#ff8c1a')).toHaveLength(1);
            t.emit(framed(3, { key: FRAME_KEY, target: 'tile:Stone', stance: null, danger: null }));
            t.runFrames();
            expect(shown(t).filter((o) => o[0] === 'moveTo')).toEqual([]);
            expect(t.view.frameLine.textContent).toBe('frame: stance — · target tile:Stone (no tile)');
        } finally { t.restore(); }
    });
});

describe('⛓ FRAME VIEW — the level guard, the clear on null, draw only on change', () => {
    it('LEVEL GUARD: a map one level behind the segment gets no marks (the line says why); the row is still outlined', () => {
        const t = setup();
        try {
            t.emit(framed(1, L40_FRAME, { tilesLevel: 3 }));
            t.runFrames();
            expect(shown(t)).toEqual([]);
            expect(marksOps(t).map((o) => o[0])).toEqual(['clearRect']);
            expect(t.view.frameLine.textContent).toMatch(/\(not marked: the map is another level\)$/);
            expect([t.view.stats.framesReceived, t.view.stats.framesMarked]).toEqual([1, 0]);
            expect(t.view.tree.children.filter((r) => r.style.cssText.includes('outline:'))).toHaveLength(1);
            t.emit(framed(2, L40_FRAME));
            t.runFrames();
            expect(strokes(t, '#4fc3f7')).toHaveLength(1);
            expect([t.view.stats.framesReceived, t.view.stats.framesMarked]).toEqual([2, 1]);
        } finally { t.restore(); }
    });

    it('CLEAR ON NULL: a null frame clears every mark, the line and the row outline', () => {
        const t = setup();
        try {
            t.emit(framed(1, L40_FRAME));
            t.runFrames();
            t.emit(framed(2, null));
            t.runFrames();
            expect(marksOps(t).at(-1)[0]).toBe('clearRect');
            expect(shown(t)).toEqual([]);
            expect(t.view.marks).toBe(null);
            expect(t.view.frameLine.textContent).toBe('');
            expect(t.view.tree.children.filter((r) => r.style.cssText.includes('outline:'))).toEqual([]);
        } finally { t.restore(); }
    });

    it('DRAW ONLY ON CHANGE: new snapshots with the same frame do not redraw the marks; a moved stance does, once', () => {
        const t = setup();
        try {
            t.emit(framed(1, L40_FRAME));
            t.runFrames();
            const drawn = t.view.stats.marksDrawn;
            const ops = marksOps(t).length;
            for (let i = 2; i <= 5; i += 1) {
                t.emit(framed(i, structuredClone(L40_FRAME), { cells: [[1, 1, i, 0], [2, i, 1, i]] }));
                t.runFrames();
            }
            expect(t.view.stats.renders).toBeGreaterThanOrEqual(5);
            expect([t.view.stats.marksDrawn, marksOps(t).length]).toEqual([drawn, ops]);
            t.emit(framed(6, { ...L40_FRAME, stance: [9, 38] }));
            t.runFrames();
            expect(t.view.stats.marksDrawn).toBe(drawn + 1);
            expect(strokes(t, '#4fc3f7')).toEqual([[9 * 14 + 1.5, 38 * 14 + 1.5, 11, 11]]);
        } finally { t.restore(); }
    });
});

describe('⛓ FRAME VIEW — the row highlight', () => {
    it('only the row whose key is frame.key is outlined (not every active row); moving the key rewrites just the two rows', () => {
        const t = setup();
        try {
            t.emit(framed(1, L40_FRAME));
            t.runFrames();
            const outlined = () => t.view.tree.children.filter((r) => r.style.cssText.includes('outline:')).map((r) => r._text.data.trim());
            expect(t.view.tree.children.filter((r) => r._shown?.css?.includes('#3a1520'))).toHaveLength(4);   // four active rows
            expect(outlined()).toEqual([expect.stringMatching(/^▾?\s*arm: arm:chaser /)]);
            const written = t.view.stats.rowsWritten;
            t.emit(framed(2, { ...L40_FRAME, key: 's/c/rung:kill' }));
            t.runFrames();
            expect(outlined()).toEqual([expect.stringMatching(/rung: rung:kill /)]);
            expect(t.view.stats.rowsWritten - written).toBe(2);
        } finally { t.restore(); }
    });
});

describe('⛓ FRAME VIEW — fields the view does not know draw nothing', () => {
    // ⛓ CACHES VIEW — the TOP-LEVEL `caches` / `churn` are drawn now (hammer-phase PR's fields); the same names
    // anywhere else are still nothing the view knows
    it('`caches` / `churn` count objects nested in segment, budget, budget.work leave every byte as it was', () => {
        const extra = { hits: 4, misses: 1 };
        const drawn = (withExtra) => {
            const t = setup();
            try {
                const out = [];
                for (const n of [...stampedStream(), framed(4, L40_FRAME), framed(5, null)]) {
                    const note = structuredClone(n);
                    if (withExtra) {
                        const s = note.snapshot;
                        Object.assign(s.segment, { caches: extra, churn: extra });
                        Object.assign(s.budget, { caches: extra, churn: extra });
                        Object.assign(s.budget.work, { caches: extra, churn: extra });
                    }
                    t.emit(note);
                    t.runFrames();
                    out.push(framelessMd5(t));
                }
                return out;
            } finally { t.restore(); }
        };
        expect(drawn(true)).toEqual(drawn(false));
    });

    it('`soft-lock` (listed since hammer-phase PR, before `other`) is a chip after the earlier kinds', () => {
        const t = setup();
        try {
            const tree = node2('s', 'segment', { danger: 1, 'soft-lock': 2 }, [], { active: true });
            t.emit({ solveId: 1, snapshot: snap2(1, { tree }), final: false });
            t.runFrames();
            expect(chipsOf(t.view._lines[0])).toEqual(['danger 1', 'soft-lock 2']);
        } finally { t.restore(); }
    });
});

// ── ⛓ CACHES VIEW — hammer-phase PR's `caches` / `churn`, and `soft-lock` in the danger colour ──

/** The danger colour (the frame view's danger mark), as the tests read it off the style text. */
const DANGER = '#ff8c1a';
/** A PR snapshot: `snap2` with `caches` / `churn` as given (`undefined` = the field is absent). */
const prSnap = (seq, { caches, churn, tree = node2('s', 'segment', {}, [], { active: true }), ...rest } = {}) => {
    const s = snap2(seq, { tree, ...rest });
    if (caches !== undefined) s.caches = caches;
    if (churn !== undefined) s.churn = churn;
    return s;
};
const ESCAPE = { hits: 6, crossPassHits: 2, misses: 4, stored: 2, tripped: 0, digestMoved: 1, cap: 1, bypassed: 3 };
const CHURN = { opened: 12, succeeded: 5, rejected: 4, moved: 7 };
/** A PR stream: the string pull and the escape cache counting up, the churn too, the last note final. */
function prStream() {
    return [1, 2, 3].map((seq) => ({ solveId: 1, final: seq === 3, snapshot: prSnap(seq, {
        caches: { stringPull: { hits: 10 * seq, misses: 5 }, escapeCrossPass: seq === 1 ? null : ESCAPE },
        churn: { opened: 4 * seq, succeeded: 2 * seq, rejected: seq === 3 ? 2 * seq : seq, moved: seq } }) }));
}

describe('⛓ CACHES VIEW — a snapshot without `caches`/`churn` draws exactly as before', () => {
    it('v1, v2 without stamps, stamped and framed streams make no caches node and draw no caches line', () => {
        for (const stream of [v1Stream, v2NoStampsStream, stampedStream, () => [framed(1, L40_FRAME), framed(2, null)]]) {
            const t = setup();
            try {
                for (const n of stream()) { t.emit(n); t.runFrames(); }
                expect(t.view.cachesBox).toBe(null);
                expect(t.view.meter.children.some((c) => c.className === 'flash-panel-solve-progress-caches')).toBe(false);
            } finally { t.restore(); }
        }
    });
});

describe('⛓ CACHES VIEW — the caches and the churn, per segment', () => {
    it('CACHES: each member\'s hits and misses with its hit rate; the escape cache names its non-zero miss outcomes', async () => {
        const { cachesText } = await import('./seedlingSolveProgress.js');
        expect(cachesText(prSnap(1, { caches: { stringPull: { hits: 30, misses: 10 }, escapeCrossPass: ESCAPE } })))
            .toBe('caches (this segment): string-pull 30 hit / 10 miss (75% hit) · escape cross-pass 6 hit (2 cross-pass)'
                + ' / 4 miss (60% hit) [stored 2, digest moved 1, cap 1] · bypassed 3');
        // no lookups yet: no rate (never a 0/0); no cross-pass hit, no outcome, no bypass: none named
        expect(cachesText(prSnap(1, { caches: { stringPull: { hits: 0, misses: 0 },
            escapeCrossPass: { hits: 1, crossPassHits: 0, misses: 0, stored: 0, tripped: 0, digestMoved: 0, cap: 0, bypassed: 0 } } })))
            .toBe('caches (this segment): string-pull 0 hit / 0 miss · escape cross-pass 1 hit / 0 miss (100% hit)');
        expect(cachesText(prSnap(1))).toBe(null);
        expect(cachesText(null)).toBe(null);
    });

    it('CACHES: a null member (its switch OFF, or nothing asked yet) and a member without counts draw `—`', async () => {
        const { cachesText } = await import('./seedlingSolveProgress.js');
        expect(cachesText(prSnap(1, { caches: { stringPull: null, escapeCrossPass: null } })))
            .toBe('caches (this segment): string-pull — · escape cross-pass —');
        expect(cachesText(prSnap(1, { caches: { stringPull: { hits: 'x', misses: 1 } } })))
            .toBe('caches (this segment): string-pull — · escape cross-pass —');
    });

    it('CHURN: opened, succeeded, rejected (its share of the opened), still open, climb moves; a missing field is left out', async () => {
        const { churnText } = await import('./seedlingSolveProgress.js');
        expect(churnText(prSnap(1, { churn: CHURN })))
            .toBe('churn (this segment): opened 12 · succeeded 5 · rejected 4 (33% of opened) · open 3 · climb moves 7');
        expect(churnText(prSnap(1, { churn: { opened: 0, succeeded: 0, rejected: 0, moved: 0 } })))
            .toBe('churn (this segment): opened 0 · succeeded 0 · rejected 0 · open 0 · climb moves 0');
        expect(churnText(prSnap(1, { churn: { opened: 3, moved: 1 } }))).toBe('churn (this segment): opened 3 · climb moves 1');
        expect(churnText(prSnap(1, { churn: {} }))).toBe('churn (this segment): none');
        expect(churnText(prSnap(1))).toBe(null);
    });

    it('the view draws both lines at the end of the meter; each is written only when its text changes', () => {
        const t = setup();
        try {
            const [a, b, c] = prStream();
            t.emit(a);
            t.runFrames();
            expect(t.view.meter.children.at(-1)).toBe(t.view.cachesBox);
            expect(t.view.cachesText.textContent).toBe('caches (this segment): string-pull 10 hit / 5 miss (67% hit) · escape cross-pass —');
            expect(t.view.churnText.textContent).toBe('churn (this segment): opened 4 · succeeded 2 · rejected 1 (25% of opened) · open 1 · climb moves 1');
            t.emit(b);
            t.runFrames();
            expect(t.view.cachesText.textContent).toBe('caches (this segment): string-pull 20 hit / 5 miss (80% hit) · escape cross-pass '
                + '6 hit (2 cross-pass) / 4 miss (60% hit) [stored 2, digest moved 1, cap 1] · bypassed 3');
            t.emit(c);
            t.runFrames();
            expect(t.view.churnText.textContent).toBe('churn (this segment): opened 12 · succeeded 6 · rejected 6 (50% of opened) · open 0 · climb moves 3');
            // the same counts again (a new seq): neither line is written
            const lines = t.view.stats.linesWritten;
            t.emit({ ...c, snapshot: { ...c.snapshot, seq: 4 }, final: true });
            t.runFrames();
            expect(t.view.cachesText.textContent).toMatch(/string-pull 30 hit/);
            expect(t.view.stats.linesWritten).toBe(lines);
        } finally { t.restore(); }
    });

    it('a later snapshot without them (a v1 solve after a PR one) empties both lines; the box stays, unmade nothing', () => {
        const t = setup();
        try {
            t.emit(prStream()[1]);
            t.runFrames();
            const box = t.view.cachesBox;
            for (const n of v1Stream()) { t.emit({ ...n, solveId: 2 }); t.runFrames(); }
            expect(t.view.cachesBox).toBe(box);
            expect([t.view.cachesText.textContent, t.view.churnText.textContent]).toEqual(['', '']);
        } finally { t.restore(); }
    });

    it('ORDER: the caches box stays LAST in the meter whichever came first, the stamps or the caches', () => {
        for (const order of ['caches first', 'stamps first', 'together']) {
            const t = setup();
            try {
                const withCaches = (s) => Object.assign(s, { caches: { stringPull: { hits: 1, misses: 1 }, escapeCrossPass: null },
                    churn: CHURN });
                const notes = order === 'caches first' ? [prSnap(1, { caches: { stringPull: null, escapeCrossPass: null } }),
                    withCaches(stamped(2, { request: REQUEST }))]
                    : order === 'stamps first' ? [stamped(1, { request: REQUEST }), withCaches(stamped(2))]
                        : [withCaches(stamped(1, { request: REQUEST }))];
                for (const s of notes) { t.emit({ solveId: 1, snapshot: s, final: false }); t.runFrames(); }
                const name = (c) => (c === t.view.cachesBox ? 'caches' : c === t.view.asksText ? 'asks' : c === t.view.workText ? 'work'
                    : c === t.view.etaText ? 'eta' : c === t.view.wallText ? 'wall' : c === t.view.meterText ? 'text' : 'bar');
                expect(t.view.meter.children.map(name), order).toEqual(['bar', 'text', 'eta', 'wall', 'asks', 'work', 'caches']);
            } finally { t.restore(); }
        }
    });

    it('the DOM of a PR stream, note by note (golden)', () => {
        const t = setup();
        try {
            const md5s = [];
            for (const n of prStream()) { t.emit(n); t.runFrames(); md5s.push(drawnMd5(t)); }
            expect(md5s).toEqual(PR_STREAM_MD5S);
        } finally { t.restore(); }
    });
});

/** ⛓ CACHES VIEW — `drawnMd5` of each `prStream` note, measured with this slice's view (the md5 pins the DOM). */
const PR_STREAM_MD5S = ['2e3355db766351c5f62c05cd7a7baae2', 'dae0e2c85156eed062a8edce90c9094b',
    'e8e2fd6b9b584d83fbdf0aa1f4f99356'];

describe('⛓ CACHES VIEW — SOFT-LOCK in the danger colour', () => {
    const softTree = (n = 2) => node2('s', 'segment', {}, [node2('s/r', 'rung', { danger: 1, 'soft-lock': n }),
        node2('s/q', 'rung', { exhausted: 1 })], { active: true });
    const chipCss = (line) => (line._chips?.children ?? []).map((c) => [c.textContent, c.style.cssText.includes(DANGER)]);

    it('DANGER_KINDS is `soft-lock` alone', () => { expect(DANGER_KINDS).toEqual(['soft-lock']); });

    it('SOFT-LOCK: the chip of a soft-lock refusal is in the danger colour; every other chip is not', () => {
        const t = setup();
        try {
            t.emit({ solveId: 1, snapshot: snap2(1, { tree: softTree() }), final: false });
            t.runFrames();
            expect(chipCss(rowOf(t, 's/r'))).toEqual([['danger 1', false], ['soft-lock 2', true]]);
            expect(chipCss(rowOf(t, 's/q'))).toEqual([['exhausted 1', false]]);
        } finally { t.restore(); }
    });

    it('SOFT-LOCK: the kinds line reads the same; its soft-lock entry is a span in the danger colour, rebuilt only on change', () => {
        const t = setup();
        try {
            t.emit({ solveId: 1, snapshot: snap2(1, { tree: softTree() }), final: false });
            t.runFrames();
            const k = t.view.kindsText;
            expect(k.textContent).toBe('refusals by kind (this segment, each once): danger 1 · exhausted 1 · soft-lock 2 · Σ 4');
            expect(k.children.map((c) => c.data ?? [c.textContent, c.style.cssText.includes(DANGER)])).toEqual([
                'refusals by kind (this segment, each once): danger 1 · exhausted 1 · ', ['soft-lock 2', true], ' · Σ 4']);
            const lines = t.view.stats.linesWritten;
            const span = k.children[1];
            t.emit({ solveId: 1, snapshot: snap2(2, { tree: softTree() }), final: false });
            t.runFrames();
            expect(t.view.stats.linesWritten).toBe(lines);
            expect(k.children[1]).toBe(span);
            t.emit({ solveId: 1, snapshot: snap2(3, { tree: softTree(3) }), final: false });
            t.runFrames();
            expect(k.children[1].textContent).toBe('soft-lock 3');
            // no soft-lock any more: the line is ONE text again (the RK view's shape)
            t.emit({ solveId: 1, snapshot: snap2(4, { tree: node2('s', 'segment', {}, [node2('s/q', 'rung', { exhausted: 1 })],
                { active: true }) }), final: false });
            t.runFrames();
            expect(k.children).toEqual([]);
            expect(k.textContent).toBe('refusals by kind (this segment, each once): exhausted 1 · Σ 1');
        } finally { t.restore(); }
    });

    it('SOFT-LOCK: the last why is in the danger colour when its kind is soft-lock, and only then (open or closed)', () => {
        const t = setup();
        try {
            const why = (kind) => ({ kind, key: 's/r', why: 'collecting Seed@32,48 here is a soft-lock: the page never ends', name: 'Error' });
            t.emit({ solveId: 1, snapshot: snap2(1, { tree: softTree(), lastWhy: why('soft-lock') }), final: false });
            t.runFrames();
            expect(t.view.whyText.style.cssText.includes(DANGER)).toBe(true);
            t.view.whyText.click();
            expect(t.view.whyText.style.cssText).toMatch(/white-space:pre-wrap/);
            expect(t.view.whyText.style.cssText.includes(DANGER)).toBe(true);
            t.emit({ solveId: 1, snapshot: snap2(2, { tree: softTree(), lastWhy: why('exhausted') }), final: false });
            t.runFrames();
            expect(t.view.whyText.style.cssText.includes(DANGER)).toBe(false);
        } finally { t.restore(); }
    });
});

describe('⛓ CACHES VIEW — the view never writes into what was posted', () => {
    it('every note DEEP-FROZEN and byte-compared after its render: the posts are the same with the view drawing them', () => {
        const freeze = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(freeze); Object.freeze(o); } return o; };
        const t = setup();
        try {
            const notes = [...prStream(), { solveId: 1, snapshot: snap2(4, { tree: node2('s', 'segment', { 'soft-lock': 1 }, [],
                { active: true }), lastWhy: { kind: 'soft-lock', key: 's', why: 'w', name: null } }), final: true }];
            const renders = t.view.stats.renders;
            for (const n of notes) {
                const before = JSON.stringify(n);
                t.emit(freeze(n));
                t.runFrames();
                expect(JSON.stringify(n)).toBe(before);
            }
            expect(t.view.stats.renders - renders).toBe(notes.length);
        } finally { t.restore(); }
    });
});
