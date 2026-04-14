// frontend/modules/tileMapAnalyzer/tileMapAnalyzerUI.js
//
// GoldenLayout panel for the TileMapAnalyzer. v1 (this file): loads
// the tilemap + category config, draws a colored-square overlay on a
// canvas, shows a small status bar with category counts. Reachability
// analysis and rules.json export land in later phases.

import {
  setActivePanelInstance,
  getModuleEventBus,
} from './index.js';
import {
  loadTileMap,
  loadCategoryConfig,
  buildCategoryGrid,
  DEFAULT_TILEMAP_PATH,
  DEFAULT_CONFIG_PATH,
} from './tileMapDataManager.js';
import { TileMapCanvasRenderer } from './canvasRenderer.js';

function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('tileMapAnalyzerUI', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[tileMapAnalyzerUI] ${message}`, ...data);
  }
}

export class TileMapAnalyzerUI {
  constructor(container, componentState) {
    this.container = container;
    this.componentState = componentState || {};
    Object.defineProperty(this, 'eventBus', { get: () => getModuleEventBus(), configurable: true });

    this.tilemapPath = this.componentState.tilemapPath || DEFAULT_TILEMAP_PATH;
    this.configPath = this.componentState.configPath || DEFAULT_CONFIG_PATH;

    this.tilemap = null;
    this.config = null;
    this.categoryGrid = null;
    this.renderer = null;

    this._buildDom();
    setActivePanelInstance(this);

    this.container.on('destroy', () => this._destroy());

    // Kick off the load. We don't gate on app:readyForUiDataLoad —
    // the analyzer's data lives entirely in static files under
    // frontend/presets/, so it's safe to load immediately.
    this._loadAndRender().catch((e) => {
      log('error', 'load failed', e);
      this._setStatus(`error: ${e.message}`);
    });
  }

  getRootElement() {
    return this.rootElement;
  }

  _buildDom() {
    this.rootElement = document.createElement('div');
    this.rootElement.className = 'tile-map-analyzer-panel panel-container';
    this.rootElement.style.cssText =
      'width:100%;height:100%;display:flex;flex-direction:column;background:#1a1a1a;color:#ddd;font-family:monospace;font-size:12px;';

    const toolbar = document.createElement('div');
    toolbar.style.cssText =
      'flex:0 0 auto;padding:6px 8px;border-bottom:1px solid #333;display:flex;gap:8px;align-items:center;';

    const reloadBtn = document.createElement('button');
    reloadBtn.textContent = 'Reload';
    reloadBtn.style.cssText = 'background:#333;color:#ddd;border:1px solid #555;padding:3px 8px;cursor:pointer;';
    reloadBtn.addEventListener('click', () => {
      this._loadAndRender().catch((e) => {
        log('error', 'reload failed', e);
        this._setStatus(`error: ${e.message}`);
      });
    });
    toolbar.appendChild(reloadBtn);

    const zoomLabel = document.createElement('span');
    zoomLabel.textContent = 'Zoom:';
    toolbar.appendChild(zoomLabel);

    const zoomSelect = document.createElement('select');
    zoomSelect.style.cssText = 'background:#222;color:#ddd;border:1px solid #555;';
    [2, 3, 4, 6, 8, 12].forEach((px) => {
      const opt = document.createElement('option');
      opt.value = String(px);
      opt.textContent = `${px}px`;
      if (px === 4) opt.selected = true;
      zoomSelect.appendChild(opt);
    });
    zoomSelect.addEventListener('change', () => {
      if (this.renderer) this.renderer.setTilePixelSize(parseInt(zoomSelect.value, 10));
    });
    toolbar.appendChild(zoomSelect);

    this.statusElement = document.createElement('span');
    this.statusElement.style.cssText = 'margin-left:auto;color:#888;';
    this.statusElement.textContent = 'idle';
    toolbar.appendChild(this.statusElement);

    this.rootElement.appendChild(toolbar);

    const canvasWrap = document.createElement('div');
    canvasWrap.style.cssText = 'flex:1 1 auto;overflow:auto;background:#000;';
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'image-rendering:pixelated;display:block;';
    canvasWrap.appendChild(this.canvas);
    this.rootElement.appendChild(canvasWrap);

    this.container.getElement().append(this.rootElement);
  }

  _setStatus(text) {
    if (this.statusElement) this.statusElement.textContent = text;
  }

  async _loadAndRender() {
    this._setStatus('loading...');
    const [tilemap, config] = await Promise.all([
      loadTileMap(this.tilemapPath),
      loadCategoryConfig(this.configPath),
    ]);
    this.tilemap = tilemap;
    this.config = config;
    this.categoryGrid = buildCategoryGrid(tilemap, config);

    if (!this.renderer) {
      this.renderer = new TileMapCanvasRenderer(this.canvas);
    }
    this.renderer.setData(tilemap, this.categoryGrid, config);

    const counts = this._countCategories();
    const summary = `${tilemap.map_width}×${tilemap.map_height}, ${counts.unique} categories`;
    this._setStatus(summary);
    log('info', 'loaded', summary, counts.byName);
  }

  _countCategories() {
    const byName = {};
    const h = this.tilemap.map_height;
    const w = this.tilemap.map_width;
    for (let y = 0; y < h; y++) {
      const row = this.categoryGrid[y];
      for (let x = 0; x < w; x++) {
        const name = row[x];
        byName[name] = (byName[name] || 0) + 1;
      }
    }
    return { unique: Object.keys(byName).length, byName };
  }

  _destroy() {
    this.tilemap = null;
    this.config = null;
    this.categoryGrid = null;
    this.renderer = null;
  }
}
