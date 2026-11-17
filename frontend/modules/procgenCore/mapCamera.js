/**
 * procgenCore/mapCamera — **THE CAMERA MATH** (region-map step 3b; moved from `regionMap/regionMapCamera.js` so the labs' set maps share it). ⛔ PURE.
 *
 * A camera is `{x, y, zoom}`: the WORLD point at the viewport's centre and the screen px per world px.
 *     screen = (world − camera) · zoom + viewport / 2
 * The viewport is `{w, h}` in CSS px. Signed world coordinates cost nothing here (⚖ the origin ruling).
 */

export const MIN_ZOOM = 0.005;
export const MAX_ZOOM = 8;

export const clampZoom = (z, min = MIN_ZOOM, max = MAX_ZOOM) => Math.min(max, Math.max(min, z));

export function worldToScreen(cam, vp, wx, wy) {
    return { x: (wx - cam.x) * cam.zoom + vp.w / 2, y: (wy - cam.y) * cam.zoom + vp.h / 2 };
}

export function screenToWorld(cam, vp, sx, sy) {
    return { x: (sx - vp.w / 2) / cam.zoom + cam.x, y: (sy - vp.h / 2) / cam.zoom + cam.y };
}

/** The world rectangle the viewport shows: `{x0, y0, x1, y1}`. */
export function viewRect(cam, vp) {
    const a = screenToWorld(cam, vp, 0, 0);
    const b = screenToWorld(cam, vp, vp.w, vp.h);
    return { x0: a.x, y0: a.y, x1: b.x, y1: b.y };
}

/** Zoom by `factor` keeping the world point under screen (sx, sy) where it is (a wheel around the cursor). */
export function zoomAround(cam, vp, sx, sy, factor, { min = MIN_ZOOM, max = MAX_ZOOM } = {}) {
    const zoom = clampZoom(cam.zoom * factor, min, max);
    const w = screenToWorld(cam, vp, sx, sy);
    return { x: w.x - (sx - vp.w / 2) / zoom, y: w.y - (sy - vp.h / 2) / zoom, zoom };
}

/** Pan by a screen-pixel drag `(dx, dy)`: the world moves with the pointer. */
export function panBy(cam, dx, dy) {
    return { x: cam.x - dx / cam.zoom, y: cam.y - dy / cam.zoom, zoom: cam.zoom };
}

/** The camera that shows the world box `{x0, y0, x1, y1}` whole, with `margin` screen px around it. */
export function fitCamera(box, vp, { margin = 16, min = MIN_ZOOM, max = MAX_ZOOM } = {}) {
    if (!box) return { x: 0, y: 0, zoom: 1 };
    const bw = Math.max(1, box.x1 - box.x0);
    const bh = Math.max(1, box.y1 - box.y0);
    const zoom = clampZoom(Math.min((vp.w - 2 * margin) / bw, (vp.h - 2 * margin) / bh), min, max);
    return { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2, zoom };
}

/** The camera centred on a world box, at `zoom` (the follow-player target keeps the zoom it has). */
export function centreOn(box, zoom) {
    return { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2, zoom };
}

/** Ease from `a` to `b`, `t` in [0, 1] (smoothstep on position; the zoom eases geometrically). */
export function easeCamera(a, b, t) {
    const u = Math.min(1, Math.max(0, t));
    const s = u * u * (3 - 2 * u);
    return {
        x: a.x + (b.x - a.x) * s,
        y: a.y + (b.y - a.y) * s,
        zoom: a.zoom * Math.pow(b.zoom / a.zoom, s),
    };
}
