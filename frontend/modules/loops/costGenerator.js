/**
 * Cost Generator for Loop Mode
 *
 * Generates per-region and per-location mana costs by running an actual
 * playthrough of the sphere log using the real loop game mechanics.
 *
 * The algorithm:
 * 1. Start at start region with max mana, costs initialized to defaults
 * 2. For each sphere log entry (location to check):
 *    a. Find path from start region to target location
 *    b. For each region in path without a cost:
 *       - Calculate cost = floor(currentMana / 2 / uncostedRegionsRemaining)
 *       - Assign to costDataManager BEFORE queuing the action
 *    c. For the location (if no cost assigned):
 *       - Calculate cost = floor(currentMana / 2)
 *       - Assign to costDataManager BEFORE queuing the action
 *    d. Queue actions via dispatcher/gameStateAPI
 *    e. Process through actual loop game mechanics
 *    f. Wait for completion, reset loop
 * 3. Assign default costs to any remaining unvisited regions/locations
 * 4. Output costs.json
 */

import { createUniversalLogger } from '../../app/core/universalLogger.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';
import { executeRegionMovePath } from '../shared/pathExecutor.js';
import { DEFAULT_TIME_DRAIN_PER_SECOND } from './costDataManager.js';

const logger = createUniversalLogger('costGenerator');

/**
 * CostGenerator class
 * Generates mana costs by running actual loop game mechanics
 */
export class CostGenerator {
  constructor(dependencies) {
    this.loopState = dependencies.loopState;
    this.stateManager = dependencies.stateManager;
    this.pathFinder = dependencies.pathFinder;
    this.eventBus = dependencies.eventBus;
    this.costDataManager = dependencies.costDataManager;
    this.dispatcher = dependencies.dispatcher;
    this.gameStateAPI = dependencies.gameStateAPI;

    // Generation state
    this.isGenerating = false;
    this.isCancelled = false;

    // Progress tracking
    this.totalEntries = 0;
    this.processedEntries = 0;

    // Track what we've assigned costs to
    this.assignedRegions = new Set();
    this.assignedLocations = new Set();
  }

  /**
   * Generate cost data from sphere log using actual game mechanics
   * @param {Array} sphereLog - Parsed sphere log entries
   * @param {string} sourceFileName - Name of the source file for metadata
   * @returns {Object} Generated cost data
   */
  async generate(sphereLog, sourceFileName = null) {
    if (this.isGenerating) {
      throw new Error('Generation already in progress');
    }

    this.isGenerating = true;
    this.isCancelled = false;
    this.assignedRegions = new Set();
    this.assignedLocations = new Set();

    logger.info('Starting cost generation with actual game mechanics...');

    try {
      // Save current loop state for restoration
      const savedState = this._saveLoopState();

      // Get start region
      const resolvedStartRegions = this.stateManager.getStartRegions?.() || [];
      const startRegion = resolvedStartRegions[0] || this._getFirstRegionFromStaticData();

      // Initialize cost data with defaults
      const costs = {
        version: '1.0',
        generatedAt: new Date().toISOString(),
        generatedFrom: sourceFileName,
        regions: {
          [startRegion]: { moveCost: 0 },
        },
        locations: {},
        defaultRegionCost: 50,
        defaultLocationCost: 10,
      };

      // Mark start region as assigned
      this.assignedRegions.add(startRegion);

      // Load initial costs into costDataManager
      this.costDataManager.setCostData(costs, 'generation-in-progress');
      logger.info(`Using start region: ${startRegion}`);

      // Configure loop state for generation
      this._configureLoopStateForGeneration();

      // Filter to state_update entries with sphere_locations
      const locationEntries = this._extractLocationEntries(sphereLog);
      this.totalEntries = locationEntries.length;
      this.processedEntries = 0;

      logger.info(`Processing ${this.totalEntries} location entries...`);

      // Process each location in sphere order
      for (const entry of locationEntries) {
        if (this.isCancelled) {
          logger.info('Generation cancelled');
          break;
        }

        await this._processLocationEntry(entry, costs, startRegion);
        this.processedEntries++;

        // Publish progress
        this.eventBus?.publish('costGenerator:progress', {
          processed: this.processedEntries,
          total: this.totalEntries,
          percent: Math.floor((this.processedEntries / this.totalEntries) * 100),
        });
      }

      // Assign default costs to unvisited regions/locations
      this._assignDefaultCosts(costs);

      // Update costDataManager with final costs
      this.costDataManager.setCostData(costs, sourceFileName || 'generated');

      // Restore original loop state
      this._restoreLoopState(savedState);

      logger.info('Cost generation complete');
      logger.info(`Generated costs for ${Object.keys(costs.regions).length} regions and ${Object.keys(costs.locations).length} locations`);

      return costs;
    } finally {
      this.isGenerating = false;
    }
  }

  /**
   * Whether a region belongs to a SUMMARY substrate (runner, bounce — M5).
   * Those regions are priced by TIME, not per action: a per-action cost
   * would double-charge on top of the time drain, so the generator emits a
   * drain rate for them and no moveCost / location costs at all (user
   * ruling 2026-07-23: summary substrates charge per-action only where the
   * data says so EXPLICITLY, which a generated sidecar must therefore not
   * say by default).
   *
   * Resolution goes through loopState's single capture-shape resolver so
   * the generator can never disagree with the runtime about what a region
   * is. Unknown / unavailable → false (today's behavior).
   */
  _isSummaryRegion(regionName) {
    try {
      return this.loopState?.getRegionCaptureShape?.(regionName) === 'summary';
    } catch {
      return false;
    }
  }

  /** The region a static location belongs to (same field order as _processLocationEntry). */
  _regionOfLocation(locationData) {
    return locationData?.parent_region || locationData?.region || null;
  }

  /**
   * Cancel ongoing generation
   */
  cancel() {
    if (this.isGenerating) {
      this.isCancelled = true;
      logger.info('Cancellation requested');
    }
  }

  /**
   * Get current progress
   * @returns {Object} Progress info
   */
  getProgress() {
    return {
      isGenerating: this.isGenerating,
      processed: this.processedEntries,
      total: this.totalEntries,
      percent: this.totalEntries > 0
        ? Math.floor((this.processedEntries / this.totalEntries) * 100)
        : 0,
    };
  }

  /**
   * Extract location entries from sphere log
   * @param {Array} sphereLog - Raw sphere log
   * @returns {Array} Flattened list of {sphereIndex, locationName, newRegions}
   */
  _extractLocationEntries(sphereLog) {
    const entries = [];
    const playerId = this._getCurrentPlayerId();

    if (!playerId) {
      logger.error(
        'CostGenerator: cannot extract sphere-log entries — no current player id ' +
        '(sphereState has none and the loaded rules carry no playerId). ' +
        'Refusing to generate costs for a guessed player.'
      );
      return entries;
    }

    for (const logEntry of sphereLog) {
      if (logEntry.type !== 'state_update') continue;

      const playerData = logEntry.player_data?.[playerId];
      if (!playerData) continue;

      const sphereLocations = playerData.sphere_locations || [];
      const newRegions = playerData.new_accessible_regions || [];

      // Count items received by this player in this sphere (from any source)
      const baseItems = playerData.new_inventory_details?.base_items || {};
      const itemsReceived = Object.values(baseItems).reduce((sum, count) => sum + count, 0);

      for (let i = 0; i < sphereLocations.length; i++) {
        entries.push({
          sphereIndex: logEntry.sphere_index,
          locationName: sphereLocations[i],
          newAccessibleRegions: newRegions,
          // Grant items received on the last location in the sphere
          itemsReceived: (i === sphereLocations.length - 1) ? itemsReceived : 0,
        });
      }

      // Items received without checking any locations (from other players)
      if (sphereLocations.length === 0 && itemsReceived > 0) {
        entries.push({
          sphereIndex: logEntry.sphere_index,
          locationName: null,
          newAccessibleRegions: newRegions,
          itemsReceived,
        });
      }
    }

    return entries;
  }

  /**
   * The player whose sphere-log slice drives generation.
   * Falls back to the state manager's stamped playerId (same value, available
   * before sphereState is up) and then to null — never to player 1, which
   * silently generated a plausible cost set for the wrong world.
   * @returns {string|null}
   */
  _getCurrentPlayerId() {
    const getIdFn = centralRegistry.getPublicFunction('sphereState', 'getCurrentPlayerId');
    const id = getIdFn?.();
    if (id) return String(id);

    const fromStatic = this.stateManager?.getStaticData?.()?.playerId;
    return fromStatic ? String(fromStatic) : null;
  }

  /**
   * Process a single location entry using actual game mechanics
   * @param {Object} entry - Location entry to process
   * @param {Object} costs - Cost data being built
   * @param {string} startRegion - Starting region for paths
   */
  async _processLocationEntry(entry, costs, startRegion) {
    const { locationName } = entry;
    const gs = this.gameStateAPI?.getState?.();

    // Phantom entry: no location to check, just apply mana boost from received items
    if (!locationName) {
      if (entry.itemsReceived > 0 && gs) {
        gs.maxMana += entry.itemsReceived * 10;
        gs.currentMana = gs.maxMana;
        logger.debug(`Mana boost from received items: +${entry.itemsReceived * 10} (now ${gs.maxMana})`);
      }
      return;
    }

    // Get location's region from static data
    const staticData = this.stateManager.getStaticData();
    const locationData = staticData?.locations?.get(locationName);

    if (!locationData) {
      // Location not in this game's static data (belongs to another player) — skip
      // but still apply any mana boost from items received
      if (entry.itemsReceived > 0 && gs) {
        gs.maxMana += entry.itemsReceived * 10;
        gs.currentMana = gs.maxMana;
      }
      logger.debug(`Skipping location not in this game: ${locationName}`);
      return;
    }

    const targetRegion = locationData.parent_region || locationData.region;
    if (!targetRegion) {
      logger.warn(`No region found for location: ${locationName}`);
      return;
    }

    logger.debug(`Processing: ${locationName} in ${targetRegion}`);

    // Clear the current queue - trim path back to start region
    this.gameStateAPI.trimPath?.(startRegion, 1);

    // Find path from start region to target region
    const path = this.pathFinder.findPathWithExits(startRegion, targetRegion);

    if (!path) {
      logger.warn(`No path found to ${targetRegion} for ${locationName}`);
      return;
    }

    // Identify regions in path without costs
    const uncostedRegions = path.steps
      .map(step => step.region)
      .filter(region => !this.assignedRegions.has(region));

    // Calculate and assign costs to uncosted regions BEFORE queuing
    const currentMana = gs ? gs.currentMana : 100;
    if (uncostedRegions.length > 0) {
      const manaForRegions = currentMana / 2;
      let remainingUncosted = uncostedRegions.length;

      for (const region of uncostedRegions) {
        if (this._isSummaryRegion(region)) {
          // Time-priced: a drain rate instead of a per-move cost.
          costs.regions[region] = { timeDrainPerSecond: DEFAULT_TIME_DRAIN_PER_SECOND };
          this.assignedRegions.add(region);
          remainingUncosted--;
          logger.debug(`Summary region — time-priced instead of per-move: ${region}`);
          continue;
        }
        const costPerRegion = Math.floor(manaForRegions / remainingUncosted);
        costs.regions[region] = {
          moveCost: Math.max(1, costPerRegion), // Minimum cost of 1
        };
        this.assignedRegions.add(region);
        remainingUncosted--;

        logger.debug(`Assigned region cost: ${region} = ${costPerRegion} (mana: ${currentMana})`);
      }

      // Update costDataManager so the costs are used when actions run
      this.costDataManager.setCostData(costs, 'generation-in-progress');
    }

    // Calculate and assign location cost BEFORE queuing (use half of remaining mana).
    // A check inside a SUMMARY region is free by default — the visit's time
    // is what costs — so it gets no entry at all and is marked assigned so
    // the default pass below doesn't fill one in.
    if (!this.assignedLocations.has(locationName) && this._isSummaryRegion(targetRegion)) {
      this.assignedLocations.add(locationName);
      logger.debug(`Summary region — location left free (time-priced): ${locationName}`);
    } else if (!this.assignedLocations.has(locationName)) {
      const locationCost = Math.floor(currentMana / 2);
      costs.locations[locationName] = Math.max(1, locationCost);
      this.assignedLocations.add(locationName);

      logger.debug(`Assigned location cost: ${locationName} = ${locationCost} (mana: ${currentMana})`);

      // Update costDataManager
      this.costDataManager.setCostData(costs, 'generation-in-progress');
    }

    // Queue the path actions using proper user:regionMove events.
    // path.steps[0] is the starting position; subsequent entries each
    // describe the region we're MOVING TO and the exit we used to get
    // there. Reshape into the canonical step list and dispatch via the
    // shared helper. NOTE: this.dispatcher here is the raw
    // EventDispatcher (4-arg publish), not the per-module wrapper —
    // wrap it so the helper sees the standard (eventName, data, opts)
    // signature with 'loops' bound as the originModuleId.
    const steps = path.steps.slice(1).map((step, index) => ({
      sourceRegion: index === 0 ? startRegion : path.steps[index].region,
      targetRegion: step.region,
      exitName: step.exitUsed,
    }));
    const dispatcher = {
      publish: (eventName, data, options) =>
        this.dispatcher.publish('loops', eventName, data, options),
    };
    executeRegionMovePath({ steps, dispatcher, source: 'loops-costGenerator' });

    // Add the location check at the end
    this.gameStateAPI.addLocationCheck?.(locationName, targetRegion);

    // Start processing if not already started
    if (!this.loopState.isProcessing) {
      this.loopState.startProcessing();
    }

    // Wait for the location to be checked
    await this._waitForLocationCheck(locationName);

    // Apply mana boost from items received in this sphere
    if (entry.itemsReceived > 0 && gs) {
      gs.maxMana += entry.itemsReceived * 10;
      logger.debug(`Mana boost from received items: +${entry.itemsReceived * 10} (now ${gs.maxMana})`);
    }

    // Reset loop for next entry (refill mana to maxMana, reset action progress)
    this.loopState._resetLoop?.();
    // Unpause after reset
    this.loopState.setPaused(false);

    // Small delay between iterations for stability
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  /**
   * Wait for a location to be checked
   * @param {string} locationName - Location to wait for
   * @returns {Promise<boolean>} True if checked, false if timeout
   */
  async _waitForLocationCheck(locationName) {
    return new Promise((resolve) => {
      let timeout;
      const handler = (data) => {
        const snapshot = data?.snapshot || this.stateManager.getLatestStateSnapshot();
        const isNowChecked = snapshot?.checkedLocations?.includes(locationName);

        if (isNowChecked) {
          clearTimeout(timeout);
          this.eventBus.unsubscribe('stateManager:snapshotUpdated', handler);
          resolve(true);
        }
      };

      this.eventBus.subscribe('stateManager:snapshotUpdated', handler);

      // Safety timeout (5 seconds per location in instant mode should be plenty)
      timeout = setTimeout(() => {
        this.eventBus.unsubscribe('stateManager:snapshotUpdated', handler);
        logger.warn(`Timeout waiting for ${locationName} to be checked`);
        resolve(false);
      }, 5000);
    });
  }

  /**
   * Assign default costs to unvisited regions/locations
   * @param {Object} costs - Cost data being built
   */
  _assignDefaultCosts(costs) {
    const staticData = this.stateManager.getStaticData();

    if (!staticData) return;

    // Find uncosted regions and use highest neighbor cost
    if (staticData.regions) {
      for (const [regionName, regionData] of staticData.regions.entries()) {
        if (!this.assignedRegions.has(regionName)) {
          if (this._isSummaryRegion(regionName)) {
            costs.regions[regionName] = { timeDrainPerSecond: DEFAULT_TIME_DRAIN_PER_SECOND };
            logger.debug(`Summary region — time-priced instead of per-move: ${regionName}`);
            continue;
          }
          const neighborCost = this._getHighestNeighborCost(regionName, regionData, costs);
          costs.regions[regionName] = {
            moveCost: neighborCost || costs.defaultRegionCost,
          };
          logger.debug(`Assigned default region cost: ${regionName} = ${neighborCost || costs.defaultRegionCost}`);
        }
      }
    }

    // Find uncosted locations and use highest existing location cost.
    // Locations inside a SUMMARY region stay uncosted (time-priced visit).
    if (staticData.locations) {
      const existingCosts = Object.values(costs.locations);
      const maxLocationCost = existingCosts.length > 0
        ? Math.max(costs.defaultLocationCost, ...existingCosts)
        : costs.defaultLocationCost;

      for (const [locationName, locationData] of staticData.locations.entries()) {
        if (this.assignedLocations.has(locationName)) continue;
        if (this._isSummaryRegion(this._regionOfLocation(locationData))) {
          logger.debug(`Summary region — location left free (time-priced): ${locationName}`);
          continue;
        }
        costs.locations[locationName] = maxLocationCost;
      }
    }
  }

  /**
   * Get highest cost of neighboring regions
   * @param {string} regionName - Region to check
   * @param {Object} regionData - Region data with exits
   * @param {Object} costs - Current cost data
   * @returns {number} Highest neighbor cost
   */
  _getHighestNeighborCost(regionName, regionData, costs) {
    let highestCost = 0;

    if (regionData.exits) {
      for (const exit of regionData.exits) {
        const neighborRegion = exit.connected_region;
        const neighborCost = costs.regions[neighborRegion]?.moveCost;
        if (neighborCost && neighborCost > highestCost) {
          highestCost = neighborCost;
        }
      }
    }

    return highestCost;
  }

  /**
   * Configure loop state for generation mode
   */
  _configureLoopStateForGeneration() {
    const gs = this.gameStateAPI?.getState?.();
    if (gs) {
      // Reset mana to max
      gs.currentMana = gs.maxMana;
      // Clear XP (fresh simulation)
      gs.regionXP = new Map();
    }

    // Enable instant mode and no-mana-depletion-reset
    this.loopState.setInstantMode(true);
    this.loopState.setNoManaDepletionReset(true);

    // Unpause
    this.loopState.setPaused(false);

    logger.info('Loop state configured for generation (instant mode, no mana reset)');
  }

  /**
   * Save current loop state for restoration
   * @returns {Object} Saved state
   */
  _saveLoopState() {
    const gs = this.gameStateAPI?.getState?.();
    return {
      currentMana: gs ? gs.currentMana : 100,
      maxMana: gs ? gs.maxMana : 100,
      regionXP: gs ? new Map(gs.regionXP) : new Map(),
      isPaused: this.loopState.isPaused,
      isProcessing: this.loopState.isProcessing,
      instantMode: this.loopState.instantMode,
      noManaDepletionReset: gs ? gs.noManaDepletionReset : false,
      gameSpeed: this.loopState.gameSpeed,
    };
  }

  /**
   * Restore saved loop state
   * @param {Object} savedState - State to restore
   */
  _restoreLoopState(savedState) {
    const gs = this.gameStateAPI?.getState?.();
    if (gs) {
      gs.currentMana = savedState.currentMana;
      gs.maxMana = savedState.maxMana;
      gs.regionXP = savedState.regionXP;
    }
    this.loopState.isPaused = savedState.isPaused;
    this.loopState.isProcessing = savedState.isProcessing;
    this.loopState.setInstantMode(savedState.instantMode);
    this.loopState.setNoManaDepletionReset(savedState.noManaDepletionReset);
    this.loopState.setGameSpeed(savedState.gameSpeed);

    // Stop any ongoing processing
    this.loopState.stopProcessing?.();

    logger.info('Loop state restored');
  }

  /**
   * Export costs to JSON string
   * @returns {string} JSON string
   */
  exportToJSON() {
    const costs = this.costDataManager.getCostData();
    return JSON.stringify(costs, null, 2);
  }

  /**
   * Get the generated costs
   * @returns {Object} Cost data
   */
  getCosts() {
    return this.costDataManager.getCostData();
  }

  /**
   * Get the first region from static data as a fallback start region
   * @returns {string|null} First region name or null
   */
  _getFirstRegionFromStaticData() {
    const staticData = this.stateManager.getStaticData();
    if (staticData?.regions?.size > 0) {
      return staticData.regions.keys().next().value;
    }
    return null;
  }
}

export default CostGenerator;
