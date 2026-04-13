import { FlashPanelUI } from './flashPanelUI.js';
import eventBus from '../../app/core/eventBus.js';

let moduleDispatcher = null;
let _moduleEventBus = null;

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

  registrationApi.registerEventBusSubscriberIntent('stateManager:rulesLoaded');
  registrationApi.registerEventBusSubscriberIntent('stateManager:inventoryChanged');
  registrationApi.registerEventBusSubscriberIntent('stateManager:ready');
  registrationApi.registerEventBusSubscriberIntent('stateManager:snapshotUpdated');

  log('info', '[FlashPanel Module] Registration complete.');
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
