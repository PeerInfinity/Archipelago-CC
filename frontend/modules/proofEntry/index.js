/**
 * Proof Entry module — MetaMath Hard mode.
 *
 * Provides a panel where players must type theorem labels or expressions
 * to discover proof steps, then arrange them in dependency order.
 * Only active when a MetaMath game is loaded (detected via slot_data.proof_structure).
 */

import proofEntryState from './proofEntryStateSingleton.js';
import { ProofEntryUI, setModuleEventBus, setDispatcher } from './proofEntryUI.js';
import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js';

// ─── Module Info ────────────────────────────────────────────

export const moduleInfo = {
  name: 'proofEntry',
  title: 'Proof Entry',
  componentType: 'proofEntryPanel',
  icon: '\u{270D}', // writing hand emoji
  column: 3,
  description: 'Type statements to discover and order proof steps (Hard mode).',
};

// ─── Module State ───────────────────────────────────────────

let _moduleEventBus = null;
let _dispatcher = null;
let _unsubscribeHandles = [];

function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('proofEntry', message, ...data);
  } else {
    const method = console[level === 'info' ? 'log' : level] || console.log;
    method(`[proofEntry] ${message}`, ...data);
  }
}

// ─── Registration ───────────────────────────────────────────

export function register(registrationApi) {
  log('info', 'Registering Proof Entry module...');

  // Load CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.type = 'text/css';
  link.href = 'modules/proofEntry/proofEntry.css';
  document.head.appendChild(link);

  // Register the panel component
  registrationApi.registerPanelComponent('proofEntryPanel', ProofEntryUI);

  // We dispatch location checks
  registrationApi.registerDispatcherSender('user:locationCheck', 'bottom', 'first');

  // Events we subscribe to
  registrationApi.registerEventBusSubscriberIntent('stateManager:rulesLoaded');
  registrationApi.registerEventBusSubscriberIntent('stateManager:snapshotUpdated');
  registrationApi.registerEventBusSubscriberIntent('stateManager:inventoryChanged');

  // Events we publish
  registrationApi.registerEventBusPublisher('proofEntry:stepDiscovered');
  registrationApi.registerEventBusPublisher('proofEntry:matchFailed');
  registrationApi.registerEventBusPublisher('proofEntry:stepChecked');
  registrationApi.registerEventBusPublisher('proofEntry:proofComplete');
  registrationApi.registerEventBusPublisher('proofEntry:queueChanged');

  // Public API
  registrationApi.registerPublicFunction(moduleInfo.name, 'getProofEntryState', () => proofEntryState);

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

  // Subscribe to events
  if (_moduleEventBus) {
    const subscribe = (eventName, handler) => {
      const unsub = _moduleEventBus.subscribe(eventName, handler);
      _unsubscribeHandles.push(unsub);
    };

    subscribe('stateManager:rulesLoaded', handleRulesLoaded);
    subscribe('stateManager:snapshotUpdated', handleSnapshotUpdated);
    subscribe('stateManager:inventoryChanged', handleInventoryChanged);
  }

  // Check if rules already loaded
  const staticData = stateManager.getStaticData();
  if (_getPlayerWorld(staticData)?.slot_data?.proof_structure) {
    _initializeProofFromStaticData(staticData);
  }

  log('info', 'Initialization complete.');

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
  if (!proofEntryState?.isLoaded) return;
  _syncStateFromSnapshot(snapshotData);
}

function handleInventoryChanged() {
  if (!proofEntryState?.isLoaded) return;
  _syncStateFromSnapshot();
}

// ─── Internal Helpers ───────────────────────────────────────

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

  // If already loaded (UI handler may have loaded it first), just wire up
  // event bus publishing without re-loading or overwriting existing callbacks.
  if (proofEntryState.isLoaded) {
    log('info', 'Proof structure already loaded, wiring event bus publishing');
    _wireEventBusPublishing();
    _syncStateFromSnapshot();
    return;
  }

  log('info', 'Found MetaMath proof structure, initializing...');

  const success = proofEntryState.loadFromSlotData(
    playerWorld.slot_data,
    playerWorld.name_substitutions
  );

  if (!success) {
    log('warn', 'Failed to load proof structure from slot data');
    return;
  }

  log('info',
    `Loaded proof for "${proofEntryState.theoremName}" with ${proofEntryState.steps.size} steps`
  );

  _syncStateFromSnapshot();
  _wireEventBusPublishing();
}

function _wireEventBusPublishing() {
  // Chain onto any existing callbacks (e.g. UI render) rather than overwriting
  const existingStepDiscovered = proofEntryState.onStepDiscovered;
  proofEntryState.onStepDiscovered = (stepIndex, matchType) => {
    if (existingStepDiscovered) existingStepDiscovered(stepIndex, matchType);
    if (_moduleEventBus) {
      _moduleEventBus.publish('proofEntry:stepDiscovered', { stepIndex, matchType });
    }
  };

  const existingMatchFailed = proofEntryState.onMatchFailed;
  proofEntryState.onMatchFailed = (input) => {
    if (existingMatchFailed) existingMatchFailed(input);
    if (_moduleEventBus) {
      _moduleEventBus.publish('proofEntry:matchFailed', { input });
    }
  };

  const existingQueueChanged = proofEntryState.onQueueChanged;
  proofEntryState.onQueueChanged = () => {
    if (existingQueueChanged) existingQueueChanged();
    if (_moduleEventBus) {
      _moduleEventBus.publish('proofEntry:queueChanged', {
        queue: [...proofEntryState.queue],
        validation: proofEntryState.validateQueue(),
      });
    }
  };
}

function _syncStateFromSnapshot(snapshotData) {
  if (!proofEntryState) return;
  // Event data is wrapped as { snapshot: ... }, unwrap if needed
  const snapshot = snapshotData?.snapshot || snapshotData || stateManager.getLatestStateSnapshot();
  if (!snapshot) return;

  if (snapshot.inventory) {
    proofEntryState.syncInventory(snapshot.inventory);
  }
  if (snapshot.checkedLocations) {
    const locMap = {};
    for (const loc of snapshot.checkedLocations) {
      locMap[loc] = true;
    }
    proofEntryState.syncLocations(locMap);
  }
}
