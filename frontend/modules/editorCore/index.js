/**
 * Editor Core Module
 *
 * Provides shared data management for editor UI modules.
 * This is a non-UI module that handles content sources,
 * event subscriptions, and data fetching.
 */

import { editorDataService } from './editorDataService.js';
import eventBus from '../../app/core/eventBus.js';
import { EDITOR_EVENTS } from './editorEvents.js';

// Helper function for logging with fallback
function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('editorCoreModule', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[editorCoreModule] ${message}`, ...data);
  }
}

// --- Module Info ---
export const moduleInfo = {
  name: 'editorCore',
  title: 'Editor Core',
  description: 'Shared data management for editor panels.',
  // No componentType - this is not a UI module
};

/**
 * Registration function for the Editor Core module.
 * Registers event publishers and initializes the data service.
 */
export function register(registrationApi) {
  log('info', '[Editor Core Module] Registering...');

  // Register event publishers
  registrationApi.registerEventBusPublisher('ui:activatePanel');
  registrationApi.registerEventBusPublisher('editor:contentResponse');

  // Subscribe to app ready event to initialize the data service
  const readyHandler = () => {
    log('info', '[Editor Core Module] App ready, initializing data service...');
    editorDataService.initialize();
    eventBus.unsubscribe(EDITOR_EVENTS.APP_READY, readyHandler);
  };
  eventBus.subscribe(EDITOR_EVENTS.APP_READY, readyHandler, 'editorCore');

  log('info', '[Editor Core Module] Registered successfully');
}

// Re-export for consumers
export { editorDataService } from './editorDataService.js';
export { EDITOR_EVENTS } from './editorEvents.js';
export { defaultConfig, defaultContentSources } from './editorConfig.js';
