import { RegionGraphLayoutEditor } from './regionGraphLayoutEditor.js';
import { pickerHTML, setupNodePicker } from './nodePicker.js';
import { startLayout } from './layoutRun.js';
import settingsManager from '../../app/core/settingsManager.js';
import { createUniversalLogger } from '../../app/core/universalLogger.js';
import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js';
import { isRegionGroupNode, SUB_REGION_VIEW_KEY, SUB_REGION_VIEW_SCHEMA, SUB_REGION_VIEW_LABELS } from './subRegionGroups.js';
import { NODE_LOOK_KEY, NODE_LOOK_SCHEMA, NODE_LOOK_LABELS, NODE_LOOK_HINT, syncNodeLookControl } from './nodeLook.js';
import { exitTileOf } from '../regionMap/regionMapModel.js';
import {
  DIRECTION_STRENGTH_KEY, DIRECTION_SPACING_KEY, DIRECTION_EXITS_KEY, DIRECTION_STRENGTH_SCHEMA, DIRECTION_SPACING_SCHEMA,
  DIRECTION_EXITS_SCHEMA, DIRECTION_EXITS_LABELS, DIRECTION_LAYOUT_PRESET, normaliseDirectionSettings, exitDirections,
  edgePreferences, directionLayout, overlapCount, angleErrors,
} from './directionLayout.js';
import {
  DUNGEON_GROUPING_KEY, DUNGEON_GROUP_STRENGTH_KEY, DUNGEON_GROUPING_SCHEMA, DUNGEON_GROUPING_LABELS,
  DUNGEON_GROUP_STRENGTH_SCHEMA, normaliseGroupingSettings, groupedDirectionLayout, dungeonReader, dungeonsOf,
  mixingCount, blockCheck, blockPad, groupingDrawsBoxes,
} from './dungeonGroups.js';
import {
  FLOOR_GAP_KEY, FLOOR_GAP_SCHEMA, normaliseFloorGap, verticalExits, verticalEdges, floorNumbers, floorLabels,
} from './floors.js';

const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** The three Direction-aware settings' keys, by field. */
export const DIRECTION_SETTING_KEYS = Object.freeze({
  strength: DIRECTION_STRENGTH_KEY, spacing: DIRECTION_SPACING_KEY, exits: DIRECTION_EXITS_KEY,
});
/** ⛓ region-graph-dungeon-groups: the dungeon grouping's two settings' keys, by field. */
export const GROUPING_SETTING_KEYS = Object.freeze({
  grouping: DUNGEON_GROUPING_KEY, groupStrength: DUNGEON_GROUP_STRENGTH_KEY,
  // ⛓ region-graph-floors: the two-step values' floor gap.
  floorGap: FLOOR_GAP_KEY,
});
/** ⛓ region-graph-floors: do the floors (vertical links, the floor gap, the floor labels) apply to `grouping`? */
export const groupingUsesFloors = (grouping) => grouping === 'twoStep' || grouping === 'twoStepBoxes';
const DIRECTION_KEY_SET = new Set([...Object.values(DIRECTION_SETTING_KEYS), ...Object.values(GROUPING_SETTING_KEYS)]);
/**
 * Is `key` one of the Direction-aware layout's settings, its dungeon grouping's included (a write re-runs that layout
 * if it is the one drawn, never rebuilds the graph)?
 */
export const isDirectionSettingKey = (key) => DIRECTION_KEY_SET.has(key);

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
        ${pickerHTML()}
        <div id="layoutEditorContainer"></div>
        <details class="rg-direction-layout" style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #555;">
          <summary style="font-weight: bold; margin-bottom: 5px; cursor: pointer; user-select: none;">Direction-aware layout:</summary>
          <div style="margin: 0 0 4px 0; font-size: 11px; color: #aaa;">Places each neighbour on the side of the exit that leads to it, as near as it can.</div>
          <label style="display: block; margin: 3px 0;" title="${DIRECTION_STRENGTH_SCHEMA.description}">
            <span style="margin-right: 5px;">Strength:</span>
            <input type="range" id="directionStrength" min="${DIRECTION_STRENGTH_SCHEMA.minimum}" max="${DIRECTION_STRENGTH_SCHEMA.maximum}" step="0.05" value="${DIRECTION_STRENGTH_SCHEMA.default}" style="width: 90px; vertical-align: middle;">
            <span id="directionStrengthValue" style="font-size: 11px;">${DIRECTION_STRENGTH_SCHEMA.default}</span>
          </label>
          <label style="display: block; margin: 3px 0;" title="${DIRECTION_SPACING_SCHEMA.description}">
            <span style="margin-right: 5px;">Spacing (px):</span>
            <input type="number" id="directionSpacing" min="${DIRECTION_SPACING_SCHEMA.minimum}" max="${DIRECTION_SPACING_SCHEMA.maximum}" step="5" value="${DIRECTION_SPACING_SCHEMA.default}" style="width: 60px; padding: 2px;">
          </label>
          <label style="display: block; margin: 3px 0;" title="${DIRECTION_EXITS_SCHEMA.description}">
            <span style="margin-right: 5px;">Exits used:</span>
            <select id="directionExits" style="padding: 2px;">
              ${Object.entries(DIRECTION_EXITS_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
            </select>
          </label>
          <label style="display: block; margin: 3px 0;" title="${DUNGEON_GROUPING_SCHEMA.description}">
            <span style="margin-right: 5px;">Dungeon grouping:</span>
            <select id="dungeonGrouping" style="padding: 2px;">
              ${Object.entries(DUNGEON_GROUPING_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
            </select>
          </label>
          <label style="display: block; margin: 3px 0;" title="${DUNGEON_GROUP_STRENGTH_SCHEMA.description}">
            <span style="margin-right: 5px;">Dungeon pull:</span>
            <input type="range" id="dungeonGroupStrength" min="${DUNGEON_GROUP_STRENGTH_SCHEMA.minimum}" max="${DUNGEON_GROUP_STRENGTH_SCHEMA.maximum}" step="0.05" value="${DUNGEON_GROUP_STRENGTH_SCHEMA.default}" style="width: 90px; vertical-align: middle;">
            <span id="dungeonGroupStrengthValue" style="font-size: 11px;">${DUNGEON_GROUP_STRENGTH_SCHEMA.default}</span>
          </label>
          <label style="display: block; margin: 3px 0;" title="${FLOOR_GAP_SCHEMA.description}">
            <span style="margin-right: 5px;">Floor gap (px):</span>
            <input type="number" id="floorGap" min="${FLOOR_GAP_SCHEMA.minimum}" max="${FLOOR_GAP_SCHEMA.maximum}" step="10" value="${FLOOR_GAP_SCHEMA.default}" style="width: 60px; padding: 2px;">
          </label>
          <button id="runDirectionLayout" style="margin: 2px; padding: 4px 8px;">Run Direction-aware layout</button>
          <div id="directionLayoutStatus" style="margin: 2px 0; font-size: 11px; color: #aaa;"></div>
        </details>
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
        <details open class="rg-sub-regions" style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #555;">
          <summary style="font-weight: bold; margin-bottom: 5px; cursor: pointer; user-select: none;">Sub-regions:</summary>
          <label style="display: block; margin: 3px 0;">
            <span style="margin-right: 5px;">Draw as:</span>
            <select id="subRegionView" style="padding: 2px;">
              ${SUB_REGION_VIEW_SCHEMA.enum.map((v) => `<option value="${v}">${SUB_REGION_VIEW_LABELS[v] ?? v}</option>`).join('')}
            </select>
          </label>
          <label style="display: block; margin: 3px 0;">
            <span style="margin-right: 5px;">Node look:</span>
            <select id="nodeLook" style="padding: 2px;">
              ${NODE_LOOK_SCHEMA.enum.map((v) => `<option value="${v}">${NODE_LOOK_LABELS[v] ?? v}</option>`).join('')}
            </select>
          </label>
          <div id="nodeLookHint" style="display: none; margin: 0 0 3px 0; font-size: 11px; color: #aaa;">${NODE_LOOK_HINT}</div>
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
    setupNodePicker(this.ui);
  }

  async loadCheckboxSettings() {
    // Load checkbox states from settings. (The seven "On Region Node Click" boxes left in CA-S2: a click runs the
    // panel's click actions, set in the "On click" strip — `moduleSettings.regionGraph.clickActions`.)
    const checkboxes = [
      { id: '#forceHideEdgeLabels', setting: 'moduleSettings.regionGraph.forceHideEdgeLabels', default: true },
      { id: '#keepRegionSetsComplete', setting: 'moduleSettings.regionGraph.keepRegionSetsComplete', default: true },
      { id: '#onlyShowLocationsInView', setting: 'moduleSettings.regionGraph.onlyShowLocationsInView', default: false },
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
    // | force-hide). Default is 'hover'. (Previously migrated from retired
    // forceShowLocations / forceHideLocations checkbox keys; that migration
    // has been removed.)
    await this.loadLocationVisibilityMode();

    // Sync edge label visibility flag
    const forceHideEdgeLabelsEl = this.ui.controlPanel.querySelector('#forceHideEdgeLabels');
    this.ui.edgeLabelsHidden = !!forceHideEdgeLabelsEl?.checked;

    // ⛓ Sub-regions (region-graph-groups-a): the select writes the setting; the panel's settings:changed handler
    // reloads it and REBUILDS the graph (`RegionGraphUI` rebuilds on any moduleSettings.regionGraph.* write).
    const subRegionSelect = this.ui.controlPanel.querySelector('#subRegionView');
    if (subRegionSelect) {
      if (this.ui.subRegionView) subRegionSelect.value = this.ui.subRegionView;
      subRegionSelect.addEventListener('change', async (e) => {
        try {
          await settingsManager.updateSetting(SUB_REGION_VIEW_KEY, e.target.value);
        } catch (error) {
          logger.warn(`Failed to save setting ${SUB_REGION_VIEW_KEY}:`, error);
        }
      });
    }

    // ⛓ Node look (region-graph-map-look): the select writes the setting; the panel's settings:changed handler reloads
    // it and turns the map look on or off WITHOUT a rebuild. Disabled (with a hint) unless Draw as is merged.
    const nodeLookSelect = this.ui.controlPanel.querySelector('#nodeLook');
    if (nodeLookSelect) {
      syncNodeLookControl(this.ui);
      nodeLookSelect.addEventListener('change', async (e) => {
        try {
          await settingsManager.updateSetting(NODE_LOOK_KEY, e.target.value);
        } catch (error) {
          logger.warn(`Failed to save setting ${NODE_LOOK_KEY}:`, error);
        }
      });
    }

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

    // ⛓ region-graph-direction-layout: the three settings (schema defaults only) and the Run button.
    await this.loadDirectionSettings();
    this.setupDirectionControls();

    // Update discovery controls visibility based on current mode
    this.updateDiscoveryControlsVisibility();
  }

  /* ── ⛓ region-graph-direction-layout ─────────────────────────────────────────────────────────────────────────── */

  /** Read the Direction-aware settings into `ui.directionSettings` (no call-site default: the schema's is the only one). */
  async loadDirectionSettings() {
    const raw = {};
    for (const [field, key] of Object.entries(DIRECTION_SETTING_KEYS)) {
      try {
        raw[field] = await settingsManager.getSetting(key);
      } catch (error) {
        logger.warn(`Could not load ${key}; using the schema default:`, error);
      }
    }
    this.ui.directionSettings = normaliseDirectionSettings(raw);
    await this.loadGroupingSettings();
    this.syncDirectionControls();
    return this.ui.directionSettings;
  }

  /** ⛓ region-graph-dungeon-groups: read the grouping settings into `ui.groupingSettings` (schema defaults only). */
  async loadGroupingSettings() {
    const raw = {};
    for (const [field, key] of Object.entries(GROUPING_SETTING_KEYS)) {
      try {
        raw[field] = await settingsManager.getSetting(key);
      } catch (error) {
        logger.warn(`Could not load ${key}; using the schema default:`, error);
      }
    }
    this.ui.groupingSettings = { ...normaliseGroupingSettings(raw), floorGap: normaliseFloorGap(raw.floorGap) };
    return this.ui.groupingSettings;
  }

  /** Show `ui.directionSettings` in the controls. */
  syncDirectionControls() {
    const panel = this.ui.controlPanel;
    const s = this.ui.directionSettings ?? normaliseDirectionSettings();
    const strength = panel?.querySelector?.('#directionStrength');
    if (strength) strength.value = String(s.strength);
    const strengthValue = panel?.querySelector?.('#directionStrengthValue');
    if (strengthValue) strengthValue.textContent = String(s.strength);
    const spacing = panel?.querySelector?.('#directionSpacing');
    if (spacing) spacing.value = String(s.spacing);
    const exits = panel?.querySelector?.('#directionExits');
    if (exits) exits.value = s.exits;
    const g = this.ui.groupingSettings ?? normaliseGroupingSettings();
    const grouping = panel?.querySelector?.('#dungeonGrouping');
    if (grouping) grouping.value = g.grouping;
    const gs = panel?.querySelector?.('#dungeonGroupStrength');
    if (gs) gs.value = String(g.groupStrength);
    const gsValue = panel?.querySelector?.('#dungeonGroupStrengthValue');
    if (gsValue) gsValue.textContent = String(g.groupStrength);
    const fg = panel?.querySelector?.('#floorGap');
    if (fg) fg.value = String(g.floorGap ?? normaliseFloorGap());
  }

  /** The controls write the settings; the panel's settings:changed handler re-runs the layout if it is the one drawn. */
  setupDirectionControls() {
    const panel = this.ui.controlPanel;
    if (!panel?.querySelector || this._directionControlsBound) return;
    this._directionControlsBound = true;
    const save = async (key, value) => {
      try {
        await settingsManager.updateSetting(key, value);
      } catch (error) {
        logger.warn(`Failed to save setting ${key}:`, error);
      }
    };
    const strength = panel.querySelector('#directionStrength');
    strength?.addEventListener('input', (e) => {
      const v = panel.querySelector('#directionStrengthValue');
      if (v) v.textContent = String(e.target.value);
    });
    strength?.addEventListener('change', (e) => save(DIRECTION_STRENGTH_KEY, parseFloat(e.target.value)));
    panel.querySelector('#directionSpacing')?.addEventListener('change', (e) => save(DIRECTION_SPACING_KEY, parseFloat(e.target.value)));
    panel.querySelector('#directionExits')?.addEventListener('change', (e) => save(DIRECTION_EXITS_KEY, e.target.value));
    panel.querySelector('#dungeonGrouping')?.addEventListener('change', (e) => save(DUNGEON_GROUPING_KEY, e.target.value));
    const gs = panel.querySelector('#dungeonGroupStrength');
    gs?.addEventListener('input', (e) => {
      const v = panel.querySelector('#dungeonGroupStrengthValue');
      if (v) v.textContent = String(e.target.value);
    });
    gs?.addEventListener('change', (e) => save(DUNGEON_GROUP_STRENGTH_KEY, parseFloat(e.target.value)));
    panel.querySelector('#floorGap')?.addEventListener('change', (e) => save(FLOOR_GAP_KEY, parseFloat(e.target.value)));
    panel.querySelector('#runDirectionLayout')?.addEventListener('click', () => this.runDirectionLayout());
  }

  /** A Direction-aware setting changed: reload it, and re-run the layout if it is the one the graph shows. */
  async onDirectionSettingChanged() {
    await this.loadDirectionSettings();
    if (this.ui.currentLayoutPreset === DIRECTION_LAYOUT_PRESET && this.ui.cy && this.ui.graphInitialized) {
      this.runDirectionLayout();
    }
  }

  /**
   * The layout's inputs from the graph AS DRAWN → `{ nodes, edges, prefs, counts }`. Laid-out nodes: every node but the
   * player, location nodes and a `nested` box (a box is placed by its members; its members carry `group` = the box, so
   * they stay together). A node's size is its drawn size (`outerWidth` × `outerHeight`: the map look's rectangle in
   * merged + map, the ellipse's box elsewhere). A merged node stands for its `members`.
   */
  directionLayoutInputs(settings = this.ui.directionSettings ?? normaliseDirectionSettings()) {
    const cy = this.ui.cy;
    const laid = cy.nodes().filter((n) => !n.hasClass('player') && !n.hasClass('location-node') && !isRegionGroupNode(n, 'box'));
    const got = this.ui.mapLook?.regionMapModel?.() ?? null;
    // ⛓ region-graph-dungeon-groups: each node's dungeon = its DISPLAY region's Region Map group (`model.groupOf`).
    const dungeonOf = this.dungeonOfNode(got?.model ?? null);
    const ids = new Set();
    const nodes = [];
    laid.forEach((n) => {
      const w = n.outerWidth?.();
      const h = n.outerHeight?.();
      const parent = n.data('parent');
      const members = isRegionGroupNode(n, 'merged') ? (n.data('members') ?? []) : [n.data('regionName') ?? n.id()];
      ids.add(n.id());
      nodes.push({ id: n.id(), w: w > 0 ? w : 64, h: h > 0 ? h : 49, members, group: parent ?? null, dungeon: dungeonOf(n) });
    });
    const edges = [];
    cy.edges().forEach((e) => {
      const s = e.data('source');
      const t = e.data('target');
      if (ids.has(s) && ids.has(t) && s !== t) edges.push({ id: e.id(), source: s, target: t });
    });
    const sidecars = got?.rules?.preset_sidecars?.[got.playerId] ?? null;
    let directions = [];
    let counts = null;
    if (got?.model && sidecars) {
      ({ directions, counts } = exitDirections({ sidecars, model: got.model, tileOf: exitTileOf, exits: settings.exits }));
    }
    const prefs = edgePreferences(nodes, edges, directions);
    return { nodes, edges, prefs, counts, model: got?.model ?? null, sidecars };
  }

  /**
   * ⛓ region-graph-floors: the floors of the graph as drawn, over the Region Map `model` → `{ exits, counts, vertical:
   * Map<edgeId, {pref, exits}>, numbering, labels: Map<group, label> }` (`floors.js`). No model: no vertical link.
   */
  floorsOf(model, sidecars, nodes, edges) {
    const { exits, counts } = model && sidecars
      ? verticalExits({ sidecars, model, tileOf: exitTileOf })
      : { exits: [], counts: { vertical: 0, withDirection: 0, centre: 0, without: 0, inGroup: 0 } };
    const numbering = model ? floorNumbers(model) : { start: null, floorOf: new Map(), order: new Map(), unreached: [], conflicts: [], conflictGroups: 0 };
    return { exits, counts, vertical: verticalEdges(nodes, edges, exits), numbering, labels: floorLabels(numbering) };
  }

  /**
   * ⛓ region-graph-dungeon-groups: the dungeon reader for drawn nodes over a Region Map `model` → `(node) → group id |
   * null`. A merged / collapsed node by its `groupKey` (a display key); a region node (a sub-region in separate, a
   * nested / open box's member) by its rules region's display region. No model, or a node the model does not place
   * (the Menu node): null.
   */
  dungeonOfNode(model) {
    if (!model) return () => null;
    const r = dungeonReader(model);
    return (n) => {
      if (isRegionGroupNode(n, 'merged')) return r.ofKey(n.data('groupKey'));
      return r.ofRegion(n.data('regionName') ?? n.id());
    };
  }

  /**
   * Compute the Direction-aware positions for the graph as drawn → `{ options, report }`: `options` a Cytoscape
   * `preset` layout (animated, fit, as the other layouts), `report` the timing and the measures (in
   * `ui.lastDirectionLayout` too). Nodes it does not lay out keep their position (location nodes are re-seated by
   * the layoutstop handler, as after any layout).
   */
  buildDirectionLayout(settings = this.ui.directionSettings ?? normaliseDirectionSettings(),
    grouping = this.ui.groupingSettings ?? normaliseGroupingSettings(), { floorLinks = true } = {}) {
    const t0 = nowMs();
    const { nodes, edges, prefs, counts, model, sidecars } = this.directionLayoutInputs(settings);
    // ⛓ region-graph-floors: in the two-step values, an edge carrying a stair / pit between two groups is a FLOOR
    // link (`vertical`). `floorLinks: false` (the shots' "before" column only) leaves them unmarked: the two-step
    // layout exactly as region-graph-dungeon-groups built it.
    const usesFloors = groupingUsesFloors(grouping.grouping);
    const floors = usesFloors ? this.floorsOf(model, sidecars, nodes, edges) : null;
    const t1 = nowMs();
    const withPrefs = edges.map((e) => {
      const v = floors && floorLinks ? floors.vertical.get(e.id) : undefined;
      return v ? { ...e, pref: prefs.get(e.id), vertical: v } : { ...e, pref: prefs.get(e.id) };
    });
    // ⛓ region-graph-dungeon-groups: `none` is the very same `directionLayout` call as before (groupedDirectionLayout).
    const { positions, stats, blocks } = groupedDirectionLayout(nodes, withPrefs, { ...settings, ...grouping });
    const t2 = nowMs();
    const errors = angleErrors(edges, prefs, positions);
    const dungeons = dungeonsOf(nodes);
    const check = blocks ? blockCheck(nodes, positions, blockPad(settings.spacing)) : null;
    const report = {
      settings: { ...settings }, grouping: { ...grouping }, view: this.ui.subRegionView ?? null, nodeLook: this.ui.nodeLook ?? null,
      nodes: nodes.length, edges: edges.length, preferredEdges: prefs.size,
      inputsMs: t1 - t0, layoutMs: t2 - t1, totalMs: t2 - t0,
      overlaps: overlapCount(nodes, positions), meanAngleError: errors.mean, p90AngleError: errors.p90,
      dungeons: dungeons.filter((d) => d.dungeon != null).length,
      dungeonSizes: dungeons.filter((d) => d.dungeon != null).map((d) => d.members.length).sort((a, b) => b - a),
      ungrouped: dungeons.filter((d) => d.dungeon == null).length,
      mixing: mixingCount(nodes, positions),
      blockOverlaps: check ? check.blockOverlaps : null, intruders: check ? check.intruders : null,
      counts: counts ? { ...counts, twoOnOneSide: counts.twoOnOneSide.length, twoOnOneSideLevels: counts.twoOnOneSideLevels.length } : null,
      floors: floors ? floorReport(floors, nodes, edges, prefs, positions, floorLinks) : null,
      stats,
    };
    this.ui.lastDirectionLayout = report;
    return {
      report,
      positions,
      // ⛓ the boxes to draw (twoStepBoxes): each dungeon of 2+ drawn nodes, its label the group's id.
      boxes: groupingDrawsBoxes(grouping.grouping) && blocks
        ? dungeons.filter((d) => d.dungeon != null && d.members.length >= 2).map((d) => ({
          dungeon: d.dungeon,
          // ⛓ region-graph-floors: the FLOOR's label; the group's root level id stays in `root` (the box's tooltip).
          label: floors?.labels.get(d.dungeon) ?? String(d.dungeon),
          root: String(d.dungeon),
          members: d.members,
        }))
        : [],
      options: {
        name: 'preset',
        positions: (node) => positions.get(node.id()) ?? node.position(),
        animate: true,
        animationDuration: 1000,
        fit: true,
        padding: 50,
      },
    };
  }

  /**
   * Run the Direction-aware layout on the graph as drawn (positions saved when the run settles, as every layout's).
   * `animate: false` (the in-app row) places the nodes at once instead of over the 1 s animation.
   */
  runDirectionLayout({ animate = true } = {}) {
    if (!this.ui.cy) return null;
    const built = this.buildDirectionLayout();
    const { report } = built;
    const options = animate ? built.options : { ...built.options, animate: false };
    this.ui.currentLayoutPreset = DIRECTION_LAYOUT_PRESET;
    const select = this.ui.controlPanel?.querySelector?.('#layoutPreset');
    if (select) select.value = DIRECTION_LAYOUT_PRESET;
    const status = this.ui.controlPanel?.querySelector?.('#directionLayoutStatus');
    if (status) {
      const err = report.meanAngleError == null ? 'no exit directions in this world' : `mean direction error ${report.meanAngleError.toFixed(0)}°`;
      const mix = report.grouping.grouping === 'none' ? '' : `, ${report.mixing.mixed}/${report.mixing.eligible} nodes mixed`;
      status.textContent = `${report.nodes} nodes in ${Math.round(report.totalMs)} ms, ${report.overlaps} overlaps, ${err}${mix}`;
    }
    this.ui.updateStatus?.('Running Direction-aware layout...');
    // The player marker is a LOCKED node (no layout moves it): re-seat it on its region once the nodes have landed.
    startLayout(this.ui, options, {
      beforeSettle: () => {
        const region = this.ui.getCurrentPlayerLocation?.();
        if (region && this.ui.cy.getElementById('player').length) this.ui.updatePlayerLocation?.(region);
      },
    });
    // ⛓ region-graph-dungeon-groups: the boxes belong to THIS run (set after its `layoutstart`, which clears the old
    // ones); any later layout's start, or a rebuild, clears them. Empty unless grouping = twoStepBoxes.
    this.ui.dungeonBoxes?.show?.(built.boxes);
    report.boxes = built.boxes.length;
    return report;
  }

  /**
   * Read `moduleSettings.regionGraph.locationVisibility` into the UI and the
   * radio. Called on the first settings load and on every settings:changed
   * that may carry it, so a write through the settings API (not only a radio
   * click) takes effect. A built graph re-draws its location nodes at once.
   */
  async loadLocationVisibilityMode() {
    const mode = await settingsManager.getSetting(
      'moduleSettings.regionGraph.locationVisibility', 'hover');
    const changed = this.ui.locationVisibilityMode !== mode;
    this.ui.locationVisibilityMode = mode;
    const radio = this.ui.controlPanel?.querySelector(
      `input[name="locationVisibility"][value="${mode}"]`);
    if (radio) radio.checked = true;
    if (changed && this.ui.cy && this.ui.graphInitialized) {
      this.ui.dataManager.redrawLocationNodesForMode();
    }
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

    // ⛓ merged (region-graph-groups-b) lays out from, and saves to, its own store: `separate`'s is never read here.
    const store = this.positionStore();
    const savedPositions = !force && store.size > 0;

    if (savedPositions) {
      this.ui.cy.nodes().forEach(node => {
        const pos = store.get(node.id());
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
        this.ui.currentLayoutPreset = 'procgen-grid';
        logger.debug(`Applying procgen grid layout (${this.ui.gridLayout.size} regions)`);
        startLayout(this.ui, gridOptions);
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
    this.ui.currentLayoutPreset = selectedPreset;

    startLayout(this.ui, layoutOptions);
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

    // A group box is sized by its members and placed by them: it takes no grid cell. A merged group node
    // (subRegionView = merged) takes the mean of its members' cells.
    const nodes = this.ui.cy.nodes().filter(n => !n.hasClass('player') && !isRegionGroupNode(n, 'box'));
    const cellOf = (node) => {
      if (!isRegionGroupNode(node, 'merged')) return layout.get(node.id());
      const cells = (node.data('members') ?? []).map((m) => layout.get(m)).filter(Boolean);
      if (cells.length === 0) return null;
      return { gx: cells.reduce((a, c) => a + c.gx, 0) / cells.length, gy: cells.reduce((a, c) => a + c.gy, 0) / cells.length };
    };
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
        const cell = cellOf(node);
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
    // A group box has no depth of its own (its members do): it takes no row slot. A merged group node has its
    // shallowest member's depth, and takes one.
    const nodes = this.ui.cy.nodes().filter(n => !n.hasClass('player') && !isRegionGroupNode(n, 'box'));

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
    this.ui.cy.nodes().filter(n => !n.hasClass('hidden') && !n.hasClass('player') && !isRegionGroupNode(n, 'box')).forEach(node => {
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

  /**
   * The saved-position store for the view the graph draws: `separate` and `nested` share `ui.nodePositions` (region
   * positions); `merged` has its own, `ui.mergedNodePositions` (its group nodes and the regions drawn beside them), so
   * a `merged` layout never writes over `separate`'s saved one. ⛓ `collapsible` (region-graph-groups-c) has its own
   * too, `ui.collapsibleNodePositions` (closed group nodes, open members and the regions beside them). None is
   * persisted.
   */
  positionStore() {
    if (this.ui.subRegionView === 'collapsible') {
      if (!this.ui.collapsibleNodePositions) this.ui.collapsibleNodePositions = new Map();
      return this.ui.collapsibleNodePositions;
    }
    if (this.ui.subRegionView !== 'merged') return this.ui.nodePositions;
    if (!this.ui.mergedNodePositions) this.ui.mergedNodePositions = new Map();
    return this.ui.mergedNodePositions;
  }

  saveNodePositions() {
    if (this.ui.subRegionView === 'collapsible') {
      // ⛓ collapsible: every drawn node but an open group's box, location nodes and the player, into its own store.
      // Not cleared first: a closed group keeps its members' last arrangement for the next open.
      const store = this.positionStore();
      this.ui.cy.nodes().not('.location-node').filter((n) => !n.hasClass('player') && !isRegionGroupNode(n, 'box')).forEach((node) => {
        store.set(node.id(), { x: node.position('x'), y: node.position('y') });
      });
      return;
    }
    if (this.ui.subRegionView === 'merged') {
      // ⛓ merged: every drawn node but location nodes and the player, into merged's own store.
      const store = this.positionStore();
      store.clear();
      this.ui.cy.nodes().not('.location-node').filter((n) => !n.hasClass('player')).forEach((node) => {
        store.set(node.id(), { x: node.position('x'), y: node.position('y') });
      });
      return;
    }
    this.ui.nodePositions.clear();
    // Location nodes are drawn around their region, never laid out; saving
    // them would make the next rebuild's size check re-run the layout. A
    // group box (subRegionView = nested) is placed by its members: saving it
    // would leak a position no `separate` graph has.
    this.ui.cy.nodes().not('.location-node').filter(n => !isRegionGroupNode(n)).forEach(node => {
      this.ui.nodePositions.set(node.id(), {
        x: node.position('x'),
        y: node.position('y')
      });
    });
  }

  exportNodePositions() {
    const positions = {};
    this.ui.cy.nodes().filter(n => !isRegionGroupNode(n)).forEach(node => {
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
/**
 * ⛓ region-graph-floors: the floors' measures for a report: the counts, the numbering (numbered / unreached /
 * conflicts), and, at `positions`, the angle error of the FLAT edges (with a preference, no vertical link; split into
 * those inside one dungeon and those between two — a warp) and of the VERTICAL ones (their vertical direction), with
 * the flat and vertical mean centre-to-centre lengths.
 */
function floorReport(floors, nodes, edges, prefs, positions, floorLinks) {
  const flat = edges.filter((e) => !floors.vertical.has(e.id));
  const dungeonOf = new Map(nodes.map((n) => [String(n.id), n.dungeon ?? null]));
  const inside = (e) => dungeonOf.get(String(e.source)) != null && dungeonOf.get(String(e.source)) === dungeonOf.get(String(e.target));
  const fin = angleErrors(flat.filter(inside), prefs, positions);
  const fx = angleErrors(flat.filter((e) => !inside(e)), prefs, positions);
  const vert = edges.filter((e) => floors.vertical.has(e.id));
  const vprefs = new Map([...floors.vertical].filter(([, v]) => v.pref).map(([id, v]) => [id, v.pref]));
  const len = (list) => {
    let sum = 0; let n = 0;
    for (const e of list) {
      const a = positions.get(String(e.source)); const b = positions.get(String(e.target));
      if (!a || !b) continue;
      sum += Math.hypot(b.x - a.x, b.y - a.y); n += 1;
    }
    return n ? sum / n : null;
  };
  const fe = angleErrors(flat, prefs, positions);
  const ve = angleErrors(vert, vprefs, positions);
  const n = floors.numbering;
  return {
    floorLinks, counts: { ...floors.counts }, verticalEdges: vert.length, verticalEdgesWithDirection: vprefs.size,
    numbered: n.floorOf.size, unreached: n.unreached.length, conflicts: n.conflicts.length, conflictGroups: n.conflictGroups,
    floorRange: n.floorOf.size ? [Math.min(...n.floorOf.values()), Math.max(...n.floorOf.values())] : null,
    flatError: { mean: fe.mean, p90: fe.p90, n: fe.n }, verticalError: { mean: ve.mean, p90: ve.p90, n: ve.n },
    flatInsideError: { mean: fin.mean, p90: fin.p90, n: fin.n }, flatBetweenError: { mean: fx.mean, p90: fx.p90, n: fx.n },
    meanFlatLength: len(flat), meanVerticalLength: len(vert),
  };
}
