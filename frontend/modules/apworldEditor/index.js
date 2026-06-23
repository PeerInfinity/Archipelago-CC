// UI Class for this module
import ApworldEditorUI from './apworldEditorUI.js';
import eventBus from '../../app/core/eventBus.js';

// Direct hand-off channel (§2.2): procgen's "Edit in APWorld Editor" publishes
// this with { jsonData } instead of the global files:jsonLoaded, so handing a
// world to the editor doesn't wake the substrate panels (which self-activate on
// a full app load and would steal focus). The UI adopts it immediately when
// open; otherwise it's stashed here and drained when the panel mounts.
export const APWORLD_EDITOR_LOAD_RULES = 'apworldEditor:loadRules';

let _moduleEventBus = null;
let _pendingEditorRules = null;

/** Consume (and clear) a stashed hand-off, or null. Called by the UI on mount. */
export function consumePendingEditorRules() {
  const r = _pendingEditorRules;
  _pendingEditorRules = null;
  return r;
}

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
  // Stash hand-offs that arrive before the panel exists; the UI drains them on
  // mount. When the panel is already open, the UI's own subscription adopts the
  // rules and clears this slot, so it never goes stale.
  _moduleEventBus.subscribe(APWORLD_EDITOR_LOAD_RULES, (ev) => {
    if (ev && ev.jsonData) _pendingEditorRules = ev.jsonData;
  }, 'apworldEditor');
  log('info', '[APWorld Editor Module] Initialized successfully');
}
