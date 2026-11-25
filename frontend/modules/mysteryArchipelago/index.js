// mysteryArchipelago module entry point.
// Bridges the mystery clue game's page (an iframe, `?iframeId=mystery`) to Archipelago: a solved
// question becomes a location check, and the papers held and questions checked go back to the
// page. The protocol is described in mysteryArchipelagoLogic.js.
//
// The module is disabled by default. Opening its panel (Mystery Game, from Quick Launch) is the one
// action that turns the bridge on and frames the page for the loaded world (mysteryPanelUI.js).

import { MysteryArchipelagoLogic, MYSTERY_EVENTS } from './mysteryArchipelagoLogic.js';
import stateManagerProxySingleton from '../stateManager/stateManagerProxySingleton.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';
import eventBus from '../../app/core/eventBus.js';
import { MysteryPanelUI } from './mysteryPanelUI.js';
import { DEFAULT_PAGE_URL } from './mysteryPage.js';

// --- Module Info ---
export const moduleInfo = {
  name: 'mysteryArchipelago',
  title: 'Mystery Game',
  componentType: 'mysteryPanel',
  docs: 'docs/json/user/modules/mysteryArchipelago.md',
  icon: '🔎',
  column: 3, // Right column
  category: 'Non-procgen Games',
  description: 'Opens the mystery clue game for the loaded mystery world and bridges it to Archipelago: solved questions are checks, received items are papers.',
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
let moduleEventBus = null;

/** The module's event bus, for its panel. Before initialize, the core bus under this module's name. */
export function getModuleEventBus() {
  if (moduleEventBus) return moduleEventBus;
  return {
    publish: (event, data) => eventBus.publish(event, data, moduleId),
    subscribe: (event, callback) => eventBus.subscribe(event, callback, moduleId),
    unsubscribe: (event, callback) => eventBus.unsubscribe(event, callback, moduleId),
  };
}

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
  registrationApi.registerPanelComponent('mysteryPanel', MysteryPanelUI);

  registrationApi.registerSettingsSchema({
    pageUrl: {
      type: 'string',
      default: DEFAULT_PAGE_URL,
      description: 'Address of the mystery clue game\'s page. The panel adds the case of the loaded world.',
    },
  });

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
  registrationApi.registerEventBusSubscriberIntent(moduleId, 'settings:changed');
}

export async function initialize(mId, priorityIndex, initializationApi) {
  moduleEventBus = initializationApi.getEventBus();
  logicInstance = new MysteryArchipelagoLogic({
    eventBus: moduleEventBus,
    dispatcher: initializationApi.getDispatcher(),
    getStaticData: () => stateManagerProxySingleton.getStaticData(),
    getSnapshot: () => stateManagerProxySingleton.getSnapshot(),
    getConnection: connectionNow,
    log,
  });
  logicInstance.initialize();
  log('info', 'Bridge initialized.');
}
