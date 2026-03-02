/**
 * Proof Entry module — MetaMath Hard mode.
 *
 * Provides a panel where players must type theorem labels or expressions
 * to discover proof steps, then arrange them in dependency order.
 * Active when a game with proof_structure or graph_structure is loaded.
 */

import proofEntryState from './proofEntryStateSingleton.js';
import { ProofEntryUI, setModuleEventBus, setDispatcher } from './proofEntryUI.js';
import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js';
import {
  getPlayerWorld,
  hasStructureData,
  syncStateFromSnapshot,
  createLogger,
  initializeProofState,
} from '../proofShared/proofModuleHelpers.js';

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

const log = createLogger('proofEntry');

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
  if (hasStructureData(getPlayerWorld(staticData)?.slot_data)) {
    initializeProofState(proofEntryState, staticData, log, _wireEventBusPublishing);
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
  initializeProofState(proofEntryState, staticData, log, _wireEventBusPublishing);
}

function handleSnapshotUpdated(snapshotData) {
  if (!proofEntryState?.isLoaded) return;
  syncStateFromSnapshot(proofEntryState, snapshotData);
}

function handleInventoryChanged() {
  if (!proofEntryState?.isLoaded) return;
  syncStateFromSnapshot(proofEntryState);
}

// ─── Internal ───────────────────────────────────────────────

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
