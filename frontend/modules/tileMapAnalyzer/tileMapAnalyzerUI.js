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
import { buildEffectiveGrids } from './tileCategorizer.js';
import {
  computeReachable,
  addMidairPOIs,
  findPlayerStart,
  findPointsOfInterest,
  orderSavePoints,
  probeOneTileOld,
} from './reachabilityAnalyzer.js';
import { probeOneTilePhysics } from './reachabilityPhysics.js';
import { exportRulesJson } from './rulesExporter.js';
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

    const mkBtn = (text, onClick) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.style.cssText = 'background:#333;color:#ddd;border:1px solid #555;padding:3px 8px;cursor:pointer;';
      b.addEventListener('click', onClick);
      return b;
    };

    toolbar.appendChild(mkBtn('Reload', () => {
      this._loadAndRender().catch((e) => {
        log('error', 'reload failed', e);
        this._setStatus(`error: ${e.message}`);
      });
    }));

    toolbar.appendChild(mkBtn('Compute', () => {
      this._runReachabilityFromControls().catch((e) => {
        log('error', 'reachability failed', e);
        this._setStatus(`error: ${e.message}`);
      });
    }));

    toolbar.appendChild(mkBtn('Export', () => {
      this._exportRulesJson().catch((e) => {
        log('error', 'export failed', e);
        this._setStatus(`error: ${e.message}`);
      });
    }));

    toolbar.appendChild(mkBtn('Clear', () => {
      if (this.renderer) this.renderer.clearOverlays();
      this._lastClick = null;
      this._setStatus(this._summary || 'idle');
    }));

    toolbar.appendChild(mkBtn('-', () => {
      if (this.renderer) this.renderer.zoomOut();
    }));

    this._zoomLabel = document.createElement('span');
    this._zoomLabel.textContent = '4px';
    this._zoomLabel.style.cssText = 'min-width:30px;text-align:center;';
    toolbar.appendChild(this._zoomLabel);

    toolbar.appendChild(mkBtn('+', () => {
      if (this.renderer) this.renderer.zoomIn();
    }));

    this.statusElement = document.createElement('span');
    this.statusElement.style.cssText = 'margin-left:auto;color:#888;';
    this.statusElement.textContent = 'idle';
    toolbar.appendChild(this.statusElement);

    this.rootElement.appendChild(toolbar);

    // Controls row: start point selector + ability checkboxes
    const controls = document.createElement('div');
    controls.style.cssText =
      'flex:0 0 auto;padding:4px 8px;border-bottom:1px solid #333;display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:11px;';

    const startLabel = document.createElement('span');
    startLabel.textContent = 'Start:';
    controls.appendChild(startLabel);

    this._startSelect = document.createElement('select');
    this._startSelect.style.cssText = 'background:#222;color:#ddd;border:1px solid #555;font-size:11px;';
    controls.appendChild(this._startSelect);

    const sep = document.createElement('span');
    sep.textContent = '|';
    sep.style.cssText = 'color:#555;';
    controls.appendChild(sep);

    const abLabel = document.createElement('span');
    abLabel.textContent = 'Abilities:';
    controls.appendChild(abLabel);

    this._abilityCheckboxes = document.createElement('span');
    this._abilityCheckboxes.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
    controls.appendChild(this._abilityCheckboxes);

    const presetBtns = document.createElement('span');
    presetBtns.style.cssText = 'display:flex;gap:4px;margin-left:4px;';
    const mkSmallBtn = (text, onClick) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.style.cssText = 'background:#333;color:#aaa;border:1px solid #555;padding:1px 5px;cursor:pointer;font-size:10px;';
      b.addEventListener('click', onClick);
      return b;
    };
    presetBtns.appendChild(mkSmallBtn('Basic', () => this._setAbilityPreset('basic')));
    presetBtns.appendChild(mkSmallBtn('All', () => this._setAbilityPreset('all')));
    presetBtns.appendChild(mkSmallBtn('None', () => this._setAbilityPreset('none')));
    controls.appendChild(presetBtns);

    const modelSep = document.createElement('span');
    modelSep.textContent = '|';
    modelSep.style.cssText = 'color:#555;';
    controls.appendChild(modelSep);

    const physicsLabel = document.createElement('label');
    physicsLabel.style.cssText = 'display:flex;align-items:center;gap:3px;cursor:pointer;';
    physicsLabel.title =
      'Use the physics-accurate trajectory simulator instead of the ' +
      'bounding-box heuristic. Slower (seconds for full abilities) but ' +
      'rejects impossible paths that the bounding-box model accepts.';
    this._physicsCheckbox = document.createElement('input');
    this._physicsCheckbox.type = 'checkbox';
    this._physicsCheckbox.style.cssText = 'margin:0;';
    this._physicsCheckbox.addEventListener('change', () => this._reExploreIfSelected());
    physicsLabel.appendChild(this._physicsCheckbox);
    const physicsText = document.createElement('span');
    physicsText.textContent = 'Physics';
    physicsLabel.appendChild(physicsText);
    controls.appendChild(physicsLabel);

    this.rootElement.appendChild(controls);

    this._canvasWrap = document.createElement('div');
    this._canvasWrap.style.cssText = 'flex:1 1 auto;overflow:hidden;background:#000;position:relative;';
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'image-rendering:pixelated;display:block;cursor:crosshair;';
    this._canvasWrap.appendChild(this.canvas);
    this.rootElement.appendChild(this._canvasWrap);

    // Tile info bar at the bottom
    this._tileInfoBar = document.createElement('div');
    this._tileInfoBar.style.cssText =
      'flex:0 0 auto;padding:4px 8px;border-top:1px solid #333;color:#aaa;font-size:11px;min-height:18px;';
    this._tileInfoBar.textContent = 'Click a tile for details';
    this.rootElement.appendChild(this._tileInfoBar);

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
      this.renderer = new TileMapCanvasRenderer(this.canvas, this._canvasWrap);
      this.renderer.onZoomChanged = (size) => {
        if (this._zoomLabel) this._zoomLabel.textContent = `${size}px`;
      };
      this.renderer.onTileSelected = (x, y, info) => {
        const catDef = this.config.categories[info.category] || {};
        const parts = [`(${x}, ${y})`, `raw=${info.rawId}`, info.category];
        if (catDef.ap_name) parts.push(`ap: ${catDef.ap_name}`);
        if (catDef.solid) parts.push('solid');
        if (catDef.lethal) parts.push('lethal');
        if (catDef.blocks_floor) parts.push('enemy');
        if (catDef.is_region) parts.push('region');
        if (catDef.is_location) parts.push('location');
        if (info.inReachable) parts.push('REACHABLE');
        this._tileInfoBar.textContent = parts.join(' | ');
        // Click also triggers a one-step "where can I go from here"
        // overlay: every tile reachable in one movement primitive,
        // without landing on any other floor tile first.
        try {
          this._exploreFromTile(x, y);
        } catch (e) {
          log('error', 'explore failed', e);
          this._setStatus(`error: ${e.message}`);
        }
      };
    }
    this.renderer.setData(tilemap, this.categoryGrid, config);

    const counts = this._countCategories();
    const summary = `${tilemap.map_width}×${tilemap.map_height}, ${counts.unique} categories`;
    this._summary = summary;
    this._setStatus(summary);
    log('info', 'loaded', summary, counts.byName);

    // Drop POIs onto the canvas as outline markers so save points
    // and pickups are easy to locate even at low zoom. This is a
    // static overlay — the Clear button wipes it along with the
    // reachability overlay.
    const pois = findPointsOfInterest(this.categoryGrid, this.config);
    const markers = pois.map((p) => ({
      x: p.x,
      y: p.y,
      color: '#ffffff',
      label: p.ap_name || p.categoryName,
    }));
    this.renderer.setMarkers(markers);

    // Populate the start-point dropdown and ability checkboxes
    this._populateControls();
  }

  _populateControls() {
    if (!this.config || !this.categoryGrid) return;
    const cats = this.config.categories;

    // Start-point dropdown: player start + all save points
    const sel = this._startSelect;
    sel.innerHTML = '';
    const playerStart = findPlayerStart(this.categoryGrid, this.config);
    if (playerStart) {
      const opt = document.createElement('option');
      opt.value = JSON.stringify({ x: playerStart.x, y: playerStart.y });
      opt.textContent = `Player Start (${playerStart.x}, ${playerStart.y})`;
      sel.appendChild(opt);
    }
    const pois = findPointsOfInterest(this.categoryGrid, this.config);
    let saves = pois.filter(p => {
      const cat = cats[p.categoryName];
      return cat && cat.is_region && !cat.is_location && !cat.is_player_start;
    });
    saves = orderSavePoints(saves, this.config);
    saves.forEach((sp, i) => {
      const opt = document.createElement('option');
      opt.value = JSON.stringify({ x: sp.x, y: sp.y });
      opt.textContent = `Save Point ${i + 1} (${sp.x}, ${sp.y})`;
      sel.appendChild(opt);
    });

    // Ability checkboxes
    const wrap = this._abilityCheckboxes;
    wrap.innerHTML = '';
    this._abilityBoxes = {};
    const abilities = Object.keys(this.config.abilities || {});
    const basicSet = new Set(this.config.basic_abilities || []);
    for (const name of abilities) {
      const label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:2px;cursor:pointer;';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = basicSet.has(name);
      cb.addEventListener('change', () => this._reExploreIfSelected());
      const span = document.createElement('span');
      span.textContent = name;
      if (basicSet.has(name)) span.style.fontWeight = 'bold';
      label.appendChild(cb);
      label.appendChild(span);
      wrap.appendChild(label);
      this._abilityBoxes[name] = cb;
    }
  }

  _setAbilityPreset(preset) {
    if (!this._abilityBoxes) return;
    const basicSet = new Set(this.config?.basic_abilities || []);
    for (const [name, cb] of Object.entries(this._abilityBoxes)) {
      if (preset === 'all') cb.checked = true;
      else if (preset === 'none') cb.checked = false;
      else if (preset === 'basic') cb.checked = basicSet.has(name);
    }
    this._reExploreIfSelected();
  }

  /**
   * If a tile was previously clicked for exploration, re-run the
   * one-step probe with the current ability set and model choice
   * so the overlay stays in sync with the checkboxes.
   */
  _reExploreIfSelected() {
    if (!this._lastClick) return;
    try {
      this._exploreFromTile(this._lastClick.x, this._lastClick.y);
    } catch (e) {
      log('error', 're-explore failed', e);
      this._setStatus(`error: ${e.message}`);
    }
  }

  _getSelectedAbilities() {
    const set = new Set();
    if (!this._abilityBoxes) return set;
    for (const [name, cb] of Object.entries(this._abilityBoxes)) {
      if (cb.checked) set.add(name);
    }
    return set;
  }

  _getSelectedStart() {
    if (!this._startSelect || !this._startSelect.value) return null;
    return JSON.parse(this._startSelect.value);
  }

  /**
   * Single-step "where can I go from here" probe. Given a clicked
   * tile, enumerate every tile directly reachable by one movement
   * primitive (walk, jump, double jump, dash, rocket, fall) WITHOUT
   * landing on any other floor tile first — i.e. the tile's
   * immediate BFS neighbors plus the hitbox-swept air column for
   * physics mode.
   *
   * Much faster than a full BFS and more useful for diagnosing
   * "why can the player reach X from here?" questions.
   */
  _exploreFromTile(clickX, clickY) {
    if (!this.categoryGrid || !this.config) return;
    // Remember the raw click so we can re-run when the ability set
    // or model choice changes.
    this._lastClick = { x: clickX, y: clickY };

    const abilitySet = this._getSelectedAbilities();
    const { effectiveGrid, floorFlags } = buildEffectiveGrids(
      this.categoryGrid, abilitySet, this.config
    );

    // Snap the click to a floor tile: if the clicked tile itself
    // isn't a floor, try a few rows below.
    let sx = clickX;
    let sy = clickY;
    const h = floorFlags.length;
    if (!floorFlags[sy] || !floorFlags[sy][sx]) {
      let found = false;
      for (let dy = 1; dy <= 4; dy++) {
        if (sy + dy >= h) break;
        if (floorFlags[sy + dy] && floorFlags[sy + dy][sx]) {
          sy += dy;
          found = true;
          break;
        }
      }
      if (!found) {
        this._setStatus(`(${clickX}, ${clickY}) — no floor tile here`);
        this.renderer.setReachableOverlay(null);
        this.renderer.setAirOverlay(null);
        return;
      }
    }

    const usePhysics = !!(this._physicsCheckbox && this._physicsCheckbox.checked);
    const cfg = usePhysics ? { ...this.config, use_physics_model: true } : this.config;

    const t0 = performance.now();
    const probe = usePhysics
      ? probeOneTilePhysics(sx, sy, effectiveGrid, floorFlags, abilitySet, cfg)
      : probeOneTileOld(sx, sy, effectiveGrid, floorFlags, abilitySet, cfg);
    const t1 = performance.now();

    // Build overlays.
    const floorSet = new Set();
    floorSet.add(`${sy},${sx}`);  // source tile itself, for visual anchor
    for (const l of probe.landings) floorSet.add(`${l.y},${l.x}`);
    const airSet = probe.sweptTiles && probe.sweptTiles.size ? probe.sweptTiles : null;

    this.renderer.setReachableOverlay(floorSet, 'rgba(80, 220, 80, 0.45)');
    this.renderer.setAirOverlay(airSet, 'rgba(120, 180, 255, 0.22)');

    const tag = usePhysics ? 'physics' : 'bbox';
    const airPart = airSet ? `, ${airSet.size} air` : '';
    this._setStatus(
      `from (${sx},${sy}): ${probe.landings.length} neighbors${airPart} [${tag}] in ${Math.round(t1 - t0)}ms`
    );
  }

  async _runReachabilityFromControls() {
    if (!this.categoryGrid || !this.config) {
      throw new Error('tilemap not loaded yet');
    }
    const abilitySet = this._getSelectedAbilities();
    const start = this._getSelectedStart();
    if (!start) throw new Error('no start point selected');

    const { effectiveGrid, floorFlags } = buildEffectiveGrids(
      this.categoryGrid, abilitySet, this.config
    );

    let sx = start.x;
    let sy = start.y;
    if (!floorFlags[sy][sx]) {
      if (sy + 1 < floorFlags.length && floorFlags[sy + 1][sx]) {
        sy = sy + 1;
      }
    }

    const usePhysics = !!(this._physicsCheckbox && this._physicsCheckbox.checked);
    const effectiveConfig = usePhysics
      ? { ...this.config, use_physics_model: true }
      : this.config;

    const t0 = performance.now();
    const { reachable } = computeReachable(
      sx, sy, effectiveGrid, floorFlags, abilitySet, effectiveConfig
    );
    const augmented = addMidairPOIs(
      reachable, effectiveGrid, floorFlags, this.categoryGrid, abilitySet, effectiveConfig
    );
    const t1 = performance.now();

    // Color based on how many abilities are selected vs total
    const totalAbilities = Object.keys(this.config.abilities || {}).length;
    const selectedCount = abilitySet.size;
    const ratio = totalAbilities > 0 ? selectedCount / totalAbilities : 0;
    const r = Math.round(80 + 100 * (1 - ratio));
    const g = Math.round(180 + 40 * ratio);
    const b = Math.round(80 + 175 * ratio);
    const color = `rgba(${r}, ${g}, ${b}, 0.35)`;

    this.renderer.setReachableOverlay(augmented, color);
    const abNames = [...abilitySet].sort().join(', ') || 'none';
    const modelTag = usePhysics ? ' physics' : '';
    const status = `${augmented.size} tiles from (${sx},${sy}) [${abNames}]${modelTag} in ${Math.round(t1 - t0)}ms`;
    this._setStatus(status);
    log('info', status);
  }

  async _exportRulesJson() {
    if (!this.categoryGrid || !this.config) {
      throw new Error('tilemap not loaded yet');
    }
    this._setStatus('exporting rules.json...');
    const t0 = performance.now();
    const { rules, debugLog } = exportRulesJson(this.categoryGrid, this.config, (msg) => {
      this._setStatus(`export: ${msg}`);
      log('info', `export: ${msg}`);
    });
    const t1 = performance.now();

    const regionCount = Object.keys(rules.regions['1']).length;
    let exitCount = 0;
    for (const r of Object.values(rules.regions['1'])) {
      exitCount += r.exits.length;
    }

    // Publish via event bus so the editor and other modules pick it up
    this.eventBus.publish('files:jsonLoaded', {
      jsonData: rules,
      selectedPlayerId: '1',
      sourceName: 'tileMapAnalyzer',
    });

    // Download rules.json
    const json = JSON.stringify(rules, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${rules.seed_name || 'tilemap'}_rules.json`;
    a.click();
    URL.revokeObjectURL(url);

    // Download debug log
    const logText = debugLog.join('\n');
    const logBlob = new Blob([logText], { type: 'text/plain' });
    const logUrl = URL.createObjectURL(logBlob);
    const a2 = document.createElement('a');
    a2.href = logUrl;
    a2.download = `${rules.seed_name || 'tilemap'}_export_debug.txt`;
    a2.click();
    URL.revokeObjectURL(logUrl);

    const status = `exported: ${regionCount} regions, ${exitCount} exits in ${Math.round(t1 - t0)}ms`;
    this._setStatus(status);
    log('info', status);
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
