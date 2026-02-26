/**
 * Proof Queue module — MetaMath Easy mode.
 *
 * Provides a panel where players arrange proof steps in dependency order.
 * Only active when a MetaMath game is loaded (detected via slot_data.proof_structure).
 */

import proofQueueState from './proofQueueStateSingleton.js';
import { ProofQueueUI, setModuleEventBus, setDispatcher } from './proofQueueUI.js';
import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js';

// ─── Module Info ────────────────────────────────────────────

export const moduleInfo = {
  name: 'proofQueue',
  title: 'Proof Queue',
  componentType: 'proofQueuePanel',
  icon: '\u{1F9E0}', // brain emoji
  column: 3, // Right column
  description: 'Arrange MetaMath proof steps in dependency order.',
};

// ─── Module State ───────────────────────────────────────────

let _moduleEventBus = null;
let _dispatcher = null;
let _unsubscribeHandles = [];

function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('proofQueue', message, ...data);
  } else {
    const method = console[level === 'info' ? 'log' : level] || console.log;
    method(`[proofQueue] ${message}`, ...data);
  }
}

// ─── Registration ───────────────────────────────────────────

export function register(registrationApi) {
  log('info', 'Registering Proof Queue module...');

  // Load CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.type = 'text/css';
  link.href = 'modules/proofQueue/proofQueue.css';
  document.head.appendChild(link);

  // Register the panel component
  registrationApi.registerPanelComponent('proofQueuePanel', ProofQueueUI);

  // We dispatch location checks
  registrationApi.registerDispatcherSender('user:locationCheck', 'bottom', 'first');

  // Events we subscribe to
  registrationApi.registerEventBusSubscriberIntent('stateManager:rulesLoaded');
  registrationApi.registerEventBusSubscriberIntent('stateManager:snapshotUpdated');
  registrationApi.registerEventBusSubscriberIntent('stateManager:inventoryChanged');

  // Events we publish
  registrationApi.registerEventBusPublisher('proofQueue:stepChecked');
  registrationApi.registerEventBusPublisher('proofQueue:proofComplete');
  registrationApi.registerEventBusPublisher('proofQueue:queueChanged');

  // Public API
  registrationApi.registerPublicFunction(moduleInfo.name, 'getProofQueueState', () => proofQueueState);

  log('info', 'Registration complete.');
}

// ─── Initialization ─────────────────────────────────────────

export function initialize(moduleId, priorityIndex, initializationApi) {
  log('info', `Initializing with priority ${priorityIndex}...`);

  _moduleEventBus = initializationApi.getEventBus();
  _dispatcher = initializationApi.getDispatcher();

  // Pass references to UI module
  setModuleEventBus(_moduleEventBus);
  setDispatcher(_dispatcher);

  // Subscribe to rules loaded to initialize proof data
  if (_moduleEventBus) {
    const subscribe = (eventName, handler) => {
      const unsub = _moduleEventBus.subscribe(eventName, handler);
      _unsubscribeHandles.push(unsub);
    };

    subscribe('stateManager:rulesLoaded', handleRulesLoaded);
    subscribe('stateManager:snapshotUpdated', handleSnapshotUpdated);
    subscribe('stateManager:inventoryChanged', handleInventoryChanged);
  }

  // Check if rules are already loaded (late initialization)
  const staticData = stateManager.getStaticData();
  if (_getPlayerWorld(staticData)?.slot_data?.proof_structure) {
    _initializeProofFromStaticData(staticData);
  }

  log('info', 'Initialization complete.');

  // Return cleanup function
  return () => {
    log('info', 'Cleaning up...');
    _unsubscribeHandles.forEach(unsub => unsub());
    _unsubscribeHandles = [];
    _moduleEventBus = null;
    _dispatcher = null;
  };
}

// ─── Event Handlers ─────────────────────────────────────────

function handleRulesLoaded() {
  log('info', 'Received stateManager:rulesLoaded');

  const staticData = stateManager.getStaticData();
  if (!staticData) return;

  _initializeProofFromStaticData(staticData);
}

function handleSnapshotUpdated(snapshotData) {
  if (!proofQueueState?.isLoaded) return;
  _syncStateFromSnapshot(snapshotData);
}

function handleInventoryChanged() {
  if (!proofQueueState?.isLoaded) return;
  _syncStateFromSnapshot();
}

// ─── Internal Helpers ───────────────────────────────────────

/**
 * Get the player-specific world data from static data.
 * @param {Object} staticData
 * @returns {Object|null}
 */
function _getPlayerWorld(staticData) {
  if (!staticData?.world) return null;
  const playerId = staticData.playerId || '1';
  return staticData.world[playerId] || null;
}

function _initializeProofFromStaticData(staticData) {
  const playerWorld = _getPlayerWorld(staticData);
  if (!playerWorld?.slot_data?.proof_structure) {
    log('info', 'No proof_structure in slot data — not a MetaMath game');
    return;
  }

  log('info', 'Found MetaMath proof structure, initializing...');

  const success = proofQueueState.loadFromSlotData(
    playerWorld.slot_data,
    playerWorld.name_substitutions
  );

  if (!success) {
    log('warn', 'Failed to load proof structure from slot data');
    return;
  }

  log('info',
    `Loaded proof for "${proofQueueState.theoremName}" with ${proofQueueState.steps.size} steps`
  );

  // Sync current inventory/location state
  _syncStateFromSnapshot();

  // Wire queue change notifications to event bus
  proofQueueState.onQueueChanged = () => {
    if (_moduleEventBus) {
      _moduleEventBus.publish('proofQueue:queueChanged', {
        queue: [...proofQueueState.queue],
        validation: proofQueueState.validateQueue(),
      });
    }
  };
}

function _syncStateFromSnapshot(snapshotData) {
  if (!proofQueueState) return;
  const snapshot = snapshotData || stateManager.getLatestStateSnapshot();
  if (!snapshot) return;

  if (snapshot.inventory) {
    proofQueueState.syncInventory(snapshot.inventory);
  }
  if (snapshot.checkedLocations) {
    const locMap = {};
    for (const loc of snapshot.checkedLocations) {
      locMap[loc] = true;
    }
    proofQueueState.syncLocations(locMap);
  }
}
