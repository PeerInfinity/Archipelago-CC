/**
 * Cost Generator for Loop Mode
 *
 * Generates per-region and per-location mana costs by simulating
 * a playthrough of the sphere log using the actual game systems.
 *
 * The algorithm:
 * 1. Start at Menu with max mana
 * 2. For each sphere log entry (location to check):
 *    a. Find path from Menu to target location
 *    b. Assign costs to uncosted regions (currentMana / 2 / uncostedCount)
 *    c. Assign location cost (currentMana)
 *    d. Simulate traveling the path (explore/move actions)
 *    e. Simulate checking the location
 *    f. Award XP, reduce mana
 *    g. If mana runs out, reset loop and continue
 *    h. After checking, reset loop
 * 3. Assign default costs to any remaining unvisited regions/locations
 * 4. Output costs.json
 */

import { createUniversalLogger } from '../../app/core/universalLogger.js';

const logger = createUniversalLogger('costGenerator');

/**
 * CostGenerator class
 * Generates mana costs by simulating sphere log playthrough
 */
export class CostGenerator {
  constructor(dependencies) {
    this.loopState = dependencies.loopState;
    this.stateManager = dependencies.stateManager;
    this.pathFinder = dependencies.pathFinder;
    this.eventBus = dependencies.eventBus;

    // Cost data being generated
    this.costs = {
      version: '1.0',
      generatedAt: null,
      generatedFrom: null,
      regions: {
        Menu: { moveCost: 0 },
      },
      locations: {},
      defaultRegionCost: 10,
      defaultLocationCost: 10,
    };

    // Simulation state
    this.discoveredRegions = new Set(['Menu']);
    this.checkedLocations = new Set();
    this.isGenerating = false;
    this.isCancelled = false;

    // Progress tracking
    this.totalEntries = 0;
    this.processedEntries = 0;
  }

  /**
   * Generate cost data from sphere log
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

    logger.info('Starting cost generation...');

    try {
      // Save current state
      const savedState = this._saveState();

      // Reset for simulation
      this._resetForSimulation();

      // Initialize cost data
      this.costs = {
        version: '1.0',
        generatedAt: new Date().toISOString(),
        generatedFrom: sourceFileName,
        regions: {
          Menu: { moveCost: 0 },
        },
        locations: {},
        defaultRegionCost: 10,
        defaultLocationCost: 10,
      };

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

        await this._processLocationEntry(entry);
        this.processedEntries++;

        // Publish progress
        this.eventBus?.publish('costGenerator:progress', {
          processed: this.processedEntries,
          total: this.totalEntries,
          percent: Math.floor((this.processedEntries / this.totalEntries) * 100),
        }, 'loops');
      }

      // Assign default costs to unvisited regions/locations
      this._assignDefaultCosts();

      // Restore original state
      this._restoreState(savedState);

      logger.info('Cost generation complete');
      logger.info(`Generated costs for ${Object.keys(this.costs.regions).length} regions and ${Object.keys(this.costs.locations).length} locations`);

      return this.costs;
    } finally {
      this.isGenerating = false;
    }
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

    for (const logEntry of sphereLog) {
      if (logEntry.type !== 'state_update') continue;

      const playerData = logEntry.player_data?.['1']; // Single player
      if (!playerData) continue;

      const sphereLocations = playerData.sphere_locations || [];
      const newRegions = playerData.new_accessible_regions || [];

      for (const locationName of sphereLocations) {
        entries.push({
          sphereIndex: logEntry.sphere_index,
          locationName,
          newAccessibleRegions: newRegions,
        });
      }
    }

    return entries;
  }

  /**
   * Process a single location entry
   * @param {Object} entry - Location entry to process
   */
  async _processLocationEntry(entry) {
    const { locationName, newAccessibleRegions } = entry;

    // Get location's region from static data
    const staticData = this.stateManager.getStaticData();
    const locationData = staticData?.locations?.get(locationName);

    if (!locationData) {
      logger.warn(`Location not found in static data: ${locationName}`);
      return;
    }

    const targetRegion = locationData.parent_region || locationData.region;
    if (!targetRegion) {
      logger.warn(`No region found for location: ${locationName}`);
      return;
    }

    logger.debug(`Processing: ${locationName} in ${targetRegion}`);

    // Find path from Menu to target region
    const path = this.pathFinder.findPathWithExits('Menu', targetRegion);

    if (!path) {
      logger.warn(`No path found to ${targetRegion} for ${locationName}`);
      return;
    }

    // Identify uncosted regions in path
    const uncostedRegions = path.steps
      .map(step => step.region)
      .filter(region => !this.costs.regions[region]);

    // Assign costs to uncosted regions
    if (uncostedRegions.length > 0) {
      const manaForRegions = this.loopState.currentMana / 2;
      const costPerRegion = Math.floor(manaForRegions / uncostedRegions.length);

      for (const region of uncostedRegions) {
        this.costs.regions[region] = {
          moveCost: Math.max(1, costPerRegion), // Minimum cost of 1
        };
        logger.debug(`Assigned region cost: ${region} = ${costPerRegion}`);
      }
    }

    // Assign location cost (use current mana as the cost)
    if (!this.costs.locations[locationName]) {
      this.costs.locations[locationName] = Math.floor(this.loopState.currentMana);
      logger.debug(`Assigned location cost: ${locationName} = ${this.costs.locations[locationName]}`);
    }

    // Simulate traveling the path
    await this._simulatePath(path, locationName);

    // Reset loop after checking location
    this._resetLoop();
  }

  /**
   * Simulate traveling a path and checking a location
   * @param {Object} path - Path with steps
   * @param {string} locationName - Location to check at the end
   */
  async _simulatePath(path, locationName) {
    for (let i = 0; i < path.steps.length; i++) {
      const step = path.steps[i];
      const region = step.region;

      // First visit to a region = explore (2x move cost)
      // Subsequent visits = move (1x move cost)
      const isFirstVisit = !this.discoveredRegions.has(region);
      const regionCost = this.costs.regions[region]?.moveCost || this.costs.defaultRegionCost;
      const actionCost = isFirstVisit ? regionCost * 2 : regionCost;

      // Consume mana
      this.loopState.currentMana -= actionCost;

      // Award XP for this region
      if (this.loopState.addRegionXP) {
        this.loopState.addRegionXP(region, actionCost);
      }

      // Mark as discovered
      if (isFirstVisit) {
        this.discoveredRegions.add(region);
      }

      // Check for mana depletion
      if (this.loopState.currentMana <= 0) {
        logger.debug('Mana depleted during path traversal, resetting loop');
        this._resetLoop();
        // Continue from where we stopped (simplified - just reset and continue)
      }
    }

    // Check the location
    const locationCost = this.costs.locations[locationName] || this.costs.defaultLocationCost;
    this.loopState.currentMana -= locationCost;

    // Award XP for location's region
    const staticData = this.stateManager.getStaticData();
    const locationData = staticData?.locations?.get(locationName);
    const locationRegion = locationData?.parent_region || locationData?.region;
    if (locationRegion && this.loopState.addRegionXP) {
      this.loopState.addRegionXP(locationRegion, locationCost);
    }

    this.checkedLocations.add(locationName);

    // Check for mana depletion
    if (this.loopState.currentMana <= 0) {
      logger.debug('Mana depleted after location check, resetting loop');
      this._resetLoop();
    }
  }

  /**
   * Reset the loop (refill mana, keep XP)
   */
  _resetLoop() {
    this.loopState.currentMana = this.loopState.maxMana;
    // Keep discovered regions and XP
  }

  /**
   * Assign default costs to unvisited regions/locations
   */
  _assignDefaultCosts() {
    const staticData = this.stateManager.getStaticData();

    if (!staticData) return;

    // Find uncosted regions and use highest neighbor cost
    if (staticData.regions) {
      for (const [regionName, regionData] of staticData.regions.entries()) {
        if (!this.costs.regions[regionName]) {
          const neighborCost = this._getHighestNeighborCost(regionName, regionData);
          this.costs.regions[regionName] = {
            moveCost: neighborCost || this.costs.defaultRegionCost,
          };
          logger.debug(`Assigned default region cost: ${regionName} = ${neighborCost || this.costs.defaultRegionCost}`);
        }
      }
    }

    // Find uncosted locations and use highest existing location cost
    if (staticData.locations) {
      const maxLocationCost = Math.max(
        this.costs.defaultLocationCost,
        ...Object.values(this.costs.locations)
      );

      for (const [locationName] of staticData.locations.entries()) {
        if (!this.costs.locations[locationName]) {
          this.costs.locations[locationName] = maxLocationCost;
        }
      }
    }
  }

  /**
   * Get highest cost of neighboring regions
   * @param {string} regionName - Region to check
   * @param {Object} regionData - Region data with exits
   * @returns {number} Highest neighbor cost
   */
  _getHighestNeighborCost(regionName, regionData) {
    let highestCost = 0;

    if (regionData.exits) {
      for (const exit of regionData.exits) {
        const neighborRegion = exit.connected_region;
        const neighborCost = this.costs.regions[neighborRegion]?.moveCost;
        if (neighborCost && neighborCost > highestCost) {
          highestCost = neighborCost;
        }
      }
    }

    return highestCost;
  }

  /**
   * Save current state for restoration
   * @returns {Object} Saved state
   */
  _saveState() {
    return {
      currentMana: this.loopState.currentMana,
      maxMana: this.loopState.maxMana,
      regionXP: new Map(this.loopState.regionXP),
      isPaused: this.loopState.isPaused,
      isProcessing: this.loopState.isProcessing,
    };
  }

  /**
   * Restore saved state
   * @param {Object} savedState - State to restore
   */
  _restoreState(savedState) {
    this.loopState.currentMana = savedState.currentMana;
    this.loopState.maxMana = savedState.maxMana;
    this.loopState.regionXP = savedState.regionXP;
    this.loopState.isPaused = savedState.isPaused;
    this.loopState.isProcessing = savedState.isProcessing;
  }

  /**
   * Reset for simulation
   */
  _resetForSimulation() {
    // Reset mana to max
    this.loopState.currentMana = this.loopState.maxMana;

    // Clear XP (fresh simulation)
    this.loopState.regionXP = new Map();

    // Stop any processing
    this.loopState.isPaused = true;
    this.loopState.isProcessing = false;

    // Clear simulation tracking
    this.discoveredRegions = new Set(['Menu']);
    this.checkedLocations = new Set();
  }

  /**
   * Export costs to JSON string
   * @returns {string} JSON string
   */
  exportToJSON() {
    return JSON.stringify(this.costs, null, 2);
  }

  /**
   * Get the generated costs
   * @returns {Object} Cost data
   */
  getCosts() {
    return this.costs;
  }
}

export default CostGenerator;
