// frontend/modules/tileMapAnalyzer/canvasRenderer.js
//
// Tile-grid canvas renderer with pan/zoom support. The canvas fills
// its parent container; a virtual camera (panX, panY, tilePixelSize)
// controls which portion of the tilemap is visible.

const FALLBACK_COLOR = '#444';
const ZOOM_LEVELS = [1, 2, 3, 4, 6, 8, 12, 16, 24];

export class TileMapCanvasRenderer {
  constructor(canvas, canvasWrap) {
    this.canvas = canvas;
    this.canvasWrap = canvasWrap;
    this.ctx = canvas.getContext('2d');
    this.tilemap = null;
    this.categoryGrid = null;
    this.config = null;
    this.tilePixelSize = 4;

    // Camera: pixel offset of the top-left corner of the viewport
    // in tilemap-pixel space (tile coords × tilePixelSize).
    this.panX = 0;
    this.panY = 0;

    // Overlay state
    this.reachableSet = null;
    this.reachableColor = 'rgba(80, 220, 80, 0.35)';
    this.airSet = null;
    this.airColor = 'rgba(120, 180, 255, 0.18)';
    this.floorFlags = null;
    this.markers = [];

    // Selection
    this.selectedTile = null;
    this.onTileSelected = null;

    // Drag state
    this._dragging = false;
    this._dragStartX = 0;
    this._dragStartY = 0;
    this._panStartX = 0;
    this._panStartY = 0;
    this._dragMoved = false;

    // Input handlers
    this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
    this.canvas.addEventListener('mouseleave', (e) => this._onMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });

    // Resize observer to keep canvas sized to container
    this._resizeObserver = new ResizeObserver(() => this._resizeCanvas());
    if (canvasWrap) this._resizeObserver.observe(canvasWrap);
  }

  // --- Mouse handling ---

  _onMouseDown(e) {
    this._dragging = true;
    this._dragStartX = e.clientX;
    this._dragStartY = e.clientY;
    this._panStartX = this.panX;
    this._panStartY = this.panY;
    this._dragMoved = false;
    this.canvas.style.cursor = 'grabbing';
  }

  _onMouseMove(e) {
    if (!this._dragging) return;
    const dx = e.clientX - this._dragStartX;
    const dy = e.clientY - this._dragStartY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) this._dragMoved = true;
    this.panX = this._panStartX - dx;
    this.panY = this._panStartY - dy;
    this._clampPan();
    this.draw();
  }

  _onMouseUp(e) {
    if (!this._dragging) return;
    this._dragging = false;
    this.canvas.style.cursor = 'crosshair';
    if (!this._dragMoved) {
      this._handleClick(e);
    }
  }

  _onWheel(e) {
    e.preventDefault();
    if (!this.tilemap) return;
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // World position under mouse before zoom
    const worldX = this.panX + mouseX;
    const worldY = this.panY + mouseY;
    const tileX = worldX / this.tilePixelSize;
    const tileY = worldY / this.tilePixelSize;

    // Change zoom level
    const idx = ZOOM_LEVELS.indexOf(this.tilePixelSize);
    let newIdx;
    if (e.deltaY < 0) {
      newIdx = idx < 0 ? ZOOM_LEVELS.length - 1 : Math.min(idx + 1, ZOOM_LEVELS.length - 1);
    } else {
      newIdx = idx < 0 ? 0 : Math.max(idx - 1, 0);
    }
    const newSize = ZOOM_LEVELS[newIdx];
    if (newSize === this.tilePixelSize) return;

    this.tilePixelSize = newSize;

    // Adjust pan so the tile under the mouse stays under the mouse
    this.panX = tileX * newSize - mouseX;
    this.panY = tileY * newSize - mouseY;
    this._clampPan();
    this.draw();
    if (this.onZoomChanged) this.onZoomChanged(newSize);
  }

  _handleClick(e) {
    if (!this.tilemap) return;
    const rect = this.canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const ts = this.tilePixelSize;
    const x = Math.floor((this.panX + cx) / ts);
    const y = Math.floor((this.panY + cy) / ts);
    if (x < 0 || y < 0 || x >= this.tilemap.map_width || y >= this.tilemap.map_height) return;
    this.selectedTile = { x, y };
    this.draw();
    if (this.onTileSelected) {
      const cat = this.categoryGrid[y][x];
      const rawId = this.tilemap.tiles[y][x];
      const inReachable = this.reachableSet ? this.reachableSet.has(`${y},${x}`) : false;
      this.onTileSelected(x, y, { category: cat, rawId, inReachable });
    }
  }

  _clampPan() {
    if (!this.tilemap) return;
    const mapW = this.tilemap.map_width * this.tilePixelSize;
    const mapH = this.tilemap.map_height * this.tilePixelSize;
    const vw = this.canvas.width;
    const vh = this.canvas.height;
    this.panX = Math.max(0, Math.min(this.panX, mapW - vw));
    this.panY = Math.max(0, Math.min(this.panY, mapH - vh));
  }

  // --- Public API ---

  setData(tilemap, categoryGrid, config) {
    this.tilemap = tilemap;
    this.categoryGrid = categoryGrid;
    this.config = config;
    this._clampPan();
    this.draw();
  }

  setTilePixelSize(size) {
    this.tilePixelSize = Math.max(1, Math.floor(size));
    this._clampPan();
    this.draw();
  }

  zoomIn() {
    const idx = ZOOM_LEVELS.indexOf(this.tilePixelSize);
    const newIdx = idx < 0 ? ZOOM_LEVELS.length - 1 : Math.min(idx + 1, ZOOM_LEVELS.length - 1);
    this.setTilePixelSize(ZOOM_LEVELS[newIdx]);
    if (this.onZoomChanged) this.onZoomChanged(this.tilePixelSize);
  }

  zoomOut() {
    const idx = ZOOM_LEVELS.indexOf(this.tilePixelSize);
    const newIdx = idx < 0 ? 0 : Math.max(idx - 1, 0);
    this.setTilePixelSize(ZOOM_LEVELS[newIdx]);
    if (this.onZoomChanged) this.onZoomChanged(this.tilePixelSize);
  }

  setReachableOverlay(reachableSet, color) {
    this.reachableSet = reachableSet || null;
    if (color) this.reachableColor = color;
    this.draw();
  }

  setAirOverlay(airSet, color) {
    this.airSet = airSet || null;
    if (color) this.airColor = color;
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
    this.reachableSet = null;
    this.airSet = null;
    this.floorFlags = null;
    this.draw();
  }

  clearAll() {
    this.reachableSet = null;
    this.airSet = null;
    this.floorFlags = null;
    this.markers = [];
    this.draw();
  }

  // --- Canvas sizing ---

  _resizeCanvas() {
    if (!this.canvasWrap) return;
    const w = this.canvasWrap.clientWidth;
    const h = this.canvasWrap.clientHeight;
    if (w === this.canvas.width && h === this.canvas.height) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.cursor = 'crosshair';
    this._clampPan();
    this.draw();
  }

  // --- Drawing ---

  draw() {
    if (!this.tilemap || !this.categoryGrid || !this.config) return;
    const ctx = this.ctx;
    const mapW = this.tilemap.map_width;
    const mapH = this.tilemap.map_height;
    const ts = this.tilePixelSize;
    const cats = this.config.categories;
    const vw = this.canvas.width;
    const vh = this.canvas.height;

    // Visible tile range
    const startCol = Math.max(0, Math.floor(this.panX / ts));
    const startRow = Math.max(0, Math.floor(this.panY / ts));
    const endCol = Math.min(mapW, Math.ceil((this.panX + vw) / ts));
    const endRow = Math.min(mapH, Math.ceil((this.panY + vh) / ts));

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, vw, vh);

    // Base tiles (only visible region)
    for (let y = startRow; y < endRow; y++) {
      const row = this.categoryGrid[y];
      for (let x = startCol; x < endCol; x++) {
        const name = row[x];
        const cat = cats[name];
        ctx.fillStyle = (cat && cat.color) || FALLBACK_COLOR;
        ctx.fillRect(x * ts - this.panX, y * ts - this.panY, ts, ts);
      }
    }

    // Air-reach overlay (tiles the hitbox passes through, not
    // necessarily landable on). Drawn below the floor overlay so
    // landable tiles stay visually dominant.
    if (this.airSet && this.airSet.size > 0) {
      ctx.fillStyle = this.airColor;
      for (const k of this.airSet) {
        const comma = k.indexOf(',');
        const y = parseInt(k.slice(0, comma), 10);
        const x = parseInt(k.slice(comma + 1), 10);
        if (x < startCol || x >= endCol || y < startRow || y >= endRow) continue;
        ctx.fillRect(x * ts - this.panX, y * ts - this.panY, ts, ts);
      }
    }

    // Reachable overlay
    if (this.reachableSet && this.reachableSet.size > 0) {
      ctx.fillStyle = this.reachableColor;
      for (const k of this.reachableSet) {
        const comma = k.indexOf(',');
        const y = parseInt(k.slice(0, comma), 10);
        const x = parseInt(k.slice(comma + 1), 10);
        if (x < startCol || x >= endCol || y < startRow || y >= endRow) continue;
        ctx.fillRect(x * ts - this.panX, y * ts - this.panY, ts, ts);
      }
    }

    // Markers
    if (this.markers.length && ts >= 3) {
      for (const m of this.markers) {
        if (m.x < startCol - 1 || m.x > endCol || m.y < startRow - 1 || m.y > endRow) continue;
        ctx.strokeStyle = m.color || '#fff';
        ctx.lineWidth = Math.max(1, Math.floor(ts / 4));
        ctx.strokeRect(
          m.x * ts - this.panX + 0.5,
          m.y * ts - this.panY + 0.5,
          ts - 1,
          ts - 1
        );
      }
      if (ts >= 6) {
        ctx.font = `${Math.max(8, ts - 2)}px monospace`;
        ctx.textBaseline = 'bottom';
        for (const m of this.markers) {
          if (!m.label) continue;
          if (m.x < startCol - 5 || m.x > endCol || m.y < startRow - 1 || m.y > endRow) continue;
          const px = m.x * ts - this.panX;
          const py = m.y * ts - this.panY;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          const textWidth = ctx.measureText(m.label).width;
          ctx.fillRect(px, py - ts + 1, textWidth + 4, ts - 1);
          ctx.fillStyle = m.color || '#fff';
          ctx.fillText(m.label, px + 2, py);
        }
      }
    }

    // Selection highlight
    if (this.selectedTile) {
      const sx = this.selectedTile.x;
      const sy = this.selectedTile.y;
      if (sx >= startCol && sx < endCol && sy >= startRow && sy < endRow) {
        ctx.strokeStyle = '#ff0';
        ctx.lineWidth = 2;
        ctx.strokeRect(sx * ts - this.panX, sy * ts - this.panY, ts, ts);
      }
    }
  }
}
