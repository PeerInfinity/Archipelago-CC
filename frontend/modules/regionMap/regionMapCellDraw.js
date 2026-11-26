/**
 * regionMap/regionMapCellDraw — **ONE REGION MAP CELL, DRAWN** (region-graph-map-look). The Region Map's cell drawing,
 * moved out of `RegionMapUI` so the Region Graph's "map" node look (`regionGraph/mapLookLayer.js`) draws each node with
 * the SAME code (⚖ the user, session 84c8ab35, 2026-11-25: "Preferably by using shared code rather than duplicating
 * existing code."). The Region Map calls these from its paint, in its own order (art, links, squares, markers,
 * labels); its output is byte-identical to before the move (the draw-call digest, `CC/docs/region-graph/map-look.md`).
 *
 * Every function draws in SCREEN px through a camera (`procgenCore/mapCamera.js`: `screen = (world − camera) · zoom +
 * viewport / 2`). A panel that places cells by other means (the Region Graph: a Cytoscape node's rendered box) hands
 * each cell a camera that maps that cell's frame onto the box (`cameraOntoBox`).
 *
 * The geometry and colours are `regionMapOverlay.js`'s (`frameSquares`, `squareColorKey`, `SQUARE_COLORS`,
 * `labelFontPx`); the art is the substrate's painter (`compositeMapPainterFor`), else `drawGenericRegion`.
 *
 * Arguments (one object `p` per call):
 *   frame   — a `regionMapFrames.js` frame `{key, x, y, w, h, tilePx, ext, cell}`
 *   cell    — the model's cell (`regionMapModel.js` `cells.get(key)`: `{region, tiles, tileSource, …}`)
 *   camera, vp, dpr — the camera, the viewport `{w, h}` (CSS px) and the device pixel ratio
 *   source  — `{rules, playerId}` the painter reads (art only)
 *   onArt   — the painter's `requestRedraw` (art only: a bake that lands later calls it)
 *   registry — the substrate registry (art only)
 *   stats   — counters to add to (`art`, `generic`), or null
 *   minSquarePx, view, out — squares only: the smallest square, the region view (`regionViewState.js`) that colours
 *             them, and the array each drawn square is pushed onto (its hit-test record, `squareAt`)
 */
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { COLORS, compositeMapPainterFor, drawGenericRegion } from '../procgenCore/compositeMapRenderer.js';
import { worldToScreen } from '../procgenCore/mapCamera.js';
import { LABEL_MIN_CELL_PX, SQUARE_COLORS, frameSquares, labelFontPx, squareColorKey } from './regionMapOverlay.js';

/** The tile size every level is baked at (the art's own); drawn scaled by the camera. */
export const BAKE_TILE_PX = 16;

/**
 * The camera that draws `frame`'s CELL into the screen box `box` (`{x, y, w, h}`, CSS px, inside a viewport `vp`):
 * zoom = box width / cell width, the cell's centre on the box's centre. (The Region Graph's node boxes keep the cell's
 * aspect ratio, so the height agrees.)
 */
export function cameraOntoBox(frame, box, vp) {
    const zoom = box.w / frame.cell.w;
    return {
        x: frame.cell.x + frame.cell.w / 2 - (box.x + box.w / 2 - vp.w / 2) / zoom,
        y: frame.cell.y + frame.cell.h / 2 - (box.y + box.h / 2 - vp.h / 2) / zoom,
        zoom,
    };
}

/** The level art (painter, else the generic region) and the cell's border. */
export function drawCellArt(ctx, { frame: f, cell, camera: cam, vp, dpr, source, onArt, registry = substrateRegistry, stats = null, warnTag = 'regionMap' }) {
    const s = worldToScreen(cam, vp, f.x, f.y);
    if (cell?.region) {
        const k = (f.tilePx * cam.zoom) / BAKE_TILE_PX;
        ctx.save();
        ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * s.x, dpr * s.y);
        const geom = {
            offX: 0, offY: 0, regionSize: { width: f.ext.w, height: f.ext.h }, tilePx: BAKE_TILE_PX, colors: COLORS,
            source, requestRedraw: onArt,
        };
        const painter = compositeMapPainterFor(cell.region, registry);
        try {
            if (painter) painter(ctx, cell.region, geom);
            else drawGenericRegion(ctx, cell.region, geom);
        } catch (e) {
            console.warn(`${warnTag}: a painter threw`, f.key, e);
        }
        ctx.restore();
        if (stats) {
            stats.art += painter ? 1 : 0;
            stats.generic += painter ? 0 : 1;
        }
    } else {
        const w = f.w * cam.zoom;
        const h = f.h * cam.zoom;
        ctx.fillStyle = COLORS.genericBg;
        ctx.fillRect(s.x, s.y, w, h);
        if (stats) stats.generic += 1;
    }
    const c = worldToScreen(cam, vp, f.cell.x, f.cell.y);
    ctx.strokeStyle = COLORS.cellBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(c.x + 0.5, c.y + 0.5, f.cell.w * cam.zoom - 1, f.cell.h * cam.zoom - 1);
}

/** An undiscovered region shown as a placeholder: a fog box with a '?' once it is wide enough. */
export function drawPlaceholderCell(ctx, { frame: f, camera: cam, vp }) {
    const s = worldToScreen(cam, vp, f.cell.x, f.cell.y);
    const cw = f.cell.w * cam.zoom;
    const ch = f.cell.h * cam.zoom;
    ctx.fillStyle = '#2b2b33';
    ctx.fillRect(s.x, s.y, cw, ch);
    ctx.strokeStyle = '#44444f';
    ctx.lineWidth = 1;
    ctx.strokeRect(s.x + 0.5, s.y + 0.5, cw - 1, ch - 1);
    if (cw > 24) {
        ctx.fillStyle = '#777';
        ctx.font = `${Math.min(28, Math.max(10, cw / 6))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', s.x + cw / 2, s.y + ch / 2);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
    }
}

/** The cell's label (its display key), screen-sized; none on a cell under `LABEL_MIN_CELL_PX` wide. */
export function drawCellLabel(ctx, { frame: f, cell, camera: cam, vp }) {
    const cw = f.cell.w * cam.zoom;
    if (cw < LABEL_MIN_CELL_PX) return;
    const c = worldToScreen(cam, vp, f.cell.x, f.cell.y);
    // ⛓ the geometry `genericLocationTiles` keeps its squares clear of (regionMapOverlay `labelBottomPx`)
    const size = labelFontPx(cw);
    ctx.font = `${size}px sans-serif`;
    const text = f.key.length > 40 ? `${f.key.slice(0, 39)}…` : f.key;
    const tw = Math.min(ctx.measureText(text).width, cw - 4);
    ctx.fillStyle = cell?.region ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)';
    ctx.fillRect(c.x + 2, c.y + 2, tw + 6, size + 5);
    ctx.fillStyle = '#e8e8f0';
    ctx.fillText(text, c.x + 5, c.y + size + 3, cw - 8);
}

/**
 * The cell's location squares, coloured by the view's state (`squareColorKey`); a hidden location draws none, a
 * placeholder draws `unknown`. Each drawn square (with `color` and `key`) is pushed onto `out`.
 */
export function drawCellSquares(ctx, { frame: f, cell, camera, vp, minSquarePx, view, out }) {
    if (!cell?.tiles?.length) return;
    // ⛓ tiled-squares-cap: a substrate-tiled cell's squares never outgrow their tile (a 1 px dot at the least).
    const squares = frameSquares(f, cell.tiles, camera, vp, minSquarePx,
        { capToTile: cell.tileSource === 'substrate' });
    for (const q of squares) {
        const loc = view?.locations?.get(q.location);
        if (loc?.visibility === 'hidden') continue;
        const colorKey = loc?.visibility === 'placeholder' ? 'unknown' : squareColorKey(loc, view?.regions?.get(loc?.region));
        q.color = colorKey;
        const h = q.side / 2;
        ctx.fillStyle = SQUARE_COLORS[colorKey];
        ctx.globalAlpha = colorKey === 'checked' ? 0.6 : 1;
        if (q.kind === 'event') {
            // Events: a diamond, so they read apart from items at any size.
            ctx.beginPath();
            ctx.moveTo(q.sx, q.sy - h * 1.15);
            ctx.lineTo(q.sx + h * 1.15, q.sy);
            ctx.lineTo(q.sx, q.sy + h * 1.15);
            ctx.lineTo(q.sx - h * 1.15, q.sy);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.stroke();
        } else {
            ctx.fillRect(q.sx - h, q.sy - h, q.side, q.side);
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.strokeRect(q.sx - h + 0.5, q.sy - h + 0.5, q.side - 1, q.side - 1);
        }
        ctx.globalAlpha = 1;
        q.key = f.key;
        out.push(q);
    }
}
