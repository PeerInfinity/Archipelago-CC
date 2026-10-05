import { FlashPanelUI } from './flashPanelUI.js';
import eventBus from '../../app/core/eventBus.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
// Import side effect registers `flash_seedling` (region-atlas Phase 4).
import {
  substrateRegistryEntry as flashSeedlingEntry,
  FLASH_SEEDLING_LOAD_REGION_EVENT,
  setSeedlingAtlasPlaybackController,
} from './flashSeedlingLibrary.js';
// Import side effect registers `flash_seedling_gen` — the LIGHT entry; its
// generator is installed below through a computed specifier (seedling
// generated levels G1: a static path would put +94 files / +4.96 MB here).
import {
  substrateRegistryEntry as flashSeedlingGenEntry,
  installSeedlingGenRoom,
  seedlingGenRoomInstalled,
  SEEDLING_GEN_ROOM_MODULE_PATH,
  setSeedlingPlaybackController,
} from './flashSeedlingGenLibrary.js';
import {
  resolveSeedlingAtlasGoal,
  SEEDLING_ATLAS_PLAYBACK_SUBSTRATE,
  SeedlingPlaybackController,
} from './seedlingPlaybackController.js';
import { PLAYBACK_WALK_FAILED_EVENT, PLAYBACK_WALK_NOTE_EVENT } from '../procgenCore/playbackEvents.js';
import { AP_ITEM_FOUND_EVENT, DOOR_LOCKED_EVENT, SeedlingRegionGlue } from './seedlingRegionGlue.js';
import { createDoorGate, createSnapshotInterfaceLoader } from './seedlingDoorGate.js';
import { stateManagerProxySingleton } from '../stateManager/index.js';
import { STORAGE_KINDS } from '../../app/core/storageKinds.js';

let moduleDispatcher = null;
let _moduleEventBus = null;
let activePanelInstance = null;
let seedlingRegionGlue = null;

/**
 * ⛓ SEEDLING GENERATED G4 — the door gate's evaluator context
 * (`createSnapshotInterface`), loaded through a computed specifier: statically
 * it would put +19 files / 634,636 B on this closure (the game-logic registry).
 */
const snapshotInterfaceLoader = createSnapshotInterfaceLoader({
  log: (message) => log('error', `[FlashPanel Module] ${message}`),
});
export function loadDoorGateEvaluator() {
  return snapshotInterfaceLoader.load();
}

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
  title: 'Flash Panel',
  componentType: 'flashPanel',
  icon: '🎮',
  column: 2,
  category: 'Embedding and Windows',
  description: 'Plays the preset\'s Flash game (Seedling, Robot Wants Kitty), turning pickups into checks and delivering items.',
  requires: ['stateManager'],
  storage: [
    { pattern: '/shrumsave$', kind: STORAGE_KINDS.user, label: 'Seedling save (a Ruffle SharedObject; the key starts with the host and SWF path)' },
  ],
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
  loadDoorGateEvaluator();

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
        enum: ['auto', 'flash', 'wasm', 'js'],
        label: 'Runtime',
        description: "'auto' uses the SWFRecomp wasm page when the game's "
          + "flash_panel wiring provides one (runs in any browser), real "
          + "Flash otherwise | 'flash' forces the real-Flash <object> embed "
          + "(needs NPAPI Flash or Ruffle) | 'wasm' forces the wasm iframe | "
          + "'js' (Seedling only) plays the JavaScript model of the game "
          + "(seedlingDemo) in rectangles, no sound — GENERATED rooms only for now.",
      },
      // ⛓ Seedling solver-walk S1 — the Playback Bot's solver mode (no reinit).
      // ⛓ S2 — default ON since the solve moved into a worker under a budget (⚖ Q3).
      seedlingSolverWalk: {
        type: 'boolean',
        default: true,
        label: 'Seedling JS: Playback Bot uses the solver',
        description: "Runtime 'js' only, real (atlas) Seedling rooms. On: the Playback "
          + "Bot asks the real solver (seedlingDemo/solverBot) for the room's plan — "
          + "baiting and striking enemies, shoving and holding blocks, opening chests — "
          + "and plays it one key set per game tick, re-solving if the game leaves the "
          + "plan; a goal the solver declines is walked by the simple walker, with the "
          + "solver's reason in the bot's status (on by default). Off: the simple "
          + "walker only. The solve runs in a background worker: the room is HELD (the "
          + "game does not advance) while it plans — typically 0.01–3 s, shown as "
          + "'solving…' in the bot's status — and a solve that takes more than 5 s "
          + "is stopped and the walker takes over, saying so; a declined goal is "
          + "offered to the solver again after a death, a crossing or 90 walked "
          + "ticks (at most 3 times). Generated rooms always use the simple walker.",
      },
      // ⛓ Seedling solver-walk O3 — the wasm engine's solve budget (the twin of the JS page's ?solverBudgetMs=).
      seedlingWasmSolverBudgetMs: {
        type: 'number',
        default: 5000,
        minimum: 100,
        label: 'Seedling wasm: solver budget (ms)',
        description: "Runtime 'wasm', solver (atlas / vanilla) rooms. How long the Playback Bot's "
          + "solver may think about one room before the budget runs out (the game is HELD meanwhile). "
          + "The solver searches without sword dashes first and then with them; when the budget runs "
          + "out and a plan is already in hand, that plan is played. Without one, the room stays held "
          + "and the solver is asked once more with 4× this budget, and only then does the walk stop, "
          + "saying why. Raise it on a busy machine. Read at the start of each solve.",
      },
      // ⛓ Seedling SHOULD-STOP — the anytime full pass's dash deadline (⚖ the user's "upgrade window", 2026-10-04:
      // "Let's try 1000 ms for now."; 0 = the whole budget).
      seedlingSolverUpgradeWindowMs: {
        type: 'number',
        default: 1000,
        minimum: 0,
        label: 'Seedling: solver upgrade window (ms; 0 = the whole budget)',
        description: "Both runtimes, solver (atlas / vanilla) rooms. The Playback Bot's solver first "
          + "searches without sword dashes, then with them. Once a plan is in hand, this is how long "
          + "(from the start of the solve) the second search may keep looking for sword dashes that "
          + "make the plan shorter; past it, that search stops looking for dashes and finishes, and "
          + "the shorter of the two plans is played. Default 1000 ms; 0 gives it the whole solver budget. "
          + "Read at the start of each solve.",
      },
    },
  });

  registrationApi.registerEventBusSubscriberIntent('stateManager:rulesLoaded');
  // ⛓ Seedling JS J1: the panel re-initializes when `runtime` changes.
  registrationApi.registerEventBusSubscriberIntent('settings:changed');
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
  // ⛓ Seedling generated G4 — a door the host refused. The same defect, found
  // again by the G4 box gate: published unregistered, the page dropped it.
  registrationApi.registerEventBusPublisher(DOOR_LOCKED_EVENT);

  // Self-activation on a region load (see `activateOnLoadRegion`).
  registrationApi.registerEventBusPublisher('ui:activatePanel');
  // ⛓ Seedling JS J2 — the playback controller's LATE refusal (same trap a
  // third time: unregistered, the publish is skipped with a warn).
  registrationApi.registerEventBusPublisher(PLAYBACK_WALK_FAILED_EVENT);
  // ⛓ solver-walk S2 — the live walk's note ("solving…", a decline, a retry).
  registrationApi.registerEventBusPublisher(PLAYBACK_WALK_NOTE_EVENT);

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
  /** ⛓ LOGICAL LINKS — the two Playback Bot controllers, filled below (the glue asks whether either walks). */
  const playbackControllers = [];
  seedlingRegionGlue = new SeedlingRegionGlue({
    eventBus: getModuleEventBus(),
    getDispatcher: () => moduleDispatcher,
    loadRegionEvent: FLASH_SEEDLING_LOAD_REGION_EVENT,
    getPanel: () => activePanelInstance,
    // G4 — the HOST enforces a generated door's AP gate: the same evaluator
    // the logic uses, over the state manager's latest snapshot.
    canPass: createDoorGate({
      getSnapshot: () => stateManagerProxySingleton.getLatestStateSnapshot?.() ?? null,
      getStaticData: () => stateManagerProxySingleton.getStaticData?.() ?? null,
      getSnapshotInterface: snapshotInterfaceLoader.get,
    }),
    // ⛓ LOGICAL LINKS — no position is read while a Playback Bot walk is in flight (its route credits its links).
    isBotWalking: () => playbackControllers.some((c) => c?.busy?.() === true),
    // ⛓ RESTART — the Menu panel's Restart re-takes procgenPlayer's start hop when the start is ours.
    getProcgen: () => ({
      getResolvedStartRegion: initializationApi.getModuleFunction?.('procgenPlayer', 'getResolvedStartRegion'),
      getRegionInfo: initializationApi.getModuleFunction?.('procgenPlayer', 'getRegionInfo'),
      retakeStartHop: initializationApi.getModuleFunction?.('procgenPlayer', 'retakeStartHop'),
    }),
    // ⛓ RESTART — a walk in flight is stopped before the warp (the bot re-plans from the start).
    stopBotWalks: () => playbackControllers.filter((c) => c?.busy?.() === true).map((c) => c.stop()).length,
  });
  seedlingRegionGlue.start();

  // ⛓ Seedling JS J2 — the Playback Bot's controller for generated rooms. It
  // reads the live panel on every call (a preset switch replaces the iframe),
  // and refuses by name under any runtime but 'js' (⛓ W2: the atlas instance also walks on 'wasm').
  const playbackDeps = {
    getSurface: () => {
      const surface = activePanelInstance?.seedlingPlaybackSurface?.() ?? null;
      // ⛓ W2 — the check binding: the wasm engine hands it each host botStart's arming window (⚖ W0-Q1).
      return surface ? { ...surface, region: seedlingRegionGlue?.binding?.region ?? null,
        checkBinding: seedlingRegionGlue?.checkBinding ?? null,
        // ⛓ W7 — the glue query the wasm engine asks before it holds an arrival.
        swapState: () => seedlingRegionGlue?.swapState?.() ?? null,
        // ⛓ LOGICAL LINKS — the route's link, credited by the region binding (no walk).
        creditLink: (name) => seedlingRegionGlue?.creditLogicalLink?.(name) ?? { ok: false, reason: 'no region glue' } } : null;
    },
    log: (msg, level) => {
      activePanelInstance?._panelLog?.(msg, level);
      log(level === 'warn' ? 'warn' : 'info', msg);
    },
    // A LATE refusal reaches the bot as a named status, never a silent wait.
    onWalkFailed: (e) => getModuleEventBus()?.publish?.(PLAYBACK_WALK_FAILED_EVENT, e),
    // ⛓ S2 — "solving…" (and a decline / a retry) reaches the bot's status line.
    onWalkNote: (e) => getModuleEventBus()?.publish?.(PLAYBACK_WALK_NOTE_EVENT, e),
  };
  // ⛓ WG — generated rooms walk on wasm too: the engine stages the MOUNTED set the generated arm delivered.
  const genController = new SeedlingPlaybackController({
    ...playbackDeps,
    wasm: true,
    wasmLevelSetOf: (surface) => surface?.wasm?.levelSet ?? null,
  });
  setSeedlingPlaybackController(genController);
  // ⛓ J3 — the same page and walker, the atlas rooms' name → cell map.
  const atlasController = new SeedlingPlaybackController({
    ...playbackDeps,
    substrate: SEEDLING_ATLAS_PLAYBACK_SUBSTRATE,
    resolve: resolveSeedlingAtlasGoal,
    mapOf: (surface) => surface?.atlas ?? null,
    // ⛓ W2 — real rooms also walk under the wasm runtime (solve at arrival, one host tape).
    wasm: true,
    // ⛓ VANILLA MAP — staged from the rooms an arm DELIVERED (the vanilla rewrite), else the map document.
    wasmDeliveredSetOf: (surface) => surface?.wasm?.deliveredSet ?? null,
  });
  setSeedlingAtlasPlaybackController(atlasController);
  playbackControllers.push(genController, atlasController);

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
    setSeedlingPlaybackController(null);
    setSeedlingAtlasPlaybackController(null);
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
