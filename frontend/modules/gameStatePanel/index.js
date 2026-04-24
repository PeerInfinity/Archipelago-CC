import { GameStatePanelUI } from './gameStatePanelUI.js';
import eventBus from '../../app/core/eventBus.js';

// --- Module Info ---
export const moduleInfo = {
  name: 'gameStatePanel',
  title: 'Game State',
  componentType: 'gameStatePanel',
  icon: '👤',
  column: 2, // Middle column
  description: 'Game State display panel.',
};

let _moduleEventBus = null;

export function getModuleEventBus() {
  if (_moduleEventBus) return _moduleEventBus;
  // Fallback wrapper before initialize() runs (e.g., GoldenLayout component creation)
  return {
    publish: (event, data) => eventBus.publish(event, data, 'gameStatePanel'),
    subscribe: (event, callback) => eventBus.subscribe(event, callback, 'gameStatePanel'),
    unsubscribe: (event, callback) => eventBus.unsubscribe(event, callback, 'gameStatePanel'),
    publishAs: (event, data, source) => eventBus.publish(event, data, source),
    getAllPublishers: () => eventBus.getAllPublishers(),
    getAllSubscribers: () => eventBus.getAllSubscribers(),
    getAllPublishCounts: () => eventBus.getAllPublishCounts(),
  };
}

export async function register(registrationApi) {
    // Register the panel component
    registrationApi.registerPanelComponent('gameStatePanel', GameStatePanelUI);
}

export function initialize(moduleId, priorityIndex, initializationApi) {
  _moduleEventBus = initializationApi.getEventBus();

  return () => {
    _moduleEventBus = null;
  };
}