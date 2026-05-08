// expansionStateManager.js
import { createUniversalLogger } from '../../app/core/universalLogger.js';

const logger = createUniversalLogger('loopUI:ExpansionState');

/**
 * Build the composite key used to store expansion state for a region
 * visit. The Loops panel renders a separate block for each (region,
 * instanceNumber) pair so revisits get their own block and their own
 * independent expansion state — mirrors the Regions panel's
 * navigation-mode behavior. instanceNumber defaults to 1 because most
 * call sites only care about the first visit.
 */
function regionKey(regionName, instanceNumber = 1) {
  return `${regionName}#${instanceNumber || 1}`;
}

/**
 * ExpansionStateManager
 *
 * Manages expansion state for region blocks and action blocks in the loops panel.
 *
 * Data Flow:
 * 1. User clicks region header → toggleRegion() → Update expandedRegions Set
 * 2. User clicks action block → toggleAction() → Update expandedActions Set
 * 3. Expand/Collapse All → Update all entries in expandedRegions Set
 * 4. Rendering → isRegionExpanded() / isActionExpanded() query the Sets
 *
 * State Storage:
 * - expandedRegions: Set<"regionName#instanceNumber"> - Tracks expanded visits
 * - expandedActions: Set<actionId> - Tracks which action blocks are expanded
 */
export class ExpansionStateManager {
  constructor() {
    // Track expansion state
    this.expandedRegions = new Set();
    this.expandedActions = new Set();

    logger.debug('ExpansionStateManager constructed');
  }

  /**
   * Check if a region visit is expanded.
   * @param {string} regionName - The region name
   * @param {number} [instanceNumber=1] - Visit number (1 for first visit)
   * @returns {boolean} True if expanded, false if collapsed
   */
  isRegionExpanded(regionName, instanceNumber = 1) {
    return this.expandedRegions.has(regionKey(regionName, instanceNumber));
  }

  /**
   * Check if an action block is expanded
   * @param {string} actionId - The action ID
   * @returns {boolean} True if expanded, false if collapsed
   */
  isActionExpanded(actionId) {
    return this.expandedActions.has(actionId);
  }

  /**
   * Set expansion state for a region visit.
   * @param {string} regionName - The region name
   * @param {boolean} expanded - True to expand, false to collapse
   * @param {number} [instanceNumber=1] - Visit number (1 for first visit)
   */
  setRegionExpanded(regionName, expanded, instanceNumber = 1) {
    const key = regionKey(regionName, instanceNumber);
    if (expanded) {
      this.expandedRegions.add(key);
    } else {
      this.expandedRegions.delete(key);
    }
    logger.debug(`Set region expansion for ${key}: ${expanded}`);
  }

  /**
   * Set expansion state for an action block
   * @param {string} actionId - The action ID
   * @param {boolean} expanded - True to expand, false to collapse
   */
  setActionExpanded(actionId, expanded) {
    if (expanded) {
      this.expandedActions.add(actionId);
    } else {
      this.expandedActions.delete(actionId);
    }
    logger.debug(`Set action expansion for ${actionId}: ${expanded}`);
  }

  /**
   * Toggle expansion state for a region visit.
   * @param {string} regionName - The region name
   * @param {number} [instanceNumber=1] - Visit number
   * @returns {boolean} New expansion state
   */
  toggleRegion(regionName, instanceNumber = 1) {
    const key = regionKey(regionName, instanceNumber);
    const wasExpanded = this.expandedRegions.has(key);
    if (wasExpanded) {
      this.expandedRegions.delete(key);
    } else {
      this.expandedRegions.add(key);
    }
    logger.debug(`Toggled region expansion for ${key}: ${!wasExpanded}`);
    return !wasExpanded;
  }

  /**
   * Toggle expansion state for an action block
   * @param {string} actionId - The action ID
   * @returns {boolean} New expansion state
   */
  toggleAction(actionId) {
    const wasExpanded = this.expandedActions.has(actionId);
    if (wasExpanded) {
      this.expandedActions.delete(actionId);
    } else {
      this.expandedActions.add(actionId);
    }
    logger.debug(`Toggled action expansion for ${actionId}: ${!wasExpanded}`);
    return !wasExpanded;
  }

  /**
   * Expand all visits.
   * @param {Array<{name: string, instance: number}>} regionVisits
   */
  expandAll(regionVisits) {
    regionVisits.forEach((v) => {
      this.expandedRegions.add(regionKey(v.name, v.instance));
    });
    logger.debug(`Expanded all ${regionVisits.length} region visits`);
  }

  /**
   * Collapse all regions
   */
  collapseAll() {
    this.expandedRegions.clear();
    logger.debug('Collapsed all regions');
  }

  /**
   * Clear all expansion state (regions and actions)
   * Used when panel is reset or cleared
   */
  clear() {
    this.expandedRegions.clear();
    this.expandedActions.clear();
    logger.debug('Cleared all expansion state');
  }

  /**
   * Get expansion state for debugging
   * @returns {Object} Object with regions and actions state
   */
  getDebugState() {
    return {
      regions: Array.from(this.expandedRegions),
      actions: Array.from(this.expandedActions)
    };
  }
}

export default ExpansionStateManager;
