/**
 * Worker-Side Spoiler Test Execution
 *
 * Processes sphere events entirely within the worker to eliminate
 * communication overhead with the main thread.
 *
 * This module is designed to run inside the StateManager worker thread,
 * with direct access to the StateManager instance and its methods.
 *
 * @module stateManager/core/workerSpoilerTest
 */

import { profiler } from '../../shared/profiler.js';
import { evaluateRule } from '../../shared/ruleEngine.js';
import { createStateSnapshotInterface } from '../../shared/stateInterface.js';

/**
 * Worker-side spoiler test runner
 *
 * Processes all sphere events within the worker, eliminating round-trip
 * communication overhead with the main thread.
 */
export class WorkerSpoilerTest {
  /**
   * Create a new WorkerSpoilerTest instance
   *
   * @param {Object} stateManager - The StateManager instance
   * @param {Function} postMessage - Function to send messages to main thread
   * @param {Function} logger - Logging function (level, message, ...args)
   */
  constructor(stateManager, postMessage, logger) {
    this.sm = stateManager;
    this.postMessage = postMessage;
    this.log = logger || (() => {});
    this.aborted = false;
    this.analysisCompleteResolver = null;
  }

  /**
   * Run the full spoiler test
   *
   * @param {Array} sphereData - Pre-processed sphere data from sphereState
   * @param {Object} config - Test configuration
   * @param {number} config.playerId - Player ID
   * @param {boolean} config.stopOnFirstError - Halt on first mismatch (default: true)
   * @param {boolean} config.waitForMainThreadAnalysis - Wait for main thread analysis (default: false)
   * @param {boolean} config.verboseMode - Enable verbose logging
   * @param {boolean} config.focusedMode - Focused regression test mode
   * @param {Array} config.focusLocations - Locations to focus on in focused mode
   * @returns {Promise<Object>} Test results
   */
  async run(sphereData, config) {
    const {
      playerId,
      stopOnFirstError = true,
      waitForMainThreadAnalysis = false,
      verboseMode = false,
      focusedMode = false,
      focusLocations = []
    } = config;

    this.playerId = playerId;
    this.playerIdKey = String(playerId);
    this.verboseMode = verboseMode;
    this.focusedMode = focusedMode;
    this.focusLocations = focusLocations;
    this.previousInventory = {};

    profiler.start('workerSpoilerTest');

    const results = {
      passed: true,
      totalEvents: sphereData.length,
      processedEvents: 0,
      mismatchDetails: [],
      locationsChecked: 0,
      itemsAdded: 0,
      aborted: false
    };

    try {
      // Configure StateManager for test
      this.sm.setAutoCollectEventsConfig(false);
      this.sm.setSpoilerTestMode(true);

      this.log('info', `[WorkerSpoilerTest] Starting test with ${sphereData.length} spheres`);

      for (let i = 0; i < sphereData.length; i++) {
        if (this.aborted) {
          results.aborted = true;
          this.log('info', '[WorkerSpoilerTest] Test aborted');
          break;
        }

        const sphere = sphereData[i];
        const sphereResult = await this.processSphere(sphere, i);

        results.processedEvents++;
        results.locationsChecked += sphereResult.locationsChecked;
        results.itemsAdded += sphereResult.itemsAdded;

        // Send progress update
        this.postMessage({
          type: 'spoilerTestProgress',
          eventIndex: i,
          totalEvents: sphereData.length,
          sphereIndex: sphere.sphereIndex,
          passed: sphereResult.passed,
          locationsChecked: sphereResult.locationsChecked,
          itemsAdded: sphereResult.itemsAdded
        });

        if (!sphereResult.passed) {
          results.passed = false;
          results.mismatchDetails.push(...sphereResult.mismatches);

          // Send mismatch details
          this.postMessage({
            type: 'spoilerTestMismatch',
            eventIndex: i,
            sphereIndex: sphere.sphereIndex,
            mismatches: sphereResult.mismatches,
            awaitingAnalysis: waitForMainThreadAnalysis && !stopOnFirstError
          });

          if (stopOnFirstError) {
            this.log('info', `[WorkerSpoilerTest] Stopping on first error at sphere ${sphere.sphereIndex}`);
            break;
          }

          if (waitForMainThreadAnalysis) {
            // Wait for main thread to complete analysis
            await this.waitForAnalysisComplete();
          }
        }

        // Update previous inventory for next sphere
        this.updatePreviousInventory(sphere);
      }
    } catch (error) {
      this.log('error', `[WorkerSpoilerTest] Error during test: ${error.message}`, error);
      results.passed = false;
      results.error = error.message;
    } finally {
      // Restore StateManager configuration
      this.sm.setAutoCollectEventsConfig(true);
      this.sm.setSpoilerTestMode(false);

      profiler.end('workerSpoilerTest');
      results.profilingData = profiler.getData();
    }

    return results;
  }

  /**
   * Process a single sphere
   *
   * @param {Object} sphere - Sphere data
   * @param {number} index - Sphere index in array
   * @returns {Promise<Object>} Sphere processing result
   */
  async processSphere(sphere, index) {
    const result = {
      passed: true,
      mismatches: [],
      locationsChecked: 0,
      itemsAdded: 0
    };

    const sphereIndex = sphere.sphereIndex;
    const sphereNumberInt = parseInt(String(sphereIndex).split('.')[0], 10);

    this.log('info', `[WorkerSpoilerTest] Processing sphere ${sphereIndex}`);

    try {
      // Clear state at sphere 0
      if (sphereNumberInt === 0 && index === 0) {
        this.sm.clearStateAndReset();
        this.log('debug', '[WorkerSpoilerTest] Cleared state for sphere 0');

        // Add starting items
        const startingItems = this.sm.staticData?.starting_items?.[this.playerIdKey] || [];
        if (startingItems.length > 0) {
          for (const itemName of startingItems) {
            this.sm.addItemToInventory(itemName, 1);
            result.itemsAdded++;
          }
          this.log('info', `[WorkerSpoilerTest] Added ${startingItems.length} starting items`);
        }
      }

      // Get exporter settings
      const exporterSettings = this.sm.staticData?.exporter?.[this.playerIdKey] || {};
      const addItemsUpfront = exporterSettings.add_sphere_items_upfront || false;
      const useResolvedItems = exporterSettings.use_resolved_items || false;

      // Determine inventory source
      const inventoryDetails = sphere.inventoryDetails || {};
      const baseItems = inventoryDetails.base_items || {};
      const resolvedItems = inventoryDetails.resolved_items || {};
      const inventoryFromLog = useResolvedItems ? { ...resolvedItems } : { ...baseItems };

      // Find newly added items
      const newlyAddedItems = this.findNewlyAddedItems(this.previousInventory, inventoryFromLog);

      if (addItemsUpfront) {
        // Add items upfront mode (DLCQuest, Blasphemous, etc.)
        const isSphere0Base = sphereNumberInt === 0 && !String(sphereIndex).includes('.');

        if (!isSphere0Base && newlyAddedItems.length > 0) {
          for (const itemName of newlyAddedItems) {
            this.sm.addItemToInventory(itemName, 1);
            result.itemsAdded++;
          }
          this.log('info', `[WorkerSpoilerTest] Added ${newlyAddedItems.length} items upfront`);
        }

        // Compare after adding items
        this.sm.invalidateCache();
        const snapshot = this.sm.getStateSnapshot();

        const locationResult = this.compareLocations(
          sphere.accessibleLocations || [],
          snapshot,
          sphereIndex
        );

        const regionResult = this.compareRegions(
          sphere.accessibleRegions || [],
          snapshot,
          sphereIndex
        );

        if (!locationResult.passed) {
          result.passed = false;
          result.mismatches.push(locationResult.mismatch);
        }

        if (!regionResult.passed) {
          result.passed = false;
          result.mismatches.push(regionResult.mismatch);
        }
      } else {
        // Normal mode: check locations one by one
        const locationsToCheck = sphere.locations || [];

        if (locationsToCheck.length > 0) {
          this.log('info', `[WorkerSpoilerTest] Checking ${locationsToCheck.length} locations`);

          for (const locationName of locationsToCheck) {
            // Get location definition
            const locationDef = this.sm.staticData?.locations?.get?.(locationName) ||
                               this.sm.staticData?.locations?.[locationName];

            if (!locationDef) {
              this.log('warn', `[WorkerSpoilerTest] Location "${locationName}" not found`);
              continue;
            }

            // Verify accessibility before checking
            const preCheckSnapshot = this.sm.getStateSnapshot();
            const snapshotInterface = createStateSnapshotInterface(
              preCheckSnapshot,
              this.sm.staticData,
              { playerId: this.playerId }
            );
            const isAccessible = snapshotInterface.isLocationAccessible(locationName);

            if (!isAccessible) {
              this.log('error', `[WorkerSpoilerTest] Location "${locationName}" not accessible!`);
              result.passed = false;
              result.mismatches.push({
                type: 'pre_check_failure',
                sphereIndex: sphereIndex,
                location: locationName,
                message: `Location "${locationName}" should be accessible but is not`
              });

              // In focused mode or stopOnFirstError, this is a critical failure
              if (this.focusedMode) {
                throw new Error(`Focused test failed: "${locationName}" not accessible`);
              }
              continue;
            }

            // Check the location (adds item to inventory)
            this.sm.checkLocation(locationName, true);
            result.locationsChecked++;
          }
        }

        // Invalidate cache and get fresh snapshot for comparison
        this.sm.invalidateCache();
        const freshSnapshot = this.sm.getStateSnapshot();

        // Skip full comparison in focused mode
        if (this.focusedMode) {
          this.log('info', `[WorkerSpoilerTest] Focused mode: sphere ${sphereIndex} passed`);
        } else {
          // Compare accessible locations
          const locationResult = this.compareLocations(
            sphere.accessibleLocations || [],
            freshSnapshot,
            sphereIndex
          );

          if (!locationResult.passed) {
            result.passed = false;
            result.mismatches.push(locationResult.mismatch);
          }

          // Compare accessible regions
          const regionResult = this.compareRegions(
            sphere.accessibleRegions || [],
            freshSnapshot,
            sphereIndex
          );

          if (!regionResult.passed) {
            result.passed = false;
            result.mismatches.push(regionResult.mismatch);
          }
        }
      }
    } catch (error) {
      this.log('error', `[WorkerSpoilerTest] Error processing sphere ${sphereIndex}: ${error.message}`);
      result.passed = false;
      result.mismatches.push({
        type: 'error',
        sphereIndex: sphereIndex,
        message: error.message
      });
    }

    return result;
  }

  /**
   * Compare accessible locations between log and current state
   *
   * @param {Array<string>} expectedLocations - Expected accessible locations from log
   * @param {Object} snapshot - Current state snapshot
   * @param {string} sphereIndex - Current sphere index
   * @returns {Object} Comparison result with passed flag and mismatch details
   */
  compareLocations(expectedLocations, snapshot, sphereIndex) {
    const result = { passed: true, mismatch: null };

    const snapshotInterface = createStateSnapshotInterface(
      snapshot,
      this.sm.staticData,
      { playerId: this.playerId }
    );

    // Get accessible unchecked locations from current state
    const stateAccessible = [];
    const locations = this.sm.staticData?.locations;

    if (locations) {
      const locationEntries = locations.entries ? [...locations.entries()] : Object.entries(locations);

      for (const [locName, locDef] of locationEntries) {
        // Skip checked locations
        if (snapshot.flags?.includes(locName)) continue;

        // Skip event locations
        if (locDef.item?.event) continue;

        // Check if location is accessible
        const parentRegion = locDef.parent_region_name || locDef.parent_region || locDef.region;
        const regionStatus = snapshot.regionReachability?.[parentRegion];
        const isRegionReachable = regionStatus === 'reachable' || regionStatus === 'checked';

        if (!isRegionReachable) continue;

        // Evaluate access rule
        let ruleResult = true;
        if (locDef.access_rule) {
          try {
            ruleResult = evaluateRule(locDef.access_rule, snapshotInterface);
          } catch (e) {
            this.log('warn', `[WorkerSpoilerTest] Error evaluating rule for ${locName}: ${e.message}`);
            ruleResult = false;
          }
        }

        if (ruleResult) {
          stateAccessible.push(locName);
        }
      }
    }

    // Compare sets
    const expectedSet = new Set(expectedLocations);
    const stateSet = new Set(stateAccessible);

    const missingFromState = expectedLocations.filter(loc => !stateSet.has(loc));
    const extraInState = stateAccessible.filter(loc => !expectedSet.has(loc));

    if (missingFromState.length > 0 || extraInState.length > 0) {
      result.passed = false;
      result.mismatch = {
        type: 'locations',
        sphereIndex: sphereIndex,
        missingFromState: missingFromState,
        extraInState: extraInState,
        expectedCount: expectedLocations.length,
        actualCount: stateAccessible.length
      };

      this.log('error', `[WorkerSpoilerTest] Location mismatch at sphere ${sphereIndex}: ` +
        `missing=${missingFromState.length}, extra=${extraInState.length}`);
    }

    return result;
  }

  /**
   * Compare accessible regions between log and current state
   *
   * @param {Array<string>} expectedRegions - Expected accessible regions from log
   * @param {Object} snapshot - Current state snapshot
   * @param {string} sphereIndex - Current sphere index
   * @returns {Object} Comparison result with passed flag and mismatch details
   */
  compareRegions(expectedRegions, snapshot, sphereIndex) {
    const result = { passed: true, mismatch: null };

    // Get reachable regions from snapshot
    const stateReachable = [];
    const regionReachability = snapshot.regionReachability || {};

    for (const [regionName, status] of Object.entries(regionReachability)) {
      if (status === 'reachable') {
        stateReachable.push(regionName);
      }
    }

    // Compare sets
    const expectedSet = new Set(expectedRegions);
    const stateSet = new Set(stateReachable);

    const missingFromState = expectedRegions.filter(reg => !stateSet.has(reg));
    const extraInState = stateReachable.filter(reg => !expectedSet.has(reg));

    if (missingFromState.length > 0 || extraInState.length > 0) {
      result.passed = false;
      result.mismatch = {
        type: 'regions',
        sphereIndex: sphereIndex,
        missingFromState: missingFromState,
        extraInState: extraInState,
        expectedCount: expectedRegions.length,
        actualCount: stateReachable.length
      };

      this.log('error', `[WorkerSpoilerTest] Region mismatch at sphere ${sphereIndex}: ` +
        `missing=${missingFromState.length}, extra=${extraInState.length}`);
    }

    return result;
  }

  /**
   * Find newly added items by comparing inventories
   *
   * @param {Object} previousInventory - Previous inventory state
   * @param {Object} currentInventory - Current inventory state
   * @returns {Array<string>} List of newly added item names (with duplicates for multiple)
   */
  findNewlyAddedItems(previousInventory, currentInventory) {
    const newlyAdded = [];

    for (const [itemName, currentCount] of Object.entries(currentInventory)) {
      const previousCount = previousInventory[itemName] || 0;
      if (currentCount > previousCount) {
        const addedCount = currentCount - previousCount;
        for (let i = 0; i < addedCount; i++) {
          newlyAdded.push(itemName);
        }
      }
    }

    return newlyAdded;
  }

  /**
   * Update previous inventory from sphere data
   *
   * @param {Object} sphere - Current sphere data
   */
  updatePreviousInventory(sphere) {
    const exporterSettings = this.sm.staticData?.exporter?.[this.playerIdKey] || {};
    const useResolvedItems = exporterSettings.use_resolved_items || false;

    const inventoryDetails = sphere.inventoryDetails || {};
    if (useResolvedItems) {
      this.previousInventory = { ...(inventoryDetails.resolved_items || {}) };
    } else {
      this.previousInventory = { ...(inventoryDetails.base_items || {}) };
    }
  }

  /**
   * Wait for main thread to signal analysis complete
   *
   * @returns {Promise<void>}
   */
  waitForAnalysisComplete() {
    return new Promise(resolve => {
      this.analysisCompleteResolver = resolve;
    });
  }

  /**
   * Signal that main thread analysis is complete
   * Called when worker receives 'analysisComplete' message
   */
  signalAnalysisComplete() {
    if (this.analysisCompleteResolver) {
      this.analysisCompleteResolver();
      this.analysisCompleteResolver = null;
    }
  }

  /**
   * Abort the test
   */
  abort() {
    this.aborted = true;
  }
}

export default WorkerSpoilerTest;
