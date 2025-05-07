console.log('[stateManagerProxy] Module loaded');

// TODO: Import eventBus

import { ALTTPHelpers } from './games/alttp/helpers.js'; // Added import
import { evaluateRule } from './ruleEngine.js'; // Added import, though might not be directly used by helpers

class StateManagerProxy {
  constructor(eventBus) {
    console.log('[stateManagerProxy] Initializing Proxy...');
    if (!eventBus) {
      throw new Error('StateManagerProxy requires an eventBus instance.');
    }
    this.worker = null;
    this.eventBus = eventBus;
    this.uiCache = null; // Initialize cache to null, indicating not yet loaded
    this.nextQueryId = 1;
    this.pendingQueries = new Map(); // Map<queryId, { resolve, reject, timeoutId? }>
    this.initialLoadPromise = null;
    this.initialLoadResolver = null;
    this.staticDataIsSet = false; // Flag for static data readiness
    this.isReadyPublished = false; // Flag to prevent multiple ready events
    this.isPotentialStaleSnapshot = false; // <<< ADDED: Staleness flag

    this._setupInitialLoadPromise();
    this.initializeWorker();
    console.log(
      '[StateManagerProxy Constructor] this._sendCommand type:',
      typeof this._sendCommand
    );
  }

  _setupInitialLoadPromise() {
    // Promise to track the initial rules loading confirmation
    this.initialLoadPromise = new Promise((resolve) => {
      this.initialLoadResolver = resolve;
    });
  }

  initializeWorker() {
    console.log('[stateManagerProxy] Creating Worker...');
    try {
      this.worker = new Worker(
        new URL('./stateManagerWorker.js', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (event) => {
        // console.debug('[stateManagerProxy] Received message from worker:', event.data); // Use debug for less noise
        this.handleWorkerMessage(event.data);
      };

      this.worker.onerror = (error) => {
        console.error('[stateManagerProxy] Worker error:', error);
        const errorMessage = `Worker error: ${
          error.message || 'Unknown worker error'
        }`;
        // Reject all pending queries
        this.pendingQueries.forEach(({ reject, timeoutId }) => {
          if (timeoutId) clearTimeout(timeoutId);
          reject(new Error(errorMessage));
        });
        this.pendingQueries.clear();
        // Reject initial load promise if it's still pending
        if (this.initialLoadResolver) {
          // Ensure it hasn't resolved yet
          // This check might be tricky, maybe add a status flag
        }
        this.eventBus.publish('stateManager:error', {
          message: errorMessage,
          isCritical: true,
        });
        // Consider attempting to restart the worker or entering a failed state
      };
    } catch (e) {
      console.error('[stateManagerProxy] Failed to initialize worker:', e);
      this.eventBus.publish('stateManager:error', {
        message: 'Failed to initialize StateManager worker.',
        isCritical: true,
      });
      // Prevent further interaction
      this.worker = null;
    }
  }

  handleWorkerMessage(message) {
    if (!message || !message.type) {
      console.warn(
        '[stateManagerProxy] Received invalid message from worker:',
        message
      );
      return;
    }

    switch (message.type) {
      case 'queryResponse':
        this._handleQueryResponse(message);
        break;
      case 'rulesLoadedConfirmation': {
        console.log('[stateManagerProxy] Rules loaded confirmation received.');
        // Cache the initial snapshot sent with the confirmation
        // --- FIX: Access snapshot via message.initialSnapshot (matching worker) ---
        if (message.initialSnapshot) {
          this.uiCache = message.initialSnapshot;
          // --- END FIX ---
          console.debug(
            '[stateManagerProxy] Initial snapshot cached from confirmation.',
            this.uiCache
          );
        } else {
          console.warn(
            '[stateManagerProxy] rulesLoadedConfirmation received without initial snapshot.'
          );
        }
        // Resolve the initial load promise
        if (this.initialLoadResolver) {
          this.initialLoadResolver(true);
          this.initialLoadResolver = null; // Prevent multiple resolves
        } else {
          console.warn(
            '[StateManagerProxy] Initial load promise already resolved or resolver missing.'
          );
        }
        // Call the readiness check instead
        this._checkAndPublishReady();
        break;
      }
      case 'stateSnapshot':
        console.debug(
          '[stateManagerProxy] Received stateSnapshot from worker.',
          message.snapshot
        );
        if (message.snapshot) {
          this.uiCache = message.snapshot;
          this.isPotentialStaleSnapshot = false; // <<< ADDED: Reset flag on snapshot arrival
          // Publish a generic event indicating the cache is updated
          this.eventBus.publish('stateManager:snapshotUpdated', {
            snapshot: this.uiCache,
          });
        } else {
          console.warn(
            '[stateManagerProxy] Received stateSnapshot message without snapshot data.'
          );
        }
        break;
      case 'progress':
        // console.debug('[stateManagerProxy] Progress update received:', message.detail); // Debug level
        this.eventBus.publish(
          'stateManager:computationProgress',
          message.detail
        );
        break;
      case 'event': // For granular events forwarded from worker
        console.log(
          `[stateManagerProxy] Forwarding worker event: ${message.name}`
        );
        this.eventBus.publish(`stateManager:${message.name}`, message.payload);
        break;
      case 'workerQueueStatus':
        this.eventBus.publish('stateManager:workerQueueStatus', {
          queueSummary: message.queueSummary,
        });
        break;
      case 'error': // Errors reported by the worker during processing
        console.error('[stateManagerProxy] Error reported by worker:', message);
        this.eventBus.publish('stateManager:workerError', {
          message: message.message,
          stack: message.stack,
          originalCommand: message.originalCommand,
        });
        break;
      default:
        console.warn(
          '[stateManagerProxy] Unknown message type received:',
          message.type,
          message
        );
    }
  }

  _handleQueryResponse(message) {
    const { queryId, result, error } = message;
    const pending = this.pendingQueries.get(queryId);

    if (pending) {
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
      if (error) {
        console.error(`[stateManagerProxy] Query ${queryId} failed:`, error);
        pending.reject(new Error(error));
      } else {
        // console.debug(`[stateManagerProxy] Query ${queryId} succeeded.`); // Debug level
        pending.resolve(result);
      }
      this.pendingQueries.delete(queryId);
    } else {
      console.warn(
        `[stateManagerProxy] Received response for unknown queryId: ${queryId}`
      );
    }
  }

  // --- Internal Helper Methods ---

  sendCommandToWorker(message) {
    if (!this.worker) {
      console.error('[stateManagerProxy] Worker not available.');
      // Optionally throw an error or handle gracefully
      return;
    }
    try {
      this.worker.postMessage(message);
    } catch (error) {
      console.error(
        '[stateManagerProxy] Error sending command to worker:',
        error,
        message
      );
      // Handle serialization errors, etc.
      this.eventBus.publish('stateManager:error', {
        message: 'Error communicating with StateManager worker.',
        isCritical: true,
      });
    }
  }

  sendQueryToWorker(message, timeoutMs = 10000) {
    // Added timeout
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        return reject(new Error('Worker not initialized'));
      }

      const queryId = this.nextQueryId++;
      let timeoutId = null;

      if (timeoutMs > 0) {
        timeoutId = setTimeout(() => {
          if (this.pendingQueries.has(queryId)) {
            console.error(
              `[stateManagerProxy] Query ${queryId} (${message.command}) timed out after ${timeoutMs}ms.`
            );
            this.pendingQueries.delete(queryId);
            reject(new Error(`Query timed out: ${message.command}`));
          }
        }, timeoutMs);
      }

      this.pendingQueries.set(queryId, { resolve, reject, timeoutId });

      try {
        this.worker.postMessage({ ...message, queryId });
      } catch (error) {
        console.error(
          '[stateManagerProxy] Error sending query to worker:',
          error,
          message
        );
        if (timeoutId) clearTimeout(timeoutId);
        this.pendingQueries.delete(queryId);
        reject(new Error('Error communicating with StateManager worker.'));
        this.eventBus.publish('stateManager:error', {
          message: 'Error communicating with StateManager worker.',
          isCritical: true,
        });
      }
    });
  }

  // --- Public API Methods ---

  /**
   * Sends the initial rules and player info to the worker.
   * Returns a promise that resolves when the worker confirms loading is complete.
   */
  async loadRules(rulesData, playerInfo) {
    if (!this.worker) {
      return Promise.reject(new Error('Worker not initialized.'));
    }
    console.log(
      '[stateManagerProxy] Sending loadRules command to worker (rules only)...'
    );
    this.sendCommandToWorker({
      command: 'loadRules',
      payload: { rulesData, playerInfo }, // Send full rulesData
    });
    // Return the promise that tracks the initial load confirmation
    return this.initialLoadPromise;
  }

  /**
   * Waits until the initial rules load is confirmed by the worker.
   */
  async ensureReady() {
    if (!this.worker) {
      throw new Error('Worker not initialized.');
    }
    if (this.uiCache !== null) {
      return true; // Already loaded
    }
    console.log('[stateManagerProxy] Waiting for worker initial load...');
    return this.initialLoadPromise;
  }

  /**
   * Returns the latest state snapshot received from the worker.
   * Returns null if no snapshot has been received yet.
   */
  getSnapshot() {
    // It's recommended to use ensureReady() before calling this
    // if you need to guarantee a non-null snapshot on initial load.
    // However, event handlers reacting to snapshotUpdated can call this safely.
    return this.uiCache;
  }

  // Method to accept and cache static data (items, groups, locations, regions)
  setStaticData(itemData, groupData, locationData, regionData, exitData) {
    console.log(
      '[StateManagerProxy] Caching static item/group/location(aggregated)/region(original)/exit(aggregated) data.'
    );
    this.staticDataCache = {
      items: itemData,
      groups: groupData,
      locations: locationData,
      regions: regionData,
      exits: exitData,
    };
    this.staticDataIsSet = true; // Set flag when static data arrives
    // Log the structure briefly
    console.debug('[StateManagerProxy] Cached static data structure:', {
      items: itemData ? Object.keys(itemData).length : 0,
      groups: groupData ? Object.keys(groupData).length : 0,
      locations: locationData ? Object.keys(locationData).length : 0,
      regions: regionData ? Object.keys(regionData).length : 0,
      exits: exitData ? Object.keys(exitData).length : 0,
    });

    // Check if ready to publish event
    this._checkAndPublishReady();
  }

  // Method to retrieve all cached static data
  getStaticData() {
    if (!this.staticDataCache) {
      console.warn(
        '[StateManagerProxy] Attempted to get static data before it was set.'
      );
    }
    return this.staticDataCache;
  }

  async addItemToInventory(item, quantity = 1) {
    await this.ensureReady(); // Ensure worker is loaded before sending commands
    console.log(
      `[stateManagerProxy] Sending addItemToInventory command for ${item}`
    );
    this.sendCommandToWorker({
      command: 'addItemToInventory',
      payload: { item, quantity },
    });
    this.isPotentialStaleSnapshot = true; // <<< ADDED: Set flag
    // Fire-and-forget - updates come via stateSnapshot events
  }

  async checkLocation(locationName) {
    console.log(
      `[StateManagerProxy] Sending checkLocation command for ${locationName}`
    );
    const messageToSend = { command: 'checkLocation', payload: locationName };
    console.log(
      '[StateManagerProxy checkLocation] Message to send to worker:',
      JSON.stringify(messageToSend)
    ); // ADDED DEBUG
    // Await the response (even if it's just an ack or error)
    return this.sendQueryToWorker(messageToSend);
  }

  async syncCheckedLocationsFromServer(checkedLocationIds) {
    await this.ensureReady();
    console.log(
      `[stateManagerProxy] Sending syncCheckedLocationsFromServer command.`
    );
    this.sendCommandToWorker({
      command: 'syncCheckedLocationsFromServer',
      payload: { checkedLocationIds },
    });
    this.isPotentialStaleSnapshot = true; // <<< ADDED: Set flag
  }

  async toggleQueueReporting(enabled) {
    await this.ensureReady();
    console.log(
      `[stateManagerProxy] Sending toggleQueueReporting command (${enabled}).`
    );
    this.sendCommandToWorker({
      command: 'toggleQueueReporting',
      payload: { enabled },
    });
    // Return the promise that tracks the initial load confirmation
    return this.initialLoadPromise;
  }

  // --- Queries ---

  async getFullSnapshot() {
    await this.ensureReady();
    console.log('[stateManagerProxy] Querying for full snapshot...');
    return this.sendQueryToWorker({ command: 'getFullSnapshot' });
  }

  async getWorkerQueueStatus() {
    await this.ensureReady();
    console.log('[stateManagerProxy] Querying for worker queue status...');
    return this.sendQueryToWorker({ command: 'getWorkerQueueStatus' });
  }

  /**
   * Synchronously returns the latest state snapshot held by the proxy.
   * Returns null if the initial snapshot hasn't been received yet.
   */
  getLatestStateSnapshot() {
    // Synchronous access to the cached state
    return this.uiCache;
  }

  terminateWorker() {
    if (this.worker) {
      console.log('[stateManagerProxy] Terminating worker.');
      this.worker.terminate();
      this.worker = null;
      // Reject any remaining pending queries
      this.pendingQueries.forEach(({ reject, timeoutId }) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(new Error('Worker terminated'));
      });
      this.pendingQueries.clear();
      // Reset initial load promise for potential restart?
      this._setupInitialLoadPromise();
      this.uiCache = null;
    }
  }

  // --- ADDED: Helper to check readiness and publish event --- >
  _checkAndPublishReady() {
    console.log('[StateManagerProxy] _checkAndPublishReady called. Status:', {
      uiCacheNotNull: !!this.uiCache,
      staticDataIsSet: this.staticDataIsSet,
      isReadyPublished: this.isReadyPublished,
    });
    if (this.uiCache && this.staticDataIsSet && !this.isReadyPublished) {
      if (this.eventBus) {
        console.log(
          '[stateManagerProxy] Publishing stateManager:ready event (Snapshot & Static Data Ready).'
        );
        this.eventBus.publish('stateManager:ready');
        this.isReadyPublished = true; // Prevent publishing again
      } else {
        console.warn(
          '[stateManagerProxy] EventBus not available to publish stateManager:ready.'
        );
      }
    }
  }
  // --- END ADDED --- >

  /**
   * Sends a command to the worker and potentially waits for a response.
   * Internal use.
   */
  async _sendCommand(
    command,
    payload = null,
    expectResponse = false,
    timeout = 5000
  ) {
    // ... existing code ...
  }

  /**
   * Requests the worker to evaluate a specific rule using its full context.
   * @param {object} rule The rule object to evaluate.
   * @returns {Promise<any>} The result of the rule evaluation from the worker.
   */
  async evaluateRuleRemote(rule) {
    if (!this.worker) {
      console.error(
        '[StateManagerProxy] Worker not initialized, cannot evaluate rule remotely.'
      );
      return false; // Or throw error
    }
    if (this._initialLoadComplete) {
      console.log(
        `[StateManagerProxy] Sending evaluateRuleRequest for rule:`,
        rule
      );
      try {
        const response = await this._sendCommand(
          'evaluateRuleRequest',
          { rule },
          true // Expect a response
        );
        console.log(
          `[StateManagerProxy] Received evaluateRuleResponse:`,
          response
        );
        // Assuming the response structure includes { result: ... } or { error: ... }
        if (response && typeof response.error !== 'undefined') {
          console.error(
            '[StateManagerProxy] Worker returned error during remote rule evaluation:',
            response.error
          );
          return false; // Propagate failure
        }
        return response?.result;
      } catch (error) {
        console.error(
          '[StateManagerProxy] Error during remote rule evaluation request:',
          error
        );
        return false; // Indicate failure
      }
    } else {
      console.warn(
        '[StateManagerProxy] Worker not ready, cannot evaluate rule remotely yet.'
      );
      return false; // Worker isn't loaded/ready
    }
  }

  /**
   * Retrieves the current state snapshot held by the proxy.
   * Returns null if the snapshot hasn't been received yet.
   */
  getCurrentStateSnapshot() {
    // ... existing code ...
  }

  // <<< ADDED: Accessor for staleness flag >>>
  /**
   * Checks if a state-modifying command has been sent to the worker
   * since the last snapshot was received.
   * @returns {boolean} True if the current snapshot might be stale.
   */
  isSnapshotPotentiallyStale() {
    return this.isPotentialStaleSnapshot;
  }
  // <<< END ADDED >>>
}

// --- ADDED: Function to create the main-thread snapshot interface ---
/**
 * Creates an interface object suitable for main-thread rule evaluation
 * based on the latest cached snapshot data.
 * @param {object | null} snapshot - The raw state snapshot from the worker (or null if not available).
 * @param {object | null} staticData - The cached static data (items, groups, etc.).
 * @returns {object} - An object conforming to the StateSnapshotInterface.
 */
export function createStateSnapshotInterface(snapshot, staticData) {
  // console.log('[SnapshotIF] Creating with snapshot:', snapshot, 'and staticData:', staticData);

  // The interface object needs to be defined first to be passed to ALTTPHelpers
  let snapshotInterfaceInstance = null;

  // Create an ALTTPHelpers instance specifically for this snapshot interface
  // It needs the interface itself to call methods like hasItem, getSetting etc.
  // And staticData for item/group definitions if helpers access them directly (though ideally via snapshot methods)
  const helpersContext = {
    // Construct a context for ALTTPHelpers
    // Provide methods that ALTTPHelpers expects if it were a full StateManager
    // This is a bit of a shim.
    inventory: {
      has: (itemName) => snapshotInterfaceInstance.hasItem(itemName),
      count: (itemName) => snapshotInterfaceInstance.countItem(itemName),
      countGroup: (groupName) =>
        snapshotInterfaceInstance.countGroup(groupName),
      // ALTTPHelpers constructor also checks for inventory.itemData
      itemData: staticData.items, // Pass static item data
    },
    helpers: null, // Will be set to the helper instance itself later if needed for self-reference
    state: {
      // Shim for state properties helpers might try to access
      hasFlag: (flagName) => snapshotInterfaceInstance.hasFlag(flagName),
      // Add other state properties if helpers try to access them directly
      // e.g., difficultyRequirements, shops
      difficultyRequirements: snapshot?.difficultyRequirements,
      shops: snapshot?.shops,
    },
    settings: snapshot?.settings,
    mode: snapshot?.gameMode, // Assuming gameMode is on the snapshot
    playerSlot: snapshot?.playerSlot,
    // Provide a way for helpers to access static game data if necessary,
    // though ideally, they rely on the snapshot's methods.
    staticGameData: staticData,

    // Methods from StateManager that helpers might call if they were in worker
    // These should mostly return undefined or throw if called in snapshot context
    // unless they can be meaningfully simulated.
    isRegionReachable: (regionName) =>
      snapshotInterfaceInstance.isRegionReachable(regionName),
    isLocationAccessible: (locationNameOrObject) =>
      snapshotInterfaceInstance.isLocationAccessible(locationNameOrObject),
    // evaluateRule: (rule) => evaluateRule(rule, snapshotInterfaceInstance) // Allow helpers to call evaluateRule with this snapshot context.
    // Expose evaluateRule if helpers need to recursively call it (complex case)
    _evaluateRule: (rule) => evaluateRule(rule, snapshotInterfaceInstance),

    // Mimic StateManager context for ALTTPHelpers constructor
    getSnapshot: () => snapshot, // Helpers shouldn't call this, but for constructor compatibility
    _isSnapshotInterface: true, // Mark this context clearly for ALTTPHelpers constructor if it checks
    hasItem: (itemName) => snapshotInterfaceInstance.hasItem(itemName), // also for constructor check
    getSetting: (settingName) =>
      snapshotInterfaceInstance.getSetting(settingName),
  };

  const altlpHelpersInstance = new ALTTPHelpers(helpersContext);
  // If helpers need to reference themselves (e.g. context.helpers.method()), set it.
  helpersContext.helpers = altlpHelpersInstance;

  snapshotInterfaceInstance = {
    _isSnapshotInterface: true,
    snapshot: snapshot, // Direct access to the raw snapshot data
    staticData: staticData, // Direct access to static data

    // --- Inventory Access ---
    hasItem: (itemName) =>
      !!(snapshot?.inventory && snapshot.inventory[itemName] > 0),
    countItem: (itemName) => snapshot?.inventory?.[itemName] || 0,
    countGroup: (groupName) => {
      if (
        !staticData?.groups ||
        !staticData.groups[groupName] ||
        !snapshot?.inventory
      ) {
        return 0;
      }
      let count = 0;
      for (const itemInGroup of staticData.groups[groupName]) {
        count += snapshot.inventory[itemInGroup] || 0;
      }
      return count;
    },

    // --- Flag Access ---
    hasFlag: (flagName) =>
      !!(snapshot?.flags && snapshot.flags.includes(flagName)),

    // --- Settings Access ---
    getSetting: (settingName) => snapshot?.settings?.[settingName],

    // --- Reachability (can only use snapshot data, may be limited) ---
    getReachabilityStatus: (name) =>
      snapshot?.reachability?.[name] || 'unknown',

    isRegionReachable: (regionName) => {
      // Extremely simplified: can only check if explicitly in snapshot.
      // Complex reachability is not possible here.
      const status = snapshot?.reachability?.[regionName];
      if (status === 'reachable') return true;
      if (status === 'unreachable' || status === 'checked') return false; // checked implies it was reachable
      // If 'processing' or 'unknown' or not present, we can't determine from snapshot alone.
      return undefined; // Indicate "unknown"
    },

    isLocationAccessible: (locationNameOrObject) => {
      // Similar to regions, can only use snapshot data.
      const name =
        typeof locationNameOrObject === 'object'
          ? locationNameOrObject.name
          : locationNameOrObject;
      const status = snapshot?.reachability?.[name];
      if (status === 'reachable') return true;
      if (status === 'checked') return true; // if a location is checked, it must have been accessible.
      if (status === 'unreachable') return false;
      return undefined; // "unknown" for 'processing' or if not in snapshot
    },

    // --- Player/Game Info ---
    getPlayerSlot: () => snapshot?.playerSlot,
    getGameMode: () => snapshot?.gameMode, // Assuming gameMode is on the snapshot
    getDifficultyRequirements: () => snapshot?.difficultyRequirements, // From snapshot
    getShops: () => snapshot?.shops, // From snapshot
    getRegionData: (regionName) => {
      // This should come from the staticData that was aggregated.
      // The snapshot itself doesn't store all region properties.
      return staticData?.regions?.[regionName];
    },

    // --- Helper Execution ---
    helpers: altlpHelpersInstance, // Make helpers directly accessible if rules do `context.helpers.method()`
    executeHelper: (name, ...args) => {
      if (
        altlpHelpersInstance &&
        typeof altlpHelpersInstance[name] === 'function'
      ) {
        try {
          // Call the helper method on the instance.
          // The helper method itself will check if it's in snapshot context
          // and return true/false or undefined.
          return altlpHelpersInstance[name](...args);
        } catch (e) {
          console.warn(
            `[SnapshotIF] Error in snapshot executeHelper for '${name}':`,
            e
          );
          return undefined; // Unknown on error during execution
        }
      }
      console.warn(
        `[SnapshotIF] Helper '${name}' not found on ALTTPHelpers instance for snapshot.`
      );
      return undefined; // Helper not found, treat as unknown
    },

    // --- StateManager Method Execution (Limited/Simulated) ---
    // Only include methods that can be reasonably simulated or are essential for some UI rules
    // and *cannot* be done via a helper. Most complex ones should return undefined.
    executeStateManagerMethod: (methodName, ...args) => {
      // Example: if StateManager had a simple method like `isSwordlessMode()`
      // if (methodName === 'isSwordlessMode') {
      //   return snapshot?.settings?.swordless;
      // }
      // For most complex StateManager methods, we can't execute them here.
      console.warn(
        `[SnapshotIF] StateManager method '${methodName}' cannot be reliably executed by snapshot interface. Assuming undefined.`
      );
      return undefined;
    },

    // Method for evaluateRule to get the 'this' for function calls on entities like 'old_man.can_reach()'
    // It should resolve 'old_man' to the entity object provided by ALTTPHelpers.
    resolveRuleObject: (ruleObjectPath) => {
      // ruleObjectPath could be like { type: 'name', name: 'old_man' }
      // or { type: 'attribute', object: { type: 'name', name: 'state'}, attr: 'helpers'}
      // This is a simplified placeholder. A more robust resolver might be needed
      // if evaluateRule doesn't already handle this by passing the core context around.
      if (ruleObjectPath && ruleObjectPath.type === 'name') {
        if (ruleObjectPath.name === 'helpers' && altlpHelpersInstance) {
          return altlpHelpersInstance;
        }
        if (
          ruleObjectPath.name === 'state' ||
          ruleObjectPath.name === 'settings'
        ) {
          // for state.getSetting, settings.goal etc.
          // Return the snapshotInterface itself, as it has getSetting, hasFlag etc.
          return snapshotInterfaceInstance;
        }
        if (
          altlpHelpersInstance &&
          altlpHelpersInstance.entities &&
          altlpHelpersInstance.entities[ruleObjectPath.name]
        ) {
          return altlpHelpersInstance.entities[ruleObjectPath.name];
        }
      }
      // If we are trying to access an attribute of the snapshotInterface (e.g. "inventory.hasItem")
      // then 'inventory' would be resolved, and 'hasItem' called on it.
      // The challenge is when a rule is like `state.can_reach_old_man()`. `state` resolves to snapshotInterface.
      // Then `can_reach_old_man` needs to be found on it (likely via helpers).
      // This indicates that `context.helpers` or `context.executeHelper` is the cleaner path.
      return snapshotInterfaceInstance; // Default to the main interface
    },
  };
  return snapshotInterfaceInstance;
}
// --- END ADDED FUNCTION ---

export default StateManagerProxy;
