/**
 * regionMap/regionMapFrames — **WHERE EACH CELL OF THE REGION MAP SITS, IN WORLD PIXELS** (region-map step 3b).
 *
 * ⛔ PURE: no imports, no DOM. The layout (`procgenCore/regionLayoutResolve.js`) answers integer CELLS `{gx, gy}`,
 * signed, the start region at (0, 0). This module turns those cells into rectangles in one WORLD frame (world px;
 * the camera maps world → screen), in one of two modes (⚖ user 2026-11-15: *"I want an option to toggle between
 * these modes. We can make sized by level the default."*):
 *
 *   · `'level'` (B, the DEFAULT) — ONE tile scale for every level (`WORLD_TILE_PX` world px per tile). The layout's
 *     cells are ANCHORS: each signed column `gx` is as wide as its widest level and each row `gy` as tall as its
 *     tallest, plus a gutter. A 5×5 level beside a 60×58 one shows at its true relative size.
 *   · `'uniform'` (A, the toggle) — one square per cell (`UNIFORM_SIDE_TILES` tiles a side); each level scaled to
 *     fit it, letterboxed and centred. Every level reads at the same size; small levels' tiles are larger.
 *
 * In both modes a column (row) the layout leaves EMPTY — the gap `layoutGrouped` keeps between groups — is
 * `GAP_PX` wide (tall): group gaps stay gaps. Column 0's slot starts at world x = 0 and row 0's at y = 0; negative
 * columns extend to the left. Nothing is normalised (⚖ the origin ruling).
 *
 * A frame: `{key, gx, gy, x, y, w, h, tilePx, ext, cell}` —
 *   `x, y, w, h` the LEVEL's own rectangle (what the art fills), `tilePx` world px per level tile, `ext` the extent
 *   used (`{w, h}` tiles, `estimated` true when it was the fallback), `cell` the slot's inner box `{x, y, w, h}`.
 */

/** World px per level tile in `'level'` mode (the art's own 16 px tile, so a zoom of 1 is the game's scale). */
export const WORLD_TILE_PX = 16;
/** A display region the substrate gives no extent for (no `compositeMap.regionExtent`): this many tiles a side. */
export const DEFAULT_EXTENT = Object.freeze({ w: 20, h: 20 });
/** `'uniform'` mode's square, in tiles of `WORLD_TILE_PX`. */
export const UNIFORM_SIDE_TILES = 20;
/** Space between two neighbouring cells (world px), split half to each side of a slot. */
export const GUTTER_PX = 32;
/** The width (height) of a layout column (row) with no region in it: the gap between groups. */
export const GAP_PX = 96;
export const CELL_SIZE_MODES = Object.freeze(['level', 'uniform']);

const validExtent = (e) => e && Number.isFinite(e.w) && Number.isFinite(e.h) && e.w > 0 && e.h > 0;

/** Left edges (world px) of every column `min..max` from their widths; column 0 starts at 0. */
function edges(min, max, widthOf) {
    const start = new Map();
    let x = 0;
    for (let g = 0; g <= max; g += 1) {
        start.set(g, x);
        x += widthOf(g);
    }
    x = 0;
    for (let g = -1; g >= min; g -= 1) {
        x -= widthOf(g);
        start.set(g, x);
    }
    return start;
}

/**
 * ⛓⛓ **THE CELL GEOMETRY.**
 * @param {Map<string,{gx:number,gy:number}>} positions  the layout's cells
 * @param {Map<string,{w:number,h:number}|null>} extents  each display region's level size in tiles (null/absent →
 *   `DEFAULT_EXTENT`, flagged `estimated`)
 * @param {'level'|'uniform'} [mode]
 * @param {object} [opts]  `{tilePx, sideTiles, gutterPx, gapPx}` overrides (tests)
 * @returns {Map<string, object>} frames, in `positions` order
 */
export function cellFrames(positions, extents = new Map(), mode = 'level', {
    tilePx = WORLD_TILE_PX, sideTiles = UNIFORM_SIDE_TILES, gutterPx = GUTTER_PX, gapPx = GAP_PX,
} = {}) {
    if (!CELL_SIZE_MODES.includes(mode)) throw new Error(`regionMapFrames: unknown cell size mode '${mode}'`);
    const out = new Map();
    if (!positions || positions.size === 0) return out;
    const extOf = (key) => {
        const e = extents?.get?.(key);
        return validExtent(e) ? { w: e.w, h: e.h, estimated: false } : { ...DEFAULT_EXTENT, estimated: true };
    };
    const side = sideTiles * tilePx;
    const colInner = new Map();
    const rowInner = new Map();
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [key, { gx, gy }] of positions) {
        const e = extOf(key);
        const w = mode === 'level' ? e.w * tilePx : side;
        const h = mode === 'level' ? e.h * tilePx : side;
        colInner.set(gx, Math.max(colInner.get(gx) ?? 0, w));
        rowInner.set(gy, Math.max(rowInner.get(gy) ?? 0, h));
        minX = Math.min(minX, gx);
        maxX = Math.max(maxX, gx);
        minY = Math.min(minY, gy);
        maxY = Math.max(maxY, gy);
    }
    const colW = (g) => (colInner.has(g) ? colInner.get(g) + gutterPx : gapPx);
    const rowH = (g) => (rowInner.has(g) ? rowInner.get(g) + gutterPx : gapPx);
    const left = edges(Math.min(minX, 0), Math.max(maxX, 0), colW);
    const top = edges(Math.min(minY, 0), Math.max(maxY, 0), rowH);
    const half = gutterPx / 2;
    for (const [key, { gx, gy }] of positions) {
        const ext = extOf(key);
        const cell = Object.freeze({ x: left.get(gx) + half, y: top.get(gy) + half, w: colInner.get(gx), h: rowInner.get(gy) });
        const tp = mode === 'level' ? tilePx : side / Math.max(ext.w, ext.h);
        const w = ext.w * tp;
        const h = ext.h * tp;
        out.set(key, Object.freeze({
            key, gx, gy,
            x: cell.x + Math.floor((cell.w - w) / 2),
            y: cell.y + Math.floor((cell.h - h) / 2),
            w, h, tilePx: tp, ext: Object.freeze(ext), cell,
        }));
    }
    return out;
}

/** The world box `{x0, y0, x1, y1}` around the frames' cells (or null for none). */
export function framesBounds(frames) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const f of frames) {
        x0 = Math.min(x0, f.cell.x);
        y0 = Math.min(y0, f.cell.y);
        x1 = Math.max(x1, f.cell.x + f.cell.w);
        y1 = Math.max(y1, f.cell.y + f.cell.h);
    }
    return Number.isFinite(x0) ? { x0, y0, x1, y1 } : null;
}

/** ⛓ THE CULL: the frames whose cell meets the world rectangle `rect` (`{x0, y0, x1, y1}`), in input order. */
export function visibleFrames(frames, rect) {
    const out = [];
    for (const f of frames) {
        const c = f.cell;
        if (c.x < rect.x1 && c.x + c.w > rect.x0 && c.y < rect.y1 && c.y + c.h > rect.y0) out.push(f);
    }
    return out;
}

/** The frame whose cell contains the world point, or null (first match in input order). */
export function frameAt(frames, wx, wy) {
    for (const f of frames) {
        const c = f.cell;
        if (wx >= c.x && wx < c.x + c.w && wy >= c.y && wy < c.y + c.h) return f;
    }
    return null;
}

/** A level tile's centre in world px. */
export function tileCentre(frame, tx, ty) {
    return { x: frame.x + (tx + 0.5) * frame.tilePx, y: frame.y + (ty + 0.5) * frame.tilePx };
}
