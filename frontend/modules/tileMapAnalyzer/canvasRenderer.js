// frontend/modules/tileMapAnalyzer/canvasRenderer.js
//
// Tile-grid canvas renderer for the TileMapAnalyzer panel. v1 draws
// colored squares per category. The category color comes from the
// per-game config; categories with no color get a fallback grey.
//
// Pan/zoom and overlay layers will land in phase 5; v1 starts at a
// fixed scale that fits the whole map in view.

const FALLBACK_COLOR = '#444';

export class TileMapCanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tilemap = null;
    this.categoryGrid = null;
    this.config = null;
    this.tilePixelSize = 4;

    // Optional overlay state — set by the panel when analysis runs.
    this.reachableSet = null;    // Set<"y,x">
    this.reachableColor = 'rgba(80, 220, 80, 0.35)';
    this.floorFlags = null;       // optional [y][x] bool; if set, drawn as a subtle marker
    this.markers = [];            // [{ x, y, color, label }]
  }

  setData(tilemap, categoryGrid, config) {
    this.tilemap = tilemap;
    this.categoryGrid = categoryGrid;
    this.config = config;
    this._resizeCanvas();
    this.draw();
  }

  setTilePixelSize(size) {
    this.tilePixelSize = Math.max(1, Math.floor(size));
    this._resizeCanvas();
    this.draw();
  }

  setReachableOverlay(reachableSet, color) {
    this.reachableSet = reachableSet || null;
    if (color) this.reachableColor = color;
    this.draw();
  }

  setFloorFlags(floorFlags) {
    this.floorFlags = floorFlags || null;
    this.draw();
  }

  setMarkers(markers) {
    this.markers = Array.isArray(markers) ? markers : [];
    this.draw();
  }

  clearOverlays() {
    // Clears the reachability tint and the floor-flag debug layer.
    // POI markers are preserved — they're static per-tilemap metadata,
    // not analysis output, and the user always wants them visible.
    this.reachableSet = null;
    this.floorFlags = null;
    this.draw();
  }

  clearAll() {
    this.reachableSet = null;
    this.floorFlags = null;
    this.markers = [];
    this.draw();
  }

  _resizeCanvas() {
    if (!this.tilemap) return;
    this.canvas.width = this.tilemap.map_width * this.tilePixelSize;
    this.canvas.height = this.tilemap.map_height * this.tilePixelSize;
  }

  draw() {
    if (!this.tilemap || !this.categoryGrid || !this.config) return;
    const ctx = this.ctx;
    const w = this.tilemap.map_width;
    const h = this.tilemap.map_height;
    const ts = this.tilePixelSize;
    const cats = this.config.categories;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (let y = 0; y < h; y++) {
      const row = this.categoryGrid[y];
      for (let x = 0; x < w; x++) {
        const name = row[x];
        const cat = cats[name];
        ctx.fillStyle = (cat && cat.color) || FALLBACK_COLOR;
        ctx.fillRect(x * ts, y * ts, ts, ts);
      }
    }

    if (this.reachableSet && this.reachableSet.size > 0) {
      ctx.fillStyle = this.reachableColor;
      for (const k of this.reachableSet) {
        const comma = k.indexOf(',');
        const y = parseInt(k.slice(0, comma), 10);
        const x = parseInt(k.slice(comma + 1), 10);
        ctx.fillRect(x * ts, y * ts, ts, ts);
      }
    }

    if (this.markers.length && ts >= 3) {
      for (const m of this.markers) {
        ctx.strokeStyle = m.color || '#fff';
        ctx.lineWidth = Math.max(1, Math.floor(ts / 4));
        ctx.strokeRect(
          m.x * ts + 0.5,
          m.y * ts + 0.5,
          ts - 1,
          ts - 1
        );
      }
    }
  }
}
