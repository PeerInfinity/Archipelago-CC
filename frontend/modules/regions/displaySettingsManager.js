// displaySettingsManager.js
import { createUniversalLogger } from '../../app/core/universalLogger.js';
import { DisplaySettingsBase } from '../shared/displaySettingsBase.js';

const logger = createUniversalLogger('regionUI:DisplaySettings');

// Cache shape + fallbacks for DisplaySettingsBase. Values MUST match the
// regions schema defaults in index.js (registerSettingsSchema) — the schema is
// the authoritative default source (schema-as-default-source); this table
// defines which keys the cache tracks and provides the no-schema fallback.
// useSubstitutedNames is the one exception (remapped to generalSettings.* via
// getSettingsKey, defaulted by the top-level schema).
const DEFAULTS = {
  // Cross-session display settings
  colorblindMode: false,
  useSubstitutedNames: true, // Special path: generalSettings.useSubstitutedNames

  // UI control settings (filter / layout / sort)
  showReachable: true,
  showUnreachable: true,
  showAll: false,
  showPaths: true,
  showEntrances: true,
  showExits: true,
  showLocations: true,
  showLogicTrees: true,
  // How the regions panel renders undiscovered content. Doesn't
  // affect the discovery DATA (that's owned by the discovery
  // module's own settings) — purely a per-panel display toggle.
  showUndiscovered: true,
  sectionOrder: 'entrances-exits-locations',
  sortMethod: 'original',
};

/**
 * DisplaySettingsManager (regions panel)
 *
 * Subclass of DisplaySettingsBase. Provides:
 *   - the regions-specific defaults table
 *   - syncFromUI / syncToUI bindings to regions-panel DOM IDs
 *   - getSettingsKey override for `useSubstitutedNames` (lives at
 *     generalSettings.useSubstitutedNames, not under moduleSettings.regions)
 *   - getRegionDisplayElements helper (used by the renderer)
 */
export class DisplaySettingsManager extends DisplaySettingsBase {
  constructor(settingsManager, rootElement) {
    super({
      moduleId: 'regions',
      settingsManager,
      rootElement,
      defaults: DEFAULTS,
    });
  }

  /**
   * Override for the one cross-module setting (useSubstitutedNames
   * is shared with other panels; its canonical home is
   * generalSettings.useSubstitutedNames, not moduleSettings.regions.*).
   */
  getSettingsKey(key) {
    if (key === 'useSubstitutedNames') return 'generalSettings.useSubstitutedNames';
    return super.getSettingsKey(key);
  }

  syncFromUI() {
    if (!this.rootElement) {
      logger.warn('Cannot sync from UI: rootElement not available');
      return;
    }
    const root = this.rootElement;
    // Checkboxes
    this.settings.showReachable    = root.querySelector('#region-show-reachable')?.checked    ?? this.settings.showReachable;
    this.settings.showUnreachable  = root.querySelector('#region-show-unreachable')?.checked  ?? this.settings.showUnreachable;
    this.settings.showAll          = root.querySelector('#show-all-regions')?.checked         ?? this.settings.showAll;
    this.settings.showPaths        = root.querySelector('#show-paths')?.checked               ?? this.settings.showPaths;
    this.settings.showEntrances    = root.querySelector('#show-entrances')?.checked           ?? this.settings.showEntrances;
    this.settings.showExits        = root.querySelector('#show-exits')?.checked               ?? this.settings.showExits;
    this.settings.showLocations    = root.querySelector('#show-locations')?.checked           ?? this.settings.showLocations;
    this.settings.showLogicTrees   = root.querySelector('#show-logic-trees')?.checked         ?? this.settings.showLogicTrees;
    this.settings.showUndiscovered = root.querySelector('#region-show-undiscovered')?.checked ?? this.settings.showUndiscovered;
    // Selects
    this.settings.sectionOrder     = root.querySelector('#section-order-select')?.value       ?? this.settings.sectionOrder;
    this.settings.sortMethod       = root.querySelector('#region-sort-select')?.value         ?? this.settings.sortMethod;
    logger.debug('Settings synced from UI');
  }

  syncToUI() {
    if (!this.rootElement) {
      logger.warn('Cannot sync to UI: rootElement not available');
      return;
    }
    const root = this.rootElement;
    const setChecked = (sel, value) => {
      const el = root.querySelector(sel);
      if (el) el.checked = value;
    };
    const setValue = (sel, value) => {
      const el = root.querySelector(sel);
      if (el) el.value = value;
    };
    setChecked('#region-show-reachable',    this.settings.showReachable);
    setChecked('#region-show-unreachable',  this.settings.showUnreachable);
    setChecked('#show-all-regions',         this.settings.showAll);
    setChecked('#show-paths',               this.settings.showPaths);
    setChecked('#show-entrances',           this.settings.showEntrances);
    setChecked('#show-exits',               this.settings.showExits);
    setChecked('#show-locations',           this.settings.showLocations);
    setChecked('#show-logic-trees',         this.settings.showLogicTrees);
    setChecked('#region-show-undiscovered', this.settings.showUndiscovered);
    setValue  ('#section-order-select',     this.settings.sectionOrder);
    setValue  ('#region-sort-select',       this.settings.sortMethod);
    logger.debug('Settings synced to UI');
  }

  /**
   * Get display elements for a region based on current settings.
   * Used by the regions panel renderer to assemble each block's
   * label row.
   *
   * @param {Object|string} regionData - Region data object or region name string
   * @returns {Array} Array of display elements: [{type, text}, ...]
   */
  getRegionDisplayElements(regionData) {
    const rawName = typeof regionData === 'string' ? regionData : (regionData.name || 'Unknown');
    const name = (this.settings.useSubstitutedNames && regionData.displayName)
      ? regionData.displayName
      : rawName;
    return [{ type: 'name', text: name }];
  }
}

export default DisplaySettingsManager;
