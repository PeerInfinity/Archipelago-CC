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
 * Once a gesture ENGAGES the camera the canvas becomes the VIEWPORT: the part of the home canvas that was on screen
 * in its scrolling panel (`engagedView`), with the camera centred where that window's centre was — so nothing moves
 * on screen at the switch, and the panel's scrollbars are replaced by the camera.
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
 * The view a gesture switches to: the visible window of the home canvas inside its scrolling panel.
 * `panel` is `{clientWidth, clientHeight, scrollLeft, scrollTop}` (any of them absent → the whole frame, no scroll).
 * The canvas size is an integer; the camera centre is the window's centre in frame px, at zoom 1.
 */
export function engagedView(frame, panel = {}) {
    const fw = frame?.width ?? 0;
    const fh = frame?.height ?? 0;
    const pick = (v, whole) => (Number.isFinite(v) && v > 0 ? Math.min(whole, Math.floor(v)) : whole);
    const w = Math.max(1, pick(panel.clientWidth, fw));
    const h = Math.max(1, pick(panel.clientHeight, fh));
    const sl = Math.max(0, Math.min(fw - w, Number(panel.scrollLeft) || 0));
    const st = Math.max(0, Math.min(fh - h, Number(panel.scrollTop) || 0));
    return { cam: { x: sl + w / 2, y: st + h / 2, zoom: 1 }, vp: { w, h } };
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
