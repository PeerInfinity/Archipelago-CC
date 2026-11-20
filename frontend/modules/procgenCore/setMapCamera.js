/**
 * procgenCore/setMapCamera — **THE SET MAP'S CAMERA, OVER THE PROVIDER'S FRAME** (slice `lab-map-camera`). ⛔ PURE.
 *
 * Both labs' set map (`setEditorView` + a `setMapLayout` provider) is drawn in FRAME pixels: the provider's
 * `frame(record)` at its own zoom (always 1 since this slice — the map's zoom is the camera's). This module puts
 * `mapCamera.js`'s camera between that frame (the WORLD) and the canvas (the SCREEN).
 *
 * ⛓⛓⛓ **THE HOME VIEW IS TODAY'S PICTURE, BY CONSTRUCTION.** Until the first camera gesture the view is *at home*:
 * the canvas is sized to the frame (exactly as before this slice), the camera is the identity over it
 * (`{x: w/2, y: h/2, zoom: 1}` over a viewport `{w, h}` = the frame), and the mount does NOT transform at all — not
 * even through the identity, because `(x − w/2) + w/2` is not always `x` in floating point. So the opening paint, its
 * pickers and its readouts are the pre-camera code path, byte for byte (⚖ Robert: "the default picture stays
 * unchanged").
 *
 * Once a gesture ENGAGES the camera the canvas becomes the VIEWPORT (`engagedView`): on an axis where the frame is
 * larger than its scrolling panel, the part of the home canvas that was on screen; on an axis where the frame fits,
 * the room the panel can give (slice `lab-map-small-set-view`) — with the window's top-left kept at the canvas's
 * top-left, so nothing moves on screen at the switch, and the panel's scrollbars are replaced by the camera.
 */
import {
    MAX_ZOOM, MIN_ZOOM, centreOn, fitCamera, panBy, screenToWorld, worldToScreen, zoomAround,
} from './mapCamera.js';

export { MAX_ZOOM, MIN_ZOOM };

/** A pointer that moves less than this many screen px between press and release is a CLICK, not a drag. */
export const DRAG_THRESHOLD_PX = 4;

/** The home view of a frame: the identity camera over a canvas the frame's size. */
export function homeView(frame) {
    const w = frame?.width ?? 0;
    const h = frame?.height ?? 0;
    return { cam: { x: w / 2, y: h / 2, zoom: 1 }, vp: { w, h } };
}

/**
 * The view a gesture switches to. `panel` is `{clientWidth, clientHeight, scrollLeft, scrollTop, roomWidth,
 * roomHeight}` (any of them absent → that axis as before: the whole frame, no scroll). The canvas size is an integer.
 *
 * ⛓⛓ PER AXIS (slice `lab-map-small-set-view`):
 *   · the frame is LARGER than the panel's window on the axis (the panel scrolls on it) → the canvas is that window,
 *     exactly as `lab-map-camera` built it;
 *   · the frame FITS (frame ≤ the window) → the canvas takes the ROOM the panel can give on that axis:
 *     `roomWidth`/`roomHeight` when the mount knows it (the panel's own CSS limit, e.g. its `max-height`), else the
 *     panel's client size (a block panel is already as wide as its container). Never less than the frame.
 *     This is what lets a SMALL set zoom in and FIT into more than its home size.
 *
 * ⛓ WHERE THE CAMERA STARTS — `anchor`:
 *   · `'pixels'` (the default; a DRAG and a CTRL+WHEEL engage this way): the window's top-left (the panel's scroll
 *     offset, clamped into the frame) at the canvas's top-left, zoom 1. The canvas keeps its page position and only
 *     grows right/down, so every frame point that was on screen stays on the SAME screen pixel — a drag or a wheel
 *     that engages does not jump under the pointer.
 *   · `'centre'` (`+`/`−`, which zoom about the view's centre): the frame point at the window's centre is at the new
 *     viewport's centre, so the step zooms about the middle of what was on screen and a small set sits in the middle
 *     of its new room.
 *   On an axis that does not grow the two are the same camera (`lab-map-camera`'s rule).
 */
export function engagedView(frame, panel = {}, { anchor = 'pixels' } = {}) {
    const fw = frame?.width ?? 0;
    const fh = frame?.height ?? 0;
    const finite = (v) => Number.isFinite(v) && v > 0;
    const axis = (client, room, whole) => {
        if (!finite(client)) return whole;
        const win = Math.min(whole, Math.floor(client));
        if (whole > client) return win;
        return Math.max(win, Math.floor(finite(room) ? room : client));
    };
    const w = Math.max(1, axis(panel.clientWidth, panel.roomWidth, fw));
    const h = Math.max(1, axis(panel.clientHeight, panel.roomHeight, fh));
    if (anchor === 'centre') {
        // the window as it was on screen: its size on each axis is min(frame, client), its offset the clamped scroll
        const win = (client, whole) => (finite(client) ? Math.min(whole, Math.floor(client)) : whole);
        const ww = win(panel.clientWidth, fw);
        const wh = win(panel.clientHeight, fh);
        const sx = Math.max(0, Math.min(fw - ww, Number(panel.scrollLeft) || 0));
        const sy = Math.max(0, Math.min(fh - wh, Number(panel.scrollTop) || 0));
        return { cam: { x: sx + ww / 2, y: sy + wh / 2, zoom: 1 }, vp: { w, h } };
    }
    const sl = Math.max(0, Math.min(fw - w, Number(panel.scrollLeft) || 0));
    const st = Math.max(0, Math.min(fh - h, Number(panel.scrollTop) || 0));
    return { cam: { x: sl + w / 2, y: st + h / 2, zoom: 1 }, vp: { w, h } };
}

/**
 * ⛓ A RESIZED PANEL while engaged: the viewport takes the new `{w, h}` and the camera keeps the frame point at the
 * canvas's top-left where it was (the canvas grows or shrinks right/down, as at the switch).
 */
export function resizeView(cam, vp, next) {
    const w = Math.max(1, Math.floor(next.w));
    const h = Math.max(1, Math.floor(next.h));
    return {
        cam: { x: cam.x + (w - vp.w) / (2 * cam.zoom), y: cam.y + (h - vp.h) / (2 * cam.zoom), zoom: cam.zoom },
        vp: { w, h },
    };
}

/** The canvas transform `screen = world · zoom + (e, f)` for `ctx.setTransform(a, 0, 0, d, e, f)`. */
export function transformOf(cam, vp) {
    return { a: cam.zoom, d: cam.zoom, e: vp.w / 2 - cam.x * cam.zoom, f: vp.h / 2 - cam.y * cam.zoom };
}

/** A world point on the screen. */
export const toScreen = (cam, vp, p) => worldToScreen(cam, vp, p.x, p.y);
/** A screen point in the world. */
export const toWorld = (cam, vp, p) => screenToWorld(cam, vp, p.x, p.y);

/** A world rect `{x, y, w, h}` as `[x, y, w, h]` on the screen. */
export function rectToScreen(cam, vp, r) {
    const a = worldToScreen(cam, vp, r.x, r.y);
    return [a.x, a.y, r.w * cam.zoom, r.h * cam.zoom];
}

/** Snap a zoom that floating point left a hair off 1 back to 1 (so `+` then `-` is home's zoom again). */
const snap = (z) => (Math.abs(z - 1) < 1e-9 ? 1 : z);

/** Zoom by `factor` keeping screen point `(sx, sy)` fixed (the wheel at the cursor). */
export function zoomAt(cam, vp, sx, sy, factor) {
    const c = zoomAround(cam, vp, sx, sy, factor);
    return { ...c, zoom: snap(c.zoom) };
}

/** Zoom by `factor` about the viewport's centre (`+`, `-`, the buttons): the centre's world point stays put. */
export const zoomAtCentre = (cam, vp, factor) => zoomAt(cam, vp, vp.w / 2, vp.h / 2, factor);

/** Pan by a screen-px drag. */
export const panScreen = (cam, dx, dy) => panBy(cam, dx, dy);

/**
 * ⛓ FIT — BOTH AXES: the camera that shows every room of the frame inside the viewport. The box is the cells'
 * union (not the frame's margins), with `margin` screen px around it.
 */
export function fitFrame(frame, vp, { margin = 8 } = {}) {
    const cells = frame?.cells ?? [];
    if (cells.length === 0) return fitCamera(null, vp);
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    for (const c of cells) {
        x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y);
        x1 = Math.max(x1, c.x + c.w); y1 = Math.max(y1, c.y + c.h);
    }
    return fitCamera({ x0, y0, x1, y1 }, vp, { margin });
}

/** The camera centred on one world rect, keeping the zoom. */
export const centreOnRect = (cam, r) => centreOn({ x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h }, cam.zoom);
