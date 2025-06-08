/**
 * Temporary canonical state manager implementation for refactoring
 * This will eventually replace the current StateManager implementation
 */

import { deepCopyState, migrateInventoryToCanonical } from './migration/stateMigration.js';

// Helper function for logging with fallback
function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('canonicalStateManager', message, ...data);
  } else {
    // In worker context, only log ERROR and WARN levels to keep console clean
    if (level === 'error' || level === 'warn') {
      const consoleMethod =
        console[level === 'info' ? 'log' : level] || console.log;
      consoleMethod(`[canonicalStateManager] ${message}`, ...data);
    }
  }
}

/**
 * StateManager refactored to use canonical state structure
 * This is a work-in-progress that will gradually replace the original StateManager
 */
export class CanonicalStateManager {
  constructor(evaluateRuleFunction, loggerInstance) {
    // Store the injected logger instance
    this.logger = loggerInstance || console;
    
    // Injected dependencies
    this.eventBus = null; // Legacy/optional
    this.postMessageCallback = null; // For worker communication
    this.evaluateRuleFromEngine = evaluateRuleFunction; // Store the injected rule evaluator
    
    // Initialize canonical state structure
    this.currentState = {
      game: null,
      gameId: null,
      debugMode: false,
      autoCollectEventsEnabled: true,
      
      player: {
        slot: 1,
        team: 0,
        name: 'Player1'
      },
      
      settings: {},
      
      inventory: {}, // Plain object of item counts
      
      flags: [], // Array of string flags
      
      reachability: {}, // Pre-computed accessibility map
      
      dungeons: {}, // Dynamic dungeon state
      
      eventLocations: {} // Event location references
    };
    
    // Static data (not part of dynamic state)
    this.staticData = {
      locations: [], // Full location definitions
      regions: {}, // Full region definitions
      itemData: {}, // Item definitions
      groupData: {}, // Item group definitions
      progressionMapping: {}, // Progressive item mappings
      startRegions: ['Menu']
    };
    
    // Internal state tracking
    this.checkedLocations = new Set(); // For quick lookup, derived from flags
    this.knownReachableRegions = new Set();
    this.knownUnreachableRegions = new Set();
    this.cacheValid = false;
    
    // Path tracking
    this.path = new Map();
    this.blockedConnections = new Set();
    this.indirectConnections = new Map();
    
    // Computation flags
    this._computing = false;
    this._batchMode = false;
    this._deferRegionComputation = false;
    this._batchedUpdates = new Map();
    
    // UI callbacks (legacy)
    this._uiCallbacks = {};
    
    // Helpers will be loaded per-game
    this.helpers = null;
    
    if (!this.evaluateRuleFromEngine) {
      log('warn', 'evaluateRuleFunction was not provided. Rule evaluation might fail.');
    }
  }
  
  /**
   * Get a snapshot of the current state
   * In the canonical version, this is much simpler - just return a deep copy
   */
  getSnapshot() {
    if (!this.cacheValid) {
      this._logDebug('Cache invalid, recomputing reachability...');
      this.computeReachableRegions();
    }
    
    // Simply return a deep copy of the current state
    return deepCopyState(this.currentState);
  }
  
  /**
   * Initialize inventory with all items set to 0
   * @param {string[]} allItems - List of all possible items
   */
  initializeInventory(allItems) {
    this.currentState.inventory = {};
    for (const item of allItems) {
      this.currentState.inventory[item] = 0;
    }
  }
  
  /**
   * Add an item to inventory
   * @param {string} itemName - Name of the item to add
   * @param {number} count - Number to add (default 1)
   */
  addItem(itemName, count = 1) {
    if (!(itemName in this.currentState.inventory)) {
      log('warn', `Attempting to add unknown item: ${itemName}`);
      this.currentState.inventory[itemName] = 0;
    }
    
    const currentCount = this.currentState.inventory[itemName];
    const itemDef = this.staticData.itemData[itemName];
    const maxCount = itemDef?.max_count ?? Infinity;
    
    const newCount = Math.min(currentCount + count, maxCount);
    this.currentState.inventory[itemName] = newCount;
    
    // Invalidate cache when inventory changes
    this.cacheValid = false;
    
    // Send update if in worker
    if (this.postMessageCallback && !this._batchMode) {
      this._sendSnapshotUpdate();
    }
  }
  
  /**
   * Check if player has an item
   * @param {string} itemName - Name of the item to check
   * @returns {boolean} True if player has the item
   */
  hasItem(itemName) {
    return (this.currentState.inventory[itemName] || 0) > 0;
  }
  
  /**
   * Get count of an item
   * @param {string} itemName - Name of the item
   * @returns {number} Count of the item
   */
  getItemCount(itemName) {
    return this.currentState.inventory[itemName] || 0;
  }
  
  /**
   * Check a location
   * @param {string} locationName - Name of the location to check
   */
  checkLocation(locationName) {
    if (!this.currentState.flags.includes(locationName)) {
      this.currentState.flags.push(locationName);
      this.checkedLocations.add(locationName);
      
      // Update reachability
      if (this.currentState.reachability[locationName]) {
        this.currentState.reachability[locationName] = 'checked';
      }
      
      // Invalidate cache
      this.cacheValid = false;
      
      // Send update if in worker
      if (this.postMessageCallback && !this._batchMode) {
        this._sendSnapshotUpdate();
      }
    }
  }
  
  /**
   * Send snapshot update to main thread
   * @private
   */
  _sendSnapshotUpdate() {
    if (this.postMessageCallback) {
      const snapshot = this.getSnapshot();
      this.postMessageCallback({
        cmd: 'snapshotUpdate',
        snapshot: snapshot
      });
    }
  }
  
  /**
   * Debug logging helper
   * @private
   */
  _logDebug(message, ...data) {
    if (this.currentState.debugMode) {
      log('info', message, ...data);
    }
  }
  
  // Stub for computeReachableRegions - will be implemented later
  computeReachableRegions() {
    // TODO: Implement using thread-agnostic helpers
    this.cacheValid = true;
  }
}