/**
 * seedlingSolveWatch — ⛓ WATCHER VIEW (slice `seedling-solver-panel-view`, ⚖ Robert 2026-11-11): the Solver section's
 * default view, model and DOM. Streams are hand-built in the shape `seedling-solve-progress.md` §2/§7 documents, with
 * the numbers of the design's L12 demo (a 561-tick plain walk, then a 328-tick dashing route; window 85, budget 640).
 *
 * ── THE MUTATION LIST (run during development; each row's catcher named) ──
 *   m1 the phase read from `segment.outcome` alone (a final cut full pass reads gave-up) -> 'PHASE: …' reds
 *   m2 the ETA kept after the final note                                            -> 'EFFORT: … no ETA once finished' reds
 *   m3 the why box shown on a SOLVED solve                                           -> 'WHY: … never on a solved solve' reds
 *   m4 the plain walk's ticks taken from the newest best whatever its pass           -> 'HEADLINE: solved …' reds
 *   m5 a pass never run drawn as failed                                              -> 'STEPS: …' reds
 *   m6 the raw solver text written with innerHTML                                    -> 'ESCAPING: …' reds (the source scan)
 *   m7 the details block made without the developer view's element                    -> 'DETAILS: …' reds
 *   (slice `seedling-solver-panel-route`, the route overlay)
 *   m8 `routeOf` -> null (the hook as it was)                       -> 'ROUTE: …' and 'the route on the map: …' red
 *   m9 the level guard dropped (`r.level === level` -> true)          -> 'ROUTE: … another level …' and the view's other-level row red
 *   m10 the line's dash pattern by phase inverted                      -> 'the route on the map: dashed while running …' reds
 *   m11 the dash markers skipped                                       -> 'the route on the map: … ◆ …' reds
 */
import { describe, expect, it } from 'vitest';

import {
    activeWords, effortOf, emptyWatch, goalTileOf, headlineOf, mapRoutesOf, observeWatch, passStepsOf, roomOf, routeOf, tryingNowOf,
    watchPhase, whyOf, WHY_TEMPLATES,
} from './seedlingSolveWatch.js';
import { SolveWatchView, legendText } from './seedlingSolveWatchView.js';
import { REFUSAL_KINDS } from '../seedlingDemo/solveProgress.js';

const REQUEST = { name: 'js-runtime-L12-exit', level: 12, goal: 'reach-exit', passes: ['dashless', 'full'], budgetWork: 640 };
const goalTree = (active = true, extra = []) => ({ key: 'segment', role: 'segment', label: 'js-runtime-L12-exit', attempts: 1,
    successes: 0, active, children: [{ key: 'segment/goal#0', role: 'goal', label: 'reach-exit (432,352)', attempts: 1,
        successes: 0, active, children: extra }] });
const snapAt = (seq, { pass = 'dashless', outcome = 'running', best, spent = 10, window, rate, frame = null, lastWhy = null,
    tree = goalTree(outcome === 'running'), wall, index = 0, tiles = null } = {}) => ({ v: 2, seq,
    segment: { name: 'js-runtime-L12-exit', index, level: 12, pass, outcome }, tree, tiles, lastWhy, frame,
    budget: { spent: { shouldStop: spent }, limit: { shouldStop: 640, ...(window !== undefined ? { window } : {}) },
        ...(rate ? { rate } : {}), ...(wall ? { wallBySite: wall } : {}) },
    ...(best ? { best } : {}), ...(seq === 1 ? { request: REQUEST } : {}) });
const stateOf = (snapshot, { final = false, solveId = 1, request = REQUEST } = {}) => ({ service: 1, solveId, snapshot, final,
    seq: snapshot.seq, request });

/** The design's L12 solve, note by note: dashless runs, lands 561; full runs, lands 328; final. */
function l12Stream() {
    const best1 = { ok: true, ticks: 561, pass: 'dashless' };
    const best2 = { ok: true, ticks: 328, pass: 'full' };
    return [
        stateOf(snapAt(1, { spent: 12 })),
        stateOf(snapAt(2, { outcome: 'solved', spent: 36, best: best1 })),
        stateOf(snapAt(3, { pass: 'full', index: 1, spent: 108, best: best1, window: 85,
            rate: { unitsPerSec: 95.74, toLimitMs: 5600 }, wall: { 'start→walk': 600, 'walk→sword-dash': 528 },
            frame: { key: 'segment/goal#0/walk', target: 'tile:14,9', stance: [14, 9], danger: null },
            tree: goalTree(true, [{ key: 'segment/goal#0/walk', role: 'walk', label: 'walk', attempts: 1, successes: 0, active: true, children: [] }]),
            tiles: { level: 12, tile: 16, cols: 40, rows: 60, cells: [[1, 5, 3, 0], [2, 5, 1, 9]] } })),
        stateOf(snapAt(4, { pass: 'full', index: 1, outcome: 'solved', spent: 151, best: best2,
            rate: { unitsPerSec: 100, toLimitMs: 4900 }, wall: { 'start→walk': 600, 'walk→sword-dash': 800 } }), { final: true }),
    ];
}

/** PANEL-ROUTE's shape on the design's L12: the plain walk's route, then the dashing route with its presses. */
const L12_WALK = { level: 12, cells: [[1, 5], [2, 5], [2, 6], [3, 6], [4, 6]], dashes: [] };
const L12_ROUTE = { level: 12, cells: [[1, 5], [2, 5], [3, 6], [4, 6]], dashes: [[2, 5], [3, 6]] };

/** l12Stream with the routes stamped: the dashless plan in hand while the full pass runs, the full plan at the end. */
function routedStream() {
    const s = l12Stream();
    const at = (i, best) => ({ ...s[i], snapshot: { ...s[i].snapshot, best } });
    s[2] = at(2, { ...s[2].snapshot.best, route: L12_WALK });
    s[3] = at(3, { ...s[3].snapshot.best, route: L12_ROUTE, passRoutes: { dashless: L12_WALK } });
    s[3].snapshot.tiles = { ...s[2].snapshot.tiles };
    return s;
}

const fold = (stream, now = (i) => i * 100) => {
    let m = emptyWatch();
    stream.forEach((s, i) => { m = observeWatch(m, s, now(i)); });
    return m;
};

describe('⛓ WATCHER — the model', () => {
    it('PHASE: none / running / solved (a plan in hand, whatever the last segment\'s outcome) / gave-up', () => {
        expect(watchPhase(null)).toBe('none');
        expect(watchPhase(stateOf(snapAt(1)))).toBe('running');
        expect(watchPhase(stateOf(snapAt(9, { outcome: 'solved' }), { final: true }))).toBe('solved');
        // the full pass cut by its window: its own segment refused, the plain walk shipped
        const cut = snapAt(9, { pass: 'full', outcome: 'refused', best: { ok: true, ticks: 561, pass: 'dashless' } });
        expect(watchPhase(stateOf(cut, { final: true }))).toBe('solved');
        expect(watchPhase(stateOf(snapAt(9, { outcome: 'refused' }), { final: true }))).toBe('gave-up');
    });

    it('HEADLINE: running says what is in hand and what it looks for; solved names the route and the saving; gave up names the goal', () => {
        const s = l12Stream();
        const m3 = fold(s.slice(0, 3));
        expect(headlineOf(s[2], m3)).toEqual({ phase: 'running', head: 'Planning a route on level 12 to the exit…',
            sub: 'A route is already in hand (561 ticks). Now looking for sword-dash shortcuts.' });
        expect(headlineOf(s[0], fold(s.slice(0, 1))).sub).toBe('Looking for a plain walking route.');
        const m = fold(s);
        expect(headlineOf(s[3], m)).toEqual({ phase: 'solved', head: '✓ Solved in 1.4 s',
            sub: 'Found a 328-tick route (10.9 s of play) with sword-dashes, 233 ticks faster than the plain walk (561).' });
        const refused = stateOf(snapAt(5, { outcome: 'refused', spent: 640 }), { final: true });
        expect(headlineOf(refused, fold([refused], () => 0))).toEqual({ phase: 'gave-up', head: '✗ Gave up after 0 ms',
            sub: 'Couldn\'t find a safe way to the exit on level 12.' });
        expect(headlineOf(null, emptyWatch()).head).toBe('solver: no solve yet');
    });

    it('MEMORY: a new solve starts over; the plain walk\'s ticks are the dashless pass\'s best only', () => {
        const s = l12Stream();
        const m = fold(s);
        expect(m.passes.dashless).toMatchObject({ ran: true, ticks: 561, outcome: 'solved' });
        expect(m.passes.full).toMatchObject({ ran: true, ticks: 328, outcome: 'solved' });
        expect(m.window).toBe(85);
        const next = observeWatch(m, stateOf(snapAt(1), { solveId: 2 }), 999);
        expect(next).not.toBe(m);
        expect(next.passes).toEqual({ dashless: { ran: true, ticks: null, outcome: null, kind: null } });
        expect(next.firstAt).toBe(999);
    });

    it('STEPS: done / now / not tried / failed; a solved solve says which plan was used', () => {
        const s = l12Stream();
        expect(passStepsOf(s[2], fold(s.slice(0, 3))).map((x) => [x.status, x.text])).toEqual([
            ['done', '✓ 1 · Plain walk · 561 ticks'], ['now', '● 2 · With dashes · searching']]);
        expect(passStepsOf(s[0], fold(s.slice(0, 1))).map((x) => x.status)).toEqual(['now', 'skip']);
        expect(passStepsOf(s[3], fold(s)).map((x) => x.text)).toEqual([
            '✓ 1 · Plain walk · 561 ticks · not used', '✓ 2 · With dashes · 328 ticks · used']);
        const gaveUp = [stateOf(snapAt(1)), stateOf(snapAt(2, { outcome: 'refused', lastWhy: { kind: 'danger', key: 'k', why: 'w' } }),
            { final: true })];
        expect(passStepsOf(gaveUp[1], fold(gaveUp)).map((x) => [x.status, x.text])).toEqual([
            ['fail', '✗ 1 · Plain walk'], ['skip', '2 · With dashes · not tried']]);
        const cut = [stateOf(snapAt(1, { pass: 'full', outcome: 'refused', lastWhy: { kind: 'deadline', key: 'k', why: 'w' } }), { final: true })];
        expect(passStepsOf(cut[0], fold(cut))[1].text).toBe('✗ 2 · With dashes · out of effort');
    });

    it('TRYING NOW: the frame\'s label when the stream carries one, else the deepest active node in words; with the stance', () => {
        const s = l12Stream();
        expect(tryingNowOf(s[2])).toEqual({ what: 'a walk, with sword-dashes allowed', where: ' near (14, 9)' });
        expect(tryingNowOf(s[3])).toBe(null);
        const labelled = stateOf({ ...s[2].snapshot, frame: { ...s[2].snapshot.frame, label: 'a sword-dash' } });
        expect(tryingNowOf(labelled).what).toBe('a sword-dash');
        const rung = { key: 'r', role: 'segment', active: true, children: [{ role: 'climb', active: true, children: [
            { role: 'rung', label: 'time', active: true, children: [] }] }] };
        expect(activeWords(rung)).toBe('waiting for an opening');
        expect(activeWords({ active: false })).toBe(null);
    });

    it('EFFORT: words, the window caption, elapsed; the ETA only while running, no ETA once finished', () => {
        const s = l12Stream();
        const run = effortOf(s[2], fold(s.slice(0, 3)));
        expect(run).toMatchObject({ caption: 'Search effort 108 of 640', windowCaption: 'dash search stops at 85',
            timeCaption: '1.1 s · ≈ 5.6 s left at most', window: 85 });
        const done = effortOf(s[3], fold(s));
        expect(done).toMatchObject({ caption: 'Search effort 151 of 640',
            windowCaption: 'dash search stopped at 85 (kept what it found)', timeCaption: '1.4 s' });
        const spent = stateOf(snapAt(5, { outcome: 'refused', spent: 640 }), { final: true });
        expect(effortOf(spent, fold([spent])).caption).toBe('Search effort 640 of 640 · budget used up');
    });

    it('WHY: a template per kind with the blocker\'s tile; never on a solved solve; every listed kind has one', () => {
        const s = l12Stream();
        expect(whyOf(s[3], fold(s))).toBe(null);
        expect(whyOf(s[2], fold(s.slice(0, 3)))).toBe(null);
        const danger = { source: 'bob@192,64', tick: 40, kind: 'forecast', at: [12, 4] };
        const run = [stateOf(snapAt(1, { frame: { key: 'k', target: null, stance: [3, 3], danger } })),
            stateOf(snapAt(2, { outcome: 'refused', lastWhy: { kind: 'danger', key: 'goal#0/walk/climb/rung:time', why: 'probes DANGEROUS' } }),
                { final: true })];
        expect(whyOf(run[1], fold(run))).toMatchObject({ kind: 'danger', at: [12, 4], fromDanger: true,
            sentence: 'every route it found would take a hit near (12, 4) (bob@192,64).', raw: 'probes DANGEROUS',
            key: 'goal#0/walk/climb/rung:time' });
        for (const k of REFUSAL_KINDS) expect(WHY_TEMPLATES[k], k).toMatch(/\{at\}\.$/);
        // a search-kind refusal names no place and marks nothing, whatever the frame or the memory holds
        const cut = [run[0], stateOf(snapAt(2, { outcome: 'refused', frame: { key: 'k', target: 'tile:5,6', stance: [3, 3], danger },
            lastWhy: { kind: 'deadline', key: 'k', why: 'w' } }), { final: true })];
        expect(whyOf(cut[1], fold(cut))).toMatchObject({ at: null, fromDanger: false, sentence: 'it used up its search effort before it found a route.' });
        // a place kind names the stance, else the target's tile; no ⚠
        const stuck = stateOf(snapAt(2, { outcome: 'refused', frame: { key: 'k', target: 'puncher@128,624', stance: null, danger: null },
            lastWhy: { kind: 'exhausted', key: 'k', why: 'w' } }), { final: true });
        expect(whyOf(stuck, fold([stuck]))).toMatchObject({ at: [8, 39], fromDanger: false });
        const odd = stateOf(snapAt(2, { outcome: 'refused', lastWhy: { kind: 'brand-new', key: 'x', why: 'y' } }), { final: true });
        expect(whyOf(odd, fold([odd])).sentence).toBe(WHY_TEMPLATES.other.replace('{at}', ''));
    });

    it('GOAL, ROOM, ROUTE: the goal\'s pixels as a tile; the room in the page\'s ink; no route until the stream carries one', () => {
        expect(goalTileOf(l12Stream()[0].snapshot)).toEqual([27, 22]);
        expect(goalTileOf({ tree: null })).toBe(null);
        const rect = (x, y) => ({ x, y, right: x + 16, bottom: y + 16 });
        const room = roomOf({ width: 2, height: 1, tiles: [{ t: 0, rect: rect(0, 0) }, { t: 1, rect: rect(16, 0) }],
            solids: [{ rect: rect(0, 0) }], objectSolids: [], teleporters: [{ rect: rect(16, 0), deactivated: false }] });
        expect(room).toEqual({ cols: 2, rows: 1, ops: [[0, 0, 16, 16, '#3a3a42', 1], [16, 0, 16, 16, '#1d4f7a', 1],
            [16, 0, 16, 16, '#3fd8ce', 0.45]] });
        expect(roomOf(null)).toBe(null);
        expect(routeOf(l12Stream()[3].snapshot)).toBe(null);
    });

    it('ROUTE: `best.route` as the tap stamps it; null when absent; on the map only on its own level; thinned and dashes kept', () => {
        const snap = routedStream()[3].snapshot;
        expect(routeOf(snap)).toBe(snap.best.route);
        expect(routeOf(l12Stream()[3].snapshot)).toBe(null);
        expect(routeOf(null)).toBe(null);
        expect(routeOf({ best: { ok: true, route: { level: 12, cells: null } } })).toBe(null);
        expect(mapRoutesOf(snap, 12)).toEqual({
            route: { level: 12, cells: L12_ROUTE.cells, dashes: L12_ROUTE.dashes, thinned: null },
            others: [{ pass: 'dashless', label: 'Plain walk', cells: L12_WALK.cells }],
        });
        // another level: neither the route nor the other pass's lands on this map (the wrong room)
        expect(mapRoutesOf(snap, 13)).toEqual({ route: null, others: [] });
        expect(mapRoutesOf(snap, null)).toEqual({ route: null, others: [] });
        // thinned: the count before; dashes null (not recorded): no markers; a malformed cell is dropped
        const thin = { best: { ok: true, ticks: 900, pass: 'full',
            route: { level: 12, cells: [[1, 5], ['x', 1], [9, 9]], dashes: null, thinned: 300 } } };
        expect(mapRoutesOf(thin, 12).route).toEqual({ level: 12, cells: [[1, 5], [9, 9]], dashes: [], thinned: 300 });
        // passRoutes never draws best's own pass
        const own = { best: { ...snap.best, passRoutes: { full: L12_ROUTE, dashless: L12_WALK } } };
        expect(mapRoutesOf(own, 12).others.map((o) => o.pass)).toEqual(['dashless']);
        // the legend names what is drawn: the line by phase, the thinning, the ◆, the faint route
        expect(legendText('solved', { room: false, blocker: false, routes: mapRoutesOf(thin, 12) }))
            .toBe('red: where it searched · white line: the final route (simplified from 300 points) · ✕ goal');
        expect(legendText('running', { room: false, blocker: false, routes: mapRoutesOf(snap, 12) }))
            .toBe('gold: searching here now · red: searched before · white dashes: the route in hand · gold ◆: a sword-dash'
                + ' · faint: the plain walk pass\'s route · cyan □: where it plans to stand · ✕ goal');
    });
});

/** A small recording DOM: elements with children, text, style, dataset, listeners; canvases record their ops. */
function recordingDocument() {
    const node = (tag) => {
        let own = '';
        const n = { tagName: tag, style: { cssText: '' }, dataset: {}, children: [], className: '', parentNode: null, listeners: {},
            get textContent() { return own + n.children.map((c) => c.data ?? c.textContent).join(''); },
            set textContent(v) { for (const c of n.children) c.parentNode = null; n.children = []; own = String(v); },
            append(...cs) { for (const c of cs) { if (c.parentNode) c.parentNode.children.splice(c.parentNode.children.indexOf(c), 1); c.parentNode = n; n.children.push(c); } },
            addEventListener(type, fn) { (n.listeners[type] ??= []).push(fn); },
            click() { for (const fn of n.listeners.click ?? []) fn({ target: n }); } };
        if (tag === 'canvas') {
            const ops = [];
            const ctx = { ops, fillStyle: '', strokeStyle: '', globalAlpha: 1, lineWidth: 1, font: '', textAlign: '', textBaseline: '' };
            for (const f of ['fillRect', 'clearRect', 'strokeRect', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'fillText', 'fill',
                'closePath', 'setLineDash']) {
                ctx[f] = (...a) => ops.push([f, ...a, f.startsWith('fill') ? ctx.fillStyle : ctx.strokeStyle]);
            }
            n.width = 0;
            n.height = 0;
            n.getContext = () => ctx;
        }
        return n;
    };
    return { createElement: node, createTextNode: (data) => ({ data, parentNode: null }) };
}

function viewSetup({ getRoom } = {}) {
    const prev = globalThis.document;
    globalThis.document = recordingDocument();
    const frames = [];
    const details = document.createElement('div');
    details.className = 'flash-panel-solve-progress';
    const view = new SolveWatchView({ details, getRoom, now: () => 0, frame: (fn) => frames.push(fn) });
    const run = () => { while (frames.length) frames.shift()(); };
    return { view, details, frames, run, restore() { globalThis.document = prev; } };
}

describe('⛓ WATCHER — the view', () => {
    it('DETAILS: a closed <details> whose summary is "Developer details" holds the developer view\'s element, as it is', () => {
        const t = viewSetup();
        try {
            const d = t.view.details;
            expect(d.tagName).toBe('details');
            expect(d.open).toBeUndefined();
            expect(d.children.map((c) => c.tagName)).toEqual(['summary', 'div']);
            expect(d.children[0].textContent).toBe('Developer details');
            expect(d.children[1]).toBe(t.details);
            expect(t.view.element.children.at(-1)).toBe(d);
        } finally { t.restore(); }
    });

    it('a hidden view draws nothing; shown, it draws the newest state at the next frame, once', () => {
        const t = viewSetup();
        try {
            const renders = t.view.stats.renders;
            for (const s of l12Stream().slice(0, 3)) t.view.update(s);
            expect(t.frames.length).toBe(0);
            t.view.setVisible(true);
            t.run();
            expect(t.view.stats.renders).toBe(renders + 1);
            expect(t.view.headline.textContent).toBe('Planning a route on level 12 to the exit…');
            expect(t.view.headline.dataset.phase).toBe('running');
            expect(t.view.nowLine.textContent).toBe('Trying now: a walk, with sword-dashes allowed near (14, 9)');
            expect(t.view.steps.children.map((c) => c.dataset.status)).toEqual(['done', 'now']);
            expect([t.view.capEffort.textContent, t.view.capWindow.textContent, t.view.capTime.textContent])
                .toEqual(['Search effort 108 of 640', 'dash search stops at 85 ▏', '1.1 s · ≈ 5.6 s left at most']);
            expect(t.view.barWindow.style.left).toBe('13.3%');
            expect(t.view.whyBox.style.display).toBe('none');
        } finally { t.restore(); }
    });

    it('the map: the room drawn once under the cells; the gold cells are the ones that rose; the goal ✕; the stance while running', () => {
        const rect = (x, y) => ({ x, y, right: x + 16, bottom: y + 16 });
        const world = { width: 40, height: 60, tiles: [{ t: 0, rect: rect(16, 80) }], solids: [], objectSolids: [], teleporters: [] };
        const t = viewSetup({ getRoom: (level) => (level === 12 ? world : null) });
        try {
            t.view.setVisible(true);
            const s = l12Stream();
            for (const x of s.slice(0, 3)) { t.view.update(x); t.run(); }
            expect(t.view.stats.roomDraws).toBe(1);
            expect([t.view.roomCanvas.width, t.view.roomCanvas.height]).toEqual([280, 420]);
            const room = t.view.roomCanvas.getContext().ops;
            expect(room.at(-1)).toEqual(['fillRect', 7, 35, 7, 7, '#6b6152']);
            const all = t.view.overlay.getContext().ops;
            const ops = all.slice(all.map((o) => o[0]).lastIndexOf('clearRect'));
            expect(ops.filter((o) => o[0] === 'strokeRect')).toEqual([['strokeRect', 99, 64, 5, 5, '#4fc3f7']]);
            expect(ops.filter((o) => o[0] === 'moveTo').map((o) => o.slice(1, 3))).toEqual([[189, 154], [196, 154]]);
            // a new snapshot of the same segment: the cell that rose is gold, the one that did not is red
            t.view.update(stateOf({ ...s[2].snapshot, seq: 3.5, tiles: { ...s[2].snapshot.tiles, cells: [[1, 5, 5, 0], [2, 5, 1, 9]] } }));
            t.run();
            const fills = t.view.overlay.getContext().ops.filter((o) => o[0] === 'fillRect').slice(-2).map((o) => o[5]);
            expect(fills[0]).toMatch(/^rgba\(245,197,24,/);
            expect(fills[1]).toMatch(/^rgba\(233,69,96,/);
            expect(t.view.stats.roomDraws).toBe(1);
            expect(t.view.legend.textContent).toBe('room: the level\'s tiles · gold: searching here now · red: searched before · cyan □: where it plans to stand · ✕ goal');
        } finally { t.restore(); }
    });

    it('a gave-up solve: the why box with the template, the raw text behind a click (as text), the ⚠ on the blocker', () => {
        const t = viewSetup();
        try {
            t.view.setVisible(true);
            const evil = '<img src=x onerror="alert(1)">';
            const danger = { source: 'bob@192,64', tick: 40, kind: 'forecast', at: [12, 4] };
            t.view.update(stateOf(snapAt(1, { frame: { key: 'k', target: null, stance: [3, 3], danger },
                tiles: { level: 12, tile: 16, cols: 20, rows: 15, cells: [[3, 3, 2, 0]] } })));
            t.view.update(stateOf(snapAt(2, { outcome: 'refused', spent: 640, tiles: { level: 12, tile: 16, cols: 20, rows: 15, cells: [[3, 3, 2, 0]] },
                lastWhy: { kind: 'danger', key: 'goal#0/walk', why: evil } }), { final: true }));
            t.run();
            expect(t.view.headline.dataset.phase).toBe('gave-up');
            expect(t.view.whyBox.style.display).toBe('');
            expect(t.view.whySentence.textContent).toBe('Why: every route it found would take a hit near (12, 4) (bob@192,64).');
            expect(t.view.whyMeta.textContent).toBe('danger at goal#0/walk · show solver text ▸');
            expect(t.view.whyRaw.style.display).toBe('none');
            t.view.whyMeta.click();
            t.run();
            expect(t.view.whyRaw.style.display).toBe('');
            expect(t.view.whyRaw.textContent).toBe(evil);
            expect(t.view.whyRaw.children).toEqual([]);
            expect(t.view.overlay.getContext().ops.filter((o) => o[0] === 'fillText')).toEqual([['fillText', '⚠', 175, 63, '#ff8c1a']]);
            expect(t.view.barFill.style.background).toBe('#ff8c1a');
            expect(t.view.nowLine.style.display).toBe('none');
        } finally { t.restore(); }
    });

    it('the route on the map: dashed while running, solid when final, a ◆ at each dash press, the other pass faint under it', () => {
        const t = viewSetup();
        const lastDraw = () => { const all = t.view.overlay.getContext().ops; return all.slice(all.map((o) => o[0]).lastIndexOf('clearRect')); };
        const lineOps = (ops) => ops.filter((o) => ['setLineDash', 'stroke', 'fill'].includes(o[0]));
        try {
            t.view.setVisible(true);
            const s = routedStream();
            for (const x of s.slice(0, 3)) { t.view.update(x); t.run(); }
            // running: the plain walk in hand, as a dashed white line through the cells' centres (7 px cells)
            let ops = lastDraw();
            expect(lineOps(ops).slice(0, 3)).toEqual([['setLineDash', [4, 3], '#ffffff'], ['stroke', '#ffffff'], ['setLineDash', [], '#ffffff']]);
            expect(ops.filter((o) => o[0] === 'lineTo').slice(0, 4).map((o) => o.slice(1, 3)))
                .toEqual([[17.5, 38.5], [17.5, 45.5], [24.5, 45.5], [31.5, 45.5]]);
            expect(ops.filter((o) => o[0] === 'fill')).toEqual([]);
            expect(t.view.legend.textContent).toBe('gold: searching here now · red: searched before · white dashes: the route in hand'
                + ' · cyan □: where it plans to stand · ✕ goal');
            // final: the plain walk faint and dotted, the dashing route solid, a ◆ (gold, dark edge) on each press's tile
            t.view.update(s[3]);
            t.run();
            ops = lastDraw();
            expect(lineOps(ops)).toEqual([
                ['setLineDash', [2, 2], 'rgba(255,255,255,0.3)'], ['stroke', 'rgba(255,255,255,0.3)'], ['setLineDash', [], 'rgba(255,255,255,0.3)'],
                ['setLineDash', [], '#ffffff'], ['stroke', '#ffffff'], ['setLineDash', [], '#ffffff'],
                ['fill', '#f5c518'], ['stroke', '#0a0a0a'], ['fill', '#f5c518'], ['stroke', '#0a0a0a'],
                ['stroke', '#ffffff'], // the goal ✕
            ]);
            const diamonds = ops.filter((o) => o[0] === 'moveTo').slice(2, 4).map((o) => o.slice(1, 3));
            expect(diamonds).toEqual([[17.5, 34.5], [24.5, 41.5]]);
            expect(t.view.legend.textContent).toBe('red: where it searched · white line: the final route · gold ◆: a sword-dash'
                + ' · faint: the plain walk pass\'s route · ✕ goal');
        } finally { t.restore(); }
    });

    it('a route on another level than the map draws nothing and the legend does not name it', () => {
        const t = viewSetup();
        try {
            t.view.setVisible(true);
            const s = routedStream();
            const other = (r) => ({ ...r, level: 13 });
            const off = { ...s[3], snapshot: { ...s[3].snapshot, best: { ...s[3].snapshot.best, route: other(L12_ROUTE),
                passRoutes: { dashless: other(L12_WALK) } } } };
            t.view.update(off);
            t.run();
            const all = t.view.overlay.getContext().ops;
            const ops = all.slice(all.map((o) => o[0]).lastIndexOf('clearRect'));
            expect(ops.filter((o) => ['setLineDash', 'fill'].includes(o[0]))).toEqual([]);
            expect(ops.filter((o) => o[0] === 'stroke')).toEqual([['stroke', '#ffffff']]); // the goal ✕ alone
            expect(t.view.legend.textContent).toBe('red: where it searched · ✕ goal');
        } finally { t.restore(); }
    });

    it('ESCAPING: the view never parses a string as HTML (source scan)', async () => {
        const { readFileSync } = await import('node:fs');
        for (const f of ['seedlingSolveWatchView.js', 'seedlingSolveWatch.js']) {
            const src = readFileSync(new URL(`./${f}`, import.meta.url), 'utf8');
            expect(src, f).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|createContextualFragment|DOMParser/);
        }
    });
});
