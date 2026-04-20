// UI Class for this module
import ApworldEditorUI from './apworldEditorUI.js';
import eventBus from '../../app/core/eventBus.js';

let _moduleEventBus = null;

export function getModuleEventBus() {
  if (_moduleEventBus) return _moduleEventBus;
  return {
    publish: (event, data) => eventBus.publish(event, data, 'apworldEditor'),
    subscribe: (event, callback) => eventBus.subscribe(event, callback, 'apworldEditor'),
    unsubscribe: (event, callback) => eventBus.unsubscribe(event, callback, 'apworldEditor'),
    publishAs: (event, data, source) => eventBus.publish(event, data, source),
    getAllPublishers: () => eventBus.getAllPublishers(),
    getAllSubscribers: () => eventBus.getAllSubscribers(),
    getAllPublishCounts: () => eventBus.getAllPublishCounts(),
  };
}

function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('apworldEditorModule', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[apworldEditorModule] ${message}`, ...data);
  }
}

export const moduleInfo = {
  name: 'apworldEditor',
  title: 'APWorld Editor',
  componentType: 'apworldEditorPanel',
  icon: '🧩',
  column: 3,
  description: 'GUI editor for apworld rules.json (regions, exits, locations, access rules).',
  requires: ['stateManager'],
};

export function register(registrationApi) {
  log('info', '[APWorld Editor Module] Registering...');
  registrationApi.registerPanelComponent('apworldEditorPanel', ApworldEditorUI);

  registrationApi.registerEventBusPublisher('files:jsonLoaded');
  registrationApi.registerEventBusPublisher('apworldEditor:rulesEdited');
}

export function initialize(moduleId, priorityIndex, initializationApi) {
  log('info', `[APWorld Editor Module] Initializing (${moduleId}, priority ${priorityIndex})...`);
  _moduleEventBus = initializationApi.getEventBus();
  log('info', '[APWorld Editor Module] Initialized successfully');
}
