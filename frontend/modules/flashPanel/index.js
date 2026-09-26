import { FlashPanelUI } from './flashPanelUI.js';
import eventBus from '../../app/core/eventBus.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
// Import side effect registers `flash_seedling` (region-atlas Phase 4).
import {
  substrateRegistryEntry as flashSeedlingEntry,
  FLASH_SEEDLING_LOAD_REGION_EVENT,
} from './flashSeedlingLibrary.js';
// Import side effect registers `flash_seedling_gen` — the LIGHT entry; its
// generator is installed below through a computed specifier (seedling
// generated levels G1: a static path would put +94 files / +4.96 MB here).
import {
  substrateRegistryEntry as flashSeedlingGenEntry,
  installSeedlingGenRoom,
  seedlingGenRoomInstalled,
  SEEDLING_GEN_ROOM_MODULE_PATH,
} from './flashSeedlingGenLibrary.js';
import { AP_ITEM_FOUND_EVENT, SeedlingRegionGlue } from './seedlingRegionGlue.js';

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
  category: 'Embedding and Windows',
  description: 'Plays the preset\'s Flash game (Seedling, Robot Wants Kitty), turning pickups into checks and delivering items.',
  requires: ['stateManager'],
};

/**
 * ⛓⛓ SEEDLING GENERATED LEVELS G1 — **INSTALL THE GENERATOR, LAZILY.** The
 * `flash_seedling_gen` entry's build hooks need `procgenSeedling.js`
 * synchronously; the entry itself is light. The room module is loaded through a
 * COMPUTED specifier against `document.baseURI` (the randomizer wiring's
 * pattern: esbuild cannot see the string, so the bundle does not move, and the
 * base is the document in both builds) and installed into THIS instance of the
 * library. Until it lands, a build hook refuses by name. Headless: no document,
 * nothing to do — callers import `flashSeedlingGenBuild.js`.
 */
let seedlingGeneratorLoad = null;
export function loadSeedlingGenerator({ baseURI = globalThis.document?.baseURI, importer = (url) => import(/* @vite-ignore */ url) } = {}) {
  if (seedlingGenRoomInstalled()) return Promise.resolve(true);
  if (!baseURI) return Promise.resolve(false);
  seedlingGeneratorLoad ??= importer(new URL(SEEDLING_GEN_ROOM_MODULE_PATH, baseURI).href)
    .then((room) => { installSeedlingGenRoom(room); return true; })
    .catch((err) => {
      seedlingGeneratorLoad = null;
      log('error', `[FlashPanel Module] the Seedling generator (${SEEDLING_GEN_ROOM_MODULE_PATH}) did not load — `
        + `generated Seedling rooms cannot be built until the page is reloaded: ${err?.message ?? err}`);
      return false;
    });
  return seedlingGeneratorLoad;
}

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
  if (!substrateRegistry.has(flashSeedlingGenEntry.id)) {
    substrateRegistry.register(flashSeedlingGenEntry);
  }
  loadSeedlingGenerator();

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

  /**
   * ⛔⛔ **THE READOUT EVENT NEEDS A REGISTERED PUBLISHER, AND WITHOUT ONE THE
   * PUBLISH IS SKIPPED WITH A `warn` AND NOTHING ELSE.** `eventBus.publish`
   * (`app/core/eventBus.js:126-129`) checks the publisher registry and
   * `return`s — it does not throw — so `seedlingRegionGlue._itemFound`'s own
   * `try/catch` (written for *"a bus that refuses an unknown event"*) never
   * fires, its `stats.itemsFound` still counts the find, and the panel's
   * subscriber is simply never called.
   *
   * ⛓ MEASURED ON THE REAL PAGE (P1-e run 4, `panel-check`): the glue reported
   * `locationChecks: 1, itemsFound: 1`, the panel log carried
   * *"found Light for you at \"Level 030 - Torchpickup\""* — written by the
   * glue's own `_log`, not by the subscriber — and the readout element was
   * still `{display:"none", headline:"", rows:""}`. The console said exactly
   * why:
   *
   *     [WARN] [eventBus] Publisher flashPanel not registered for event
   *     flashSeedling:apItemFound. Call registerEventBusPublisher first.
   *
   * ⚠ This is an M1 defect, latent since the event was introduced: nothing in
   * production wired the check binding until P1, so nothing ever published it.
   * `flashPanelUI.test`-less code plus a counter incremented BEFORE the publish
   * is what let a producer's view and a consumer's view disagree in silence.
   */
  registrationApi.registerEventBusPublisher(AP_ITEM_FOUND_EVENT);
  registrationApi.registerEventBusSubscriberIntent(AP_ITEM_FOUND_EVENT);

  // Self-activation on a region load (see `activateOnLoadRegion`).
  registrationApi.registerEventBusPublisher('ui:activatePanel');

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

// Test/diagnostic handle (used by scripts/procgen/check-seedling-wasm-
// bridge.mjs to reach the live adapter).
export function getActivePanelInstance() {
  return activePanelInstance;
}

/**
 * ⛓ SEEDLING T2b (U1) — **A REGION LOAD BRINGS THE PANEL FORWARD**, the rule
 * every other substrate panel already follows (bounce `flashSubstrate/index.js`,
 * maze `mazeRoom/index.js`, jta). Without it a return from a maze region into a
 * placed Seedling room left the Maze Room tab in front, showing *"Currently
 * playing Seedling (region atlas)"*, and the person had to find the tab.
 *
 * Skipped when loops' "Keep this panel focused" pins another panel
 * (`isFocusLocked`); the glue still takes the region, only the tab switch is
 * suppressed.
 */
export function activateOnLoadRegion(bus, isFocusLocked, focusGame) {
  if (isFocusLocked?.()) return false;
  bus?.publish?.('ui:activatePanel', { panelId: moduleInfo.componentType });
  // ⛓ T2b U2a — and the KEYBOARD with it. A tab that was already in front
  // gets no 'show', so the focus is asked for here too.
  focusGame?.('a region load activated the panel');
  return true;
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

  // ⛓ AFTER the glue's own subscription, so the arrival is queued before the
  // tab switch that resumes the game's page.
  const activationBus = getModuleEventBus();
  const onLoadRegionActivate = () => activateOnLoadRegion(activationBus,
    initializationApi.getModuleFunction?.('loops', 'isFocusLocked'),
    (why) => activePanelInstance?.focusGame?.(why));
  const offActivate = activationBus.subscribe(FLASH_SEEDLING_LOAD_REGION_EVENT, onLoadRegionActivate);

  log('info', '[FlashPanel Module] Initialization complete.');

  return () => {
    if (typeof offActivate === 'function') offActivate();
    else activationBus.unsubscribe?.(FLASH_SEEDLING_LOAD_REGION_EVENT, onLoadRegionActivate);
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
