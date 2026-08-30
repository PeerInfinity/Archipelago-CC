/**
 * Cost Data Manager for Loop Mode
 *
 * Manages loading, caching, and access to cost data files.
 * Cost data contains per-region and per-location mana costs used by the
 * queue analyzer and loop simulation.
 *
 * Cost data can be:
 * - Generated from sphere logs using CostGenerator
 * - Loaded from pre-generated JSON files
 * - Cached in memory for performance
 */

import { createUniversalLogger } from '../../app/core/universalLogger.js';
import {
  DEFAULT_REGION_XP_EFFECT,
  normalizeRegionXpEffect,
} from './xpFormulas.js';
// The generated-sidecar vocabulary is owned by the generator (a pure
// module), so reader and writer share one default and cannot drift.
import { DEFAULT_TIME_DRAIN_PER_SECOND } from '../shared/procgen/loopCostGenerator.js';

export { DEFAULT_TIME_DRAIN_PER_SECOND };

const logger = createUniversalLogger('costDataManager');

/**
 * Returns true when the source string looks like a URL or filesystem
 * path that fetch() can resolve. Filters out synthetic source names
 * the rest of the app uses for in-memory loads (procgenPipeline,
 * editorApply, moduleSpecificConfigProvidedRules, hardcodedFallback:*).
 * @param {string} src
 */
function _looksLikeRulesPath(src) {
    if (typeof src !== 'string' || src.length === 0) return false;
    if (src.startsWith('hardcodedFallback:')) return false;
    if (src === 'procgenPipeline' || src === 'editorApply'
        || src === 'moduleSpecificConfigProvidedRules') return false;
    // Real paths contain a slash or end in .json; the synthetic names
    // pass through both filters above so this is the inclusive case.
    return src.includes('/') || src.endsWith('.json');
}

/**
 * CostDataManager class
 * Loads and manages cost data for loop mode
 */
export class CostDataManager {
  constructor(eventBus = null) {
    this.eventBus = eventBus;

    // Currently loaded cost data
    this.costData = null;

    // Metadata about loaded data
    this.loadedFrom = null;
    this.loadedAt = null;

    // Loading state
    this.isLoading = false;
    this.loadError = null;
  }

  /**
   * Load cost data from a URL
   * @param {string} url - URL to load cost data from
   * @returns {Object|null} Loaded cost data or null on failure
   */
  async loadFromUrl(url) {
    if (this.isLoading) {
      logger.warn('Load already in progress');
      return null;
    }

    this.isLoading = true;
    this.loadError = null;

    try {
      logger.info(`Loading cost data from: ${url}`);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Validate the data structure
      if (!this._validateCostData(data)) {
        throw new Error('Invalid cost data structure');
      }

      this.costData = data;
      this.loadedFrom = url;
      this.loadedAt = new Date().toISOString();

      logger.info(`Cost data loaded: ${Object.keys(data.regions || {}).length} regions, ${Object.keys(data.locations || {}).length} locations`);

      this.eventBus?.publish('costDataManager:loaded', {
        source: url,
        regionCount: Object.keys(data.regions || {}).length,
        locationCount: Object.keys(data.locations || {}).length,
      });

      return data;
    } catch (error) {
      logger.error(`Failed to load cost data: ${error.message}`);
      this.loadError = error.message;

      this.eventBus?.publish('costDataManager:loadError', {
        source: url,
        error: error.message,
      });

      return null;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Load cost data from a File object (e.g., from file input)
   * @param {File} file - File to load
   * @returns {Object|null} Loaded cost data or null on failure
   */
  async loadFromFile(file) {
    if (this.isLoading) {
      logger.warn('Load already in progress');
      return null;
    }

    this.isLoading = true;
    this.loadError = null;

    try {
      logger.info(`Loading cost data from file: ${file.name}`);

      const text = await file.text();
      const data = JSON.parse(text);

      // Validate the data structure
      if (!this._validateCostData(data)) {
        throw new Error('Invalid cost data structure');
      }

      this.costData = data;
      this.loadedFrom = `file:${file.name}`;
      this.loadedAt = new Date().toISOString();

      logger.info(`Cost data loaded from file: ${Object.keys(data.regions || {}).length} regions, ${Object.keys(data.locations || {}).length} locations`);

      this.eventBus?.publish('costDataManager:loaded', {
        source: file.name,
        regionCount: Object.keys(data.regions || {}).length,
        locationCount: Object.keys(data.locations || {}).length,
      });

      return data;
    } catch (error) {
      logger.error(`Failed to load cost data from file: ${error.message}`);
      this.loadError = error.message;

      this.eventBus?.publish('costDataManager:loadError', {
        source: file.name,
        error: error.message,
      });

      return null;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Apply a loop_costs object directly (e.g., from in-memory jsonData).
   * Wraps setCostData with the embedded-source naming convention and
   * the pipeline-error skip rule.
   *
   * @param {Object} embedded - loop_costs object from rules.json
   * @param {string} sourceLabel - human label for logging (e.g., 'procgenPipeline')
   * @returns {boolean} true on success
   */
  applyEmbeddedLoopCosts(embedded, sourceLabel = 'embedded') {
    if (!embedded || typeof embedded !== 'object') return false;
    if (embedded.error) {
      logger.warn(`Embedded loop_costs has error field, skipping: ${embedded.error}`);
      return false;
    }
    const ok = this.setCostData(embedded, `embedded:${sourceLabel}`);
    if (ok) {
      logger.info(`Loaded embedded loop_costs from ${sourceLabel} (${Object.keys(embedded.regions || {}).length} regions, ${Object.keys(embedded.locations || {}).length} locations).`);
    }
    return ok;
  }

  /**
   * Try to load loop_costs embedded in a rules.json document by URL.
   * Mirrors the pattern sphereState uses for embedded sphere_log:
   * refetches the rules.json (browser-cache friendly) and applies any
   * loop_costs field via setCostData.
   *
   * Skips synthetic source names (procgenPipeline, editorApply, etc.)
   * — those don't resolve as URLs. Use applyEmbeddedLoopCosts directly
   * with the in-memory jsonData for those flows.
   *
   * @param {string} rulesPath - URL/path to the rules.json
   * @returns {Promise<boolean>} true if embedded loop_costs were found and loaded
   */
  async tryLoadEmbedded(rulesPath) {
    if (!rulesPath || typeof fetch !== 'function') return false;
    if (!_looksLikeRulesPath(rulesPath)) return false;
    try {
      const response = await fetch(rulesPath);
      if (!response.ok) return false;
      const rulesDoc = await response.json();
      return this.applyEmbeddedLoopCosts(rulesDoc?.loop_costs, rulesPath);
    } catch (err) {
      logger.warn(`Could not load embedded loop_costs from ${rulesPath}: ${err.message}`);
      return false;
    }
  }

  /**
   * Set cost data directly (e.g., from cost generator)
   * @param {Object} data - Cost data object
   * @param {string} source - Source description
   */
  setCostData(data, source = 'generated') {
    if (!this._validateCostData(data)) {
      logger.error('Invalid cost data structure provided to setCostData');
      return false;
    }

    this.costData = data;
    this.loadedFrom = source;
    this.loadedAt = new Date().toISOString();

    logger.info(`Cost data set from ${source}: ${Object.keys(data.regions || {}).length} regions, ${Object.keys(data.locations || {}).length} locations`);

    this.eventBus?.publish('costDataManager:loaded', {
      source,
      regionCount: Object.keys(data.regions || {}).length,
      locationCount: Object.keys(data.locations || {}).length,
    });

    return true;
  }

  /**
   * Validate cost data structure
   * @param {Object} data - Data to validate
   * @returns {boolean} True if valid
   */
  _validateCostData(data) {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // Must have regions object
    if (!data.regions || typeof data.regions !== 'object') {
      logger.warn('Cost data missing regions object');
      return false;
    }

    // Must have locations object
    if (!data.locations || typeof data.locations !== 'object') {
      logger.warn('Cost data missing locations object');
      return false;
    }

    return true;
  }

  /**
   * Get cost for a region
   * @param {string} regionName - Name of the region
   * @returns {number} Move cost for the region
   */
  getRegionCost(regionName) {
    if (!this.costData) {
      return this.getDefaultRegionCost();
    }

    const regionData = this.costData.regions[regionName];
    if (regionData && typeof regionData.moveCost === 'number') {
      return regionData.moveCost;
    }

    return this.costData.defaultRegionCost || 50;
  }

  /**
   * Region XP effect mode for the named region. Read from the per-region
   * `xpEffect` field in the loop_costs sidecar; falls back to
   * `defaultRegionXpEffect` (sidecar-level) and finally to `DEFAULT_REGION_XP_EFFECT`
   * ('cost') when neither is set.
   *
   * @param {string} regionName
   * @returns {'cost'|'speed'|'both'|'none'}
   */
  getRegionXpEffect(regionName) {
    if (!this.costData) return DEFAULT_REGION_XP_EFFECT;
    const regionData = this.costData.regions?.[regionName];
    if (regionData && typeof regionData.xpEffect === 'string') {
      return normalizeRegionXpEffect(regionData.xpEffect);
    }
    if (typeof this.costData.defaultRegionXpEffect === 'string') {
      return normalizeRegionXpEffect(this.costData.defaultRegionXpEffect);
    }
    return DEFAULT_REGION_XP_EFFECT;
  }

  /**
   * Get cost for a location
   * @param {string} locationName - Name of the location
   * @returns {number} Cost for checking the location
   */
  getLocationCost(locationName) {
    if (!this.costData) {
      return this.getDefaultLocationCost();
    }

    const locationCost = this.costData.locations[locationName];
    if (typeof locationCost === 'number') {
      return locationCost;
    }

    return this.costData.defaultLocationCost || 100;
  }

  /**
   * The EXPLICIT per-region move cost, or null when the sidecar states
   * none (M5). Distinct from `getRegionCost`, which always answers with a
   * number by falling back to `defaultRegionCost` / 50.
   *
   * SUMMARY substrates (runner, bounce) are priced by TIME, not per action:
   * their actions cost mana only where the loop_costs data says so
   * explicitly (user ruling 2026-07-23). A sidecar-level default is a
   * fallback for regions the data didn't mention — exactly the case this
   * must answer "free" for — so it deliberately does NOT count as explicit.
   *
   * @param {string} regionName
   * @returns {number|null}
   */
  getExplicitRegionCost(regionName) {
    const regionData = this.costData?.regions?.[regionName];
    return (regionData && typeof regionData.moveCost === 'number')
      ? regionData.moveCost
      : null;
  }

  /**
   * The EXPLICIT per-location check cost, or null when the sidecar states
   * none (M5). See getExplicitRegionCost for why the sidecar-level default
   * is not consulted.
   *
   * @param {string} locationName
   * @returns {number|null}
   */
  getExplicitLocationCost(locationName) {
    const cost = this.costData?.locations?.[locationName];
    return typeof cost === 'number' ? cost : null;
  }

  /**
   * Mana drained per second of live play in this region (M5) — the summary
   * substrates' whole default economy: their visits are priced by how long
   * they take, not by what they do. Per-region, with a sidecar-level
   * default and a final fallback of 1/s.
   *
   * The value is a BASE cost: callers scale it by region XP through
   * `applyRegionXpCostEffect`, exactly like every other cost.
   *
   * @param {string} regionName
   * @returns {number} mana per second (>= 0)
   */
  getTimeDrainPerSecond(regionName) {
    const regionData = this.costData?.regions?.[regionName];
    if (regionData && typeof regionData.timeDrainPerSecond === 'number') {
      return Math.max(0, regionData.timeDrainPerSecond);
    }
    if (typeof this.costData?.defaultTimeDrainPerSecond === 'number') {
      return Math.max(0, this.costData.defaultTimeDrainPerSecond);
    }
    return DEFAULT_TIME_DRAIN_PER_SECOND;
  }

  /**
   * Get default region cost
   * @returns {number} Default region move cost
   */
  getDefaultRegionCost() {
    return this.costData?.defaultRegionCost || 50;
  }

  /**
   * Get default location cost
   * @returns {number} Default location check cost
   */
  getDefaultLocationCost() {
    return this.costData?.defaultLocationCost || 100;
  }

  /**
   * Check if cost data is loaded
   * @returns {boolean} True if data is loaded
   */
  isLoaded() {
    return this.costData !== null;
  }

  /**
   * Get all loaded cost data
   * @returns {Object|null} Cost data or null if not loaded
   */
  getCostData() {
    return this.costData;
  }

  /**
   * Get loading status
   * @returns {Object} Loading status info
   */
  getStatus() {
    return {
      isLoaded: this.isLoaded(),
      isLoading: this.isLoading,
      loadedFrom: this.loadedFrom,
      loadedAt: this.loadedAt,
      loadError: this.loadError,
      regionCount: this.costData ? Object.keys(this.costData.regions).length : 0,
      locationCount: this.costData ? Object.keys(this.costData.locations).length : 0,
    };
  }

  /**
   * Clear loaded cost data
   */
  clear() {
    this.costData = null;
    this.loadedFrom = null;
    this.loadedAt = null;
    this.loadError = null;

    logger.info('Cost data cleared');

    this.eventBus?.publish('costDataManager:cleared', {});
  }

  /**
   * Export cost data to JSON string
   * @returns {string|null} JSON string or null if no data
   */
  exportToJSON() {
    if (!this.costData) {
      return null;
    }
    return JSON.stringify(this.costData, null, 2);
  }

  /**
   * Download cost data as a file
   * @param {string} filename - Name for the downloaded file
   */
  downloadCostData(filename = 'costs.json') {
    const json = this.exportToJSON();
    if (!json) {
      logger.warn('No cost data to download');
      return;
    }

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);

    logger.info(`Cost data downloaded as ${filename}`);
  }

  /**
   * Derive the costs file path from a rules file path
   * @param {string} rulesPath - Path to the rules.json file
   * @returns {string} Path to the corresponding costs.json file
   */
  getCostsPathFromRulesPath(rulesPath) {
    // Rules path: presets/game/AP_SEED/AP_SEED_rules.json
    // Costs path: presets/game/AP_SEED/AP_SEED_costs.json
    return rulesPath.replace('_rules.json', '_costs.json');
  }

  /**
   * Try to load existing costs from the preset directory
   * @param {string} rulesPath - Path to the rules.json file
   * @returns {Object|null} Loaded cost data or null if not found
   */
  async tryLoadFromPreset(rulesPath) {
    const costsPath = this.getCostsPathFromRulesPath(rulesPath);

    try {
      logger.info(`Checking for existing costs file: ${costsPath}`);
      const response = await fetch(costsPath);

      if (response.ok) {
        const data = await response.json();
        if (this._validateCostData(data)) {
          this.costData = data;
          this.loadedFrom = costsPath;
          this.loadedAt = new Date().toISOString();

          logger.info(`Loaded existing costs: ${Object.keys(data.regions || {}).length} regions, ${Object.keys(data.locations || {}).length} locations`);

          this.eventBus?.publish('costDataManager:loaded', {
            source: costsPath,
            regionCount: Object.keys(data.regions || {}).length,
            locationCount: Object.keys(data.locations || {}).length,
            fromExisting: true,
          });

          return data;
        }
      }

      logger.info(`No existing costs file found at ${costsPath}`);
      return null;
    } catch (error) {
      logger.debug(`Could not load costs from ${costsPath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Save cost data to a file path (for use in Node.js/test environments)
   * In browser context, this triggers a download with the appropriate filename
   * @param {string} rulesPath - Path to the rules.json file (used to derive costs path)
   * @returns {string} The path where costs should be saved
   */
  saveCostsToPreset(rulesPath) {
    const costsPath = this.getCostsPathFromRulesPath(rulesPath);
    const filename = costsPath.split('/').pop();

    // In browser context, trigger download with the correct filename
    this.downloadCostData(filename);

    logger.info(`Cost data should be saved to: ${costsPath}`);
    return costsPath;
  }

  /**
   * Get cost data as a JSON string for external saving
   * @returns {Object} Object with path and content for saving
   */
  getCostDataForSaving(rulesPath) {
    const costsPath = this.getCostsPathFromRulesPath(rulesPath);
    return {
      path: costsPath,
      content: this.exportToJSON(),
      filename: costsPath.split('/').pop(),
    };
  }
}

export default CostDataManager;
