/**
 * Universal Tracker Comparison Module
 *
 * Provides UI and logic for comparing Python-generated sphere logs with
 * Universal Tracker sphere logs to verify UT correctly tracks game logic.
 *
 * This module integrates with the testSpoilers panel to add UT comparison
 * functionality.
 *
 * @module utComparison
 */

import {
  parseSphereLogWithMetadata,
  extractEventFiltersFromMetadata,
  compareSphereLogs,
  findFirstMismatch,
  formatComparisonSummary
} from './lib/sphereLogComparison.js';
import { createUniversalLogger } from '../../app/core/universalLogger.js';

const logger = createUniversalLogger('utComparison');

/**
 * UT Comparison controller class.
 * Manages loading and comparing Python and UT sphere logs.
 */
export class UTComparison {
  constructor(logCallback) {
    this.logCallback = logCallback || ((type, msg) => console.log(`[${type}] ${msg}`));

    // Loaded sphere logs
    this.pythonLog = null;
    this.pythonMetadata = null;
    this.utLog = null;
    this.utMetadata = null;

    // Comparison results
    this.comparisonResult = null;

    // Options
    this.autoIgnoreEvents = true;
  }

  /**
   * Log a message using the provided callback.
   * @param {string} type - Log type (info, warn, error, success)
   * @param {string} message - Message to log
   */
  log(type, message) {
    this.logCallback(type, message);
  }

  /**
   * Load a sphere log from file content.
   * @param {string} content - JSONL file content
   * @param {string} logType - 'python' or 'ut'
   * @returns {boolean} True if loaded successfully
   */
  loadFromContent(content, logType) {
    try {
      const result = parseSphereLogWithMetadata(content);

      if (logType === 'python') {
        this.pythonLog = result.entries;
        this.pythonMetadata = result.metadata;
        this.log('info', `Loaded Python sphere log: ${result.entries.length} entries`);
        if (result.metadata) {
          const eventLocs = result.metadata.event_locations ?
            Object.values(result.metadata.event_locations).flat().length : 0;
          const eventItems = result.metadata.event_items ?
            Object.values(result.metadata.event_items).flat().length : 0;
          if (eventLocs > 0 || eventItems > 0) {
            this.log('info', `  Event locations: ${eventLocs}, Event items: ${eventItems}`);
          }
        }
      } else if (logType === 'ut') {
        this.utLog = result.entries;
        this.utMetadata = result.metadata;
        this.log('info', `Loaded UT sphere log: ${result.entries.length} entries`);
      }

      return true;
    } catch (error) {
      this.log('error', `Failed to parse ${logType} sphere log: ${error.message}`);
      return false;
    }
  }

  /**
   * Load a sphere log from a URL (fetch).
   * @param {string} url - URL to fetch
   * @param {string} logType - 'python' or 'ut'
   * @returns {Promise<boolean>} True if loaded successfully
   */
  async loadFromUrl(url, logType) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const content = await response.text();
      return this.loadFromContent(content, logType);
    } catch (error) {
      this.log('error', `Failed to fetch ${logType} log from ${url}: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if both logs are loaded and ready for comparison.
   * @returns {boolean} True if ready to compare
   */
  isReadyToCompare() {
    return this.pythonLog !== null && this.utLog !== null;
  }

  /**
   * Run the comparison between loaded Python and UT logs.
   * @returns {Object|null} Comparison result, or null if not ready
   */
  runComparison() {
    if (!this.isReadyToCompare()) {
      this.log('warn', 'Cannot compare: both logs must be loaded first');
      return null;
    }

    this.log('info', 'Running UT comparison...');

    // Build comparison options
    const options = {};

    if (this.autoIgnoreEvents && this.pythonMetadata) {
      const eventFilters = extractEventFiltersFromMetadata(this.pythonMetadata);
      if (eventFilters.ignoreLocations.size > 0) {
        options.ignoreLocations = eventFilters.ignoreLocations;
        this.log('info', `Auto-ignoring ${eventFilters.ignoreLocations.size} event locations`);
      }
      if (eventFilters.ignoreItems.size > 0) {
        options.ignoreItems = eventFilters.ignoreItems;
        this.log('info', `Auto-ignoring ${eventFilters.ignoreItems.size} event items`);
      }
    }

    // Run comparison
    this.comparisonResult = compareSphereLogs(this.pythonLog, this.utLog, options);

    // Log summary
    const summary = this.comparisonResult.summary;
    this.log('info', `Comparison complete: ${summary.matched_entries}/${summary.python_entries} spheres match`);

    if (this.comparisonResult.all_match) {
      this.log('success', 'ALL SPHERES MATCH');
    } else {
      this.log('error', `MISMATCHES FOUND: ${summary.mismatched_entries} spheres differ`);

      // Log first mismatch details
      const firstMismatch = findFirstMismatch(this.pythonLog, this.utLog, options);
      if (firstMismatch) {
        this.logMismatchDetails(firstMismatch);
      }
    }

    return this.comparisonResult;
  }

  /**
   * Log details of a mismatch.
   * @param {Object} mismatch - Mismatch object from comparison
   */
  logMismatchDetails(mismatch) {
    this.log('warn', `First mismatch at sphere ${mismatch.sphere_index} (${mismatch.status}):`);

    if (mismatch.status === 'missing_in_ut') {
      this.log('warn', '  Sphere exists in Python log but not in UT log');
      return;
    }

    if (mismatch.status === 'extra_in_ut') {
      this.log('warn', '  Sphere exists in UT log but not in Python log');
      return;
    }

    if (mismatch.players) {
      for (const [playerId, playerData] of Object.entries(mismatch.players)) {
        if (!playerData.match) {
          this.log('warn', `  Player ${playerId}:`);

          // Locations
          if (!playerData.accessible_locations.match) {
            const loc = playerData.accessible_locations;
            if (loc.missing.length > 0) {
              this.log('mismatch', `    Locations missing in UT: ${loc.missing.join(', ')}`);
            }
            if (loc.extra.length > 0) {
              this.log('mismatch', `    Locations extra in UT: ${loc.extra.join(', ')}`);
            }
          }

          // Regions
          if (!playerData.accessible_regions.match) {
            const reg = playerData.accessible_regions;
            if (reg.missing.length > 0) {
              this.log('mismatch', `    Regions missing in UT: ${reg.missing.join(', ')}`);
            }
            if (reg.extra.length > 0) {
              this.log('mismatch', `    Regions extra in UT: ${reg.extra.join(', ')}`);
            }
          }

          // Inventory
          if (!playerData.inventory.match) {
            this.logInventoryMismatch(playerData.inventory);
          }
        }
      }
    }
  }

  /**
   * Log inventory mismatch details.
   * @param {Object} inventory - Inventory diff object
   */
  logInventoryMismatch(inventory) {
    // Base items
    if (Object.keys(inventory.base_items.missing).length > 0) {
      const items = Object.entries(inventory.base_items.missing).map(([k, v]) => `${k}(${v})`);
      this.log('mismatch', `    Base items missing in UT: ${items.join(', ')}`);
    }
    if (Object.keys(inventory.base_items.extra).length > 0) {
      const items = Object.entries(inventory.base_items.extra).map(([k, v]) => `${k}(${v})`);
      this.log('mismatch', `    Base items extra in UT: ${items.join(', ')}`);
    }
    if (Object.keys(inventory.base_items.mismatch).length > 0) {
      const items = Object.entries(inventory.base_items.mismatch).map(([k, v]) =>
        `${k}(expected:${v.expected}, actual:${v.actual})`);
      this.log('mismatch', `    Base items count mismatch: ${items.join(', ')}`);
    }

    // Resolved items
    if (Object.keys(inventory.resolved_items.missing).length > 0) {
      const items = Object.entries(inventory.resolved_items.missing).map(([k, v]) => `${k}(${v})`);
      this.log('mismatch', `    Resolved items missing in UT: ${items.join(', ')}`);
    }
    if (Object.keys(inventory.resolved_items.extra).length > 0) {
      const items = Object.entries(inventory.resolved_items.extra).map(([k, v]) => `${k}(${v})`);
      this.log('mismatch', `    Resolved items extra in UT: ${items.join(', ')}`);
    }
    if (Object.keys(inventory.resolved_items.mismatch).length > 0) {
      const items = Object.entries(inventory.resolved_items.mismatch).map(([k, v]) =>
        `${k}(expected:${v.expected}, actual:${v.actual})`);
      this.log('mismatch', `    Resolved items count mismatch: ${items.join(', ')}`);
    }
  }

  /**
   * Get comparison statistics.
   * @returns {Object|null} Statistics object
   */
  getStatistics() {
    if (!this.comparisonResult) {
      return null;
    }

    const summary = this.comparisonResult.summary;
    const total = summary.python_entries;
    const matched = summary.matched_entries;
    const matchPercentage = total > 0 ? ((matched / total) * 100).toFixed(1) : 0;

    return {
      total_spheres: total,
      matched_spheres: matched,
      mismatched_spheres: summary.mismatched_entries,
      missing_in_ut: summary.missing_in_ut,
      extra_in_ut: summary.extra_in_ut,
      match_percentage: matchPercentage,
      all_match: this.comparisonResult.all_match
    };
  }

  /**
   * Clear all loaded data and results.
   */
  clear() {
    this.pythonLog = null;
    this.pythonMetadata = null;
    this.utLog = null;
    this.utMetadata = null;
    this.comparisonResult = null;
  }

  /**
   * Set whether to auto-ignore event locations/items.
   * @param {boolean} enabled - Enable auto-ignore
   */
  setAutoIgnoreEvents(enabled) {
    this.autoIgnoreEvents = enabled;
  }
}

/**
 * Derive the UT sphere log path from a Python sphere log path.
 * @param {string} pythonLogPath - Path to Python sphere log
 * @returns {string} Path to UT sphere log
 */
export function deriveUtLogPath(pythonLogPath) {
  // Replace _sphere_log.jsonl with _sphere_log_ut.jsonl
  if (pythonLogPath.endsWith('_sphere_log.jsonl')) {
    return pythonLogPath.replace('_sphere_log.jsonl', '_sphere_log_ut.jsonl');
  }
  // Fallback: insert _ut before .jsonl
  if (pythonLogPath.endsWith('.jsonl')) {
    return pythonLogPath.replace('.jsonl', '_ut.jsonl');
  }
  return pythonLogPath + '_ut';
}

/**
 * Derive the base URL for fetching logs based on the Python log path.
 * @param {string} pythonLogPath - Path to Python sphere log (e.g., "AP_xxx_sphere_log.jsonl")
 * @param {string} activeRulesetName - Active ruleset path (e.g., "presets/adventure/AP_xxx/AP_xxx_P1_Player1_rules.json")
 * @returns {string|null} Base URL for fetching logs, or null if cannot be derived
 */
export function deriveLogBaseUrl(pythonLogPath, activeRulesetName) {
  if (!activeRulesetName) return null;

  // Extract directory from ruleset path
  // e.g., "presets/adventure/AP_xxx/AP_xxx_P1_Player1_rules.json" -> "presets/adventure/AP_xxx/"
  const lastSlash = activeRulesetName.lastIndexOf('/');
  if (lastSlash === -1) return null;

  const baseDir = activeRulesetName.substring(0, lastSlash + 1);
  return baseDir;
}

export default UTComparison;
