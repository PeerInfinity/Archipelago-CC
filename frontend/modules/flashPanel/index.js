import { FlashPanelUI } from './flashPanelUI.js';
import eventBus from '../../app/core/eventBus.js';

let moduleDispatcher = null;
let _moduleEventBus = null;
let activePanelInstance = null;

function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('flashPanelModule', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[flashPanelModule] ${message}`, ...data);
  }
}

export const moduleInfo = {
  name: 'flashPanel',
  title: 'Flash Game',
  componentType: 'flashPanel',
  icon: '🎮',
  column: 2,
  description: 'Embeds a Flash game with an injected Archipelago bridge.',
  requires: ['stateManager'],
};

export function register(registrationApi) {
  log('info', '[FlashPanel Module] Registering...');

  registrationApi.registerPanelComponent('flashPanel', FlashPanelUI);

  registrationApi.registerDispatcherSender('user:locationCheck', 'bottom', 'first');

  // Observe user:locationCheck as it flows through the dispatcher
  // chain, so the panel's "TP on UI click" feature can react to
  // clicks in the Regions/Locations/etc. panels without gating on
  // the event-bus layer (which doesn't carry this event). The
  // handler always propagates — it's observation-only.
  // user: + system:locationCheck — observe both, propagate same name.
  for (const evName of ['user:locationCheck', 'system:locationCheck']) {
    registrationApi.registerDispatcherReceiver(
      moduleInfo.name,
      evName,
      (data) => handleUserLocationCheckForFlashPanel(data, evName),
      { direction: 'up', condition: 'conditional', timing: 'immediate' }
    );
  }

  registrationApi.registerEventBusSubscriberIntent('stateManager:rulesLoaded');
  registrationApi.registerEventBusSubscriberIntent('stateManager:inventoryChanged');
  registrationApi.registerEventBusSubscriberIntent('stateManager:ready');
  registrationApi.registerEventBusSubscriberIntent('stateManager:snapshotUpdated');
  registrationApi.registerEventBusSubscriberIntent('regionGraph:nodeSelected');

  log('info', '[FlashPanel Module] Registration complete.');
}

/**
 * Dispatcher receiver for user:locationCheck. Observes the event
 * (handing it to the active panel so it can teleport on UI click),
 * then propagates up the chain so the normal client/stateManager
 * flow continues.
 */
function handleUserLocationCheckForFlashPanel(eventData, eventName = 'user:locationCheck') {
  try {
    if (activePanelInstance && typeof activePanelInstance.handleUserLocationCheck === 'function') {
      activePanelInstance.handleUserLocationCheck(eventData);
    }
  } catch (e) {
    log('error', '[FlashPanel Module] handleUserLocationCheck error:', e);
  }
  if (moduleDispatcher && typeof moduleDispatcher.publishToNextModule === 'function') {
    moduleDispatcher.publishToNextModule(
      moduleInfo.name,
      eventName,
      eventData,
      { direction: 'up' }
    );
  }
}

export function setActivePanelInstance(instance) {
  activePanelInstance = instance;
}

export function initialize(moduleId, priorityIndex, initializationApi) {
  log('info', `[FlashPanel Module] Initializing with priority ${priorityIndex}...`);
  moduleDispatcher = initializationApi.getDispatcher();
  _moduleEventBus = initializationApi.getEventBus();
  log('info', '[FlashPanel Module] Initialization complete.');
}

export function getDispatcher() {
  return moduleDispatcher;
}

export function getModuleEventBus() {
  if (_moduleEventBus) return _moduleEventBus;
  return {
    publish: (event, data) => eventBus.publish(event, data, 'flashPanel'),
    subscribe: (event, callback) => eventBus.subscribe(event, callback, 'flashPanel'),
    unsubscribe: (event, callback) => eventBus.unsubscribe(event, callback, 'flashPanel'),
    publishAs: (event, data, source) => eventBus.publish(event, data, source),
    getAllPublishers: () => eventBus.getAllPublishers(),
    getAllSubscribers: () => eventBus.getAllSubscribers(),
    getAllPublishCounts: () => eventBus.getAllPublishCounts(),
  };
}
