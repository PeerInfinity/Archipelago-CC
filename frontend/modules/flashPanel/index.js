import { FlashPanelUI } from './flashPanelUI.js';
import eventBus from '../../app/core/eventBus.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
// Import side effect registers `flash_seedling` (region-atlas Phase 4).
import {
  substrateRegistryEntry as flashSeedlingEntry,
  FLASH_SEEDLING_LOAD_REGION_EVENT,
} from './flashSeedlingLibrary.js';
import { SeedlingRegionGlue } from './seedlingRegionGlue.js';

let moduleDispatcher = null;
let _moduleEventBus = null;
let activePanelInstance = null;
let seedlingRegionGlue = null;

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

  // Region-atlas play-time binding: the glue publishes a boundary crossing as
  // user:regionMove, the same dialect the substrate bridges use.
  registrationApi.registerDispatcherSender('user:regionMove', 'bottom', 'first');

  // The registry is also populated by flashSeedlingLibrary's import side
  // effect; repeating it here is the standing convention (idempotent, guarded).
  if (!substrateRegistry.has(flashSeedlingEntry.id)) {
    substrateRegistry.register(flashSeedlingEntry);
  }

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

  // Transport selection (read by FlashPanelUI at panel init; changing
  // it takes effect the next time a flash panel initializes). Mirrors
  // the moduleSettings.bounceDemo.renderer pattern.
  registrationApi.registerSettingsSchema({
    type: 'object',
    properties: {
      runtime: {
        type: 'string',
        default: 'auto',
        enum: ['auto', 'flash', 'wasm'],
        label: 'Runtime',
        description: "'auto' uses the SWFRecomp wasm page when the game's "
          + "flash_panel wiring provides one (runs in any browser), real "
          + "Flash otherwise | 'flash' forces the real-Flash <object> embed "
          + "(needs NPAPI Flash or Ruffle) | 'wasm' forces the wasm iframe.",
      },
    },
  });

  registrationApi.registerEventBusSubscriberIntent('stateManager:rulesLoaded');
  registrationApi.registerEventBusSubscriberIntent('stateManager:inventoryChanged');
  registrationApi.registerEventBusSubscriberIntent('stateManager:ready');
  registrationApi.registerEventBusSubscriberIntent('stateManager:snapshotUpdated');
  registrationApi.registerEventBusSubscriberIntent('regionGraph:nodeSelected');
  registrationApi.registerEventBusSubscriberIntent(FLASH_SEEDLING_LOAD_REGION_EVENT);

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

/**
 * The region-atlas glue, or null when the module hasn't initialized. The panel
 * hands it every adapter it builds (see FlashPanelUI), and the verify script
 * reads its stats.
 */
export function getSeedlingRegionGlue() {
  return seedlingRegionGlue;
}

// Test/diagnostic handle (used by scripts/procgen/verify-seedling-wasm-
// bridge.mjs to reach the live adapter).
export function getActivePanelInstance() {
  return activePanelInstance;
}

export function initialize(moduleId, priorityIndex, initializationApi) {
  log('info', `[FlashPanel Module] Initializing with priority ${priorityIndex}...`);
  moduleDispatcher = initializationApi.getDispatcher();
  _moduleEventBus = initializationApi.getEventBus();

  // Region-atlas play-time binding. Started unconditionally: it is inert until
  // a preset whose sidecars name the flash_seedling substrate is loaded, and
  // subscribing here (rather than when a flash region first appears) is what
  // keeps it ahead of procgenPlayer's start-region publish.
  seedlingRegionGlue = new SeedlingRegionGlue({
    eventBus: getModuleEventBus(),
    getDispatcher: () => moduleDispatcher,
    loadRegionEvent: FLASH_SEEDLING_LOAD_REGION_EVENT,
    getPanel: () => activePanelInstance,
  });
  seedlingRegionGlue.start();

  log('info', '[FlashPanel Module] Initialization complete.');

  return () => {
    if (seedlingRegionGlue) { seedlingRegionGlue.stop(); seedlingRegionGlue = null; }
  };
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
