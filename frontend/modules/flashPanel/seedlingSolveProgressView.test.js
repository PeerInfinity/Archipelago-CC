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
 */
import { describe, expect, it } from 'vitest';

import { cellColour, levelColour, recentLevel, shadeLevel, SolveProgressView } from './seedlingSolveProgressView.js';
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
            addEventListener() {}, querySelectorAll: () => [] };
        if (tag === 'canvas') {
            let w = 0;
            let h = 0;
            Object.defineProperty(n, 'width', { get: () => w, set: (v) => { w = v; rec.resizes += 1; } });
            Object.defineProperty(n, 'height', { get: () => h, set: (v) => { h = v; rec.resizes += 1; } });
            const ctx = { fillStyle: '', fillRect: (x, y, fw, fh) => rec.fills.push([x, y, fw, fh, ctx.fillStyle]) };
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
