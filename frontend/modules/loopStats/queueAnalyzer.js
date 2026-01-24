/**
 * Queue Analyzer for Loop Stats Panel
 *
 * Analyzes the action queue and calculates costs, predicting mana remaining
 * after each action. Provides data structure for the stats panel UI.
 */

import {
  proposedLinearReduction,
  proposedLinearFinalCost,
} from '../loops/xpFormulas.js';

// Helper function for logging with fallback
function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('queueAnalyzer', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[queueAnalyzer] ${message}`, ...data);
  }
}

/**
 * Analysis result for a single action in the queue
 * @typedef {Object} ActionAnalysis
 * @property {number} index - Position in the queue
 * @property {string} type - Action type: 'move', 'explore', 'checkLocation'
 * @property {string} description - Full description of the action
 * @property {string} truncatedDescription - Truncated for narrow display
 * @property {string} regionName - Region where action occurs
 * @property {number} baseCost - Base mana cost before modifiers
 * @property {number} levelDiscount - Reduction from region XP level
 * @property {Array} itemPenalties - Future: penalties for missing items
 * @property {number} finalCost - Actual mana cost after all modifiers
 * @property {number} manaBeforeAction - Mana before this action
 * @property {number} manaAfterAction - Mana after this action
 * @property {boolean} isDoubledCost - Future: has item penalty
 * @property {boolean} hasInsufficientMana - Will run out of mana
 * @property {boolean} isCompleted - Action is already completed
 * @property {number} progress - Current progress (0-100)
 */

/**
 * Full queue analysis result
 * @typedef {Object} QueueAnalysis
 * @property {ActionAnalysis[]} entries - Analysis for each action
 * @property {number} totalCost - Sum of all action costs
 * @property {number} finalMana - Predicted mana after all actions
 * @property {number} startingMana - Mana at start of analysis
 * @property {number} maxMana - Maximum mana capacity
 * @property {number} timestamp - When analysis was performed
 */

/**
 * QueueAnalyzer class
 * Analyzes the action queue and provides cost/mana predictions
 */
export class QueueAnalyzer {
  constructor() {
    // Previous loop analysis for comparison
    this.previousAnalysis = null;

    // Current analysis cache
    this.currentAnalysis = null;

    // Base costs for each action type
    this.baseCosts = {
      explore: 50,
      checkLocation: 100,
      moveToRegion: 10,
    };
  }

  /**
   * Get base cost for an action type
   * @param {string} actionType - The type of action
   * @returns {number} Base mana cost
   */
  getBaseCost(actionType) {
    return this.baseCosts[actionType] || 50;
  }

  /**
   * Calculate the mana cost of an action
   * @param {Object} action - The action to calculate cost for
   * @param {Object} loopState - The loop state for XP data
   * @returns {Object} Cost breakdown
   */
  calculateActionCost(action, loopState) {
    const baseCost = this.getBaseCost(action.type);

    let levelDiscount = 0;
    let finalCost = baseCost;

    // Apply region XP reduction if applicable
    if (action.regionName && loopState) {
      const xpData = loopState.getRegionXP(action.regionName);
      const level = xpData?.level || 0;

      // Calculate discount using the same formula as loopState
      const reduction = proposedLinearReduction(level);
      finalCost = proposedLinearFinalCost(baseCost, level);
      levelDiscount = baseCost - finalCost;
    }

    return {
      baseCost,
      levelDiscount,
      itemPenalties: [], // Future: Phase 3 implementation
      finalCost: Math.floor(finalCost),
      level: action.regionName && loopState ? loopState.getRegionXP(action.regionName)?.level || 0 : 0,
    };
  }

  /**
   * Get a display name for an action
   * @param {Object} action - The action
   * @returns {string} Display name
   */
  getActionDescription(action) {
    switch (action.type) {
      case 'explore':
        return `Explore: ${action.regionName}`;
      case 'checkLocation':
        return `Check: ${action.locationName}`;
      case 'moveToRegion':
        return `Move: ${action.destinationRegion || action.regionName}`;
      default:
        return `${action.type}: ${action.regionName || 'Unknown'}`;
    }
  }

  /**
   * Truncate a string for narrow display
   * @param {string} str - String to truncate
   * @param {number} maxLen - Maximum length
   * @returns {string} Truncated string
   */
  truncateDescription(str, maxLen = 20) {
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen - 1) + '…';
  }

  /**
   * Check if an action is the initial start position (skip in analysis)
   * @param {Object} action - Action to check
   * @param {Object} loopState - Loop state for start region check
   * @returns {boolean} True if this is the initial start entry
   */
  isInitialStartEntry(action, loopState) {
    if (!action || action.type !== 'moveToRegion' || action.exitUsed) {
      return false;
    }
    // Check if the region is a start region
    if (loopState?.playerState?.isStartRegion) {
      return loopState.playerState.isStartRegion(action.region || action.regionName);
    }
    // Fallback to checking for 'Menu'
    return (action.region || action.regionName) === 'Menu';
  }

  /**
   * Analyze the action queue and calculate costs
   * @param {Array} actionQueue - Array of actions from loopState
   * @param {Object} loopState - The loop state instance
   * @returns {QueueAnalysis} Analysis result
   */
  analyze(actionQueue, loopState) {
    if (!actionQueue || !loopState) {
      return this._createEmptyAnalysis();
    }

    const startingMana = loopState.currentMana;
    const maxMana = loopState.maxMana;
    let currentMana = startingMana;
    let totalCost = 0;
    const entries = [];

    // Track starting index (skip initial start region)
    let startIndex = 0;
    if (actionQueue.length > 0 && this.isInitialStartEntry(actionQueue[0], loopState)) {
      startIndex = 1;
    }

    for (let i = startIndex; i < actionQueue.length; i++) {
      const action = actionQueue[i];

      // Calculate cost breakdown
      const costData = this.calculateActionCost(action, loopState);

      // Get description
      const description = this.getActionDescription(action);
      const truncatedDescription = this.truncateDescription(description);

      // Calculate mana before/after
      const manaBeforeAction = currentMana;

      // If action is completed, it already consumed its cost
      let manaAfterAction;
      if (action.completed) {
        manaAfterAction = manaBeforeAction; // Completed actions don't affect predicted mana
      } else if (action.progress > 0 && action.progress < 100) {
        // Partially complete - calculate remaining cost
        const remainingCost = costData.finalCost * (1 - action.progress / 100);
        manaAfterAction = manaBeforeAction - remainingCost;
      } else {
        manaAfterAction = manaBeforeAction - costData.finalCost;
      }

      // Update running total
      if (!action.completed) {
        const effectiveCost = action.progress > 0
          ? costData.finalCost * (1 - action.progress / 100)
          : costData.finalCost;
        totalCost += effectiveCost;
        currentMana = manaAfterAction;
      }

      entries.push({
        index: i,
        pathIndex: action.pathIndex,
        type: action.type,
        description,
        truncatedDescription,
        regionName: action.regionName,
        locationName: action.locationName,
        destinationRegion: action.destinationRegion,

        // Cost breakdown
        baseCost: costData.baseCost,
        levelDiscount: costData.levelDiscount,
        level: costData.level,
        itemPenalties: costData.itemPenalties,
        finalCost: costData.finalCost,

        // Mana tracking
        manaBeforeAction: Math.floor(manaBeforeAction),
        manaAfterAction: Math.floor(manaAfterAction),

        // Status flags
        isDoubledCost: costData.itemPenalties.length > 0,
        hasInsufficientMana: manaAfterAction < 0,
        isCompleted: action.completed || false,
        progress: action.progress || 0,
      });
    }

    const analysis = {
      entries,
      totalCost: Math.floor(totalCost),
      finalMana: Math.floor(currentMana),
      startingMana: Math.floor(startingMana),
      maxMana,
      timestamp: Date.now(),
    };

    // Cache current analysis
    this.currentAnalysis = analysis;

    return analysis;
  }

  /**
   * Create an empty analysis result
   * @returns {QueueAnalysis} Empty analysis
   */
  _createEmptyAnalysis() {
    return {
      entries: [],
      totalCost: 0,
      finalMana: 0,
      startingMana: 0,
      maxMana: 100,
      timestamp: Date.now(),
    };
  }

  /**
   * Archive current analysis as previous (called on loop reset)
   */
  archiveCurrentAnalysis() {
    if (this.currentAnalysis) {
      this.previousAnalysis = { ...this.currentAnalysis };
      log('info', 'Archived current analysis as previous');
    }
  }

  /**
   * Get the previous loop analysis for comparison
   * @returns {QueueAnalysis|null} Previous analysis or null
   */
  getPreviousAnalysis() {
    return this.previousAnalysis;
  }

  /**
   * Get the current cached analysis
   * @returns {QueueAnalysis|null} Current analysis or null
   */
  getCurrentAnalysis() {
    return this.currentAnalysis;
  }

  /**
   * Clear all cached analysis data
   */
  clearCache() {
    this.currentAnalysis = null;
    this.previousAnalysis = null;
  }

  /**
   * Get a comparison of current vs previous analysis for an action
   * @param {number} index - Action index
   * @returns {Object|null} Comparison data or null
   */
  getComparison(index) {
    if (!this.currentAnalysis || !this.previousAnalysis) {
      return null;
    }

    const current = this.currentAnalysis.entries.find(e => e.index === index);
    const previous = this.previousAnalysis.entries.find(e => e.index === index);

    if (!current) return null;

    return {
      current,
      previous: previous || null,
      manaChanged: previous ? current.manaAfterAction !== previous.manaAfterAction : false,
      costChanged: previous ? current.finalCost !== previous.finalCost : false,
    };
  }

  /**
   * Get serializable state for persistence/testing
   * @returns {Object} Serializable state
   */
  getSerializableState() {
    return {
      currentAnalysis: this.currentAnalysis,
      previousAnalysis: this.previousAnalysis,
      baseCosts: { ...this.baseCosts },
    };
  }
}

// Export singleton instance for convenience
export const queueAnalyzer = new QueueAnalyzer();
export default queueAnalyzer;
