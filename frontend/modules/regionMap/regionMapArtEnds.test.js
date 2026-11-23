/**
 * region-map art-ends: a LINE between cells that are not adjacent ends at its door tile (the link's own exit, or its
 * reciprocal) when the end has one, else on the level ART's border (`f.x / y / w / h`, not `f.cell`). Gap marks
 * between adjacent cells are byte-identical to base (`baseGapShape` below: base 178b2c16c0's `cellsAdjacent`,
 * `gapSegment` and the gap branch of `linkShape`, verbatim but renamed).
 *
 * ⚖ The user, session 84c8ab35, 2026-11-23T01:20:20.902Z: "End lines at the art. Also, if the arrows have a known source
 * or destination tile, then the arrow should start or end at that tile, if possible."
 *
 * ⛔ No preset-derived hard pins (js-19 e3): over the presets every number is DERIVED.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { artRect, linkShape, segmentInRect } from './regionMapLinkGeometry.js';
import { GUTTER_PX, cellFrames, tileCentre } from './regionMapFrames.js';
import { buildRegionMapModel, exitTileOf, groupLinks } from './regionMapModel.js';
import { displayRegionReader } from '../procgenCore/regionLayoutResolve.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import '../flashPanel/flashSeedlingLibrary.js';
import '../flashPanel/flashSeedlingGenLibrary.js';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const read = (p) => JSON.parse(readFileSync(here(p), 'utf8'));
const PRESETS = {
    seedling_playthrough: '../../presets/seedling_playthrough/AP_14089154938208861744/AP_14089154938208861744_rules.json',
    seedling_er: '../../presets/seedling_er/AP_1/AP_1_rules.json',
    seedling_playthrough_maze: '../../presets/seedling_playthrough_maze/AP_1/AP_1_rules.json',
    alttp: '../../presets/alttp/AP_14089154938208861744/AP_14089154938208861744_rules.json',
    procgen_topdown: '../../presets/procgen_topdown/AP_7/AP_7_rules.json',
};

// ⛔ FROZEN: base 178b2c16c0, verbatim (renamed): the adjacency rule, the gap mark, and linkShape's gap branch.
const EPS = 1e-9;
function baseCellsAdjacent(a, b, tol = GUTTER_PX) {
    if (!a || !b) return null;
    const ovY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    const ovX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    if (ovY > EPS) {
        if (b.x >= a.x + a.w - EPS && b.x - (a.x + a.w) <= tol + EPS) {
            return { axis: 'x', gap: b.x - (a.x + a.w), lo: Math.max(a.y, b.y), hi: Math.min(a.y + a.h, b.y + b.h), at0: a.x + a.w, at1: b.x };
        }
        if (a.x >= b.x + b.w - EPS && a.x - (b.x + b.w) <= tol + EPS) {
            return { axis: 'x', gap: a.x - (b.x + b.w), lo: Math.max(a.y, b.y), hi: Math.min(a.y + a.h, b.y + b.h), at0: a.x, at1: b.x + b.w };
        }
    }
    if (ovX > EPS) {
        if (b.y >= a.y + a.h - EPS && b.y - (a.y + a.h) <= tol + EPS) {
            return { axis: 'y', gap: b.y - (a.y + a.h), lo: Math.max(a.x, b.x), hi: Math.min(a.x + a.w, b.x + b.w), at0: a.y + a.h, at1: b.y };
        }
        if (a.y >= b.y + b.h - EPS && a.y - (b.y + b.h) <= tol + EPS) {
            return { axis: 'y', gap: a.y - (b.y + b.h), lo: Math.max(a.x, b.x), hi: Math.min(a.x + a.w, b.x + b.w), at0: a.y, at1: b.y + b.h };
        }
    }
    return null;
}
function baseGapSegment(adj, pa = null, pb = null) {
    const along = (p) => (p ? (adj.axis === 'x' ? p.y : p.x) : null);
    const ps = [along(pa), along(pb)].filter((v) => v != null && Number.isFinite(v));
    let t = ps.length ? ps.reduce((s, v) => s + v, 0) / ps.length : (adj.lo + adj.hi) / 2;
    t = Math.min(adj.hi, Math.max(adj.lo, t));
    return adj.axis === 'x'
        ? { x0: adj.at0, y0: t, x1: adj.at1, y1: t }
        : { x0: t, y0: adj.at0, x1: t, y1: adj.at1 };
}
function baseGapShape(link, frames, tol = GUTTER_PX) {
    const fa = frames.get(link.from);
    const fb = frames.get(link.to);
    if (!fa || !fb) return null;
    const end = (f, tile) => (tile ? tileCentre(f, tile[0], tile[1]) : null);
    const da = end(fa, link.a);
    const db = end(fb, link.b);
    const head = (link.kind ?? 'join') !== 'join';
    const adj = baseCellsAdjacent(fa.cell, fb.cell, tol);
    if (adj) return { form: 'gap', seg: baseGapSegment(adj, da, db), head, axis: adj.axis };
    return { form: 'line' };
}

const R = (x, y, w, h) => ({ x, y, w, h });
const onBorder = (pt, r) => {
    const inX = pt.x >= r.x - 1e-6 && pt.x <= r.x + r.w + 1e-6;
    const inY = pt.y >= r.y - 1e-6 && pt.y <= r.y + r.h + 1e-6;
    const edge = [r.x, r.x + r.w].some((v) => Math.abs(pt.x - v) < 1e-6) || [r.y, r.y + r.h].some((v) => Math.abs(pt.y - v) < 1e-6);
    return inX && inY && edge;
};

// Two cells two columns apart: A (0,0) a 10×10 level, C (2,0) a 4×4 level in a row as tall as B's 10×30 (so C's art
// is far smaller than its cell). B (1,1) is only there to make C's column / row big.
const frames = cellFrames(
    new Map([['A', { gx: 0, gy: 0 }], ['C', { gx: 2, gy: 0 }], ['B', { gx: 2, gy: 1 }], ['T', { gx: 0, gy: 1 }]]),
    new Map([['A', { w: 10, h: 10 }], ['C', { w: 4, h: 4 }], ['B', { w: 30, h: 30 }], ['T', { w: 4, h: 40 }]]),
);
const fA = frames.get('A');
const fC = frames.get('C');

describe('a line ends at the door tile, else on the ART border', () => {
    it('the fixture: C\'s art is smaller than its cell', () => {
        expect(fC.w).toBeLessThan(fC.cell.w);
        expect(fC.h).toBeLessThan(fC.cell.h);
    });
    it('both ends with tiles: from tile centre to tile centre, nothing clipped', () => {
        const s = linkShape({ from: 'A', to: 'C', kind: 'down', a: [2, 3], b: [1, 1] }, frames);
        const pa = tileCentre(fA, 2, 3);
        const pc = tileCentre(fC, 1, 1);
        expect(s).toMatchObject({ form: 'line', head: true, ends: { from: 'tile', to: 'tile' } });
        expect(s.seg).toEqual({ x0: pa.x, y0: pa.y, x1: pc.x, y1: pc.y });
    });
    it('a tile at the source only: starts at the tile, ends where it ENTERS the target art (aimed at its centre)', () => {
        const s = linkShape({ from: 'A', to: 'C', kind: 'warp', a: [2, 3], b: null }, frames);
        const pa = tileCentre(fA, 2, 3);
        expect(s.ends).toEqual({ from: 'tile', to: 'art' });
        expect({ x: s.seg.x0, y: s.seg.y0 }).toEqual(pa);
        const end = { x: s.seg.x1, y: s.seg.y1 };
        expect(onBorder(end, artRect(fC))).toBe(true);
        // On the line from the tile to C's art centre.
        const q = { x: fC.x + fC.w / 2, y: fC.y + fC.h / 2 };
        const cross = (end.x - pa.x) * (q.y - pa.y) - (end.y - pa.y) * (q.x - pa.x);
        expect(Math.abs(cross)).toBeLessThan(1e-6);
        // ...and inside the CELL, not on its border: the art is what it stops at.
        expect(end.x).toBeGreaterThan(fC.cell.x);
    });
    it('a tile at the target only: starts where it LEAVES the source art, ends at the tile', () => {
        const s = linkShape({ from: 'A', to: 'C', kind: 'join', a: null, b: [1, 1] }, frames);
        expect(s).toMatchObject({ head: false, ends: { from: 'art', to: 'tile' } });
        expect(onBorder({ x: s.seg.x0, y: s.seg.y0 }, artRect(fA))).toBe(true);
        expect({ x: s.seg.x1, y: s.seg.y1 }).toEqual(tileCentre(fC, 1, 1));
    });
    it('neither: art centre to art centre, clipped to both ARTS (not the cells)', () => {
        const s = linkShape({ from: 'A', to: 'C', kind: 'up', a: null, b: null }, frames);
        expect(s.ends).toEqual({ from: 'art', to: 'art' });
        expect(onBorder({ x: s.seg.x0, y: s.seg.y0 }, artRect(fA))).toBe(true);
        expect(onBorder({ x: s.seg.x1, y: s.seg.y1 }, artRect(fC))).toBe(true);
        expect(s.seg.x1).toBe(fC.x); // C's art's left side, inside its cell's
        expect(s.seg.x1).toBeGreaterThan(fC.cell.x);
    });
    it('a tall cell, small art (T: 4×40 in A\'s column): the end is on the art, not the cell outline', () => {
        const s = linkShape({ from: 'T', to: 'C', kind: 'join', a: null, b: null }, frames);
        const fT = frames.get('T');
        expect(onBorder({ x: s.seg.x0, y: s.seg.y0 }, artRect(fT))).toBe(true);
        expect(s.seg.x0).toBe(fT.x + fT.w);
        expect(s.seg.x0).toBeLessThan(fT.cell.x + fT.cell.w);
    });
    it('a door tile ON the art border: the end is that tile\'s centre (half a tile inside the art)', () => {
        const s = linkShape({ from: 'A', to: 'C', kind: 'join', a: [9, 4], b: null }, frames);
        const pa = tileCentre(fA, 9, 4);
        expect({ x: s.seg.x0, y: s.seg.y0 }).toEqual(pa);
        expect(pa.x).toBe(fA.x + fA.w - fA.tilePx / 2);
        expect(s.ends.from).toBe('tile');
    });
    it('the arrowhead is at the `to` end (the shape\'s x1/y1), the door tile or the art border', () => {
        const s = linkShape({ from: 'C', to: 'A', kind: 'down', a: null, b: [2, 3] }, frames);
        expect({ x: s.seg.x1, y: s.seg.y1 }).toEqual(tileCentre(fA, 2, 3));
        expect(s.head).toBe(true);
    });
    it('a door tile on a level with an ESTIMATED extent is no place: that end clips to the art', () => {
        const est = cellFrames(new Map([['A', { gx: 0, gy: 0 }], ['C', { gx: 2, gy: 0 }]]), new Map([['A', { w: 10, h: 10 }]]));
        expect(est.get('C').ext.estimated).toBe(true);
        const s = linkShape({ from: 'A', to: 'C', kind: 'join', a: [2, 3], b: [37, 0] }, est);
        expect(s.ends).toEqual({ from: 'tile', to: 'art' });
        expect(onBorder({ x: s.seg.x1, y: s.seg.y1 }, artRect(est.get('C')))).toBe(true);
    });
    it('segmentInRect still answers the art clip', () => {
        expect(segmentInRect({ x: fC.x - 10, y: fC.y + 1 }, { x: fC.x + 1, y: fC.y + 1 }, artRect(fC))).not.toBeNull();
    });
});

describe('WHICH tile: the link\'s own exit, never "the nearest" (js-22 edit 1)', () => {
    it('hand-made: of several exits from A to C, the first one in payload order (and its reciprocal) is the end', () => {
        const layout = { positions: new Map([['A', { gx: 0, gy: 0 }], ['C', { gx: 2, gy: 0 }]]), graph: { links: [] } };
        const sc = (exits) => ({ playable_payload: { exits } });
        const sidecars = {
            A: sc([
                { exit_id: 'far', targetRegion: 'C', targetExitId: 'c1', exit_tiles: [[0, 0]] },
                { exit_id: 'near', targetRegion: 'C', targetExitId: 'c2', exit_tiles: [[9, 5]] },
            ]),
            C: sc([
                { exit_id: 'c1', targetRegion: 'A', targetExitId: 'far', exit_tiles: [[3, 3]] },
                { exit_id: 'c2', targetRegion: 'A', targetExitId: 'near', exit_tiles: [[0, 0]] },
            ]),
        };
        // groupLinks over a two-group layout: A and C in different groups.
        {
            const links = groupLinks({ layout, sidecars, displayOf: (n) => n, groupOf: new Map([['A', 1], ['C', 2]]) });
            expect(links).toEqual([{ from: 'A', to: 'C', kind: 'join', a: [0, 0], b: [3, 3] }]);
            const s = linkShape(links[0], frames);
            expect({ x: s.seg.x0, y: s.seg.y0 }).toEqual(tileCentre(fA, 0, 0)); // 'far', not 'near'
            expect({ x: s.seg.x1, y: s.seg.y1 }).toEqual(tileCentre(fC, 3, 3));
        }
    });
    it('seedling_playthrough L16 → L17 (7 pit exits + a stairway): the end is the FIRST exit naming the pair, its reciprocal at the other end', () => {
        const rules = read(PRESETS.seedling_playthrough);
        const m = buildRegionMapModel({ rules, registry: substrateRegistry });
        const sidecars = rules.preset_sidecars[m.player];
        const displayOf = displayRegionReader(sidecars, substrateRegistry);
        const all = [...m.links, ...m.neighbourLinks];
        const link = all.find((l) => [l.from, l.to].sort().join() === ['level_16', 'level_17'].sort().join());
        expect(link).toBeTruthy();
        // Derived: every exit between the two display regions, in sidecar-then-payload order.
        const cands = [];
        for (const [name, s] of Object.entries(sidecars)) {
            for (const e of s?.playable_payload?.exits ?? []) {
                if (typeof e?.targetRegion !== 'string' || !sidecars[e.targetRegion]) continue;
                const pair = [displayOf(name), displayOf(e.targetRegion)];
                if (pair.sort().join() === ['level_16', 'level_17'].sort().join()) cands.push({ name, e });
            }
        }
        const fromL16 = cands.filter((c) => displayOf(c.name) === 'level_16');
        expect(fromL16.length).toBeGreaterThan(1); // several candidates: the case the edit is about
        const first = cands[0];
        expect(displayOf(first.name)).toBe(link.from);
        expect(link.a).toEqual(exitTileOf(first.e));
        const back = sidecars[first.e.targetRegion].playable_payload.exits.find((x) => x.exit_id === first.e.targetExitId);
        expect(link.b).toEqual(exitTileOf(back));
        const f = cellFrames(m.layout.positions, new Map([...m.cells].map(([k, c]) => [k, c.extent])), 'level');
        const s = linkShape(link, f);
        if (s.form === 'line') {
            expect(s.ends).toEqual({ from: 'tile', to: 'tile' });
            const pa = tileCentre(f.get(link.from), link.a[0], link.a[1]);
            expect({ x: s.seg.x0, y: s.seg.y0 }).toEqual(pa);
        }
    });
});

describe('the gap marks and the gap/line split are byte-identical to base (frozen copy)', () => {
    for (const [name, path] of Object.entries(PRESETS)) {
        for (const mode of ['level', 'uniform']) {
            it(`${name} (${mode})`, () => {
                const m = buildRegionMapModel({ rules: read(path), registry: substrateRegistry });
                const f = cellFrames(m.layout.positions, new Map([...m.cells].map(([k, c]) => [k, c.extent])), mode);
                const all = [...m.links, ...m.neighbourLinks];
                const now = all.map((l) => {
                    const s = linkShape(l, f);
                    return s?.form === 'gap' ? s : (s && { form: s.form });
                });
                const base = all.map((l) => baseGapShape(l, f));
                expect(JSON.stringify(now)).toBe(JSON.stringify(base));
                // Every line end is a door tile or on its art's border.
                for (const l of all) {
                    const s = linkShape(l, f);
                    if (s?.form !== 'line') continue;
                    for (const [which, x, y] of [['from', s.seg.x0, s.seg.y0], ['to', s.seg.x1, s.seg.y1]]) {
                        const fr = f.get(l[which]);
                        const tile = which === 'from' ? l.a : l.b;
                        if (tile && !fr.ext.estimated) {
                            expect({ x, y }).toEqual(tileCentre(fr, tile[0], tile[1]));
                            // A real-extent door tile is inside its own art.
                            expect(x > fr.x && x < fr.x + fr.w && y > fr.y && y < fr.y + fr.h).toBe(true);
                        } else {
                            expect(s.ends[which]).toBe('art');
                            expect(onBorder({ x, y }, artRect(fr))).toBe(true);
                        }
                    }
                }
            });
        }
    }
});
