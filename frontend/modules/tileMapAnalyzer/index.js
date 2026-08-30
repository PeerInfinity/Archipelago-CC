// frontend/modules/tileMapAnalyzer/index.js
//
// TileMapAnalyzer module — registers the panel component and exposes
// shared module accessors. The panel itself owns all of the analysis
// logic; this file is the registration shell.

import { TileMapAnalyzerUI } from './tileMapAnalyzerUI.js';
import eventBus from '../../app/core/eventBus.js';

function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('tileMapAnalyzerModule', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[tileMapAnalyzerModule] ${message}`, ...data);
  }
}

export const moduleInfo = {
  name: 'tileMapAnalyzer',
  title: 'Tile Map Analyzer',
  componentType: 'tileMapAnalyzer',
  icon: '🗺️',
  column: 2,
  description: 'Analyzes a tile-based Flash game\'s map data and emits an Archipelago rules.json.',
};

let thisModuleId = moduleInfo.name;
let moduleDispatcher = null;
let moduleEventBus = null;
let activePanelInstance = null;

export function register(registrationApi) {
  log('info', `[${moduleInfo.name} Module] Registering...`);
  registrationApi.registerPanelComponent(moduleInfo.componentType, TileMapAnalyzerUI);
  registrationApi.registerEventBusPublisher('files:jsonLoaded');
  log('info', `[${moduleInfo.name} Module] Registration complete.`);
}

export async function initialize(moduleId, priorityIndex, initializationApi) {
  thisModuleId = moduleId;
  moduleDispatcher = initializationApi.getDispatcher();
  moduleEventBus = initializationApi.getEventBus();
  log('info', `[${thisModuleId} Module] Initializing with priority ${priorityIndex}...`);
  log('info', `[${thisModuleId} Module] Initialization complete.`);
  return () => {
    log('info', `[${thisModuleId} Module] Cleaning up...`);
    activePanelInstance = null;
    moduleDispatcher = null;
    moduleEventBus = null;
  };
}

export function setActivePanelInstance(instance) {
  activePanelInstance = instance;
}

export function getActivePanelInstance() {
  return activePanelInstance;
}

export function getModuleDispatcher() {
  return moduleDispatcher;
}

export function getModuleEventBus() {
  if (moduleEventBus) return moduleEventBus;
  return {
    publish: (event, data) => eventBus.publish(event, data, 'tileMapAnalyzer'),
    subscribe: (event, callback) => eventBus.subscribe(event, callback, 'tileMapAnalyzer'),
    unsubscribe: (event, callback) => eventBus.unsubscribe(event, callback, 'tileMapAnalyzer'),
    publishAs: (event, data, source) => eventBus.publish(event, data, source),
    getAllPublishers: () => eventBus.getAllPublishers(),
    getAllSubscribers: () => eventBus.getAllSubscribers(),
    getAllPublishCounts: () => eventBus.getAllPublishCounts(),
  };
}
