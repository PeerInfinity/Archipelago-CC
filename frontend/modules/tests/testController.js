// frontend/modules/tests/testController.js
//
// Writing new tests? See ./README.md for the project's testing discipline.
// Short version: call `eventBus.publish`, `stateManager.pingWorker`, and
// module APIs directly. Assert on state, not DOM. Use `assertEqual` /
// `reportCondition` for assertions, and `return testController.getOverallResult()`
// to auto-complete the test. Keep domain-specific helpers in their own module,
// not in this controller.
import { stateManagerProxySingleton } from '../stateManager/index.js';
import { DEFAULT_PLAYER_ID } from '../shared/playerIdUtils.js';

// --- TestController Class ---
export class TestController {
  constructor(testId, callbacks, eventBus) {
    if (
      !callbacks ||
      typeof callbacks.log !== 'function' ||
      typeof callbacks.reportCondition !== 'function' ||
      typeof callbacks.setTestStatus !== 'function' ||
      typeof callbacks.completeTest !== 'function'
    ) {
      throw new Error(
        'TestController: Missing required callbacks (log, reportCondition, setTestStatus, completeTest)'
      );
    }

    this.testId = testId;
    this.callbacks = callbacks; // { log, reportCondition, setTestStatus, completeTest }
    this.eventBus = eventBus; // Injected eventBus instance
    this.stateManager = stateManagerProxySingleton; // Direct import
    
    // Track active event listeners for automatic cleanup
    this.activeEventListeners = new Map(); // eventName -> Set of handlers
    this.isCompleted = false; // Flag to track if test has completed

    // Failed-assertion count. `assertEqual` increments this on mismatch;
    // `reportCondition` increments it when called with `false`. Tests can
    // `return testController.getOverallResult()` to auto-complete with the
    // AND of all assertions rather than threading a manual `overallResult`
    // boolean through every condition.
    this._failedConditionCount = 0;
  }

  log(message, type = 'info') {
    this.callbacks.log(this.testId, message, type);
  }

  reportCondition(description, passed) {
    this.log(`Condition: "${description}" - ${passed ? 'PASSED' : 'FAILED'}`);
    if (!passed) this._failedConditionCount += 1;
    this.callbacks.reportCondition(
      this.testId,
      description,
      passed ? 'passed' : 'failed'
    );
  }

  /**
   * Assert two values are equal via `Object.is`. On mismatch, logs both the
   * expected and actual value so failures are diagnosable from the test log
   * alone (no need to add ad-hoc `log(...)` calls before the assertion).
   * Returns the boolean result so callers can short-circuit if they want.
   */
  assertEqual(description, expected, actual) {
    const passed = Object.is(expected, actual);
    if (!passed) {
      this.log(
        `Assertion mismatch for "${description}": expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
        'error'
      );
    }
    this.reportCondition(description, passed);
    return passed;
  }

  /**
   * AND of every assertion run so far via `assertEqual` / `reportCondition`.
   * Tests can `return testController.getOverallResult()` as the last line and
   * the orchestrator will auto-complete with that boolean (see testLogic.js's
   * "if (typeof testResult === 'boolean')" path).
   */
  getOverallResult() {
    return this._failedConditionCount === 0;
  }

  waitForEvent(eventName, timeoutMilliseconds = 5000) {
    this.log(
      `Waiting for event: ${eventName} (timeout: ${timeoutMilliseconds}ms)`
    );
    this.callbacks.setTestStatus(this.testId, 'waiting_for_event', eventName);
    return new Promise((resolve, reject) => {
      if (!this.eventBus) {
        const msg = 'eventBus is not available in TestController';
        this.log(msg, 'error');
        reject(new Error(msg));
        return;
      }
      
      // Check if test has already completed
      if (this.isCompleted) {
        const msg = `Test ${this.testId} has already completed, ignoring waitForEvent for ${eventName}`;
        this.log(msg, 'warn');
        reject(new Error(msg));
        return;
      }
      
      let timeoutId;
      const handler = (data) => {
        // FIRST: Check if test is completed - return immediately without any processing
        if (this.isCompleted) {
          // Event received for completed test - this is normal and not an error
          // Don't log at all to reduce noise
          return;
        }
        
        clearTimeout(timeoutId);
        
        // Remove from tracking before unsubscribing
        this._removeEventListenerFromTracking(eventName, handler);
        
        // Ensure eventBus and unsubscribe are still valid before calling
        if (this.eventBus && typeof this.eventBus.unsubscribe === 'function') {
          this.eventBus.unsubscribe(eventName, handler);
        }
        
        this.log(`Event received: ${eventName}`);
        this.log(`Event data: ${JSON.stringify(data)}`, 'debug');
        this.callbacks.setTestStatus(this.testId, 'running');
        resolve(data);
      };
      
      timeoutId = setTimeout(() => {
        // Remove from tracking before unsubscribing
        this._removeEventListenerFromTracking(eventName, handler);
        
        if (this.eventBus && typeof this.eventBus.unsubscribe === 'function') {
          this.eventBus.unsubscribe(eventName, handler);
        }
        const msg = `Timeout waiting for event ${eventName}`;
        this.log(msg, 'error');
        this.callbacks.setTestStatus(this.testId, 'failed');
        reject(new Error(msg));
      }, timeoutMilliseconds);

      if (this.eventBus && typeof this.eventBus.subscribe === 'function') {
        this.eventBus.subscribe(eventName, handler);
        
        // Track this listener for cleanup
        this._addEventListenerToTracking(eventName, handler);
      } else {
        clearTimeout(timeoutId);
        const msg =
          'eventBus or its subscribe method is not available for waitForEvent';
        this.log(msg, 'error');
        reject(new Error(msg));
      }
    });
  }

  async completeTest(overallPassStatus) {
    this.log(
      `Test completion signal: ${overallPassStatus ? 'PASSED' : 'FAILED'}`
    );
    
    // Mark as completed and cleanup event listeners
    this.isCompleted = true;
    this._cleanupAllEventListeners();
    
    // The status update and event emission will be handled by the callback
    this.callbacks.completeTest(this.testId, overallPassStatus);
  }

  // New method: pollForCondition
  async pollForCondition(checkFn, description, timeoutMs, intervalMs) {
    const logPrefix = this.testId ? `[${this.testId}] ` : '';
    this.log(
      `${logPrefix}Polling for condition: \"${description}\" (timeout: ${timeoutMs}ms, interval: ${intervalMs}ms)...`
    );
    const startTime = Date.now();

    return new Promise((resolve) => {
      const intervalId = setInterval(async () => {
        let conditionMet = false;
        try {
          conditionMet = await checkFn();
        } catch (e) {
          this.log(
            `${logPrefix}Error in checkFn for condition "${description}": ${e}`,
            'error'
          );
          // Continue polling until timeout
        }

        if (conditionMet) {
          clearInterval(intervalId);
          this.log(`${logPrefix}Condition met for: \"${description}\".`);
          resolve(true);
        } else if (Date.now() - startTime > timeoutMs) {
          clearInterval(intervalId);
          this.log(
            `${logPrefix}Timeout polling for condition: \"${description}\".`,
            'warn'
          );
          resolve(false);
        }
      }, intervalMs);
    });
  }

  async pollForValue(checkFn, description, timeoutMs, intervalMs) {
    const logPrefix = this.testId ? `[${this.testId}] ` : '';
    this.log(
      `${logPrefix}Polling for value: \"${description}\" (timeout: ${timeoutMs}ms, interval: ${intervalMs}ms)...`
    );
    const startTime = Date.now();

    return new Promise((resolve) => {
      const intervalId = setInterval(async () => {
        let result = null;
        let errorOccurred = false;
        try {
          result = await checkFn();
        } catch (e) {
          this.log(
            `${logPrefix}Error in checkFn for value "${description}": ${e}`,
            'error'
          );
          errorOccurred = true;
        }

        // Resolve if a truthy result is found (and no error occurred)
        if (!errorOccurred && result) {
          clearInterval(intervalId);
          this.log(`${logPrefix}Value found for: \"${description}\".`);
          resolve(result);
        } else if (Date.now() - startTime > timeoutMs) {
          clearInterval(intervalId);
          this.log(
            `${logPrefix}Timeout polling for value: \"${description}\".`,
            'warn'
          );
          resolve(null); // Resolve with null on timeout or if result remains null/falsy
        }
        // If errorOccurred or result is falsy, continue polling until timeout
      }, intervalMs);
    });
  }

  /**
   * Fetch a rules.json file by path and hand it to the StateManager worker,
   * waiting for the worker to confirm via `stateManager:rulesLoaded` before
   * resolving. Shared backbone for `loadALTTPRules` and `reloadCurrentRules`.
   *
   * @param {string} rulesPath - Path to the rules JSON file
   * @param {{playerId?: string, playerName?: string}} [options]
   * @returns {Promise<void>} - Resolves when rules are loaded and ready
   */
  async loadRulesFromFile(rulesPath, options = {}) {
    if (!this.stateManager) {
      throw new Error('StateManager proxy not available for loadRulesFromFile.');
    }
    await this.stateManager.ensureReady(5000);

    const playerId = options.playerId || DEFAULT_PLAYER_ID;
    const playerInfo = {
      playerId,
      playerName: options.playerName || `TestPlayer${playerId}`,
    };

    this.log(`Loading rules from file: ${rulesPath}`);
    const response = await fetch(rulesPath);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch rules from ${rulesPath}: ${response.status} ${response.statusText}`
      );
    }
    const rulesData = await response.json();

    // Subscribe BEFORE issuing the command to avoid the race where the
    // worker confirms before we're listening.
    const rulesLoadedPromise = this.waitForEvent('stateManager:rulesLoaded', 8000);
    await this.stateManager.loadRules(rulesData, playerInfo, rulesPath);
    await rulesLoadedPromise;
  }

  /**
   * Load the canonical ALTTP rules for tests that require that game mode.
   * Always loads the same file regardless of what was previously loaded.
   */
  async loadALTTPRules(options = {}) {
    return this.loadRulesFromFile(
      './presets/alttp/AP_14089154938208861744/AP_14089154938208861744_rules.json',
      options
    );
  }

  /**
   * Reload whatever rules.json file is currently loaded. Useful when a test
   * wants to start from a fresh state without knowing which preset is active.
   * Only file-path sources are supported (i.e. rules loaded via
   * `loadRulesFromFile` / `loadALTTPRules`).
   */
  async reloadCurrentRules(options = {}) {
    if (!this.stateManager) {
      throw new Error('StateManager proxy not available for reloadCurrentRules.');
    }
    const currentSource = this.stateManager.getRawJsonDataSource();
    if (!currentSource) {
      throw new Error('No rules source available to reload.');
    }
    if (typeof currentSource !== 'string' || !currentSource.includes('.json')) {
      throw new Error(
        `Cannot reload rules from source type: ${currentSource}. Only file paths are supported.`
      );
    }
    return this.loadRulesFromFile(currentSource, options);
  }

  // === Event Listener Tracking and Cleanup Methods ===
  
  /**
   * Add an event listener to the tracking map
   * @private
   */
  _addEventListenerToTracking(eventName, handler) {
    if (!this.activeEventListeners.has(eventName)) {
      this.activeEventListeners.set(eventName, new Set());
    }
    this.activeEventListeners.get(eventName).add(handler);
    this.log(`Tracking event listener for ${eventName} (total: ${this.activeEventListeners.get(eventName).size})`, 'debug');
  }
  
  /**
   * Remove an event listener from the tracking map
   * @private
   */
  _removeEventListenerFromTracking(eventName, handler) {
    if (this.activeEventListeners.has(eventName)) {
      this.activeEventListeners.get(eventName).delete(handler);
      if (this.activeEventListeners.get(eventName).size === 0) {
        this.activeEventListeners.delete(eventName);
      }
      this.log(`Removed tracking for event listener on ${eventName}`, 'debug');
    }
  }
  
  /**
   * Clean up all active event listeners when test completes
   * @private
   */
  _cleanupAllEventListeners() {
    if (this.activeEventListeners.size === 0) {
      this.log('No active event listeners to clean up', 'debug');
      return;
    }
    
    let totalCleaned = 0;
    for (const [eventName, handlers] of this.activeEventListeners.entries()) {
      this.log(`Cleaning up ${handlers.size} listeners for event: ${eventName}`, 'info');
      
      for (const handler of handlers) {
        if (this.eventBus && typeof this.eventBus.unsubscribe === 'function') {
          try {
            this.eventBus.unsubscribe(eventName, handler);
            totalCleaned++;
          } catch (error) {
            this.log(`Error unsubscribing from ${eventName}: ${error.message}`, 'warn');
          }
        }
      }
    }
    
    // Clear the tracking map
    this.activeEventListeners.clear();
    this.log(`Event listener cleanup completed. Cleaned up ${totalCleaned} listeners.`, 'info');
  }
}
