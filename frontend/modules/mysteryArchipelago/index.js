// mysteryArchipelago module entry point.
// Bridges the mystery clue game's page (an iframe, `?iframeId=mystery`) to Archipelago: a solved
// question becomes a location check, and the papers held and questions checked go back to the
// page. The protocol is described in mysteryArchipelagoLogic.js.

import { MysteryArchipelagoLogic, MYSTERY_EVENTS } from './mysteryArchipelagoLogic.js';
import stateManagerProxySingleton from '../stateManager/stateManagerProxySingleton.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';

// --- Module Info ---
export const moduleInfo = {
  name: 'mysteryArchipelago',
  title: 'Mystery Archipelago Bridge',
  componentType: null, // No UI panel
  icon: '',
  description: 'Bridges the mystery clue game\'s page to Archipelago location checks and received papers.',
  requires: ['stateManager', 'client', 'iframeAdapter', 'iframePanel'],
};

const moduleId = 'mysteryArchipelago';

function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level](moduleId, message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[${moduleId}] ${message}`, ...data);
  }
}

let logicInstance = null;

/** The client's own answer, asked each time: connected means the socket is open AND the slot is assigned. */
function connectionNow() {
  const info = centralRegistry.getPublicFunction?.('client', 'getConnectionInfo')?.();
  return {
    connected: !!(info?.isConnected && info?.isHandshakeComplete),
    slot: info?.slot ?? null,
    team: info?.team ?? null,
  };
}

export async function register(registrationApi) {
  // Dispatcher: this module sends location checks upward
  registrationApi.registerDispatcherSender('user:locationCheck', 'bottom', 'first');

  registrationApi.registerEventBusPublisher(MYSTERY_EVENTS.STATE);
  registrationApi.registerEventBusPublisher(MYSTERY_EVENTS.REFUSED);

  registrationApi.registerEventBusSubscriberIntent(moduleId, MYSTERY_EVENTS.QUESTION_SOLVED);
  registrationApi.registerEventBusSubscriberIntent(moduleId, MYSTERY_EVENTS.REQUEST_STATE);
  registrationApi.registerEventBusSubscriberIntent(moduleId, 'game:connected');
  registrationApi.registerEventBusSubscriberIntent(moduleId, 'client:connectedStateApplied');
  registrationApi.registerEventBusSubscriberIntent(moduleId, 'connection:close');
  registrationApi.registerEventBusSubscriberIntent(moduleId, 'game:itemsReceived');
  registrationApi.registerEventBusSubscriberIntent(moduleId, 'stateManager:rulesLoaded');
  registrationApi.registerEventBusSubscriberIntent(moduleId, 'stateManager:snapshotUpdated');
}

export async function initialize(mId, priorityIndex, initializationApi) {
  logicInstance = new MysteryArchipelagoLogic({
    eventBus: initializationApi.getEventBus(),
    dispatcher: initializationApi.getDispatcher(),
    getStaticData: () => stateManagerProxySingleton.getStaticData(),
    getSnapshot: () => stateManagerProxySingleton.getSnapshot(),
    getConnection: connectionNow,
    log,
  });
  logicInstance.initialize();
  log('info', 'Bridge initialized.');
}
