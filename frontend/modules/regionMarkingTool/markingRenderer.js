// markingRenderer — TileMapCanvasRenderer plus the interactions the marking
// tool needs and the analyzer never had: rectangle drags (region bounds),
// straight H/V line drags (edge exits), and an overlay pass that draws the
// regions, their exits and their locations on top of the tile grid.
//
// Subclassed rather than edited into the analyzer's renderer: that file is
// live behind the tile map analyzer panel, and its pan/zoom/click behaviour is
// what this tool wants unchanged when no marking mode is active.
//
// Mouse contract:
//   - no active mode, or a right/middle/shift drag  -> pan and click exactly
//     as the base renderer does;
//   - an active mode + a plain left drag            -> mark, with a live
//     preview, committed on mouse-up via onMarkRect / onMarkLine / onMarkTile.

import { TileMapCanvasRenderer } from '../tileMapAnalyzer/canvasRenderer.js';

export const MARK_MODES = {
    NONE: null,
    REGION: 'region',       // rectangle drag -> region bounds
    EDGE: 'edge',           // straight line drag -> edge exit span
    TELEPORTER: 'teleporter', // line drag or single click -> teleporter span
    ENTRANCE: 'entrance',   // click -> entrance spawn tile
    LOCATION: 'location',   // click -> location tile
};

const REGION_STROKE = 'rgba(120, 200, 255, 0.95)';
const REGION_FILL = 'rgba(120, 200, 255, 0.10)';
const SELECTED_STROKE = 'rgba(255, 230, 120, 1)';
const SELECTED_FILL = 'rgba(255, 230, 120, 0.14)';
const EXIT_EDGE = 'rgba(120, 255, 160, 0.9)';
const EXIT_TELEPORTER = 'rgba(255, 150, 255, 0.9)';
const ENTRANCE_STROKE = '#fff';
const LOCATION_STROKE = 'rgba(255, 120, 120, 1)';
const PREVIEW_STROKE = 'rgba(255, 255, 255, 0.95)';

export class RegionMarkingRenderer extends TileMapCanvasRenderer {
    constructor(canvas, canvasWrap) {
        super(canvas, canvasWrap);

        this.markMode = MARK_MODES.NONE;
        /** @type {Array<{region_id, bounds, exits, locations, selected}>} */
        this.regionOverlays = [];
        this.showLabels = true;

        this.onMarkRect = null;   // ({x,y,w,h}) => void
        this.onMarkLine = null;   // (tiles[[x,y],…]) => void
        this.onMarkTile = null;   // ([x,y]) => void

        this._markFrom = null;
        this._markTo = null;
        this._marking = false;
    }

    setMarkMode(mode) {
        this.markMode = mode ?? MARK_MODES.NONE;
        this._cancelMark();
        this.canvas.style.cursor = this.markMode ? 'crosshair' : 'grab';
    }

    setRegionOverlays(overlays) {
        this.regionOverlays = Array.isArray(overlays) ? overlays : [];
        this.draw();
    }

    _cancelMark() {
        this._marking = false;
        this._markFrom = null;
        this._markTo = null;
    }

    /**
     * Client (viewport) coordinates of a tile's centre — the inverse of
     * tileAt. Used to place the canvas overlay's own hit targets, and by the
     * UI verifier to drag on a real tile rather than a guessed pixel.
     */
    tileToClient(tile) {
        const rect = this.canvas.getBoundingClientRect();
        const ts = this.tilePixelSize;
        return {
            x: rect.left + tile[0] * ts - this.panX + ts / 2,
            y: rect.top + tile[1] * ts - this.panY + ts / 2,
        };
    }

    /** Tile under a mouse event, or null when it falls outside the level. */
    tileAt(e) {
        if (!this.tilemap) return null;
        const rect = this.canvas.getBoundingClientRect();
        const ts = this.tilePixelSize;
        const x = Math.floor((this.panX + e.clientX - rect.left) / ts);
        const y = Math.floor((this.panY + e.clientY - rect.top) / ts);
        if (x < 0 || y < 0 || x >= this.tilemap.map_width || y >= this.tilemap.map_height) return null;
        return [x, y];
    }

    // A modifier or non-left button always means "pan", so the author never
    // loses the ability to move around while a mode is armed.
    _wantsPan(e) { return !this.markMode || e.button !== 0 || e.shiftKey; }

    _onMouseDown(e) {
        if (this._wantsPan(e)) { super._onMouseDown(e); return; }
        const tile = this.tileAt(e);
        if (!tile) return;
        this._marking = true;
        this._markFrom = tile;
        this._markTo = tile;
        this.draw();
    }

    _onMouseMove(e) {
        if (!this._marking) { super._onMouseMove(e); return; }
        const tile = this.tileAt(e);
        if (!tile) return;
        this._markTo = tile;
        this.draw();
    }

    _onMouseUp(e) {
        if (!this._marking) { super._onMouseUp(e); return; }
        const from = this._markFrom;
        const to = this.tileAt(e) ?? this._markTo;
        this._cancelMark();
        this.draw();
        if (!from || !to) return;

        if (this.markMode === MARK_MODES.REGION) {
            this.onMarkRect?.({
                x: Math.min(from[0], to[0]),
                y: Math.min(from[1], to[1]),
                w: Math.abs(to[0] - from[0]) + 1,
                h: Math.abs(to[1] - from[1]) + 1,
            });
            return;
        }
        if (this.markMode === MARK_MODES.EDGE || this.markMode === MARK_MODES.TELEPORTER) {
            this.onMarkLine?.(this._lineTiles(from, to), this.markMode);
            return;
        }
        // Point modes take the tile the drag ended on, so a slip still lands
        // somewhere deliberate.
        this.onMarkTile?.(to, this.markMode);
    }

    // A drag that is not axis-aligned collapses onto its dominant axis rather
    // than being rejected: an exit span is always straight, and refusing the
    // drag would just make the author repeat it.
    _lineTiles(from, to) {
        const dx = Math.abs(to[0] - from[0]);
        const dy = Math.abs(to[1] - from[1]);
        if (dx >= dy) {
            const [a, b] = [Math.min(from[0], to[0]), Math.max(from[0], to[0])];
            return Array.from({ length: b - a + 1 }, (_, i) => [a + i, from[1]]);
        }
        const [a, b] = [Math.min(from[1], to[1]), Math.max(from[1], to[1])];
        return Array.from({ length: b - a + 1 }, (_, i) => [from[0], a + i]);
    }

    draw() {
        super.draw();
        if (!this.tilemap || !this.categoryGrid || !this.config) return;
        const ctx = this.ctx;
        const ts = this.tilePixelSize;
        const px = (tx) => tx * ts - this.panX;
        const py = (ty) => ty * ts - this.panY;

        for (const ov of this.regionOverlays) {
            const b = ov.bounds;
            ctx.fillStyle = ov.selected ? SELECTED_FILL : REGION_FILL;
            ctx.fillRect(px(b.x), py(b.y), b.w * ts, b.h * ts);
            ctx.strokeStyle = ov.selected ? SELECTED_STROKE : REGION_STROKE;
            ctx.lineWidth = ov.selected ? 3 : 1.5;
            ctx.strokeRect(px(b.x) + 0.5, py(b.y) + 0.5, b.w * ts - 1, b.h * ts - 1);

            for (const exit of ov.exits ?? []) {
                ctx.fillStyle = exit.kind === 'edge' ? EXIT_EDGE : EXIT_TELEPORTER;
                for (const [x, y] of exit.exit_tiles) ctx.fillRect(px(x), py(y), ts, ts);
                const [ex, ey] = exit.entrance_tile;
                ctx.strokeStyle = ENTRANCE_STROKE;
                ctx.lineWidth = Math.max(1, Math.floor(ts / 5));
                ctx.strokeRect(px(ex) + 1, py(ey) + 1, ts - 2, ts - 2);
            }

            for (const loc of ov.locations ?? []) {
                const [x, y] = loc.tile;
                ctx.strokeStyle = LOCATION_STROKE;
                ctx.lineWidth = Math.max(2, Math.floor(ts / 4));
                ctx.beginPath();
                ctx.arc(px(x) + ts / 2, py(y) + ts / 2, Math.max(2, ts / 2 - 1), 0, Math.PI * 2);
                ctx.stroke();
            }

            if (this.showLabels && ts >= 4) {
                ctx.font = `${Math.max(10, Math.min(16, ts))}px monospace`;
                ctx.textBaseline = 'top';
                const label = ov.region_id;
                const w = ctx.measureText(label).width;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
                ctx.fillRect(px(b.x) + 2, py(b.y) + 2, w + 6, 16);
                ctx.fillStyle = ov.selected ? SELECTED_STROKE : REGION_STROKE;
                ctx.fillText(label, px(b.x) + 5, py(b.y) + 4);
            }
        }

        // Live preview of the drag in progress.
        if (this._marking && this._markFrom && this._markTo) {
            ctx.strokeStyle = PREVIEW_STROKE;
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 3]);
            if (this.markMode === MARK_MODES.REGION) {
                const x = Math.min(this._markFrom[0], this._markTo[0]);
                const y = Math.min(this._markFrom[1], this._markTo[1]);
                const w = Math.abs(this._markTo[0] - this._markFrom[0]) + 1;
                const h = Math.abs(this._markTo[1] - this._markFrom[1]) + 1;
                ctx.strokeRect(px(x) + 0.5, py(y) + 0.5, w * ts - 1, h * ts - 1);
            } else {
                for (const [x, y] of this._lineTiles(this._markFrom, this._markTo)) {
                    ctx.strokeRect(px(x) + 0.5, py(y) + 0.5, ts - 1, ts - 1);
                }
            }
            ctx.setLineDash([]);
        }
    }
}
