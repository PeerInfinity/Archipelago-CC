import { evaluateRule } from './ruleEngine.js';
import eventBus from '../../app/core/eventBus.js';
import { ALTTPInventory } from '../../app/games/alttp/inventory.js';
import { ALTTPState } from '../../app/games/alttp/state.js';
import { ALTTPHelpers } from '../../app/games/alttp/helpers.js';
import { StateManager } from './stateManager.js';
import stateManagerSingleton from './stateManagerSingleton.js';

// --- Module Info ---
export const moduleInfo = {
  name: 'stateManager',
  description: 'Core game state management.',
};

// --- StateManager Class Definition ---
class StateManager {
  constructor() {
    this.inventory = new ALTTPInventory();
    this.state = new ALTTPState();
    this.helpers = new ALTTPHelpers();
    this.playerSlot = 1;
    this.team = 0;
    this.locations = [];
    this.regions = {};
    this.eventLocations = new Map();
    this.indirectConnections = new Map();
    this.knownReachableRegions = new Set();
    this.knownUnreachableRegions = new Set();
    this.cacheValid = false;
    this.path = new Map();
    this.blockedConnections = new Set();
    this._computing = false;
    this.mode = null;
    this.settings = null;
    this.startRegions = null;
    this.itemData = {};
    this.groupData = {};
    this.checkedLocations = new Set();
    this._batchMode = false;
    this._deferRegionComputation = false;
    this._batchedUpdates = new Map();
    this.debugMode = false;
    this.itemNameToId = {};
    this.locationNameToId = {};
    console.log('[StateManager Instance] Created.');
  }

  /**
   * Logs debug messages if debugMode is enabled.
   */
  _logDebug(message, data = null) {
    if (this.debugMode) {
      if (data) {
        try {
          const clonedData = JSON.parse(JSON.stringify(data));
          console.debug(message, clonedData);
        } catch (e) {
          console.debug(message, '[Could not clone data]', data);
        }
      } else {
        console.debug(message);
      }
    }
  }

  /**
   * Notifies listeners via the event bus.
   */
  _publishEvent(eventType, eventData = {}) {
    try {
      const fullEventName = `stateManager:${eventType}`;
      eventBus.publish(fullEventName, eventData);
      this._logDebug(
        `[StateManager Instance] Published ${fullEventName} via eventBus`,
        eventData
      );
    } catch (e) {
      console.warn(
        `[StateManager Instance] Could not publish ${eventType} to eventBus:`,
        e
      );
    }
  }

  /**
   * Initializes inventory (called before loadFromJSON).
   */
  initializeInventory(items = [], progressionMapping = {}, itemData = {}) {
    this.inventory = new ALTTPInventory(items, progressionMapping, itemData);
    this.itemData = itemData;
    console.log('[StateManager Instance] Inventory initialized.');
    // Don't publish yet, wait for full rules load
  }

  /**
   * Clears inventory state.
   */
  clearInventory() {
    const progressionMapping = this.inventory.progressionMapping || {};
    const itemData = this.inventory.itemData || {};
    const groupData = this.inventory.groupData || {};
    this.inventory = new ALTTPInventory([], progressionMapping, itemData);
    this.inventory.groupData = groupData;
    this.itemData = itemData;
    this.groupData = groupData;
    console.log('[StateManager Instance] Inventory cleared.');
    this.invalidateCache();
    this.computeReachableRegions(); // Recompute first
    this._publishEvent('inventoryChanged'); // Publish after recompute
  }

  /**
   * Clears entire game state.
   */
  clearState() {
    const progressionMapping = this.inventory.progressionMapping || {};
    const itemData = this.inventory.itemData || {};
    const groupData = this.inventory.groupData || {};
    this.inventory = new ALTTPInventory([], progressionMapping, itemData);
    this.inventory.groupData = groupData;
    this.itemData = itemData;
    this.groupData = groupData;
    this.state = new ALTTPState();
    this.clearCheckedLocations(); // Publishes checkedLocationsCleared
    this.indirectConnections = new Map();
    this.invalidateCache();
    console.log('[StateManager Instance] Full state cleared.');
    this.computeReachableRegions(); // Recompute first
    this._publishEvent('inventoryChanged'); // Publish after recompute
  }

  /**
   * Adds an item.
   */
  addItemToInventory(itemName) {
    if (!this.itemData || !this.itemData[itemName]) {
      console.warn(
        `[StateManager Instance] Attempted to add unknown item: ${itemName}`
      );
      return false;
    }
    if (this._batchMode) {
      const currentCount =
        this._batchedUpdates.get(itemName) || this.inventory.count(itemName);
      this._batchedUpdates.set(itemName, currentCount + 1);
    } else {
      this.inventory.addItem(itemName);
      this._logDebug(`[StateManager Instance] Added item: ${itemName}`);
      this.invalidateCache();
      this.computeReachableRegions(); // Recompute first
      this._publishEvent('inventoryChanged'); // Publish after recompute
    }
    return true;
  }

  /**
   * Gets item count.
   */
  getItemCount(itemName) {
    return this.inventory.count(itemName);
  }

  /**
   * Loads state from JSON data.
   */
  loadFromJSON(jsonData, selectedPlayerId) {
    console.log(
      `[StateManager Instance] Loading JSON for player ${selectedPlayerId}...`
    );
    // ... (validation and data extraction logic as before) ...
    if (!jsonData.schema_version || jsonData.schema_version !== 3) {
      throw new Error(
        '[StateManager Instance] Invalid JSON format: requires schema version 3'
      );
    }
    if (!selectedPlayerId) {
      throw new Error(
        '[StateManager Instance] loadFromJSON called without selectedPlayerId'
      );
    }
    this.playerSlot = parseInt(selectedPlayerId, 10);
    const playerData = {
      regions: jsonData.regions?.[selectedPlayerId],
      itemData: jsonData.items?.[selectedPlayerId],
      groupData: jsonData.item_groups?.[selectedPlayerId],
      progressionMapping: jsonData.progression_mapping?.[selectedPlayerId],
      itempoolCounts: jsonData.itempool_counts?.[selectedPlayerId],
      settings: jsonData.settings?.[selectedPlayerId],
      startRegions: jsonData.start_regions?.[selectedPlayerId],
      mode: jsonData.mode?.[selectedPlayerId],
    };
    if (
      !playerData.regions ||
      !playerData.itemData ||
      !playerData.groupData ||
      !playerData.progressionMapping ||
      !playerData.settings
    ) {
      console.error(
        '[StateManager Instance] Missing essential data for player:',
        selectedPlayerId,
        playerData
      );
      throw new Error(
        `Missing essential data fields for player ${selectedPlayerId} in JSON.`
      );
    }
    this.regions = playerData.regions;
    this.itemData = playerData.itemData;
    this.groupData = playerData.groupData;
    this.settings = playerData.settings;
    this.startRegions = playerData.startRegions;
    this.mode = playerData.mode;
    this.itempool_counts = playerData.itempoolCounts;
    if (this.inventory) {
      this.inventory.progressionMapping = playerData.progressionMapping;
      this.inventory.itemData = this.itemData;
      this.inventory.groupData = this.groupData;
    }
    this.itemNameToId = {};
    Object.entries(this.itemData).forEach(([itemName, data]) => {
      if (data.id !== undefined && data.id !== null) {
        this.itemNameToId[itemName] = data.id;
        if (this.inventory.itemData[itemName]) {
          this.inventory.itemData[itemName].id = data.id;
        }
      }
    });
    this.locationNameToId = {};
    this.locations = [];
    this.eventLocations.clear();
    this.indirectConnections = new Map();
    Object.values(this.regions).forEach((region) => {
      region.locations.forEach((loc) => {
        loc.region = region.name;
        const locationData = { ...loc, player: region.player };
        this.locations.push(locationData);
        if (locationData.event) {
          this.eventLocations.set(locationData.name, locationData);
        }
        if (locationData.id !== undefined && locationData.id !== null) {
          this.locationNameToId[locationData.name] = locationData.id;
        }
      });
    });
    this.buildIndirectConnections();
    this.state.loadSettings(this.settings);
    console.log(
      '[StateManager Instance] Loaded rules, settings, locations from JSON.'
    );

    this.invalidateCache();
    this.computeReachableRegions(); // This computes reachability and publishes regionsComputed

    console.log('[StateManager Instance] Finished processing JSON load.');

    // Publish event *after* processing and initial computation
    this._publishEvent('rulesLoaded', {
      source: 'jsonData',
      selectedPlayerId: selectedPlayerId,
      rules: {
        items: this.itemData,
        groups: this.groupData,
        // Other relevant data can be added here
      },
    });
  }

  /**
   * Builds indirect connections map.
   */
  buildIndirectConnections() {
    this.indirectConnections.clear();
    if (!this.regions) return;
    Object.values(this.regions).forEach((region) => {
      region.exits.forEach((exit) => {
        if (exit.rule) {
          const dependencies = this.findRegionDependencies(exit.rule);
          dependencies.forEach((depRegionName) => {
            if (!this.indirectConnections.has(depRegionName)) {
              this.indirectConnections.set(depRegionName, new Set());
            }
            if (exit.name) {
              this.indirectConnections.get(depRegionName).add(exit.name);
            }
          });
        }
      });
    });
  }

  /**
   * Finds region dependencies in a rule.
   */
  findRegionDependencies(rule) {
    const dependencies = new Set();
    // ... (Implementation from original stateManager.js) ...
    if (!rule) return dependencies;
    if (typeof rule === 'string') {
      if (this.regions && this.regions[rule]) {
        dependencies.add(rule);
      } else {
        const match = rule.match(/@helper\/[^\(]+\(([^\)]+)\)/);
        if (match && match[1]) {
          const args = match[1].split(/,\s*/);
          args.forEach((arg) => {
            const cleanArg = arg.replace(/['"]/g, '');
            if (this.regions && this.regions[cleanArg]) {
              dependencies.add(cleanArg);
            }
          });
        }
      }
    } else if (Array.isArray(rule)) {
      rule.forEach((subRule) => {
        this.findRegionDependencies(subRule).forEach((dep) =>
          dependencies.add(dep)
        );
      });
    } else if (typeof rule === 'object') {
      Object.values(rule).forEach((subRule) => {
        this.findRegionDependencies(subRule).forEach((dep) =>
          dependencies.add(dep)
        );
      });
    }
    return dependencies;
  }

  /**
   * Invalidates reachability cache.
   */
  invalidateCache() {
    this.cacheValid = false;
    this.knownReachableRegions.clear();
    this.knownUnreachableRegions.clear();
    this.path = new Map();
    this.blockedConnections = new Set();
    this._logDebug('[StateManager Instance] Cache invalidated.');
  }

  /**
   * Computes reachable regions.
   */
  computeReachableRegions() {
    if (this._computing || this.cacheValid) {
      // if (this._computing) console.warn('[StateManager Instance] Recursive computeReachableRegions call detected.');
      return;
    }
    if (!this.regions || Object.keys(this.regions).length === 0) {
      this._logDebug(
        '[StateManager Instance] Cannot compute regions: Region data not loaded.'
      );
      return;
    }
    this._logDebug('[StateManager Instance] Starting region computation...');
    this._computing = true;
    this.invalidateCache();
    let changed = true;
    let collectedItems = false;
    while (changed) {
      changed = false;
      const currentPassRegions = this.runBFSPass();
      let newRegionsFound = false;
      currentPassRegions.forEach((regionName) => {
        if (!this.knownReachableRegions.has(regionName)) {
          this.knownReachableRegions.add(regionName);
          newRegionsFound = true;
        }
      });
      if (newRegionsFound) {
        this._logDebug(
          `[StateManager Instance] New regions found: ${[
            ...currentPassRegions,
          ].join(', ')}`
        );
        changed = true;
        collectedItems = this.collectEventItems(); // Collect items and check if inventory changed
        if (collectedItems) {
          this._logDebug(
            '[StateManager Instance] Collected event items, restarting computation.'
          );
          this.invalidateCache(); // Inventory changed, invalidate again
          collectedItems = false;
          continue; // Restart while loop immediately
        }
      }
    }
    this._computing = false;
    this.cacheValid = true;
    this._logDebug('[StateManager Instance] Region computation complete.');
    this._publishEvent('regionsComputed'); // Publish after computation is fully stable
  }

  /**
   * Runs one BFS pass.
   */
  runBFSPass() {
    const queue = this.getStartRegions();
    const reachedInPass = new Set(queue);
    const visitedEntrances = new Set();
    queue.forEach((regionName) => {
      if (!this.path.has(regionName)) {
        this.path.set(regionName, {
          name: regionName,
          entrance: null,
          previousRegion: null,
        });
      }
    });
    let head = 0;
    while (head < queue.length) {
      const currentRegionName = queue[head++];
      const currentRegion = this.regions[currentRegionName];
      if (!currentRegion) {
        this._logDebug(`Warning: Region data missing for ${currentRegionName}`);
        continue;
      }
      currentRegion.exits.forEach((exit) => {
        const destinationRegionName = exit.connects;
        const entranceName = exit.name;
        if (!destinationRegionName || !this.regions[destinationRegionName]) {
          return;
        }
        if (visitedEntrances.has(entranceName)) {
          return;
        }
        const ruleContext = { region: currentRegion, exit: exit };
        const canPass = this.evaluateRuleWithPathContext(
          exit.rule,
          ruleContext
        );
        if (canPass) {
          visitedEntrances.add(entranceName);
          this.blockedConnections.delete(entranceName);
          if (!reachedInPass.has(destinationRegionName)) {
            reachedInPass.add(destinationRegionName);
            queue.push(destinationRegionName);
            this._logDebug(
              `Reached ${destinationRegionName} via ${entranceName}`
            );
            if (!this.path.has(destinationRegionName)) {
              this.path.set(destinationRegionName, {
                name: destinationRegionName,
                entrance: entranceName,
                previousRegion: currentRegionName,
              });
            }
          }
        } else {
          this.blockedConnections.add(entranceName);
        }
      });
    }
    return reachedInPass;
  }

  /**
   * Evaluates rule with path context.
   */
  evaluateRuleWithPathContext(rule, context) {
    return evaluateRule(
      rule,
      this.inventory,
      this.state,
      this.helpers,
      context,
      this
    );
  }

  /**
   * Gets starting regions.
   */
  getStartRegions() {
    if (this.startRegions && this.startRegions.length > 0) {
      return [...this.startRegions];
    }
    console.warn(
      '[StateManager Instance] No explicit start_regions defined. Falling back.'
    );
    // ... (Fallback logic from original stateManager.js) ...
    const allDestinations = new Set();
    Object.values(this.regions).forEach((region) => {
      region.exits.forEach((exit) => {
        if (exit.connects) {
          allDestinations.add(exit.connects);
        }
      });
    });
    const starts = Object.keys(this.regions).filter(
      (name) => !allDestinations.has(name)
    );
    if (starts.length === 0 && Object.keys(this.regions).length > 0) {
      console.warn(
        '[StateManager Instance] Fallback failed. Using first region.'
      );
      return [Object.keys(this.regions).sort()[0]];
    }
    return starts;
  }

  /**
   * Checks region reachability.
   */
  isRegionReachable(regionName) {
    if (!this.cacheValid) {
      this.computeReachableRegions();
    }
    return this.knownReachableRegions.has(regionName);
  }

  /**
   * Checks location accessibility.
   */
  isLocationAccessible(location) {
    if (!location || !location.region || !location.name) return false;
    if (!this.isRegionReachable(location.region)) {
      return false;
    }
    return evaluateRule(
      location.rule,
      this.inventory,
      this.state,
      this.helpers,
      { location: location },
      this
    );
  }

  /**
   * Gets processed locations.
   */
  getProcessedLocations(
    sorting = 'original',
    showReachable = true,
    showUnreachable = true
  ) {
    if (!this.cacheValid) {
      this.computeReachableRegions();
    }
    let processed = this.locations.map((loc) => {
      const isReachable = this.isRegionReachable(loc.region);
      const canAccess =
        isReachable &&
        evaluateRule(
          loc.rule,
          this.inventory,
          this.state,
          this.helpers,
          { location: loc },
          this
        );
      return { ...loc, isReachable, canAccess };
    });
    processed = processed.filter(
      (loc) =>
        (loc.canAccess && showReachable) || (!loc.canAccess && showUnreachable)
    );
    if (sorting === 'alphabetical') {
      processed.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sorting === 'reachableFirst') {
      processed.sort((a, b) =>
        a.canAccess === b.canAccess
          ? a.name.localeCompare(b.name)
          : a.canAccess
          ? -1
          : 1
      );
    }
    return processed;
  }

  /**
   * Gets path to region.
   */
  getPathToRegion(regionName) {
    // ... (Implementation from original stateManager.js) ...
    if (!this.isRegionReachable(regionName)) {
      return null;
    }
    if (!this.path.has(regionName)) {
      const startRegions = this.getStartRegions();
      if (startRegions.includes(regionName)) {
        return [{ region: regionName, entrance: null }];
      } else {
        console.warn(`Path not found for reachable region: ${regionName}`);
        return null;
      }
    }
    const constructedPath = [];
    let current = this.path.get(regionName);
    while (current) {
      constructedPath.unshift({
        region: current.name,
        entrance: current.entrance,
      });
      if (!current.previousRegion) break;
      current = this.path.get(current.previousRegion);
      if (
        !current &&
        constructedPath[0]?.region !== this.getStartRegions()[0]
      ) {
        console.error('Path reconstruction failed.');
        return null;
      }
    }
    return constructedPath;
  }

  /**
   * Gets all paths.
   */
  getAllPaths() {
    // ... (Implementation from original stateManager.js) ...
    if (!this.cacheValid) {
      this.computeReachableRegions();
    }
    const allPathsMap = new Map();
    this.knownReachableRegions.forEach((regionName) => {
      const path = this.getPathToRegion(regionName);
      if (path) {
        allPathsMap.set(regionName, path);
      }
    });
    return allPathsMap;
  }

  /**
   * Updates inventory from list.
   */
  updateInventoryFromList(items) {
    this.beginBatchUpdate();
    items.forEach((item) => this.addItemToInventory(item));
    this.commitBatchUpdate();
  }

  /**
   * Collects event items.
   */
  collectEventItems() {
    let collected = false;
    this.eventLocations.forEach((location) => {
      if (
        !this.inventory.has(location.name) &&
        this.isLocationAccessible(location)
      ) {
        this._logDebug(`Collecting event item: ${location.name}`);
        this.inventory.addItem(location.name);
        collected = true;
      }
    });
    // Publish inventoryChanged *only if* items were collected, *after* the collection loop completes.
    if (collected) {
      this._publishEvent('inventoryChanged');
    }
    return collected;
  }

  /**
   * Checks if location is checked.
   */
  isLocationChecked(locationName) {
    return this.checkedLocations.has(locationName);
  }

  /**
   * Marks location as checked.
   */
  checkLocation(locationName) {
    if (!this.checkedLocations.has(locationName)) {
      this.checkedLocations.add(locationName);
      this._logDebug(`Checked location: ${locationName}`);
      const location = this.locations.find((loc) => loc.name === locationName);
      this._publishEvent('locationChecked', {
        locationName: locationName,
        regionName: location?.region,
      });
    }
  }

  /**
   * Clears checked locations.
   */
  clearCheckedLocations() {
    if (this.checkedLocations.size > 0) {
      this.checkedLocations.clear();
      this._logDebug('[StateManager Instance] Cleared checked locations.');
      this._publishEvent('checkedLocationsCleared');
    }
  }

  /**
   * Begins batch update.
   */
  beginBatchUpdate(deferRegionComputation = true) {
    this._batchMode = true;
    this._deferRegionComputation = deferRegionComputation;
    this._batchedUpdates.clear();
    this._logDebug('[StateManager Instance] Beginning batch update.');
  }

  /**
   * Commits batch update.
   */
  commitBatchUpdate() {
    if (!this._batchMode) return;
    this._logDebug('[StateManager Instance] Committing batch update...');
    this._batchMode = false;
    let inventoryChanged = false;
    this._batchedUpdates.forEach((targetCount, itemName) => {
      const currentCount = this.inventory.count(itemName);
      if (currentCount !== targetCount) {
        // TODO: Need setItemCount or similar in inventory for efficiency
        if (targetCount > currentCount) {
          for (let i = 0; i < targetCount - currentCount; i++) {
            this.inventory.addItem(itemName);
          }
        } else {
          console.warn(
            `Batch commit needs inventory.removeItem for ${itemName}`
          );
        }
        inventoryChanged = true;
      }
    });
    this._batchedUpdates.clear();
    if (inventoryChanged) {
      this._logDebug('Inventory changed during batch update.');
      this.invalidateCache();
    }
    if (!this._deferRegionComputation || inventoryChanged) {
      this._logDebug('Recomputing regions after batch commit.');
      this.computeReachableRegions(); // Recompute first
    }
    // Publish inventoryChanged *after* potential recomputation
    if (inventoryChanged) {
      this._publishEvent('inventoryChanged');
    }
    this._logDebug('[StateManager Instance] Batch update committed.');
  }

  /**
   * Fetches and processes the default rules JSON.
   */
  async loadDefaultRules() {
    this._logDebug(
      '[StateManager Instance] Attempting to load default_rules.json...'
    );
    try {
      const response = await fetch('./default_rules.json');
      if (!response.ok) {
        throw new Error(
          `HTTP error fetching default rules! status: ${response.status}`
        );
      }
      const jsonData = await response.json();
      this._logDebug('Successfully fetched default_rules.json');
      // === Player Selection Logic ===
      let selectedPlayerId = null;
      const playerNames = jsonData.player_names || {};
      const playerIds = Object.keys(playerNames);
      if (playerIds.length === 0) {
        throw new Error('No players found.');
      } else if (playerIds.length === 1) {
        selectedPlayerId = playerIds[0];
        this._logDebug(`Auto-selected player: ${selectedPlayerId}`);
      } else {
        const playerOptions = playerIds
          .map((id) => `${id}: ${playerNames[id]}`)
          .join('\n');
        const choice = prompt(
          `Multiple players found:\n${playerOptions}\nEnter ID:`
        );
        if (choice && playerNames[choice]) {
          selectedPlayerId = choice;
          this._logDebug(`User selected player: ${selectedPlayerId}`);
        } else {
          throw new Error('Invalid player selection.');
        }
      }
      // === End Player Selection ===
      this.loadFromJSON(jsonData, selectedPlayerId); // This processes and publishes rulesLoaded
    } catch (error) {
      console.error(
        '[StateManager Instance] Failed load/process default rules:',
        error
      );
      this._publishEvent('rulesLoadError', { error: error, source: 'default' });
      throw error;
    }
  }

  /**
   * Sets debug mode.
   */
  setDebugMode(mode) {
    this.debugMode = !!mode;
    console.log(`[StateManager Instance] Debug mode set to: ${this.debugMode}`);
  }

  // --- Compatibility methods (can_reach, collect, item_count, etc.) ---
  can_reach(region, type = 'Region', player = 1) {
    if (player !== this.playerSlot) {
      this._logDebug(`can_reach check for wrong player (${player})`);
      return false;
    }
    return this.isRegionReachable(region);
  }
  collect(item, event = false, player = 1) {
    if (player !== this.playerSlot) {
      console.warn(`collect ignored for player ${player}`);
      return;
    }
    this.addItemToInventory(item);
  }
  item_count(item, player = 1) {
    if (player !== this.playerSlot) {
      return 0;
    }
    return this.getItemCount(item);
  }
  can_hypothetically_reach(helperName, ...args) {
    return this.helpers.executeHelper(
      helperName,
      args,
      this,
      this.state,
      this.inventory
    );
  }

  // ... other methods like getItemId, getLocationId, debug methods ...
  getItemId(itemName) {
    return this.itemNameToId[itemName] ?? null;
  }
  getItemNameFromId(itemId) {
    /* ... iterate ... */ for (const [n, i] of Object.entries(
      this.itemNameToId
    )) {
      if (i === itemId) return n;
    }
    return null;
  }
  getLocationId(locationName) {
    return this.locationNameToId[locationName] ?? null;
  }
  getLocationNameFromId(locationId) {
    /* ... iterate ... */ for (const [n, i] of Object.entries(
      this.locationNameToId
    )) {
      if (i === locationId) return n;
    }
    return null;
  }
  // ... (debugCriticalRegions, debugRuleEvaluation etc. can be included if needed) ...
}

// --- Module Lifecycle Functions --- //

/**
 * Registration function for the StateManager module.
 * Registers event bus publishers.
 */
export function register(registrationApi) {
  console.log('[StateManager Module] Registering publishers...');
  // Register publishers for events the StateManager class instance will emit
  registrationApi.registerEventBusPublisher('stateManager:rulesLoaded');
  registrationApi.registerEventBusPublisher('stateManager:inventoryChanged');
  registrationApi.registerEventBusPublisher('stateManager:regionsComputed');
  registrationApi.registerEventBusPublisher('stateManager:locationChecked');
  registrationApi.registerEventBusPublisher(
    'stateManager:checkedLocationsCleared'
  );
  registrationApi.registerEventBusPublisher('stateManager:ready'); // If StateManager uses this
  registrationApi.registerEventBusPublisher('rulesLoadError');
}

/**
 * Initialization function for the StateManager module.
 * Creates the real StateManager instance and sets it on the singleton.
 */
export function initialize(moduleId, priorityIndex, initializationApi) {
  console.log(
    `[StateManager Module] Initializing with priority ${priorityIndex}...`
  );
  // Create the actual instance and replace the stub in the singleton
  console.log('[StateManager Module] Creating real StateManager instance...');
  const realInstance = new StateManager();
  stateManagerSingleton.setInstance(realInstance);
  console.log(
    '[StateManager Module] Real StateManager instance created and set.'
  );
  console.log(
    '[StateManager Module] Basic initialization complete (instance ready).'
  );
}

/**
 * Post-initialization function for the StateManager module.
 * Triggers the loading of default rules using the instance from the singleton.
 */
export function postInitialize(initializationApi) {
  console.log('[StateManager Module] Post-initializing...');
  console.log(
    '[StateManager Module] Triggering load of default rules via singleton instance...'
  );
  // Access the instance via the singleton and call its method
  stateManagerSingleton.instance.loadDefaultRules().catch((error) => {
    console.error(
      '[StateManager Module] Error during initial default rules load triggered by postInitialize:',
      error
    );
    // Event bus notification for the error is handled within loadDefaultRules
  });
  console.log('[StateManager Module] Post-initialization complete.');
}

// --- Exports --- //

// Export the singleton wrapper object (preferred way to access the instance)
export { stateManagerSingleton };

// Export the StateManager class if needed elsewhere (less common)
export { StateManager };

// Create and export a convenience constant `stateManager` that directly points
// to the singleton's instance getter. This provides easy access like `stateManager.addItem(...)`
// while still respecting the singleton pattern.
export const stateManager = stateManagerSingleton.instance;
