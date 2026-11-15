/**
 * regionMap/regionMapOverlay — **THE LIVE OVERLAY'S GEOMETRY AND COLOURS** (region-map step 3b). ⛔ PURE.
 *
 * The art is static (the substrate's painter, cached); the overlay is the part that changes with every snapshot:
 * the location squares, their colours, and the links between groups. It is drawn generically, for every substrate.
 */
import { worldToScreen } from './regionMapCamera.js';
import { tileCentre } from './regionMapFrames.js';

/** The smallest on-screen side of a location square (CSS px), at any zoom (⚖ user: a minimum visible size). */
export const MIN_SQUARE_PX = 6;
/** A square's side as a fraction of the on-screen tile, once that is bigger than the minimum. */
export const SQUARE_TILE_FRACTION = 0.7;

export const SQUARE_COLORS = Object.freeze({
    accessible: '#3ccf4e',
    inaccessible: '#e04646',
    checked: '#6a6a6a',
    unknown: '#b8b8b8',
});

/**
 * ⛓ A location square's colour key, as the Region Graph shows it (step 2's `regionColorState`):
 *   · `'checked'`      — checked (grey, dimmed);
 *   · `'unknown'`      — the region's displayed colour is NULL (the accessibility filter is off, or discovery hides
 *                         an undiscovered region's reachability): no green, no red — the Region Graph shows no
 *                         reachability colour there either (it treats null as "not accessible" and shows yellow/grey);
 *   · `'accessible'`   — the location's rule passes and its region shows accessible;
 *   · `'inaccessible'` — otherwise.
 * @param {{state: string}|undefined} loc  the view's location record
 * @param {{color: string|null}|undefined} region  the view's record of the location's RULES region
 */
export function squareColorKey(loc, region) {
    if (!loc) return 'unknown';
    if (loc.state === 'checked') return 'checked';
    if (!region || region.color == null) return 'unknown';
    return loc.state === 'accessible' && region.color === 'accessible' ? 'accessible' : 'inaccessible';
}

/** A square's on-screen side: the tile fraction, never under `minPx`. */
export function squareSide(frame, zoom, minPx = MIN_SQUARE_PX) {
    return Math.max(minPx, frame.tilePx * zoom * SQUARE_TILE_FRACTION);
}

/**
 * ⛓ The squares of one frame, on screen: `[{location, kind, sx, sy, side}]` (`sx, sy` the centre), centred on
 * each location's tile.
 */
export function frameSquares(frame, tiles, cam, vp, minPx = MIN_SQUARE_PX) {
    const side = squareSide(frame, cam.zoom, minPx);
    return (tiles ?? []).map((t) => {
        const c = tileCentre(frame, t.x, t.y);
        const s = worldToScreen(cam, vp, c.x, c.y);
        return { location: t.location, kind: t.kind, sx: s.x, sy: s.y, side };
    });
}

/**
 * ⛓ GENERIC SQUARE PLACES for a region whose substrate places none (no `compositeMap.locationTiles` — a classic
 * AP world): its locations in reading order on a grid inside its extent, below a two-row label band.
 * → `[{location, x, y, kind: 'item'}]` in that extent's tiles.
 */
export function genericLocationTiles(names, ext) {
    const fits = (step) => Math.max(1, Math.floor((ext.w - 1) / step)) * Math.max(1, Math.floor((ext.h - 3) / step));
    const step = names.length <= fits(2) ? 2 : 1;
    const cols = Math.max(1, Math.floor((ext.w - 1) / step));
    return names.map((location, i) => ({ location, x: 1 + (i % cols) * step, y: 3 + Math.floor(i / cols) * step, kind: 'item' }));
}

/** The screen square under a screen point (within its side), or null — the LAST drawn wins (it is on top). */
export function squareAt(squares, sx, sy) {
    for (let i = squares.length - 1; i >= 0; i -= 1) {
        const q = squares[i];
        if (Math.abs(sx - q.sx) <= q.side / 2 && Math.abs(sy - q.sy) <= q.side / 2) return q;
    }
    return null;
}
