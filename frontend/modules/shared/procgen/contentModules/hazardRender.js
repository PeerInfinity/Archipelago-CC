/**
 * Hazard rendering — pure canvas overlay helpers.
 *
 * Plan: NewDocs/plans/procedural-generation/maze-content-modules.md
 * (Phase 2). Consumes hazards (from hazardPathGen) at their current
 * runtime phase (from hazardRuntime) and draws:
 *   - the hazard's PATH as a thick red line connecting tile centers
 *     (closed for loops, open for linear paths),
 *   - the hazard's CURRENT POSITION as a filled red triangle pointing
 *     in its `facing` direction (the tile it will step to next turn).
 *
 * Called from the substrate's canvas pass (mazeRoomUI._drawWorld)
 * after grid lines but before the fog overlay — fog correctly hides
 * hazards in unseen tiles.
 */

import {
    currentTile,
    facing,
} from './hazardRuntime.js';

const DEFAULT_PATH_COLOR = '#d04040';
const DEFAULT_TRIANGLE_COLOR = '#ff5050';
const DEFAULT_TRIANGLE_FRACTION = 0.6;

/**
 * Draw every hazard's path + facing triangle. No-op when `hazards`
 * is null / empty.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<object>} hazards
 * @param {number} tilePx - tile size in pixels
 * @param {object} [opts]
 * @param {string} [opts.pathColor]
 * @param {number} [opts.pathWidth]
 * @param {string} [opts.triangleColor]
 * @param {number} [opts.triangleFraction] - triangle size as a
 *   fraction of tilePx (default 0.6)
 */
export function drawHazards(ctx, hazards, tilePx, opts = {}) {
    if (!ctx) return;
    if (!Array.isArray(hazards) || hazards.length === 0) return;
    if (!Number.isFinite(tilePx) || tilePx <= 0) return;
    for (const hazard of hazards) {
        drawHazardPath(ctx, hazard, tilePx, opts);
        drawHazardFacing(ctx, hazard, tilePx, opts);
    }
}

/**
 * Draw a single hazard's path as a thick line from tile center to
 * tile center. Loops close the segment back to the starting tile;
 * linear paths leave the ends open.
 */
export function drawHazardPath(ctx, hazard, tilePx, opts = {}) {
    if (!Array.isArray(hazard.tiles) || hazard.tiles.length < 2) return;
    const color = opts.pathColor ?? DEFAULT_PATH_COLOR;
    const width = opts.pathWidth ?? Math.max(2, Math.floor(tilePx * 0.12));
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const first = tileCenterPx(hazard.tiles[0], tilePx);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < hazard.tiles.length; i++) {
        const p = tileCenterPx(hazard.tiles[i], tilePx);
        ctx.lineTo(p.x, p.y);
    }
    if (hazard.shape === 'loop') {
        // Close back to the starting tile so the loop reads as a
        // closed cycle, not a chain that happens to end near its
        // origin.
        ctx.lineTo(first.x, first.y);
    }
    ctx.stroke();
    ctx.restore();
}

/**
 * Draw the hazard's facing triangle at its current tile. The
 * triangle's tip points at the next tile (where the hazard will
 * step on its next turn).
 */
export function drawHazardFacing(ctx, hazard, tilePx, opts = {}) {
    const cur = currentTile(hazard);
    const dir = facing(hazard);
    if (!dir) return;
    const color = opts.triangleColor ?? DEFAULT_TRIANGLE_COLOR;
    const fraction = opts.triangleFraction ?? DEFAULT_TRIANGLE_FRACTION;
    const center = tileCenterPx(cur, tilePx);
    const points = trianglePoints(center, tilePx * fraction, dir);
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(points.tip.x, points.tip.y);
    ctx.lineTo(points.b1.x, points.b1.y);
    ctx.lineTo(points.b2.x, points.b2.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function tileCenterPx(tile, tilePx) {
    return {
        x: tile.x * tilePx + tilePx / 2,
        y: tile.y * tilePx + tilePx / 2,
    };
}

/**
 * Compute the 3 vertices of an arrowhead pointing in `dir` from
 * `center`. `size` is the bounding-box edge length; the tip extends
 * one half from center in `dir`, the base spans roughly 80% of size.
 *
 * Exported for tests.
 */
export function trianglePoints(center, size, dir) {
    const half = size / 2;
    const baseExtent = half * 0.8;
    const baseDepth = half * 0.5;
    switch (dir) {
        case 'N':
            return {
                tip: { x: center.x, y: center.y - half },
                b1: { x: center.x - baseExtent, y: center.y + baseDepth },
                b2: { x: center.x + baseExtent, y: center.y + baseDepth },
            };
        case 'S':
            return {
                tip: { x: center.x, y: center.y + half },
                b1: { x: center.x + baseExtent, y: center.y - baseDepth },
                b2: { x: center.x - baseExtent, y: center.y - baseDepth },
            };
        case 'E':
            return {
                tip: { x: center.x + half, y: center.y },
                b1: { x: center.x - baseDepth, y: center.y - baseExtent },
                b2: { x: center.x - baseDepth, y: center.y + baseExtent },
            };
        case 'W':
            return {
                tip: { x: center.x - half, y: center.y },
                b1: { x: center.x + baseDepth, y: center.y + baseExtent },
                b2: { x: center.x + baseDepth, y: center.y - baseExtent },
            };
        default:
            throw new Error(`trianglePoints: unknown direction '${dir}'`);
    }
}
