import { PresetUI } from './presetUI.js';
import eventBus from '../../app/core/eventBus.js';
import { getActiveBot } from '../playbackBot/playbackBotUI.js';

let _moduleEventBus = null;
let _moduleDispatcher = null;

export function getModuleEventBus() {
  if (_moduleEventBus) return _moduleEventBus;
  // Fallback wrapper before initialize() runs (e.g., GoldenLayout component creation)
  return {
    publish: (event, data) => eventBus.publish(event, data, 'presets'),
    subscribe: (event, callback) => eventBus.subscribe(event, callback, 'presets'),
    unsubscribe: (event, callback) => eventBus.unsubscribe(event, callback, 'presets'),
    publishAs: (event, data, source) => eventBus.publish(event, data, source),
    getAllPublishers: () => eventBus.getAllPublishers(),
    getAllSubscribers: () => eventBus.getAllSubscribers(),
    getAllPublishCounts: () => eventBus.getAllPublishCounts(),
  };
}

// Helper function for logging with fallback
function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('presetsModule', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[presetsModule] ${message}`, ...data);
  }
}

// --- Module Info ---
export const moduleInfo = {
  name: 'presets',
  title: 'Presets',
  componentType: 'presetsPanel',
  icon: '⚙️',
  column: 2, // Middle column
  description: 'Provides UI for loading preset game rules.',
};

/**
 * Registration function for the Presets module.
 * Registers the panel component and declares event publishing intentions.
 * @param {object} registrationApi - API provided by the initialization script.
 */
export function register(registrationApi) {
  log('info', '[Presets Module] Registering...');

  // Register the panel component, providing the class constructor
  registrationApi.registerPanelComponent('presetsPanel', PresetUI);

  // Declare events published by PresetUI on the EventBus
  registrationApi.registerEventBusPublisher('editor:loadJsonData');
  registrationApi.registerEventBusPublisher('files:jsonLoaded');
  registrationApi.registerEventBusPublisher('ui:notification');
  registrationApi.registerEventBusPublisher('rules:loaded');
  // Sphere log chart cells publish these to navigate the spoiler
  // checklist when clicked. activatePanel brings the checklist
  // forward; scrollToSphere is consumed by spoilerChecklistUI to
  // scrollIntoView the matching section.
  registrationApi.registerEventBusPublisher('ui:activatePanel');
  registrationApi.registerEventBusPublisher('spoilerChecklist:scrollToSphere');
  // Phase 5 — playback bot in the procgen-data section publishes
  // remote-control commands that the maze panel's visualizer
  // subscribes to.
  registrationApi.registerEventBusPublisher('playback:command');

  // Sphere-log playback (the bot's outer-layer play loop) advances
  // its cursor and re-routes via PathFinder by listening to the same
  // dispatcher events the rest of the app uses for state. The bot
  // itself is a UI widget mounted inside this panel rather than its
  // own module, so it can't register dispatcher receivers directly;
  // we forward here to whichever bot is currently mounted via the
  // module-scope getActiveBot() registry. See
  // NewDocs/plans/procedural-generation/sphere-log-playback.md.
  //
  // Two important quirks of the dispatcher chain:
  //   1. The first matching handler must call publishToNextModule for
  //      the chain to propagate. presets has the highest priority
  //      index of any module that listens to these events, so without
  //      this propagation stateManager (lowest priority) never sees
  //      the event and its inventory snapshot stays stale.
  //   2. PathFinder.findPathWithExits evaluates exit access rules
  //      against stateManager's current snapshot. So we have to
  //      propagate FIRST (so stateManager updates synchronously), and
  //      only then call the bot. Otherwise the bot routes against
  //      stale inventory and trips on the next gated exit.
  registrationApi.registerDispatcherReceiver(
    'presets',
    'user:locationCheck',
    (data) => {
      try {
        _moduleDispatcher?.publishToNextModule?.('presets', 'user:locationCheck', data, { direction: 'up' });
      } catch (e) { log('warn', 'presets: locationCheck propagation threw', e); }
      try { getActiveBot()?.onLocationCheck?.(data); } catch (e) { log('warn', 'bot.onLocationCheck threw', e); }
    },
    { direction: 'up', condition: 'unconditional', timing: 'immediate' },
  );
  registrationApi.registerDispatcherReceiver(
    'presets',
    'user:regionMove',
    (data) => {
      try {
        _moduleDispatcher?.publishToNextModule?.('presets', 'user:regionMove', data, { direction: 'up' });
      } catch (e) { log('warn', 'presets: regionMove propagation threw', e); }
      try { getActiveBot()?.onRegionMove?.(data); } catch (e) { log('warn', 'bot.onRegionMove threw', e); }
    },
    { direction: 'up', condition: 'unconditional', timing: 'immediate' },
  );

  log('info', '[Presets Module] Registration complete.');
}

/**
 * Initialization function for the Presets module.
 * Currently minimal, could be expanded if PresetUI needed injected dependencies.
 * @param {string} moduleId - The unique ID for this module ('presets').
 * @param {number} priorityIndex - The loading priority index.
 * @param {object} initializationApi - API provided by the initialization script.
 */
export async function initialize(moduleId, priorityIndex, initializationApi) {
  log('info', 
    `[Presets Module] Initializing with priority ${priorityIndex}...`
  );

  _moduleEventBus = initializationApi.getEventBus();
  _moduleDispatcher = initializationApi.getDispatcher?.() ?? null;

  log('info', '[Presets Module] Initialization complete.');

  // No complex cleanup needed for now, return null or empty function
  return null;
}

// No postInitialize needed currently
// export async function postInitialize(initializationApi) { ... }
