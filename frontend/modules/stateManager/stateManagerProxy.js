console.log('[stateManagerProxy] Module loaded');

// TODO: Import eventBus

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

    this._setupInitialLoadPromise();
    this.initializeWorker();
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
      case 'rulesLoadedConfirmation':
        console.log('[stateManagerProxy] Rules loaded confirmation received.');
        this.uiCache = message.initialSnapshot;
        if (this.initialLoadResolver) {
          this.initialLoadResolver(true); // Resolve the initial load promise
          this.initialLoadResolver = null; // Ensure it's only called once
        }
        this.eventBus.publish('stateManager:rulesLoaded', {
          snapshot: this.uiCache,
        });
        // Optionally publish initial queue status if provided
        if (message.workerQueueSummary) {
          this.eventBus.publish('stateManager:workerQueueStatus', {
            queueSummary: message.workerQueueSummary,
          });
        }
        break;
      case 'stateSnapshot':
        // console.debug('[stateManagerProxy] State snapshot received.');
        if (message.snapshot) {
          this.uiCache = message.snapshot;
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

  // ADD setStaticData method
  setStaticData(itemData, groupData) {
    console.log('[StateManagerProxy] Caching static item/group data.');
    this.itemData = itemData;
    this.groupData = groupData;
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
    // Fire-and-forget - updates come via stateSnapshot events
  }

  async checkLocation(locationName) {
    await this.ensureReady();
    console.log(
      `[stateManagerProxy] Sending checkLocation command for ${locationName}`
    );
    this.sendCommandToWorker({
      command: 'checkLocation',
      payload: { locationName },
    });
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

  // Method to get the current UI cache snapshot
  // getSnapshot() { // REMOVED DUPLICATE
  //     return this.uiCache;
  // }

  // START ADDED GETTERS
  getItemData() {
    // Assuming itemData is stored after initial load
    return this.itemData;
  }

  getGroupData() {
    // Assuming groupData is stored after initial load
    return this.groupData;
  }
  // END ADDED GETTERS

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
}

export default StateManagerProxy;
