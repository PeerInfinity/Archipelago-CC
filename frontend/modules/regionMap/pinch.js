/**
 * regionMap/pinch — **THE CANVAS GESTURE: ONE-POINTER DRAG, TWO-POINTER PINCH** (region-map zoom-links). ⛔ PURE.
 *
 * ⚖ The user, 2026-11-22T20:18:07Z (session 84c8ab35): *"I would like a way to zoom, preferably a way that also works
 * on mobile."* The panel feeds pointer events in (`down` / `move` / `up`, by `pointerId`, in canvas CSS px) and
 * applies what comes back with `procgenCore/mapCamera.js` (`panBy`, `zoomAround`); nothing here knows the camera.
 *
 *   · ONE pointer: a drag. It moves nothing until it has gone `DRAG_SLOP_PX` (the mouse's old 3 px), then pans by
 *     each move's delta (`{kind: 'pan', dx, dy, first}`; `first` on the move that starts it, so the panel unticks
 *     Follow once, as the wheel does).
 *   · TWO pointers: a pinch. Each move answers `{kind: 'pinch', factor, cx, cy, dx, dy}`: the midpoint moved by
 *     (dx, dy) → pan; the finger distance changed by `factor` → zoom around the NEW midpoint (cx, cy). Applied in
 *     that order, the world point between the fingers stays between them.
 *   · A third pointer is ignored (only the first two steer).
 *   · Two → one: the finger left on the glass becomes the drag anchor AT ITS CURRENT POSITION, already moving, so
 *     the drag resumes with no jump.
 *   · A gesture that ever had two pointers is NEVER a click: `up` of its last pointer answers `{click: false}`.
 *     A click is a single pointer that went down and up without passing the slop.
 */

/** How far (CSS px) a single pointer moves before it is a drag, not a click (the panel's mouse threshold). */
export const DRAG_SLOP_PX = 3;
/** The smallest finger distance used as a pinch base (two fingers at one point cannot divide). */
const MIN_PINCH_DIST = 1;

const dist = (a, b) => Math.max(MIN_PINCH_DIST, Math.hypot(a.x - b.x, a.y - b.y));
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** The pinch step between two finger pairs: the zoom factor, the new midpoint and how far the midpoint moved. */
export function pinchStep(prevA, prevB, a, b) {
    const m0 = mid(prevA, prevB);
    const m1 = mid(a, b);
    return { factor: dist(a, b) / dist(prevA, prevB), cx: m1.x, cy: m1.y, dx: m1.x - m0.x, dy: m1.y - m0.y };
}

export function createCanvasGesture({ slop = DRAG_SLOP_PX } = {}) {
    /** pointerId → {x, y}, in down order (a Map keeps insertion order). */
    const pts = new Map();
    let drag = null; // one pointer: {id, x, y, moved, sx, sy}
    let pinched = false;

    const steering = () => [...pts.keys()].slice(0, 2);
    const anchor = (id, moved) => {
        const p = pts.get(id);
        drag = { id, x: p.x, y: p.y, sx: p.x, sy: p.y, moved };
    };

    return {
        /** How many pointers are down. */
        get count() { return pts.size; },
        /** Did this gesture ever have two pointers down (so it can no longer click)? */
        get pinched() { return pinched; },
        /** Is a pointer down (the panel hovers only when none is)? */
        get active() { return pts.size > 0; },
        /** Has the single-pointer drag passed the slop? */
        get moved() { return !!drag?.moved; },

        down(id, x, y) {
            if (pts.has(id)) return;
            pts.set(id, { x, y });
            if (pts.size === 1) {
                pinched = false;
                anchor(id, false);
            } else if (pts.size === 2) {
                pinched = true;
                drag = null;
            }
        },

        /** → `null` (nothing to do), `{kind: 'pan', dx, dy, first}` or `{kind: 'pinch', factor, cx, cy, dx, dy}`. */
        move(id, x, y) {
            const p = pts.get(id);
            if (!p) return null;
            const ids = steering();
            if (ids.length >= 2) {
                if (!ids.includes(id)) { pts.set(id, { x, y }); return null; }
                const [ia, ib] = ids;
                const prevA = { ...pts.get(ia) };
                const prevB = { ...pts.get(ib) };
                pts.set(id, { x, y });
                const s = pinchStep(prevA, prevB, pts.get(ia), pts.get(ib));
                return { kind: 'pinch', ...s };
            }
            pts.set(id, { x, y });
            if (!drag || drag.id !== id) return null;
            if (!drag.moved && Math.hypot(x - drag.sx, y - drag.sy) < slop) return null;
            const first = !drag.moved;
            const dx = x - drag.x;
            const dy = y - drag.y;
            drag.moved = true;
            drag.x = x;
            drag.y = y;
            return { kind: 'pan', dx, dy, first };
        },

        /** → `{click}`: true only when the LAST pointer of a never-pinched gesture lifts without having dragged. */
        up(id) {
            if (!pts.has(id)) return { click: false };
            const wasDrag = drag;
            pts.delete(id);
            if (pts.size === 0) {
                const click = !pinched && !!wasDrag && wasDrag.id === id && !wasDrag.moved;
                drag = null;
                return { click };
            }
            // Two (or more) → one: the remaining finger drags on from where it is, already moving (no jump, no click).
            if (pts.size === 1) anchor([...pts.keys()][0], true);
            return { click: false };
        },

        /** Drop every pointer (a pointercancel, or the panel disposing). */
        reset() {
            pts.clear();
            drag = null;
            pinched = false;
        },
    };
}
