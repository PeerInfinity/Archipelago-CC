/**
 * regionMap/regionMapOverlay — **THE LIVE OVERLAY'S GEOMETRY AND COLOURS** (region-map step 3b). ⛔ PURE.
 *
 * The art is static (the substrate's painter, cached); the overlay is the part that changes with every snapshot:
 * the location squares, their colours, and the links between groups. It is drawn generically, for every substrate.
 */
import { worldToScreen } from '../procgenCore/mapCamera.js';
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
 * ⛓ A TILED SQUARE NEVER OUTGROWS ITS TILE (⚖ the user, session 84c8ab35, 2026-11-23: "Yes, I also want to prevent the
 * location boxes from growing larger than their tile."), BUT NEVER VANISHES (⚖ the user, same session,
 * 2026-11-24T00:36:20.300Z: "Keep a 1 px dot" — superseding their 00:35:39.877Z "Skip them"). On a substrate-tiled cell
 * the side is `squareSide` capped at the tile's on-screen side, floored at `TILED_SQUARE_FLOOR_PX`:
 *   `max(TILED_SQUARE_FLOOR_PX, min(tilePx · zoom, max(minPx, tilePx · zoom · SQUARE_TILE_FRACTION)))`.
 * So `minPx` (the `minSquarePx` setting) holds only while the tile is at least that big; below it the square fills its
 * tile; below a 1 px tile it stays a 1 px dot (the one case it is larger than its tile). Wherever today's side was
 * already ≤ the tile (the tile ≥ `minPx` on screen) the value is unchanged. Nothing is skipped (the door ring, unlike
 * this, IS skipped under 1 px). Untiled (generic) squares are not capped (squares-rings' rules stand).
 */
export const TILED_SQUARE_FLOOR_PX = 1;
export function tiledSquareSide(frame, zoom, minPx = MIN_SQUARE_PX) {
    return Math.max(TILED_SQUARE_FLOOR_PX, Math.min(frame.tilePx * zoom, squareSide(frame, zoom, minPx)));
}

/**
 * ⛓ The squares of one frame, on screen: `[{location, kind, sx, sy, side}]` (`sx, sy` the centre), centred on
 * each location's tile. A tile carrying `size` (a generic place: its side in tiles) is drawn that size, never under
 * `minPx`; a tile without one is `squareSide` — or, with `capToTile` (a substrate-tiled cell), `tiledSquareSide`.
 * Centres never depend on the side.
 */
export function frameSquares(frame, tiles, cam, vp, minPx = MIN_SQUARE_PX, { capToTile = false } = {}) {
    const side = capToTile ? tiledSquareSide(frame, cam.zoom, minPx) : squareSide(frame, cam.zoom, minPx);
    return (tiles ?? []).map((t) => {
        const c = tileCentre(frame, t.x, t.y);
        const s = worldToScreen(cam, vp, c.x, c.y);
        const q = Number.isFinite(t.size) ? Math.max(minPx, t.size * frame.tilePx * cam.zoom) : side;
        return { location: t.location, kind: t.kind, sx: s.x, sy: s.y, side: q };
    });
}

/**
 * ⛓ THE DOOR RING'S SIZE (drawn by `regionMapUI._drawLinks` at a line's door-tile end; art-ends). A dark halo
 * (`DOOR_RING_WIDTH_PX` + 2 wide) under a `DOOR_RING_WIDTH_PX` stroke.
 *
 * ⛓ THE RING NEVER OUTGROWS ITS TILE (⚖ the user, session 84c8ab35, 2026-11-23: "I don't want the circles to grow
 * larger than the size of the tile they are circling, even if that makes them too small to see when zooming out"):
 * `doorRingRadius` — the ring's OUTER edge (halo included) is at most half the tile's on-screen side, and its stroke
 * centre at most `DOOR_RING_MAX_R_PX` (the zoomed-in cap). There is no minimum: a ring whose stroke centre would be
 * under `DOOR_RING_SKIP_R_PX` is NOT drawn (counted in `lastPaint.doorRingsSkipped`), so a zoomed-out door shows no ring.
 */
export const DOOR_RING_MAX_R_PX = 9;
export const DOOR_RING_WIDTH_PX = 1.5;
/** A ring whose stroke centre is under this many screen px is skipped (not drawn at sub-pixel). */
export const DOOR_RING_SKIP_R_PX = 1;
/** Half the ring's halo width: the outer edge sits this far beyond its stroke centre. */
export const DOOR_RING_HALO_HALF_PX = (DOOR_RING_WIDTH_PX + 2) / 2;

/**
 * ⛓ A door ring's stroke-centre radius (screen px) for a tile `tileScreenPx` on screen, or null when it is skipped:
 *   `r = min(DOOR_RING_MAX_R_PX, tileScreenPx / 2 − DOOR_RING_HALO_HALF_PX)`, skipped when `r < DOOR_RING_SKIP_R_PX`.
 * So the drawn ring's diameter (outer edge, halo included) is ≤ the tile's side at every zoom.
 */
export function doorRingRadius(tileScreenPx) {
    const r = Math.min(DOOR_RING_MAX_R_PX, tileScreenPx / 2 - DOOR_RING_HALO_HALF_PX);
    return r >= DOOR_RING_SKIP_R_PX ? r : null;
}

/**
 * ⛓ THE CELL LABEL'S GEOMETRY (drawn by `regionMapUI._drawLabel`; here so the generic square places can stay clear of
 * it). The label is SCREEN-sized: drawn only when the cell is at least `LABEL_MIN_CELL_PX` wide on screen, its font
 * `cellPx / LABEL_FONT_CELL_DIVISOR` clamped to `LABEL_FONT_MIN_PX`..`LABEL_FONT_MAX_PX`, its box from 2 px below the
 * cell's top to `font + LABEL_BOX_BOTTOM_PAD_PX` below it.
 */
export const LABEL_MIN_CELL_PX = 60;
export const LABEL_FONT_MIN_PX = 9;
export const LABEL_FONT_MAX_PX = 13;
export const LABEL_FONT_CELL_DIVISOR = 14;
export const LABEL_BOX_BOTTOM_PAD_PX = 7;
/** Clear screen px between the label box's bottom and the first row of generic squares. */
export const LABEL_SQUARE_CLEAR_PX = 2;

/** The label's font size (px) for a cell `cellPx` wide on screen, or null when no label is drawn there. */
export function labelFontPx(cellPx) {
    if (!(cellPx >= LABEL_MIN_CELL_PX)) return null;
    return Math.max(LABEL_FONT_MIN_PX, Math.min(LABEL_FONT_MAX_PX, cellPx / LABEL_FONT_CELL_DIVISOR));
}

/** The label box's bottom, in screen px below the cell's top, for a cell `cellPx` wide (null: no label). */
export function labelBottomPx(cellPx) {
    const size = labelFontPx(cellPx);
    return size == null ? null : size + LABEL_BOX_BOTTOM_PAD_PX;
}

/**
 * ⛓ GENERIC SQUARES (⚖ the user, session 84c8ab35, 2026-11-23: "double their current width and height. They can be
 * scaled back down for regions that have too many locations to fit at the bigger size"): a square is
 * `GENERIC_SQUARE_FRACTION` of its grid pitch, the pitch at most `GENERIC_PITCH_MAX_TILES` tiles — so a region with
 * room gets 1.4-tile squares, twice the 0.7-tile square every location had before. A crowded region's pitch drops in
 * steps of `GENERIC_PITCH_STEP_TILES` until all its locations fit inside the extent, below the label band.
 */
export const GENERIC_PITCH_MAX_TILES = 2;
export const GENERIC_SQUARE_FRACTION = 0.7;
export const GENERIC_PITCH_STEP_TILES = 1 / 16;
export const GENERIC_PITCH_MIN_TILES = 1 / 16;
/** The margin (tiles) between the grid and the extent's left, right and bottom edges. */
export const GENERIC_MARGIN_TILES = 0.5;

/**
 * ⛓ THE LABEL BAND (⚖ the user, same session: "move the location boxes lower so that the title text doesn't overlap
 * it"), in tiles from the extent's top: where the first row's square CENTRES go. The rule is ZOOM-INDEPENDENT — the
 * squares are placed once, as if the label were drawn, so they sit the same whether it is (cell ≥ 60 px) or not:
 *
 *   the label's box is screen-sized, so in WORLD units it is tallest at the smallest zoom it is drawn at (the cell
 *   `LABEL_MIN_CELL_PX` wide: zoom = 60 / cell width). The band holds the box's bottom there, plus
 *   `LABEL_SQUARE_CLEAR_PX`, plus the first row's half-side there — the larger of its `minPx` floor and its own
 *   half-side. Zoomed in, every term in screen px grows no faster than the cell, so the gap only widens.
 *
 * In tiles of an extent `w` wide (a generic cell's frame is its cell: `w` tiles = the cell width; the label scales
 * with the CELL, so this is in units of the cell's width and holds in either cell-size mode):
 *   `centreY = max((bottom + clear + minPx / 2) · w / 60,  (bottom + clear) · w / 60 + side / 2)`.
 */
export function labelBandCentreTiles(w, sideTiles, minPx = MIN_SQUARE_PX) {
    const perPx = w / LABEL_MIN_CELL_PX;
    const top = (labelBottomPx(LABEL_MIN_CELL_PX) + LABEL_SQUARE_CLEAR_PX) * perPx;
    return Math.max(top + (minPx / 2) * perPx, top + sideTiles / 2);
}

/**
 * ⛓ GENERIC SQUARE PLACES for a region whose substrate places none (no `compositeMap.locationTiles` — a classic
 * AP world): its locations in reading order on a grid inside its extent, below the label band
 * (`labelBandCentreTiles`), at the largest pitch ≤ `GENERIC_PITCH_MAX_TILES` that fits them all.
 * → `[{location, x, y, kind: 'item', size}]`: `x, y` in that extent's tiles (fractional: the tile whose centre is the
 * square's centre), `size` the square's side in tiles (`frameSquares` reads it).
 */
export function genericLocationTiles(names, ext) {
    const fitAt = (p) => {
        const side = GENERIC_SQUARE_FRACTION * p;
        const cy = labelBandCentreTiles(ext.w, side);
        const cols = Math.max(1, Math.floor((ext.w - 2 * GENERIC_MARGIN_TILES) / p));
        const lastCentre = ext.h - GENERIC_MARGIN_TILES - p / 2;
        const rows = Math.max(1, 1 + Math.floor((lastCentre - cy) / p + 1e-9));
        return { p, side, cy, cols, rows };
    };
    let g = fitAt(GENERIC_PITCH_MAX_TILES);
    for (let k = 1; g.cols * g.rows < names.length; k += 1) {
        const p = GENERIC_PITCH_MAX_TILES - k * GENERIC_PITCH_STEP_TILES;
        if (p < GENERIC_PITCH_MIN_TILES) break;
        g = fitAt(p);
    }
    const x0 = GENERIC_MARGIN_TILES + g.p / 2;
    return names.map((location, i) => ({
        location,
        x: x0 + (i % g.cols) * g.p - 0.5,
        y: g.cy + Math.floor(i / g.cols) * g.p - 0.5,
        kind: 'item',
        size: g.side,
    }));
}

/**
 * ⛓ THE PRE-2026-11-23 GENERIC PLACES (base 6dbadc7364, verbatim): a 2-tile (else 1-tile) grid below a two-row band,
 * no `size` (so `squareSide`'s 0.7-tile square). Kept for the cells `regionMapModel`'s `usesBigGenericPlaces` leaves
 * out — see there.
 */
export function legacyGenericLocationTiles(names, ext) {
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
