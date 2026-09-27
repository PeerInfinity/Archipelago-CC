// iframeManagerPanel module entry point
import { IframeManagerUI } from './iframeManagerUI.js';
import eventBus from '../../app/core/eventBus.js';
import { knownIframePages } from '../../app/config/knownIframePages.js';
import { STORAGE_KINDS } from '../../app/core/storageKinds.js';

// --- Module Info ---
export const moduleInfo = {
  name: 'iframeManagerPanel',
  title: 'Iframe Manager',
  componentType: 'iframeManagerPanel',
  docs: 'docs/json/user/modules/iframeManagerPanel.md',
  icon: '🖼️',
  column: 2, // Middle column
  category: 'Embedding and Windows',
  description: 'Loads a known page or typed URL into the open Iframe panels, unloads them, and lists connected pages.',
  requires: ['iframeAdapter', 'iframePanel'],
  storage: [
    { key: 'incrementalGameSave', kind: STORAGE_KINDS.user, label: 'Journey to Ascension game save (the iframe page)' },
    { key: 'a-mazing-idle', kind: STORAGE_KINDS.user, label: 'A-Mazing-Idle game save (the iframe page)' },
    { key: 'a-mazing-idle-disable-biome-check', kind: STORAGE_KINDS.state, label: 'A-Mazing-Idle: one-shot flag across a reload' },
    { key: 'externalModule.customUrlWarning.suppressed', kind: STORAGE_KINDS.state, label: '"Don\'t warn again" for custom page addresses' },
  ],
};

// Helper function for logging with fallback
function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('iframeManagerPanel', message, ...data);
  } else {
    const consoleMethod =
      console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[iframeManagerPanel] ${message}`, ...data);
  }
}

// Store module-level references
let moduleEventBus = null;
let moduleId = 'iframeManagerPanel';

export async function register(registrationApi) {
    log('info', `[${moduleId} Module] Registering...`);

    // Register panel component for Golden Layout
    registrationApi.registerPanelComponent('iframeManagerPanel', IframeManagerUI);

    // Register EventBus publishers
    registrationApi.registerEventBusPublisher('iframe:loadUrl');
    registrationApi.registerEventBusPublisher('iframe:unload');
    registrationApi.registerEventBusPublisher('iframeManager:urlChanged');

    // Register EventBus subscribers
    registrationApi.registerEventBusSubscriberIntent(moduleId, 'iframePanel:loaded');
    registrationApi.registerEventBusSubscriberIntent(moduleId, 'iframePanel:unloaded');
    registrationApi.registerEventBusSubscriberIntent(moduleId, 'iframePanel:error');
    registrationApi.registerEventBusSubscriberIntent(moduleId, 'iframe:connected');
    registrationApi.registerEventBusSubscriberIntent(moduleId, 'iframe:disconnected');

    // Register module settings schema
    registrationApi.registerSettingsSchema({
        knownPages: {
            type: 'array',
            default: knownIframePages.map(({ name, url, description }) => ({ name, url, description })),
            description: 'List of known iframe applications'
        },
        allowCustomUrls: {
            type: 'boolean',
            default: true,
            description: 'Allow users to enter custom URLs'
        }
    });

    log('info', `[${moduleId} Module] Registration complete.`);
}

export async function initialize(mId, priorityIndex, initializationApi) {
    moduleId = mId;
    log('info', `[${moduleId} Module] Initializing with priority ${priorityIndex}...`);

    // Store API references
    moduleEventBus = initializationApi.getEventBus();
    
    log('info', `[${moduleId} Module] Initialization complete.`);
}

// Export eventBus getter for use by UI components
export function getModuleEventBus() {
  if (moduleEventBus) return moduleEventBus;
  // Fallback wrapper before initialize() runs (e.g., GoldenLayout component creation)
  return {
    publish: (event, data) => eventBus.publish(event, data, 'iframeManagerPanel'),
    subscribe: (event, callback) => eventBus.subscribe(event, callback, 'iframeManagerPanel'),
    unsubscribe: (event, callback) => eventBus.unsubscribe(event, callback, 'iframeManagerPanel'),
    publishAs: (event, data, source) => eventBus.publish(event, data, source),
    getAllPublishers: () => eventBus.getAllPublishers(),
    getAllSubscribers: () => eventBus.getAllSubscribers(),
    getAllPublishCounts: () => eventBus.getAllPublishCounts(),
  };
}