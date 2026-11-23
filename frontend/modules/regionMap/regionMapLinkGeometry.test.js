/**
 * region-map link-ends: the pure geometry under the Region Map's link lines — the adjacency rule, the mark across the
 * gap, the clip to a cell's border, and the arrowhead rule (⚖ the user 2026-11-22T21:55:35Z).
 */
import { describe, expect, it } from 'vitest';
import {
    atLeast, cellsAdjacent, clipBetweenRects, gapSegment, linkHasArrowhead, linkShape, segmentInRect,
} from './regionMapLinkGeometry.js';
import { GAP_PX, GUTTER_PX, cellFrames } from './regionMapFrames.js';

const R = (x, y, w, h) => ({ x, y, w, h });

describe('cellsAdjacent: a shared border across one gap of at most the gutter', () => {
    const a = R(0, 0, 100, 100);
    it('right / left / below / above, with a gutter of N', () => {
        const N = 32;
        expect(cellsAdjacent(a, R(100 + N, 0, 100, 100))).toMatchObject({ axis: 'x', gap: N, lo: 0, hi: 100, at0: 100, at1: 132 });
        expect(cellsAdjacent(a, R(-100 - N, 0, 100, 100))).toMatchObject({ axis: 'x', gap: N, at0: 0, at1: -N });
        expect(cellsAdjacent(a, R(0, 100 + N, 100, 100))).toMatchObject({ axis: 'y', gap: N, lo: 0, hi: 100, at0: 100, at1: 132 });
        expect(cellsAdjacent(a, R(0, -100 - N, 100, 100))).toMatchObject({ axis: 'y', gap: N, at0: 0, at1: -N });
    });
    it('a gutter of 0 (touching sides) is adjacent', () => {
        expect(cellsAdjacent(a, R(100, 20, 50, 50))).toMatchObject({ axis: 'x', gap: 0, lo: 20, hi: 70 });
    });
    it('a gap wider than the tolerance is not (the gap between GROUPS: GAP_PX plus a gutter)', () => {
        expect(cellsAdjacent(a, R(100 + GUTTER_PX + 1, 0, 100, 100))).toBeNull();
        expect(cellsAdjacent(a, R(100 + GAP_PX + GUTTER_PX, 0, 100, 100))).toBeNull();
        expect(cellsAdjacent(a, R(140, 0, 100, 100), 40)).toMatchObject({ gap: 40 });
    });
    it('a CORNER touch is NOT adjacent: the sides overlap by 0, so there is no shared border to mark', () => {
        expect(cellsAdjacent(a, R(100, 100, 100, 100))).toBeNull();
        expect(cellsAdjacent(a, R(132, 132, 100, 100))).toBeNull();
        expect(cellsAdjacent(a, R(100, 100, 100, 100), 0)).toBeNull();
    });
    it('a partial overlap: lo..hi is the shared stretch', () => {
        expect(cellsAdjacent(a, R(132, 60, 100, 100))).toMatchObject({ lo: 60, hi: 100 });
    });
});

describe('gapSegment: across the gap, at the doors when given', () => {
    const adj = cellsAdjacent(R(0, 0, 100, 100), R(132, 0, 100, 100));
    it('no doors: the middle of the shared border', () => {
        expect(gapSegment(adj)).toEqual({ x0: 100, y0: 50, x1: 132, y1: 50 });
    });
    it('doors: their mean position along the border, each projected onto it', () => {
        expect(gapSegment(adj, { x: 92, y: 20 }, null)).toEqual({ x0: 100, y0: 20, x1: 132, y1: 20 });
        expect(gapSegment(adj, { x: 92, y: 20 }, { x: 140, y: 40 })).toEqual({ x0: 100, y0: 30, x1: 132, y1: 30 });
    });
    it('a door ON the border projects to itself; one beyond the shared stretch is clamped to it', () => {
        expect(gapSegment(adj, { x: 100, y: 77 })).toMatchObject({ y0: 77 });
        const part = cellsAdjacent(R(0, 0, 100, 100), R(132, 60, 100, 100));
        expect(gapSegment(part, { x: 90, y: 10 })).toMatchObject({ y0: 60, y1: 60 });
    });
    it('vertical gap: x along the border', () => {
        const v = cellsAdjacent(R(0, 0, 100, 100), R(0, 132, 100, 100));
        expect(gapSegment(v, { x: 10, y: 90 })).toEqual({ x0: 10, y0: 100, x1: 10, y1: 132 });
    });
});

describe('clipping a line to the cells\' borders', () => {
    const ra = R(0, 0, 100, 100);
    const rb = R(300, 0, 100, 100);
    it('from inside both: starts where it leaves the source, ends where it enters the target', () => {
        expect(clipBetweenRects({ x: 50, y: 50 }, { x: 350, y: 50 }, ra, rb)).toEqual({ x0: 100, y0: 50, x1: 300, y1: 50, clipped: true });
    });
    it('the direction is the door-to-door one, unchanged (a diagonal keeps its slope)', () => {
        const s = clipBetweenRects({ x: 50, y: 50 }, { x: 350, y: 350 }, ra, R(300, 300, 100, 100));
        expect(s).toMatchObject({ x0: 100, y0: 100, x1: 300, y1: 300 });
    });
    it('from OUTSIDE its own cell: that end is kept', () => {
        expect(clipBetweenRects({ x: 150, y: 50 }, { x: 350, y: 50 }, ra, rb)).toMatchObject({ x0: 150, x1: 300 });
    });
    it('a door tile ON the border: the end is that point', () => {
        expect(clipBetweenRects({ x: 100, y: 30 }, { x: 300, y: 30 }, ra, rb)).toMatchObject({ x0: 100, y0: 30, x1: 300, y1: 30 });
    });
    it('overlapping cells leave nothing to clip to: the uncut segment', () => {
        expect(clipBetweenRects({ x: 10, y: 10 }, { x: 20, y: 20 }, ra, ra)).toMatchObject({ x0: 10, x1: 20, clipped: false });
    });
    it('segmentInRect misses and hits', () => {
        expect(segmentInRect({ x: -10, y: 200 }, { x: 500, y: 200 }, ra)).toBeNull();
        expect(segmentInRect({ x: -100, y: 50 }, { x: 100, y: 50 }, ra)).toEqual([0.5, 1]);
    });
});

describe('the arrowhead rule and the shape of a link', () => {
    it('no head on a join; down / up / warp keep theirs', () => {
        expect(linkHasArrowhead('join')).toBe(false);
        expect(linkHasArrowhead(undefined)).toBe(false);
        for (const k of ['down', 'up', 'warp']) expect(linkHasArrowhead(k)).toBe(true);
    });
    // Three cells: A (0,0) and B (1,0) side by side; C (3,0) two columns on. 10×10-tile levels, 16 px tiles.
    const frames = cellFrames(new Map([['A', { gx: 0, gy: 0 }], ['B', { gx: 1, gy: 0 }], ['C', { gx: 3, gy: 0 }], ['D', { gx: 1, gy: 1 }]]),
        new Map([['A', { w: 10, h: 10 }], ['B', { w: 10, h: 10 }], ['C', { w: 10, h: 10 }], ['D', { w: 10, h: 10 }]]));
    it('adjacent: a gap mark from A\'s border to B\'s, at the doors', () => {
        const s = linkShape({ from: 'A', to: 'B', kind: 'join', a: [9, 3], b: [0, 3] }, frames);
        const fa = frames.get('A').cell;
        const fb = frames.get('B').cell;
        expect(s.form).toBe('gap');
        expect(s.head).toBe(false);
        expect(s.seg).toEqual({ x0: fa.x + fa.w, y0: fa.y + 3.5 * 16, x1: fb.x, y1: fa.y + 3.5 * 16 });
    });
    it('a down link between adjacent cells is a gap mark WITH a head', () => {
        expect(linkShape({ from: 'B', to: 'D', kind: 'down', a: null, b: null }, frames)).toMatchObject({ form: 'gap', head: true, axis: 'y' });
    });
    it('diagonal neighbours (corner) are not adjacent: a clipped line', () => {
        expect(linkShape({ from: 'A', to: 'D', kind: 'join' }, frames).form).toBe('line');
    });
    it('not adjacent: a line clipped to both borders, centre to centre with no doors', () => {
        const s = linkShape({ from: 'A', to: 'C', kind: 'warp', a: null, b: null }, frames);
        const fa = frames.get('A').cell;
        const fc = frames.get('C').cell;
        expect(s).toMatchObject({ form: 'line', head: true });
        expect(s.seg.x0).toBe(fa.x + fa.w);
        expect(s.seg.x1).toBe(fc.x);
    });
    it('a missing frame: null', () => {
        expect(linkShape({ from: 'A', to: 'Z' }, frames)).toBeNull();
    });
});

describe('atLeast: the floor on a gap mark\'s on-screen length', () => {
    it('stretches about the middle; a long one is untouched', () => {
        expect(atLeast({ x0: 0, y0: 5, x1: 2, y1: 5 }, 8)).toEqual({ x0: -3, y0: 5, x1: 5, y1: 5 });
        expect(atLeast({ x0: 0, y0: 0, x1: 20, y1: 0 }, 8)).toEqual({ x0: 0, y0: 0, x1: 20, y1: 0 });
    });
    it('a zero-length one (gutter 0) grows along the gap axis', () => {
        expect(atLeast({ x0: 4, y0: 4, x1: 4, y1: 4 }, 8, 'y')).toEqual({ x0: 4, y0: 0, x1: 4, y1: 8 });
        expect(atLeast({ x0: 4, y0: 4, x1: 4, y1: 4 }, 8)).toEqual({ x0: 4, y0: 4, x1: 4, y1: 4 });
    });
});
