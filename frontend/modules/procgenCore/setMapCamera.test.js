/**
 * setMapCamera — the set map's camera over the provider's frame (slice `lab-map-camera`). Pure rows.
 */
import { describe, expect, it } from 'vitest';

import { worldToScreen } from './mapCamera.js';
import {
    DRAG_THRESHOLD_PX, centreOnRect, engagedView, fitFrame, homeView, panScreen, rectToScreen, toScreen, toWorld,
    transformOf, zoomAt, zoomAtCentre,
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
        // a panel wider than the frame → the frame's width; no panel → the whole frame
        expect(engagedView(TALL, { clientWidth: 900 }).vp).toEqual({ w: 228, h: 720 });
        expect(engagedView(TALL).cam).toEqual(homeView(TALL).cam);
        // a scroll past the end is clamped
        expect(engagedView(TALL, { clientWidth: 100, clientHeight: 300, scrollLeft: 999, scrollTop: 999 }).cam)
            .toEqual({ x: 178, y: 570, zoom: 1 });
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
