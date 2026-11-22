/**
 * pinch.test — the Region Map canvas gesture (zoom-links): one pointer drags, two pinch; the zoom ratio, the
 * midpoint pan, the two → one hand-off with no jump, and that a pinch is never a click. Applied through
 * `mapCamera` here exactly as the panel applies it, so the "world point between the fingers stays put" claim is
 * measured, not assumed.
 */
import { describe, expect, it } from 'vitest';

import { DRAG_SLOP_PX, createCanvasGesture, pinchStep } from './pinch.js';
import { MAX_ZOOM, MIN_ZOOM, panBy, screenToWorld, zoomAround } from '../procgenCore/mapCamera.js';

const VP = { w: 400, h: 300 };
/** What the panel does with a step. */
const apply = (cam, step) => (step?.kind === 'pan' ? panBy(cam, step.dx, step.dy)
    : step?.kind === 'pinch' ? zoomAround(panBy(cam, step.dx, step.dy), VP, step.cx, step.cy, step.factor) : cam);

describe('pinchStep', () => {
    it('the zoom factor is the distance ratio; the pan is the midpoint movement', () => {
        const s = pinchStep({ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 50, y: 110 }, { x: 250, y: 110 });
        expect(s.factor).toBeCloseTo(2, 12);
        expect(s).toMatchObject({ cx: 150, cy: 110, dx: 0, dy: 10 });
    });
    it('two fingers moving together pan without zooming', () => {
        const s = pinchStep({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 30, y: 40 }, { x: 40, y: 40 });
        expect(s.factor).toBe(1);
        expect(s).toMatchObject({ dx: 30, dy: 40 });
    });
    it('fingers at one point do not divide by zero', () => {
        const s = pinchStep({ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 0, y: 5 }, { x: 10, y: 5 });
        expect(Number.isFinite(s.factor)).toBe(true);
        expect(s.factor).toBe(10);
    });
});

describe('createCanvasGesture — one pointer (the mouse, unchanged)', () => {
    it('down + up without moving is a click', () => {
        const g = createCanvasGesture();
        g.down(1, 10, 10);
        expect(g.move(1, 11, 11)).toBe(null); // inside the slop
        expect(g.up(1)).toEqual({ click: true });
        expect(g.active).toBe(false);
    });
    it('past the slop it is a drag: pans by each move, `first` once, and is no click', () => {
        const g = createCanvasGesture();
        g.down(1, 10, 10);
        const a = g.move(1, 10 + DRAG_SLOP_PX + 1, 10);
        expect(a).toEqual({ kind: 'pan', dx: DRAG_SLOP_PX + 1, dy: 0, first: true });
        expect(g.move(1, 20, 15)).toEqual({ kind: 'pan', dx: 20 - (10 + DRAG_SLOP_PX + 1), dy: 5, first: false });
        expect(g.up(1)).toEqual({ click: false });
    });
    it('a move with nothing down answers nothing (the panel hovers)', () => {
        const g = createCanvasGesture();
        expect(g.move(1, 5, 5)).toBe(null);
        expect(g.active).toBe(false);
    });
});

describe('createCanvasGesture — two pointers', () => {
    it('a pinch zooms by the distance ratio around the midpoint, and the world point between the fingers stays there', () => {
        const g = createCanvasGesture();
        let cam = { x: 37, y: -12, zoom: 0.8 };
        g.down(1, 150, 150);
        g.down(2, 250, 150);
        const worldMid = screenToWorld(cam, VP, 200, 150);
        // spread both fingers apart, and drag the pair right by 30 px
        const s1 = g.move(1, 130, 160);
        cam = apply(cam, s1);
        const s2 = g.move(2, 330, 160);
        cam = apply(cam, s2);
        expect(s1.kind).toBe('pinch');
        expect(s2.kind).toBe('pinch');
        // finger distance 100 → 200: ×2 overall
        expect(cam.zoom).toBeCloseTo(0.8 * 2, 10);
        // the world point that was between the fingers is between them again (the new midpoint 230, 160)
        const now = screenToWorld(cam, VP, 230, 160);
        expect(now.x).toBeCloseTo(worldMid.x, 9);
        expect(now.y).toBeCloseTo(worldMid.y, 9);
    });
    it('the zoom stays inside mapCamera\'s limits however far the fingers go', () => {
        const g = createCanvasGesture();
        let cam = { x: 0, y: 0, zoom: MAX_ZOOM / 2 };
        g.down(1, 199, 150);
        g.down(2, 201, 150);
        cam = apply(cam, g.move(2, 400, 150));
        expect(cam.zoom).toBe(MAX_ZOOM);
        cam = apply(cam, g.move(2, 199.5, 150));
        cam = apply(cam, g.move(1, 199.4, 150));
        expect(cam.zoom).toBeGreaterThanOrEqual(MIN_ZOOM);
    });
    it('a pinch is never a click: neither lift fires one, in either order', () => {
        for (const order of [[1, 2], [2, 1]]) {
            const g = createCanvasGesture();
            g.down(1, 100, 100);
            g.down(2, 200, 100);
            expect(g.pinched).toBe(true);
            expect(g.up(order[0])).toEqual({ click: false });
            expect(g.up(order[1])).toEqual({ click: false });
        }
    });
    it('even a pinch with no movement at all is no click', () => {
        const g = createCanvasGesture();
        g.down(1, 100, 100);
        g.down(2, 100, 100);
        g.up(2);
        expect(g.up(1)).toEqual({ click: false });
    });
    it('two → one: the finger left on the glass drags on from where it is, with no jump', () => {
        const g = createCanvasGesture();
        g.down(1, 100, 100);
        g.down(2, 200, 100);
        g.move(1, 90, 100);
        g.move(2, 220, 120);
        expect(g.up(2)).toEqual({ click: false });
        expect(g.count).toBe(1);
        expect(g.moved).toBe(true);
        // the very next move of finger 1 pans by its own delta from (90, 100), not from where it went down
        expect(g.move(1, 92, 101)).toEqual({ kind: 'pan', dx: 2, dy: 1, first: false });
        expect(g.up(1)).toEqual({ click: false });
    });
    it('a third pointer does not steer; the pinch stays on the first two', () => {
        const g = createCanvasGesture();
        g.down(1, 100, 100);
        g.down(2, 200, 100);
        g.down(3, 300, 300);
        expect(g.move(3, 310, 310)).toBe(null);
        expect(g.move(2, 300, 100).kind).toBe('pinch');
    });
    it('a new gesture after a pinch can click again; reset drops every pointer', () => {
        const g = createCanvasGesture();
        g.down(1, 0, 0);
        g.down(2, 10, 0);
        g.reset();
        expect(g.active).toBe(false);
        g.down(5, 50, 50);
        expect(g.up(5)).toEqual({ click: true });
    });
});
