/**
 * Shared helper functions for proof/graph module index.js files.
 *
 * Provides common utilities used by all proof module entry points:
 *   - Player world extraction from static data
 *   - Structure detection (proof_structure or graph_structure)
 *   - State snapshot synchronization
 */

import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js';

/**
 * Get the player-specific world data from static data.
 * @param {Object} staticData
 * @returns {Object|null}
 */
export function getPlayerWorld(staticData) {
  if (!staticData?.world) return null;
  const playerId = staticData.playerId || '1';
  return staticData.world[playerId] || null;
}

/**
 * The loaded document's location names, for matching proof steps to them
 * (ProofBaseState._resolveLocationNames). Null when static data has none.
 * @param {Object} staticData
 * @returns {Set<string>|null}
 */
export function getDocLocationNames(staticData) {
  const locations = staticData?.locations;
  if (!locations) return null;
  const names = new Set();
  const add = (key, value) => {
    const name = value?.name ?? key;
    if (typeof name === 'string') names.add(name);
  };
  if (locations instanceof Map) {
    for (const [key, value] of locations) add(key, value);
  } else if (Array.isArray(locations)) {
    for (const entry of locations) {
      if (Array.isArray(entry)) add(entry[0], entry[1]);
      else add(undefined, entry);
    }
  } else if (typeof locations === 'object') {
    for (const [key, value] of Object.entries(locations)) add(key, value);
  }
  return names.size > 0 ? names : null;
}

/**
 * Sync a proof state from a stateManager snapshot.
 * Handles the { snapshot: ... } wrapper and falls back to getLatestStateSnapshot().
 *
 * @param {Object} state - A proof state instance (must have syncInventory, syncLocations)
 * @param {Object} [snapshotData] - Event data (may be wrapped)
 */
export function syncStateFromSnapshot(state, snapshotData) {
  if (!state) return;
  const snapshot = snapshotData?.snapshot || snapshotData || stateManager.getLatestStateSnapshot();
  if (!snapshot) return;

  if (snapshot.inventory) {
    state.syncInventory(snapshot.inventory);
  }
  if (snapshot.checkedLocations) {
    state.syncLocations(snapshot.checkedLocations);
  }
}

/**
 * Report the local player's goal if the proof is complete.
 *
 * Publishes `user:goalReached` via the module dispatcher, which the client
 * module forwards to the AP server as a single CLIENT_GOAL status update.
 * Safe to call after every sync: the client-side guard (messageHandler
 * `_goalReported`) ensures the goal is only sent once per connection, and
 * re-arms on reconnect so a previously-finished game re-reports its goal.
 *
 * Only the local player's proof state is consulted, so this never fires off
 * another player's progress in a multiworld.
 *
 * @param {Object} state - A proof state instance (must have isProofComplete)
 * @param {Object} dispatcher - The module dispatcher
 * @param {Function} [log] - Logger function
 */
export function reportGoalIfComplete(state, dispatcher, log) {
  if (!state?.isLoaded || !dispatcher) return;
  if (typeof state.isProofComplete !== 'function' || !state.isProofComplete()) return;

  log?.('info', 'Proof complete — reporting goal to server (user:goalReached)');
  dispatcher.publish('user:goalReached', { originator: 'proof' }, {
    initialTarget: 'bottom',
  });
}

/**
 * Create a logger function for a proof module.
 *
 * @param {string} moduleName - e.g. 'proofQueue'
 * @returns {Function} log(level, message, ...data)
 */
export function createLogger(moduleName) {
  return function log(level, message, ...data) {
    if (typeof window !== 'undefined' && window.logger) {
      window.logger[level](moduleName, message, ...data);
    } else {
      const method = console[level === 'info' ? 'log' : level] || console.log;
      method(`[${moduleName}] ${message}`, ...data);
    }
  };
}

/**
 * Check if slot data contains a proof or graph structure.
 * @param {Object} slotData
 * @returns {boolean}
 */
export function hasStructureData(slotData) {
  return !!(slotData?.proof_structure || slotData?.graph_structure);
}

/**
 * Initialize proof/graph state from static data.
 * Common pattern used by all proof module index.js initialize functions.
 *
 * Accepts either proof_structure (MetaMath) or graph_structure (DepGraph).
 *
 * @param {Object} state - The proof state instance
 * @param {Object} staticData - Static data from stateManager
 * @param {Function} log - Logger function
 * @param {Function} wirePublishing - Function to wire event bus publishing
 * @returns {boolean} Whether initialization succeeded
 */
export function initializeProofState(state, staticData, log, wirePublishing) {
  const playerWorld = getPlayerWorld(staticData);
  const slotData = playerWorld?.slot_data;
  if (!hasStructureData(slotData)) {
    log('info', 'No proof_structure or graph_structure — not a proof/graph game');
    return false;
  }

  // Already loaded from THIS document (the UI's rulesLoaded handler may have
  // loaded it first): just make sure the bus publishing is wired. A state
  // loaded from an earlier document (the mode's boot preset, before a connect
  // loaded the room's rules) is reloaded below, so the goal is the room's, open
  // panel or not.
  if (state.isLoaded && state.loadedSlotData === slotData) {
    log('info', 'Structure already loaded, wiring event bus publishing');
    wirePublishingOnce(state, wirePublishing);
    syncStateFromSnapshot(state);
    return true;
  }

  const structureType = slotData.proof_structure ? 'proof' : 'graph';
  log('info', `Found ${structureType} structure, initializing...`);

  const success = state.loadFromSlotData(
    slotData,
    playerWorld.name_substitutions,
    playerWorld.options,
    getDocLocationNames(staticData)
  );

  if (!success) {
    log('warn', `Failed to load ${structureType} structure from slot data`);
    return false;
  }

  log('info', `Loaded ${structureType} "${state.theoremName}" with ${state.steps.size} steps`);

  syncStateFromSnapshot(state);
  wirePublishingOnce(state, wirePublishing);
  return true;
}

/**
 * Wire a module's event-bus publishing onto a state once: the wiring chains
 * onto the state's callbacks, so a second call would publish every event twice.
 */
function wirePublishingOnce(state, wirePublishing) {
  if (state._busPublishingWired) return;
  state._busPublishingWired = true;
  wirePublishing();
}
