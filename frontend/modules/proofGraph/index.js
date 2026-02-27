/**
 * Proof Graph module — MetaMath Medium mode.
 *
 * Provides a Cytoscape graph where players reconstruct the proof dependency
 * structure by drawing edges between proof step nodes using edgehandles.
 */

import proofGraphState from './proofGraphStateSingleton.js';
import { ProofGraphUI, setModuleEventBus, setDispatcher } from './proofGraphUI.js';
import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js';

// ─── Module Info ────────────────────────────────────────────

export const moduleInfo = {
  name: 'proofGraph',
  title: 'Proof Graph',
  componentType: 'proofGraphPanel',
  icon: '\u{1F517}', // link emoji
  column: 3,
  description: 'Reconstruct proof dependency edges in a graph puzzle.',
};

// ─── Module State ───────────────────────────────────────────

let _moduleEventBus = null;
let _dispatcher = null;
let _unsubscribeHandles = [];

function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('proofGraph', message, ...data);
  } else {
    const method = console[level === 'info' ? 'log' : level] || console.log;
    method(`[proofGraph] ${message}`, ...data);
  }
}

// ─── Registration ───────────────────────────────────────────

export function register(registrationApi) {
  log('info', 'Registering Proof Graph module...');

  // Load CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.type = 'text/css';
  link.href = 'modules/proofGraph/proofGraph.css';
  document.head.appendChild(link);

  // Register panel component
  registrationApi.registerPanelComponent('proofGraphPanel', ProofGraphUI);

  // Dispatcher: we send location checks
  registrationApi.registerDispatcherSender('user:locationCheck', 'bottom', 'first');

  // Events we subscribe to
  registrationApi.registerEventBusSubscriberIntent('stateManager:rulesLoaded');
  registrationApi.registerEventBusSubscriberIntent('stateManager:snapshotUpdated');
  registrationApi.registerEventBusSubscriberIntent('stateManager:inventoryChanged');

  // Events we publish
  registrationApi.registerEventBusPublisher('proofGraph:edgeDrawn');
  registrationApi.registerEventBusPublisher('proofGraph:edgeRejected');
  registrationApi.registerEventBusPublisher('proofGraph:stepCompleted');
  registrationApi.registerEventBusPublisher('proofGraph:proofComplete');

  // Public API
  registrationApi.registerPublicFunction(moduleInfo.name, 'getProofGraphState', () => proofGraphState);

  log('info', 'Registration complete.');
}

// ─── Initialization ─────────────────────────────────────────

export function initialize(moduleId, priorityIndex, initializationApi) {
  log('info', `Initializing with priority ${priorityIndex}...`);

  _moduleEventBus = initializationApi.getEventBus();
  _dispatcher = initializationApi.getDispatcher();

  // Pass references to UI
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
    _initializeFromStaticData(staticData);
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
  if (staticData) _initializeFromStaticData(staticData);
}

function handleSnapshotUpdated(snapshotData) {
  if (!proofGraphState?.isLoaded) return;
  _syncFromSnapshot(snapshotData);
}

function handleInventoryChanged() {
  if (!proofGraphState?.isLoaded) return;
  _syncFromSnapshot();
}

// ─── Internal ───────────────────────────────────────────────

function _getPlayerWorld(staticData) {
  if (!staticData?.world) return null;
  const playerId = staticData.playerId || '1';
  return staticData.world[playerId] || null;
}

function _initializeFromStaticData(staticData) {
  const playerWorld = _getPlayerWorld(staticData);
  if (!playerWorld?.slot_data?.proof_structure) {
    log('info', 'No proof_structure — not a MetaMath game');
    return;
  }

  // If already loaded (UI handler may have loaded it first), just wire up
  // event bus publishing without re-loading or overwriting existing callbacks.
  if (proofGraphState.isLoaded) {
    log('info', 'Proof structure already loaded, wiring event bus publishing');
    _wireEventBusPublishing();
    _syncFromSnapshot();
    return;
  }

  log('info', 'Found MetaMath proof structure, initializing...');

  const success = proofGraphState.loadFromSlotData(
    playerWorld.slot_data,
    playerWorld.name_substitutions
  );

  if (!success) {
    log('warn', 'Failed to load proof structure');
    return;
  }

  log('info',
    `Loaded proof for "${proofGraphState.theoremName}" with ${proofGraphState.steps.size} steps, ${proofGraphState.getTotalEdgeCount()} edges`
  );

  _syncFromSnapshot();
  _wireEventBusPublishing();
}

function _wireEventBusPublishing() {
  // Chain onto any existing callbacks (e.g. UI render) rather than overwriting
  const existingEdgeDrawn = proofGraphState.onEdgeDrawn;
  proofGraphState.onEdgeDrawn = (source, target) => {
    if (existingEdgeDrawn) existingEdgeDrawn(source, target);
    if (_moduleEventBus) {
      _moduleEventBus.publish('proofGraph:edgeDrawn', { source, target });
    }
  };

  const existingEdgeRejected = proofGraphState.onEdgeRejected;
  proofGraphState.onEdgeRejected = (source, target) => {
    if (existingEdgeRejected) existingEdgeRejected(source, target);
    if (_moduleEventBus) {
      _moduleEventBus.publish('proofGraph:edgeRejected', { source, target });
    }
  };

  const existingStepCompleted = proofGraphState.onStepCompleted;
  proofGraphState.onStepCompleted = (stepIndex) => {
    if (existingStepCompleted) existingStepCompleted(stepIndex);
    if (_moduleEventBus) {
      _moduleEventBus.publish('proofGraph:stepCompleted', { stepIndex });
    }
  };
}

function _syncFromSnapshot(snapshotData) {
  if (!proofGraphState) return;
  // Event data is wrapped as { snapshot: ... }, unwrap if needed
  const snapshot = snapshotData?.snapshot || snapshotData || stateManager.getLatestStateSnapshot();
  if (!snapshot) return;

  if (snapshot.inventory) {
    proofGraphState.syncInventory(snapshot.inventory);
  }
  if (snapshot.checkedLocations) {
    proofGraphState.syncLocations(snapshot.checkedLocations);
  }
}
