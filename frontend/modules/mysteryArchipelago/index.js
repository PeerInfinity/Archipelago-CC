// mysteryArchipelago module entry point.
// Bridges the mystery clue game's page (an iframe, `?iframeId=mystery`) to Archipelago: a solved
// question becomes a location check, and the papers held and questions checked go back to the
// page. The protocol is described in mysteryArchipelagoLogic.js.
//
// The module is on by default (the bridge and the `mystery` substrate entry are there at boot), and
// its panel is not in the layout: opening Mystery Game from Quick Launch frames the page for the
// loaded world (mysteryPanelUI.js).

import {
  LIVE_PLAY_EVENTS, MysteryArchipelagoLogic, MYSTERY_EVENTS, SOURCE_MODULE, caseRegionsOfWarehouse,
} from './mysteryArchipelagoLogic.js';
import stateManagerProxySingleton from '../stateManager/stateManagerProxySingleton.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';
import eventBus from '../../app/core/eventBus.js';
import {
  MYSTERY_AUTO_SOLVE_EVENT, MYSTERY_AUTO_SOLVE_STATUS_EVENT, createMysteryPlaybackController,
} from './mysteryPlaybackController.js';
import { PLAYBACK_WALK_FAILED_EVENT } from '../procgenCore/playbackEvents.js';
import { MysteryPanelUI } from './mysteryPanelUI.js';
import { DEFAULT_PAGE_URL } from './mysteryPage.js';
import { MYSTERY_PANEL_COMPONENT_TYPE, MYSTERY_SUBSTRATE_ID, setPlaybackController, substrateRegistryEntry } from './mysterySubstrateLibrary.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';

// --- Module Info ---
export const moduleInfo = {
  name: 'mysteryArchipelago',
  title: 'Mystery Game',
  componentType: 'mysteryPanel',
  docs: 'docs/json/user/modules/mysteryArchipelago.md',
  icon: '🔎',
  column: 3, // Right column
  category: 'Non-procgen Games',
  description: 'Opens the mystery clue game for the loaded mystery world and bridges it to Archipelago: solved questions are checks, received items are papers.',
  requires: ['stateManager', 'client', 'iframeAdapter', 'iframePanel'],
};

const moduleId = 'mysteryArchipelago';

function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level](moduleId, message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[${moduleId}] ${message}`, ...data);
  }
}

let logicInstance = null;
let playbackController = null;
let moduleEventBus = null;

/** The panel dropped its page: the bridge waits for the next page to ask before it drives one. */
export function mysteryPageGone() {
  logicInstance?.pageGone();
}

/** The module's event bus, for its panel. Before initialize, the core bus under this module's name. */
export function getModuleEventBus() {
  if (moduleEventBus) return moduleEventBus;
  return {
    publish: (event, data) => eventBus.publish(event, data, moduleId),
    subscribe: (event, callback) => eventBus.subscribe(event, callback, moduleId),
    unsubscribe: (event, callback) => eventBus.unsubscribe(event, callback, moduleId),
  };
}

/** The client's own answer, asked each time: connected means the socket is open AND the slot is assigned. */
function connectionNow() {
  const info = centralRegistry.getPublicFunction?.('client', 'getConnectionInfo')?.();
  return {
    connected: !!(info?.isConnected && info?.isHandshakeComplete),
    slot: info?.slot ?? null,
    team: info?.team ?? null,
  };
}

/**
 * The loaded world's `mystery` regions, off the runtime player's warehouse: `[]` for a world that
 * is not generated, or that holds no case as a region.
 */
export function caseRegionsNow() {
  return caseRegionsOfWarehouse(centralRegistry.getPublicFunction?.('procgenPlayer', 'getWarehouse')?.(), MYSTERY_SUBSTRATE_ID);
}

/** The region the player is in, as the runtime player last announced it. */
export function activeRegionIdNow() {
  return centralRegistry.getPublicFunction?.('procgenPlayer', 'getActiveSubstrate')?.()?.regionId ?? null;
}

/** Loop mode, and the region the Loops queue is parked on for live play (null: none, or no Loops module). */
export function livePlayNow() {
  return {
    loopMode: centralRegistry.getPublicFunction?.('loops', 'isLoopModeActive')?.() === true,
    region: centralRegistry.getPublicFunction?.('loops', 'livePlayRegion')?.() ?? null,
    // The region whose question the Playback Bot is having the page solve (mysteryPlaybackController.js).
    botRegion: playbackController?.walking() ?? null,
  };
}

/**
 * Bring the Mystery Game panel up, as Quick Launch does (`quickLaunchUI.js`): on the desktop layout
 * `enableModule` adds the tab of a module that is already on; the mobile layout shows a panel on
 * `ui:activatePanel`.
 */
function openMysteryPanel() {
  if (typeof window !== 'undefined' && window.goldenLayoutInstance && window.moduleManagerApi?.enableModule) {
    window.moduleManagerApi.enableModule(moduleId);
    return;
  }
  moduleEventBus?.publish('ui:activatePanel', { panelId: MYSTERY_PANEL_COMPONENT_TYPE });
}

export async function register(registrationApi) {
  registrationApi.registerPanelComponent('mysteryPanel', MysteryPanelUI);
  // The substrate entry (also registered when its library is imported; guarded both ways).
  if (!substrateRegistry.has(substrateRegistryEntry.id)) substrateRegistry.register(substrateRegistryEntry);

  registrationApi.registerSettingsSchema({
    pageUrl: {
      type: 'string',
      default: DEFAULT_PAGE_URL,
      description: 'Address of the mystery clue game\'s page. The panel adds the case of the loaded world.',
    },
  });

  // Dispatcher: this module sends location checks upward
  registrationApi.registerDispatcherSender('user:locationCheck', 'bottom', 'first');
  // …and, for the Playback Bot's controller, a move out of the office
  registrationApi.registerDispatcherSender('user:regionMove', 'bottom', 'first');

  registrationApi.registerEventBusPublisher(MYSTERY_EVENTS.STATE);
  registrationApi.registerEventBusPublisher(MYSTERY_EVENTS.REFUSED);
  // The Playback Bot's controller: it asks the page for its careful reader, hears the page's word on it, opens the
  // panel when no page is there, and names a walk the page could not do.
  registrationApi.registerEventBusPublisher(MYSTERY_AUTO_SOLVE_EVENT);
  registrationApi.registerEventBusPublisher('ui:activatePanel');
  registrationApi.registerEventBusPublisher(PLAYBACK_WALK_FAILED_EVENT);
  registrationApi.registerEventBusSubscriberIntent(moduleId, MYSTERY_AUTO_SOLVE_STATUS_EVENT);

  registrationApi.registerEventBusSubscriberIntent(moduleId, MYSTERY_EVENTS.QUESTION_SOLVED);
  registrationApi.registerEventBusSubscriberIntent(moduleId, MYSTERY_EVENTS.REQUEST_STATE);
  registrationApi.registerEventBusSubscriberIntent(moduleId, 'game:connected');
  registrationApi.registerEventBusSubscriberIntent(moduleId, 'client:connectedStateApplied');
  registrationApi.registerEventBusSubscriberIntent(moduleId, 'connection:close');
  registrationApi.registerEventBusSubscriberIntent(moduleId, 'game:itemsReceived');
  registrationApi.registerEventBusSubscriberIntent(moduleId, 'stateManager:rulesLoaded');
  registrationApi.registerEventBusSubscriberIntent(moduleId, 'stateManager:snapshotUpdated');
  registrationApi.registerEventBusSubscriberIntent(moduleId, 'settings:changed');
  registrationApi.registerEventBusSubscriberIntent(moduleId, 'procgen:activeSubstrateChanged');
  for (const event of LIVE_PLAY_EVENTS) registrationApi.registerEventBusSubscriberIntent(moduleId, event);
}

export async function initialize(mId, priorityIndex, initializationApi) {
  // Enabling the module again after its panel was closed (closing disables it; Quick Launch and the bot's walk
  // enable it to open the panel) calls initialize again, and nothing is ever uninitialized: the bridge and the
  // controller made the first time are still subscribed. A second pair answered the page beside the first, and
  // the bridge's `botRegion` read the new controller while the bot drove the old one (measured: the loop row's
  // first request went out with `inOffice: false` and the page refused it as locked). Keep the first pair.
  if (logicInstance) {
    log('info', 'Bridge already initialized; keeping it.');
    return;
  }
  moduleEventBus = initializationApi.getEventBus();
  logicInstance = new MysteryArchipelagoLogic({
    eventBus: moduleEventBus,
    dispatcher: initializationApi.getDispatcher(),
    getStaticData: () => stateManagerProxySingleton.getStaticData(),
    getSnapshot: () => stateManagerProxySingleton.getSnapshot(),
    getConnection: connectionNow,
    getCaseRegions: caseRegionsNow,
    getActiveRegionId: activeRegionIdNow,
    getLivePlay: livePlayNow,
    log,
  });
  logicInstance.initialize();
  playbackController = createMysteryPlaybackController({
    dispatcher: initializationApi.getDispatcher(),
    eventBus: moduleEventBus,
    getCaseRegions: caseRegionsNow,
    getActiveRegionId: activeRegionIdNow,
    pageHasAsked: () => logicInstance.pageHasAsked(),
    openPanel: openMysteryPanel,
    // `inOffice` follows a walk in flight: the page hears it before the request, and again when it ends.
    onWalkingChanged: () => logicInstance.sendStateIfChanged(),
    substrateId: MYSTERY_SUBSTRATE_ID,
    sourceModule: SOURCE_MODULE,
  });
  setPlaybackController(playbackController);
  log('info', 'Bridge initialized.');
}
