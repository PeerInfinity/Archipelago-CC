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
    this.tilePixelSize = 4;  // start zoomed out so 188x84 fits in a typical panel
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
  }
}
