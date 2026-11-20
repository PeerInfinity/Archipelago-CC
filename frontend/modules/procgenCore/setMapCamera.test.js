/**
 * setMapCamera — the set map's camera over the provider's frame (slice `lab-map-camera`). Pure rows.
 */
import { describe, expect, it } from 'vitest';

import { worldToScreen } from './mapCamera.js';
import {
    DRAG_THRESHOLD_PX, centreOnRect, engagedView, fitFrame, homeView, panScreen, rectToScreen, toScreen, toWorld,
    resizeView, transformOf, zoomAt, zoomAtCentre,
} from './setMapCamera.js';

const cell = (x, y, w = 88, h = 88) => ({ x, y, w, h });
/** A frame TALLER than it is wide, so a width-only fit overflows it. */
const TALL = { width: 228, height: 720, cells: [cell(20, 20), cell(120, 20), cell(20, 612)] };

describe('setMapCamera — HOME is the identity over the frame', () => {
    it('home: the canvas is the frame, the camera its centre at zoom 1, and every point maps to itself', () => {
        const { cam, vp } = homeView(TALL);
        expect(vp).toEqual({ w: 228, h: 720 });
        expect(cam).toEqual({ x: 114, y: 360, zoom: 1 });
        for (const p of [{ x: 0, y: 0 }, { x: 20, y: 612 }, { x: 227, y: 719 }]) expect(toScreen(cam, vp, p)).toEqual(p);
        expect(transformOf(cam, vp)).toEqual({ a: 1, d: 1, e: 0, f: 0 });
    });

    it('engaged: the canvas is the panel\'s visible window, centred where that window was, clamped to the frame', () => {
        const panel = { clientWidth: 100, clientHeight: 300, scrollLeft: 50, scrollTop: 400 };
        const { cam, vp } = engagedView(TALL, panel);
        expect(vp).toEqual({ w: 100, h: 300 });
        expect(cam).toEqual({ x: 100, y: 550, zoom: 1 });
        // ⛓ what was at the window's top-left (frame px (50, 400)) is at canvas (0, 0): nothing moved on screen
        expect(toScreen(cam, vp, { x: 50, y: 400 })).toEqual({ x: 0, y: 0 });
        // (lab-map-small-set-view) a panel wider than the frame → the PANEL's width; no panel → the whole frame
        expect(engagedView(TALL, { clientWidth: 900 }).vp).toEqual({ w: 900, h: 720 });
        expect(engagedView(TALL).cam).toEqual(homeView(TALL).cam);
        // a scroll past the end is clamped
        expect(engagedView(TALL, { clientWidth: 100, clientHeight: 300, scrollLeft: 999, scrollTop: 999 }).cam)
            .toEqual({ x: 178, y: 570, zoom: 1 });
    });
});

/**
 * ⛓⛓ lab-map-small-set-view — once engaged, a SMALL set's map takes the room the panel can give, not the frame's
 * size. MUTANT: the old `min(panel, frame)` window on every axis → the first three rows red.
 */
describe('setMapCamera — a small set gets the panel\'s room once engaged', () => {
    /** A frame SMALLER than the panel on both axes (a one-row strip of rooms, like the maze demo pack). */
    const SHORT = { width: 300, height: 100, cells: [cell(6, 6), cell(106, 6), cell(206, 6)] };
    /** At home a short frame's block panel is as wide as its container but only as tall as the canvas. */
    const PANEL = { clientWidth: 800, clientHeight: 100, scrollLeft: 0, scrollTop: 0, roomHeight: 640 };

    it('a frame SMALLER than the panel → the viewport is the panel\'s room (width, and max-height), not the frame', () => {
        expect(engagedView(SHORT, PANEL).vp).toEqual({ w: 800, h: 640 });
        // no room known for the height → the panel's client height (here the frame's), as before; width still grows
        expect(engagedView(SHORT, { ...PANEL, roomHeight: undefined }).vp).toEqual({ w: 800, h: 100 });
        // a room smaller than the frame never shrinks it
        expect(engagedView(SHORT, { ...PANEL, clientWidth: 300, roomHeight: 40 }).vp).toEqual({ w: 300, h: 100 });
    });

    it('a frame LARGER than the panel → the visible window, exactly as before (a room does not change it)', () => {
        const panel = { clientWidth: 100, clientHeight: 300, scrollLeft: 50, scrollTop: 400 };
        expect(engagedView(TALL, { ...panel, roomHeight: 640, roomWidth: 900 })).toEqual(engagedView(TALL, panel));
        expect(engagedView(TALL, { ...panel, roomHeight: 640 })).toEqual({ cam: { x: 100, y: 550, zoom: 1 },
            vp: { w: 100, h: 300 } });
        // one axis larger, one fitting: only the fitting one grows
        const WIDE = { width: 2000, height: 100, cells: [cell(0, 0)] };
        expect(engagedView(WIDE, { clientWidth: 500, clientHeight: 100, scrollLeft: 120, roomHeight: 640 }))
            .toEqual({ cam: { x: 370, y: 320, zoom: 1 }, vp: { w: 500, h: 640 } });
    });

    it('the switch: `pixels` keeps every on-screen frame point on its pixel; `centre` puts the window\'s centre at the '
        + 'view\'s centre', () => {
        const px = engagedView(SHORT, PANEL);
        for (const p of [{ x: 0, y: 0 }, { x: 150, y: 50 }, { x: 299, y: 99 }]) expect(toScreen(px.cam, px.vp, p)).toEqual(p);
        const scrolled = engagedView({ ...SHORT, width: 1000 }, { ...PANEL, scrollLeft: 200 });
        expect(scrolled.vp).toEqual({ w: 800, h: 640 });
        expect(toScreen(scrolled.cam, scrolled.vp, { x: 200, y: 0 })).toEqual({ x: 0, y: 0 });
        const c = engagedView(SHORT, PANEL, { anchor: 'centre' });
        expect(c.vp).toEqual(px.vp);
        expect(toScreen(c.cam, c.vp, { x: 150, y: 50 })).toEqual({ x: 400, y: 320 });
        // on an axis that does not grow the two anchors are the same camera
        const t = { clientWidth: 100, clientHeight: 300, scrollLeft: 50, scrollTop: 400, roomHeight: 640 };
        expect(engagedView(TALL, t, { anchor: 'centre' })).toEqual(engagedView(TALL, t));
    });

    it('FIT on a small set ZOOMS IN to fill the tight axis of the new viewport (within MAX_ZOOM)', () => {
        const { vp } = engagedView(SHORT, PANEL);
        const cam = fitFrame(SHORT, vp);
        expect(cam.zoom).toBeGreaterThan(2);
        const xs = SHORT.cells.flatMap((k) => [k.x, k.x + k.w]);
        const left = toScreen(cam, vp, { x: Math.min(...xs), y: 6 }).x;
        const right = toScreen(cam, vp, { x: Math.max(...xs), y: 6 }).x;
        expect(left).toBeCloseTo(8, 6);
        expect(right).toBeCloseTo(vp.w - 8, 6);
        const tiny = { width: 10, height: 10, cells: [cell(0, 0, 10, 10)] };
        expect(fitFrame(tiny, engagedView(tiny, PANEL).vp).zoom).toBe(8);
    });

    it('a RESIZED panel keeps the frame point at the canvas\'s top-left', () => {
        const { cam, vp } = engagedView(SHORT, PANEL);
        const z = zoomAt(cam, vp, 100, 40, 1.25);
        const tl = toWorld(z, vp, { x: 0, y: 0 });
        const r = resizeView(z, vp, { w: 600.7, h: vp.h });
        expect(r.vp).toEqual({ w: 600, h: 640 });
        const tl2 = toWorld(r.cam, r.vp, { x: 0, y: 0 });
        expect(tl2.x).toBeCloseTo(tl.x, 9);
        expect(tl2.y).toBeCloseTo(tl.y, 9);
        expect(r.cam.zoom).toBe(z.zoom);
    });
});

describe('setMapCamera — the gestures', () => {
    const vp = { w: 200, h: 100 };
    const cam = { x: 300, y: 50, zoom: 2 };

    it('the canvas transform IS worldToScreen', () => {
        const t = transformOf(cam, vp);
        for (const [wx, wy] of [[0, 0], [300, 50], [17.5, -3]]) {
            const s = worldToScreen(cam, vp, wx, wy);
            expect(wx * t.a + t.e).toBeCloseTo(s.x, 9);
            expect(wy * t.d + t.f).toBeCloseTo(s.y, 9);
        }
        expect(rectToScreen(cam, vp, cell(300, 50, 10, 4))).toEqual([100, 50, 20, 8]);
        expect(toWorld(cam, vp, toScreen(cam, vp, { x: 12, y: 34 }))).toEqual({ x: 12, y: 34 });
    });

    it('zoomAt keeps the world point under the screen point; zoomAtCentre keeps the centre and undoes exactly', () => {
        const at = zoomAt(cam, vp, 37, 81, 1.25);
        expect(at.zoom).toBe(2.5);
        const before = toWorld(cam, vp, { x: 37, y: 81 });
        const after = toWorld(at, vp, { x: 37, y: 81 });
        expect(after.x).toBeCloseTo(before.x, 9);
        expect(after.y).toBeCloseTo(before.y, 9);
        const home = homeView(TALL);
        const back = zoomAtCentre(zoomAtCentre(home.cam, home.vp, 1.25), home.vp, 1 / 1.25);
        expect(back).toEqual(home.cam);
    });

    it('a drag moves the world with the pointer; the drag threshold is a few px', () => {
        const p = panScreen(cam, 20, -10);
        expect(toScreen(p, vp, { x: 300, y: 50 })).toEqual({ x: 120, y: 40 });
        expect(DRAG_THRESHOLD_PX).toBeGreaterThan(1);
        expect(DRAG_THRESHOLD_PX).toBeLessThan(10);
    });

    /** MUTANT: fit the width only — the tall frame's bottom room is below the view. */
    it('FIT puts EVERY room inside the view on BOTH axes', () => {
        const view = { w: 400, h: 200 };
        const f = fitFrame(TALL, view);
        for (const c of TALL.cells) {
            const [x, y, w, h] = rectToScreen(f, view, c);
            expect(x).toBeGreaterThanOrEqual(0);
            expect(y).toBeGreaterThanOrEqual(0);
            expect(x + w).toBeLessThanOrEqual(view.w + 1e-9);
            expect(y + h).toBeLessThanOrEqual(view.h + 1e-9);
        }
        // the height binds here: rooms span 680 px of frame into 200 − 2·8
        expect(f.zoom).toBeCloseTo((200 - 16) / 680, 12);
    });

    it('centreOnRect puts a rect\'s centre at the view centre and keeps the zoom', () => {
        const c = centreOnRect(cam, cell(20, 612));
        expect(c).toEqual({ x: 64, y: 656, zoom: 2 });
        expect(toScreen(c, vp, { x: 64, y: 656 })).toEqual({ x: 100, y: 50 });
    });
});
