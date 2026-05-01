import { RegionGraphLayoutEditor } from './regionGraphLayoutEditor.js';
import settingsManager from '../../app/core/settingsManager.js';
import { createUniversalLogger } from '../../app/core/universalLogger.js';
import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js';

const logger = createUniversalLogger('regionGraph');

export class LayoutControlsManager {
  constructor(ui) {
    this.ui = ui;
  }

  setupControlPanel() {
    // Create hybrid control panel with both existing controls and layout editor
    this.ui.controlPanel.innerHTML = `
      <div id="controlsHeader" style="display: flex; align-items: center; margin-bottom: 5px; cursor: pointer; user-select: none;">
        <button id="toggleControls" style="background: none; border: 1px solid #555; color: white; padding: 2px 6px; font-size: 10px; cursor: pointer; border-radius: 2px; margin-right: 8px; pointer-events: none;">+</button>
        <span style="font-weight: bold; pointer-events: none;">Controls</span>
      </div>
      <div id="controlsContent" style="display: none; max-height: calc(100vh - 100px); overflow-y: auto; padding-right: 15px;">
        <div style="margin-bottom: 10px;">
          <button id="resetView" style="margin: 2px; padding: 4px 8px;">Reset View</button>
          <button id="relayout" style="margin: 2px; padding: 4px 8px;">Re-layout</button>
          <button id="exportPositions" style="margin: 2px; padding: 4px 8px;">Export Positions</button>
        </div>
        <div id="layoutEditorContainer"></div>
        <div id="discoveryControls" style="display: none; margin-top: 10px; padding-top: 8px; border-top: 1px solid #555;">
          <div style="font-weight: bold; margin-bottom: 5px;">Discovery Mode:</div>
          <label style="display: block; margin: 3px 0; cursor: pointer;">
            <input type="checkbox" id="graph-show-undiscovered" checked style="margin-right: 5px;">
            Show undiscovered regions/exits
          </label>
        </div>
        <details open style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #555;">
          <summary style="font-weight: bold; margin-bottom: 5px; cursor: pointer; user-select: none;">Zoom:</summary>
          <label style="display: block; margin: 3px 0;">
            <span style="margin-right: 5px;">Zoom level:</span>
            <input type="number" id="zoomLevel" min="0.01" max="10" step="0.01" value="1" style="width: 60px; padding: 2px;">
          </label>
          <label style="display: block; margin: 3px 0;">
            <span style="margin-right: 5px;">Scroll zoom sensitivity:</span>
            <input type="number" id="wheelSensitivity" min="0.1" max="5" step="0.1" value="1" style="width: 60px; padding: 2px;">
          </label>
        </details>
        <details open style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #555;">
          <summary style="font-weight: bold; margin-bottom: 5px; cursor: pointer; user-select: none;">On Region Node Click:</summary>
          <label style="display: block; margin: 3px 0; cursor: pointer;">
            <input type="checkbox" id="movePlayerOneStep" style="margin-right: 5px;">
            Move player one step towards region
          </label>
          <label style="display: block; margin: 3px 0; cursor: pointer;">
            <input type="checkbox" id="movePlayerDirectly" style="margin-right: 5px;" checked>
            Move player directly to region
          </label>
          <label style="display: block; margin: 3px 0; cursor: pointer;">
            <input type="checkbox" id="showRegionInPanel" style="margin-right: 5px;" checked>
            Show region in Regions panel
          </label>
          <label style="display: block; margin: 3px 0; cursor: pointer;">
            <input type="checkbox" id="addToPath" style="margin-right: 5px;" checked>
            Add to path
          </label>
          <label style="display: block; margin: 3px 0; cursor: pointer;">
            <input type="checkbox" id="overwritePath" style="margin-right: 5px;">
            Overwrite path
          </label>
          <label style="display: block; margin: 3px 0; cursor: pointer;">
            <input type="checkbox" id="addLocationsToPath" style="margin-right: 5px;">
            Add locations to path
          </label>
          <label style="display: block; margin: 3px 0; cursor: pointer;">
            <input type="checkbox" id="checkAllLocationsInRegion" style="margin-right: 5px;">
            Check all locations in region
          </label>
        </details>
        <details open style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #555;">
          <summary style="font-weight: bold; margin-bottom: 5px; cursor: pointer; user-select: none;">Location Visibility:</summary>
          <label style="display: block; margin: 3px 0; cursor: pointer;">
            <input type="radio" name="locationVisibility" value="hover" style="margin-right: 5px;">
            Show on hover
          </label>
          <label style="display: block; margin: 3px 0; cursor: pointer;">
            <input type="radio" name="locationVisibility" value="zoom" style="margin-right: 5px;">
            Zoom-based
          </label>
          <label style="display: block; margin: 3px 0; cursor: pointer;">
            <input type="radio" name="locationVisibility" value="force-show" style="margin-right: 5px;">
            Always show
          </label>
          <label style="display: block; margin: 3px 0; cursor: pointer;">
            <input type="radio" name="locationVisibility" value="force-hide" style="margin-right: 5px;">
            Always hide
          </label>
          <label style="display: block; margin: 3px 0; cursor: pointer;">
            <input type="checkbox" id="forceHideEdgeLabels" style="margin-right: 5px;">
            Hide edge labels
          </label>
        </details>
        <details style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #555;">
          <summary style="font-weight: bold; margin-bottom: 5px; cursor: pointer; user-select: none;">Location Display Limits:</summary>
          <label style="display: block; margin: 3px 0;">
            <span style="margin-right: 5px;">Max location nodes:</span>
            <input type="number" id="maxLocationNodes" min="0" value="100" style="width: 60px; padding: 2px;">
            <span style="font-size: 10px; color: #888;"> (0 = unlimited)</span>
          </label>
          <label style="display: block; margin: 3px 0; cursor: pointer;">
            <input type="checkbox" id="keepRegionSetsComplete" style="margin-right: 5px;" checked>
            Keep region sets complete (may exceed limit)
          </label>
          <label style="display: block; margin: 3px 0; cursor: pointer;">
            <input type="checkbox" id="onlyShowLocationsInView" style="margin-right: 5px;">
            Only show locations in view
          </label>
          <label id="viewportDelayContainer" style="display: none; margin: 3px 0;">
            <span style="margin-right: 5px;">Viewport stabilize delay (ms):</span>
            <input type="number" id="viewportStabilizeDelay" min="100" max="5000" value="1000" style="width: 60px; padding: 2px;">
          </label>
        </details>
      </div>
    `;

    // Initialize layout editor
    const layoutEditorContainer = this.ui.controlPanel.querySelector('#layoutEditorContainer');
    if (layoutEditorContainer) {
      this.ui.layoutEditor = new RegionGraphLayoutEditor(this.ui.cy, this.ui.controlPanel);
      layoutEditorContainer.innerHTML = this.ui.layoutEditor.createEditorHTML();
      this.ui.layoutEditor.setupEventHandlers(this.ui);
    }
  }

  async loadCheckboxSettings() {
    // Load checkbox states from settings
    const checkboxes = [
      { id: '#forceHideEdgeLabels', setting: 'moduleSettings.regionGraph.forceHideEdgeLabels', default: true },
      { id: '#keepRegionSetsComplete', setting: 'moduleSettings.regionGraph.keepRegionSetsComplete', default: true },
      { id: '#onlyShowLocationsInView', setting: 'moduleSettings.regionGraph.onlyShowLocationsInView', default: false },
      { id: '#movePlayerOneStep', setting: 'moduleSettings.regionGraph.movePlayerOneStep', default: false },
      { id: '#movePlayerDirectly', setting: 'moduleSettings.regionGraph.movePlayerDirectly', default: true },
      { id: '#showRegionInPanel', setting: 'moduleSettings.regionGraph.showRegionInPanel', default: true },
      { id: '#addToPath', setting: 'moduleSettings.regionGraph.addToPath', default: true },
      { id: '#overwritePath', setting: 'moduleSettings.regionGraph.overwritePath', default: false },
      { id: '#addLocationsToPath', setting: 'moduleSettings.regionGraph.addLocationsToPath', default: false },
      { id: '#checkAllLocationsInRegion', setting: 'moduleSettings.regionGraph.checkAllLocationsInRegion', default: false },
      { id: '#graph-show-undiscovered', setting: 'moduleSettings.regionGraph.showUndiscovered', default: true }
    ];

    // Load numeric input settings
    const numericInputs = [
      { id: '#maxLocationNodes', setting: 'moduleSettings.regionGraph.maxLocationNodes', default: 100 },
      { id: '#viewportStabilizeDelay', setting: 'moduleSettings.regionGraph.viewportStabilizeDelay', default: 1000 },
      { id: '#wheelSensitivity', setting: 'moduleSettings.regionGraph.wheelSensitivity', default: 1, parse: parseFloat }
    ];

    // Zoom level input — syncs with Cytoscape, not persisted to settings
    this._setupZoomLevelInput();

    for (const input of numericInputs) {
      const element = this.ui.controlPanel.querySelector(input.id);
      if (element) {
        const parseFn = input.parse || (v => parseInt(v, 10));
        try {
          const value = await settingsManager.getSetting(input.setting, input.default);
          element.value = value;
          // Store on UI for easy access
          if (input.id === '#maxLocationNodes') {
            this.ui.maxLocationNodes = value;
          } else if (input.id === '#viewportStabilizeDelay') {
            this.ui.viewportStabilizeDelay = value;
          } else if (input.id === '#wheelSensitivity') {
            this.ui.wheelSensitivity = value;
          }
        } catch (error) {
          logger.warn(`Failed to load setting ${input.setting}:`, error);
          element.value = input.default;
          // Also update UI property with default
          if (input.id === '#maxLocationNodes') {
            this.ui.maxLocationNodes = input.default;
          } else if (input.id === '#viewportStabilizeDelay') {
            this.ui.viewportStabilizeDelay = input.default;
          } else if (input.id === '#wheelSensitivity') {
            this.ui.wheelSensitivity = input.default;
          }
        }

        // Setup change handler
        element.addEventListener('change', async (e) => {
          const newValue = parseFn(e.target.value);
          await this.saveNumericSetting(input.setting, newValue);
          if (input.id === '#maxLocationNodes') {
            this.ui.maxLocationNodes = newValue;
            // Refresh location nodes if visible
            if (this.ui.locationsVisible) {
              this.ui.refreshLocationNodes();
            }
          } else if (input.id === '#viewportStabilizeDelay') {
            this.ui.viewportStabilizeDelay = newValue;
          } else if (input.id === '#wheelSensitivity') {
            this.ui.wheelSensitivity = newValue;
          }
        });
      }
    }

    for (const checkbox of checkboxes) {
      const element = this.ui.controlPanel.querySelector(checkbox.id);
      if (element) {
        try {
          const value = await settingsManager.getSetting(checkbox.setting, checkbox.default);
          element.checked = value;
        } catch (error) {
          logger.warn(`Failed to load setting ${checkbox.setting}:`, error);
          element.checked = checkbox.default;
        }
      }
    }

    // Load location visibility mode (4-way radio: hover | zoom | force-show
    // | force-hide). Default is 'hover'. Migrates from the previous two
    // checkbox keys (forceShowLocations / forceHideLocations) when the new
    // key isn't set yet, so existing users who had a force-mode preference
    // keep it on first load after the upgrade.
    let mode = await settingsManager.getSetting(
      'moduleSettings.regionGraph.locationVisibility', null);
    if (!mode) {
      const oldShow = await settingsManager.getSetting(
        'moduleSettings.regionGraph.forceShowLocations', false);
      const oldHide = await settingsManager.getSetting(
        'moduleSettings.regionGraph.forceHideLocations', false);
      mode = oldShow ? 'force-show' : (oldHide ? 'force-hide' : 'hover');
    }
    this.ui.locationVisibilityMode = mode;
    const radio = this.ui.controlPanel.querySelector(
      `input[name="locationVisibility"][value="${mode}"]`);
    if (radio) radio.checked = true;

    // Sync edge label visibility flag
    const forceHideEdgeLabelsEl = this.ui.controlPanel.querySelector('#forceHideEdgeLabels');
    this.ui.edgeLabelsHidden = !!forceHideEdgeLabelsEl?.checked;

    // Setup change handler for discovery checkbox to trigger graph rebuild
    const showUndiscoveredCheckbox = this.ui.controlPanel.querySelector('#graph-show-undiscovered');
    if (showUndiscoveredCheckbox) {
      showUndiscoveredCheckbox.addEventListener('change', async (e) => {
        await this.saveCheckboxSetting('#graph-show-undiscovered', 'moduleSettings.regionGraph.showUndiscovered', e.target.checked);
        // Rebuild the graph with new filtering
        if (this.ui.cy && this.ui.graphInitialized) {
          this.ui.loadGraphData();
        }
      });
    }

    // Setup change handler for keepRegionSetsComplete
    const keepRegionSetsCheckbox = this.ui.controlPanel.querySelector('#keepRegionSetsComplete');
    if (keepRegionSetsCheckbox) {
      this.ui.keepRegionSetsComplete = keepRegionSetsCheckbox.checked;
      keepRegionSetsCheckbox.addEventListener('change', async (e) => {
        await this.saveCheckboxSetting('#keepRegionSetsComplete', 'moduleSettings.regionGraph.keepRegionSetsComplete', e.target.checked);
        this.ui.keepRegionSetsComplete = e.target.checked;
        // Refresh location nodes if visible
        if (this.ui.locationsVisible) {
          this.ui.refreshLocationNodes();
        }
      });
    }

    // Setup change handler for onlyShowLocationsInView
    const onlyInViewCheckbox = this.ui.controlPanel.querySelector('#onlyShowLocationsInView');
    const viewportDelayContainer = this.ui.controlPanel.querySelector('#viewportDelayContainer');
    if (onlyInViewCheckbox) {
      this.ui.onlyShowLocationsInView = onlyInViewCheckbox.checked;
      // Show/hide viewport delay setting based on checkbox state
      if (viewportDelayContainer) {
        viewportDelayContainer.style.display = onlyInViewCheckbox.checked ? 'block' : 'none';
      }
      onlyInViewCheckbox.addEventListener('change', async (e) => {
        await this.saveCheckboxSetting('#onlyShowLocationsInView', 'moduleSettings.regionGraph.onlyShowLocationsInView', e.target.checked);
        this.ui.onlyShowLocationsInView = e.target.checked;
        // Show/hide viewport delay setting
        if (viewportDelayContainer) {
          viewportDelayContainer.style.display = e.target.checked ? 'block' : 'none';
        }
        // Refresh location nodes if visible
        if (this.ui.locationsVisible) {
          this.ui.refreshLocationNodes();
        }
      });
    }

    // Setup change handler for forceHideEdgeLabels
    const forceHideEdgeLabelsCheckbox = this.ui.controlPanel.querySelector('#forceHideEdgeLabels');
    if (forceHideEdgeLabelsCheckbox) {
      forceHideEdgeLabelsCheckbox.addEventListener('change', async (e) => {
        await this.saveCheckboxSetting('#forceHideEdgeLabels', 'moduleSettings.regionGraph.forceHideEdgeLabels', e.target.checked);
        this.ui.edgeLabelsHidden = e.target.checked;
        this.ui.interactionManager.updateZoomBasedVisibility();
      });
    }

    // Update discovery controls visibility based on current mode
    this.updateDiscoveryControlsVisibility();
  }

  /**
   * Update visibility of discovery-specific controls based on discovery mode state
   */
  updateDiscoveryControlsVisibility() {
    const discoveryControls = this.ui.controlPanel?.querySelector('#discoveryControls');
    if (discoveryControls) {
      discoveryControls.style.display = this.ui.isDiscoveryModeActive ? 'block' : 'none';
    }
  }

  _setupZoomLevelInput() {
    const zoomLevelInput = this.ui.controlPanel.querySelector('#zoomLevel');
    if (!zoomLevelInput) return;
    this._zoomLevelInput = zoomLevelInput;

    // Apply zoom when the user changes the input
    zoomLevelInput.addEventListener('change', (e) => {
      const newZoom = parseFloat(e.target.value);
      if (this.ui.cy && !isNaN(newZoom) && newZoom > 0) {
        this.ui.cy.zoom({
          level: newZoom,
          renderedPosition: {
            x: this.ui.cy.width() / 2,
            y: this.ui.cy.height() / 2
          }
        });
      }
    });

    // If Cytoscape is already initialized, connect now
    if (this.ui.cy) {
      this._connectZoomLevelToCy();
    }
  }

  /** Called once Cytoscape is available to sync the zoom input with the graph. */
  connectZoomInput() {
    if (this._zoomLevelInput && this.ui.cy) {
      this._connectZoomLevelToCy();
    }
  }

  _connectZoomLevelToCy() {
    this._zoomLevelInput.value = this.ui.cy.zoom().toFixed(2);
    this.ui.cy.on('zoom', () => {
      this._zoomLevelInput.value = this.ui.cy.zoom().toFixed(2);
    });
  }

  async saveCheckboxSetting(checkboxId, settingKey, value) {
    try {
      await settingsManager.updateSetting(settingKey, value);
    } catch (error) {
      logger.warn(`Failed to save setting ${settingKey}:`, error);
    }
  }

  async saveNumericSetting(settingKey, value) {
    try {
      await settingsManager.updateSetting(settingKey, value);
    } catch (error) {
      logger.warn(`Failed to save setting ${settingKey}:`, error);
    }
  }

  toggleControlPanel() {
    const controlsContent = this.ui.controlPanel.querySelector('#controlsContent');
    const toggleButton = this.ui.controlPanel.querySelector('#toggleControls');

    if (!controlsContent || !toggleButton) return;

    const isVisible = controlsContent.style.display !== 'none';

    if (isVisible) {
      // Collapse
      controlsContent.style.display = 'none';
      toggleButton.textContent = '+';
      toggleButton.title = 'Expand controls';
    } else {
      // Expand
      controlsContent.style.display = 'block';
      toggleButton.textContent = '−';
      toggleButton.title = 'Collapse controls';
    }
  }

  runLayout(force = false) {
    if (this.ui.isLayoutRunning) {
      logger.debug('Layout already running');
      return;
    }

    const savedPositions = !force && this.ui.nodePositions.size > 0;

    if (savedPositions) {
      this.ui.cy.nodes().forEach(node => {
        const pos = this.ui.nodePositions.get(node.id());
        if (pos) {
          node.position(pos);
        }
      });
      this.ui.cy.fit(30);

      // Position the player if this is initial load and no layout will run
      if (this.ui.initialPlayerRegion && !this.ui.cy.getElementById('player').length) {
        logger.debug(`Positioning player with saved positions at ${this.ui.initialPlayerRegion}`);
        this.ui.updatePlayerLocation(this.ui.initialPlayerRegion);
        this.ui.initialPlayerRegion = null;

        // Refresh node colors now that player positioning is complete
        const snapshot = stateManager.getLatestStateSnapshot();
        if (snapshot) {
          this.ui.dataManager.onStateUpdate({ snapshot });
        }
      }

      return;
    }

    this.ui.isLayoutRunning = true;
    this.ui.updateStatus('Running layout...');

    // Pre-size nodes for overlays so layout spaces them correctly
    this.ui.overlayManager.presizeNodes();

    // Procgen grid layout — when rules.json carried preset_sidecars
    // with grid_cell coordinates, mirror the maze panel's spatial
    // layout instead of running a force-directed pass. Picked ahead
    // of the DAG/cose auto-detection so a procgen-emitted graph
    // doesn't get re-laid-out by Cytoscape's heuristics.
    if (this.ui.gridLayout && this.ui.gridLayout.size > 0) {
      const gridOptions = this.buildProcgenGridLayout();
      if (gridOptions) {
        const layoutPresetSelect = this.ui.controlPanel?.querySelector('#layoutPreset');
        if (layoutPresetSelect) layoutPresetSelect.value = 'procgen-grid';
        logger.debug(`Applying procgen grid layout (${this.ui.gridLayout.size} regions)`);
        this.ui.currentLayout = this.ui.cy.layout(gridOptions);
        this.ui.currentLayout.run();
        return;
      }
    }

    // Auto-detect DAG structure for hierarchical layout
    const dagResult = this.detectDAGStructure();
    let layoutOptions;
    let selectedPreset = 'cose';

    if (dagResult.isDAG) {
      // Check if nodes have pre-computed hierarchy depths from graphDataManager.
      // If so, use a custom hierarchical layout that respects those depths
      // (Cytoscape's breadthfirst BFS ignores our longest-path computation).
      layoutOptions = this.buildHierarchyLayout();
      logger.debug(`Using custom hierarchy layout with ${layoutOptions._depthCount} depth levels`);

      selectedPreset = 'hierarchical-auto';
      logger.debug(`DAG detected, using hierarchical layout`);
    } else {
      // Use COSE for non-DAG graphs
      layoutOptions = {
        name: 'cose',
        randomize: false,
        animate: true,
        animationDuration: 1000,
        fit: true,
        padding: 50,
        nodeRepulsion: 400000,
        nodeOverlap: 10,
        idealEdgeLength: 100,
        edgeElasticity: 100,
        nestingFactor: 5,
        gravity: 80,
        numIter: 1000,
        componentSpacing: 100,
      };
    }

    // Sync layout editor dropdown to reflect the selected layout
    const layoutPresetSelect = this.ui.controlPanel?.querySelector('#layoutPreset');
    if (layoutPresetSelect) {
      layoutPresetSelect.value = selectedPreset;
    }

    this.ui.currentLayout = this.ui.cy.layout(layoutOptions);
    this.ui.currentLayout.run();
  }

  /**
   * Build a Cytoscape 'preset' layout from the driver-emitted grid_cell
   * coordinates in this.ui.gridLayout. Each region is placed at
   * (gx, gy) scaled by per-cell spacing derived from the average
   * node bounding-box (so dense graphs don't overlap and sparse
   * graphs don't sprawl). Player and any nodes without a grid_cell
   * are excluded from positioning — they default to {0, 0} and the
   * cy.fit pass at the end pulls them into view; the player sprite
   * follows its currently-highlighted region anyway.
   *
   * Returns null if the gridLayout couldn't produce a usable
   * positions map (e.g. all entries non-finite); caller falls back
   * to the cose / hierarchical pass.
   */
  buildProcgenGridLayout() {
    const layout = this.ui.gridLayout;
    if (!layout || layout.size === 0) return null;

    const nodes = this.ui.cy.nodes().filter(n => !n.hasClass('player'));
    const avgNodeWidth = nodes.reduce((sum, n) => {
      const bb = n.boundingBox({ includeLabels: true });
      return sum + bb.w;
    }, 0) / Math.max(nodes.length, 1);
    const avgNodeHeight = nodes.reduce((sum, n) => {
      const bb = n.boundingBox({ includeLabels: true });
      return sum + bb.h;
    }, 0) / Math.max(nodes.length, 1);

    const spacingFactor = 1.6;
    const cellWidth = Math.max(avgNodeWidth * spacingFactor, 150);
    const cellHeight = Math.max(avgNodeHeight * spacingFactor, 100);

    // Translate to origin so the smallest gx/gy lands at (0, 0) —
    // keeps the rendered graph tightly packed regardless of where
    // the grid placed regions in absolute coordinates.
    let minGx = Infinity, minGy = Infinity;
    for (const cell of layout.values()) {
      if (cell.gx < minGx) minGx = cell.gx;
      if (cell.gy < minGy) minGy = cell.gy;
    }
    if (!Number.isFinite(minGx) || !Number.isFinite(minGy)) return null;

    return {
      name: 'preset',
      positions: (node) => {
        const cell = layout.get(node.id());
        if (!cell) return { x: 0, y: 0 };
        return {
          x: (cell.gx - minGx) * cellWidth,
          y: (cell.gy - minGy) * cellHeight,
        };
      },
      animate: true,
      animationDuration: 1000,
      fit: true,
      padding: 50,
    };
  }

  /**
   * Build a hierarchical layout using pre-computed longest-path depths stored
   * on node data (hierarchyDepth). Returns a Cytoscape 'preset' layout config
   * with computed positions that guarantee no edge connects same-row nodes.
   */
  buildHierarchyLayout() {
    const nodes = this.ui.cy.nodes().filter(n => !n.hasClass('player'));

    // Group nodes by depth
    const depthGroups = new Map();
    nodes.forEach(node => {
      const depth = node.data('hierarchyDepth') ?? 0;
      if (!depthGroups.has(depth)) depthGroups.set(depth, []);
      depthGroups.get(depth).push(node);
    });

    // Sort depth levels
    const sortedDepths = [...depthGroups.keys()].sort((a, b) => a - b);
    const numLevels = sortedDepths.length;

    // Log depth distribution for debugging
    const depthInfo = sortedDepths.map(d => `${d}:${depthGroups.get(d).length}`).join(', ');
    logger.debug(`Hierarchy layout: ${numLevels} levels, distribution: [${depthInfo}]`);

    // Compute node dimensions for spacing
    const avgNodeWidth = nodes.reduce((sum, n) => {
      const bb = n.boundingBox({ includeLabels: true });
      return sum + bb.w;
    }, 0) / Math.max(nodes.length, 1);
    const avgNodeHeight = nodes.reduce((sum, n) => {
      const bb = n.boundingBox({ includeLabels: true });
      return sum + bb.h;
    }, 0) / Math.max(nodes.length, 1);

    const spacingFactor = 1.5;
    const rowSpacing = Math.max(avgNodeHeight * spacingFactor, 80);
    const colSpacing = Math.max(avgNodeWidth * spacingFactor, 120);

    // Compute positions: center each row horizontally
    const positions = new Map();
    sortedDepths.forEach((depth, levelIndex) => {
      const nodesAtDepth = depthGroups.get(depth);
      const rowWidth = (nodesAtDepth.length - 1) * colSpacing;
      const startX = -rowWidth / 2;

      nodesAtDepth.forEach((node, colIndex) => {
        positions.set(node.id(), {
          x: startX + colIndex * colSpacing,
          y: levelIndex * rowSpacing
        });
      });
    });

    return {
      name: 'preset',
      _depthCount: numLevels,
      positions: (node) => positions.get(node.id()) || { x: 0, y: 0 },
      animate: true,
      animationDuration: 1000,
      fit: true,
      padding: 50
    };
  }

  /**
   * Detect whether the graph has DAG (directed acyclic graph) structure
   * by analyzing hasForwardExit/hasReverseExit on edges and running Kahn's algorithm.
   * @returns {{ isDAG: boolean }}
   */
  detectDAGStructure() {
    const edges = this.ui.cy.edges().filter(e => !e.hasClass('hidden'));
    if (edges.length === 0) return { isDAG: false };

    // Count truly bidirectional edges (both directions have actual exits)
    let bidirectionalCount = 0;
    for (let i = 0; i < edges.length; i++) {
      const data = edges[i].data();
      if (data.hasForwardExit && data.hasReverseExit) {
        bidirectionalCount++;
      }
    }

    // If >10% of edges are truly bidirectional, not a DAG
    if (bidirectionalCount / edges.length > 0.1) {
      return { isDAG: false };
    }

    // Build directed adjacency from hasForwardExit/hasReverseExit
    // Edges are oriented parent→child by BFS depth from starting region
    const inDegree = new Map();
    const adjList = new Map();

    // Initialize all nodes
    this.ui.cy.nodes().filter(n => !n.hasClass('hidden') && !n.hasClass('player')).forEach(node => {
      const id = node.id();
      inDegree.set(id, 0);
      adjList.set(id, []);
    });

    // Add directed edges based on which direction has an actual exit
    for (let i = 0; i < edges.length; i++) {
      const data = edges[i].data();
      const source = data.source; // parent (shallower in BFS)
      const target = data.target; // child (deeper in BFS)
      if (!inDegree.has(source) || !inDegree.has(target)) continue;

      if (data.hasForwardExit && !data.hasReverseExit) {
        // Forward only: source -> target
        adjList.get(source).push(target);
        inDegree.set(target, inDegree.get(target) + 1);
      } else if (data.hasReverseExit && !data.hasForwardExit) {
        // Reverse only: target -> source
        adjList.get(target).push(source);
        inDegree.set(source, inDegree.get(source) + 1);
      }
      // If both, skip — already counted as bidirectional and under threshold
    }

    // Kahn's algorithm for topological sort / cycle detection
    const queue = [];
    for (const [nodeId, deg] of inDegree) {
      if (deg === 0) queue.push(nodeId);
    }

    let processed = 0;
    while (queue.length > 0) {
      const node = queue.shift();
      processed++;
      for (const neighbor of adjList.get(node) || []) {
        const newDeg = inDegree.get(neighbor) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) queue.push(neighbor);
      }
    }

    const totalNodes = inDegree.size;
    const isDAG = processed === totalNodes && totalNodes > 0;

    logger.debug(`DAG detection: ${processed}/${totalNodes} nodes processed, bidirectional=${bidirectionalCount}/${edges.length}, isDAG=${isDAG}`);

    return { isDAG };
  }

  saveNodePositions() {
    this.ui.nodePositions.clear();
    this.ui.cy.nodes().forEach(node => {
      this.ui.nodePositions.set(node.id(), {
        x: node.position('x'),
        y: node.position('y')
      });
    });
  }

  exportNodePositions() {
    const positions = {};
    this.ui.cy.nodes().forEach(node => {
      positions[node.id()] = {
        x: Math.round(node.position('x')),
        y: Math.round(node.position('y'))
      };
    });

    const dataStr = JSON.stringify(positions, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'region-graph-positions.json';
    link.click();
    URL.revokeObjectURL(url);

    this.ui.updateStatus('Positions exported to file');
  }
}