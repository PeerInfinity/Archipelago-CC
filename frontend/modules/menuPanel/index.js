/**
 * menuPanel — the start region's substrate.
 *
 * Every rules.json declares a start region (`start_regions[<player>].default`)
 * that has exits and no locations: the AP-side "menu" the player leaves on
 * their first move. Until this module there was no UI that OWNED it — a plain
 * world's only ways out were the Region Graph's navigation clicks and the Exits
 * panel's exit click, and a procgen world skipped it entirely because
 * `procgenPlayer` synthesizes the hop at load. This panel is that region's
 * substrate: one button per exit, a Restart that works outside loop mode, and
 * a "skip the menu" checkbox that generalises the procgen auto-hop to every
 * world.
 *
 * ⛔ The word "Menu" appears in no branch here. The question the panel asks is
 * `gameState.isStartRegion(currentRegion)`; the CONTENT is read out of the
 * loaded document (`stateManager:rawJsonDataLoaded` → `rawJsonData`). See
 * `menuPanelEngine.js`, which is the whole derivation and has no wiring.
 *
 * ⛓ EXACTLY ONE start hop fires per load. Two modules can publish it —
 * `procgenPlayer` for a warehoused world, this one for everything else — and
 * they share ONE setting. The hand-off is not a guess about the document: this
 * module asks `procgenPlayer.getResolvedStartRegion()`, which is non-null
 * exactly when procgenPlayer will publish (see `procgenOwnsStartHop`).
 * `procgenPlayer` reads the same setting through this module's
 * `isSkipMenuEnabled()` public function. Merging the two publishers is a named
 * follow-up (plan §6), not this slice.
 *
 * Docs: docs/json/modules/menuPanel.md
 */

import { MenuPanelUI } from './menuPanelUI.js';
import settingsManager from '../../app/core/settingsManager.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';
import eventBus from '../../app/core/eventBus.js';
import { DEFAULT_PLAYER_ID } from '../procgenCore/rulesGraph.js';
import {
    MENU_PANEL_MODULE_ID,
    MENU_PANEL_COMPONENT_TYPE,
    SKIP_MENU_SETTING_KEY,
    SKIP_MENU_SETTING_PATH,
    SKIP_MENU_DEFAULT,
    MOVE_SOURCE_EXIT,
    MOVE_SOURCE_START,
    MOVE_SOURCE_RESTART,
    describeMenu,
    firstExitOf,
    procgenOwnsStartHop,
    restartTargetOf,
} from './menuPanelEngine.js';

function log(level, message, ...data) {
    if (typeof window !== 'undefined' && window.logger) {
        window.logger[level](MENU_PANEL_MODULE_ID, message, ...data);
    } else {
        const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
        consoleMethod(`[${MENU_PANEL_MODULE_ID}] ${message}`, ...data);
    }
}

export const moduleInfo = {
    name: MENU_PANEL_MODULE_ID,
    title: 'Menu',
    componentType: MENU_PANEL_COMPONENT_TYPE,
    icon: '🚪',
    column: 3,
    description: "The start region's substrate: its exits, a Restart, and the skip-the-menu setting.",
    requires: ['gameState'],
};

// --- module state -----------------------------------------------------------

let moduleEventBus = null;
let moduleDispatcher = null;

/** The loaded document and the player it was loaded for. */
let rawJsonData = null;
let playerId = DEFAULT_PLAYER_ID;

/**
 * The skip setting, cached SYNCHRONOUSLY so `procgenPlayer` can consult it from
 * inside its (synchronous) rules-loaded handler. Seeded from the schema default
 * in register() and refreshed from settingsManager in initialize(); the
 * checkbox writes through both here and to settingsManager.
 */
let skipMenu = SKIP_MENU_DEFAULT;

/**
 * The load handshake. `stateManager` publishes `rawJsonDataLoaded` (the
 * document) and `rulesLoaded` (the worker's confirmation, which is what makes
 * gameState reset its path and start region) as two separate events, and the
 * skip decision needs BOTH — the document for the exit, gameState's reset for
 * the position. Waiting on the pair rather than on one of them means the
 * decision does not depend on which order they arrive in.
 */
let sawRawJson = false;
let sawRulesLoaded = false;

let unsubRawJson = null;
let unsubRulesLoaded = null;

// --- gameState / neighbours, looked up late ---------------------------------
// Read through centralRegistry at CALL time rather than cached at initialize:
// the panel is constructed by GoldenLayout, which can happen before or after
// any given module's initialize(), and a stale null here would silently turn a
// button into a no-op.

function gs(fnName) {
    return centralRegistry?.getPublicFunction?.('gameState', fnName) ?? null;
}

function currentRegion() {
    return gs('getCurrentRegion')?.() ?? null;
}

function startRegions() {
    return gs('getState')?.()?.startRegions ?? [];
}

/** procgenPlayer's resolved start region, or null when it doesn't own this world. */
function resolvedStartRegion() {
    try {
        return centralRegistry?.getPublicFunction?.('procgenPlayer', 'getResolvedStartRegion')?.() ?? null;
    } catch {
        return null;
    }
}

function loopModeActive() {
    try {
        return centralRegistry?.getPublicFunction?.('loops', 'isLoopModeActive')?.() === true;
    } catch {
        return false;
    }
}

// --- the module's own API (imported by menuPanelUI.js, and by the tests) -----

/** The document the panel derives its content from, or null before a load. */
export function getMenuDocument() {
    return rawJsonData ? { doc: rawJsonData, playerId } : null;
}

/** Everything the panel renders, for the CURRENT document and position. */
export function getMenuContent() {
    if (!rawJsonData) return null;
    return describeMenu(rawJsonData, playerId, currentRegion());
}

/** The cached "skip the menu" value. Synchronous by contract — procgenPlayer reads it. */
export function isSkipMenuEnabled() {
    return skipMenu === true;
}

/** Set "skip the menu", writing through to settingsManager. */
export async function setSkipMenuEnabled(enabled) {
    skipMenu = enabled === true;
    try {
        await settingsManager.updateSetting(SKIP_MENU_SETTING_PATH, skipMenu);
    } catch (error) {
        log('error', `Failed to persist ${SKIP_MENU_SETTING_PATH}`, error);
    }
    return skipMenu;
}

function publishMove(payload) {
    if (!moduleDispatcher?.publish) {
        log('error', 'Dispatcher not available; move dropped', payload);
        return false;
    }
    // procgenPlayer's shape: 'bottom' so the substrate coordinator sees the
    // move before gameState commits it.
    moduleDispatcher.publish('user:regionMove', payload, { initialTarget: 'bottom' });
    return true;
}

/**
 * Take one exit of the start region the player is standing in. This is the
 * button press: a REAL `user:regionMove` with a planning `source`, identical in
 * every other respect to a region-graph click.
 *
 * @param {{name: string|null, targetRegion: string}} exit
 */
export function takeExit(exit) {
    if (!exit?.targetRegion) return false;
    return publishMove({
        sourceRegion: currentRegion(),
        targetRegion: exit.targetRegion,
        exitName: exit.name ?? null,
        source: MOVE_SOURCE_EXIT,
    });
}

/**
 * Restart from the first region.
 *
 * OUTSIDE loop mode this is the only restart affordance the app has: clear the
 * path, then teleport with the LOOPS RESET's own shape
 * (`fromReset: true, updatePath: false`) so substrate panels reset themselves
 * and do not bill the teleport. Mana, XP and discovery are deliberately
 * untouched — this restarts the RUN, not the save (the Loops panel's Hard Reset
 * is what clears those).
 *
 * IN loop mode the loops module already owns "back to the start of the run", so
 * this delegates to `loopState.restartFromStart({ autoStart: false })` — the
 * same primitive the Loops panel's own Restart button calls, landing paused
 * because a menu is not a "go" affordance. Nothing is duplicated here.
 *
 * @returns {{mode: 'loop'|'world', target: string|null}}
 */
export function restart() {
    if (loopModeActive()) {
        const loopState = centralRegistry?.getPublicFunction?.('loops', 'getLoopState')?.();
        loopState?.restartFromStart?.({ autoStart: false });
        return { mode: 'loop', target: null };
    }

    gs('clearPath')?.();

    const target = restartTargetOf(resolvedStartRegion(), startRegions());
    const from = currentRegion();
    if (target && target !== from) {
        publishMove({
            sourceRegion: from,
            targetRegion: target,
            fromReset: true,
            updatePath: false,
            source: MOVE_SOURCE_RESTART,
        });
    }
    return { mode: 'world', target };
}

// --- the load handshake -----------------------------------------------------

function handleRawJsonLoaded(data) {
    if (!data?.rawJsonData) return;
    rawJsonData = data.rawJsonData;
    playerId = data?.selectedPlayerInfo?.playerId ?? DEFAULT_PLAYER_ID;
    sawRawJson = true;
    maybeStartHop();
}

function handleRulesLoaded() {
    sawRulesLoaded = true;
    maybeStartHop();
}

/**
 * Runs once per load, when both halves of the handshake have arrived.
 *
 * ⛔ A RESTART DOES NOT COME THROUGH HERE. The skip hop is a LOAD event; a
 * restart deliberately leaves the player at the start region with the panel
 * showing its exits, which is the whole point of the user's ruling that the
 * panel be manually activatable at any time.
 */
function maybeStartHop() {
    if (!sawRawJson || !sawRulesLoaded) return;
    sawRawJson = false;
    sawRulesLoaded = false;

    if (!skipMenu) {
        // Skip OFF: the player plays the menu, so put it in front of them.
        moduleEventBus?.publish?.('ui:activatePanel', { panelId: MENU_PANEL_COMPONENT_TYPE });
        return;
    }

    const region = currentRegion();
    if (!(gs('isStartRegion')?.(region) === true)) return;
    if (procgenOwnsStartHop(resolvedStartRegion())) return;

    const exit = firstExitOf(rawJsonData, playerId, region);
    if (!exit) {
        log('warn', `Skip-the-menu is on but start region '${region}' has no exit to take.`);
        return;
    }
    publishMove({
        sourceRegion: region,
        targetRegion: exit.targetRegion,
        exitName: exit.name ?? null,
        source: MOVE_SOURCE_START,
    });
}

// --- module hooks -----------------------------------------------------------

export function register(registrationApi) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = 'modules/menuPanel/menuPanel.css';
    document.head.appendChild(link);

    registrationApi.registerPanelComponent(MENU_PANEL_COMPONENT_TYPE, MenuPanelUI);

    // Exits and Restart are real moves, published the way every other mover
    // publishes them.
    registrationApi.registerDispatcherSender('user:regionMove', 'bottom', 'first');

    // ⚠ The eventBus DROPS a publish from an unregistered publisher (a warn,
    // no throw, no delivery), so the skip-OFF self-activation needs this line
    // as much as it needs the publish call.
    registrationApi.registerEventBusPublisher('ui:activatePanel');

    registrationApi.registerSettingsSchema({
        type: 'object',
        properties: {
            [SKIP_MENU_SETTING_KEY]: {
                type: 'boolean',
                default: SKIP_MENU_DEFAULT,
                label: 'Skip the menu',
            },
        },
    });

    // Consulted SYNCHRONOUSLY by procgenPlayer.handleRulesLoaded. Registered in
    // register() (not initialize()) because procgenPlayer initializes BEFORE
    // this module — every register() runs before any initialize().
    registrationApi.registerPublicFunction(MENU_PANEL_MODULE_ID, 'isSkipMenuEnabled', isSkipMenuEnabled);
    registrationApi.registerPublicFunction(MENU_PANEL_MODULE_ID, 'getMenuContent', getMenuContent);
    registrationApi.registerPublicFunction(MENU_PANEL_MODULE_ID, 'restart', restart);
}

export async function initialize(moduleId, priorityIndex, initializationApi) {
    moduleEventBus = initializationApi.getEventBus();
    moduleDispatcher = initializationApi.getDispatcher();

    // The schema is the default source (settingsManager.getSetting consults it
    // before any call-site fallback), so no default is repeated here.
    try {
        skipMenu = (await settingsManager.getSetting(SKIP_MENU_SETTING_PATH)) === true;
    } catch (error) {
        log('error', `Failed to read ${SKIP_MENU_SETTING_PATH}; using the schema default`, error);
        skipMenu = SKIP_MENU_DEFAULT;
    }

    unsubRawJson = moduleEventBus.subscribe('stateManager:rawJsonDataLoaded', handleRawJsonLoaded);
    unsubRulesLoaded = moduleEventBus.subscribe('stateManager:rulesLoaded', handleRulesLoaded);

    log('info', `Initialized (priority ${priorityIndex}); skip-the-menu = ${skipMenu}`);

    return () => {
        if (typeof unsubRawJson === 'function') unsubRawJson();
        if (typeof unsubRulesLoaded === 'function') unsubRulesLoaded();
        unsubRawJson = null;
        unsubRulesLoaded = null;
        rawJsonData = null;
        sawRawJson = false;
        sawRulesLoaded = false;
        moduleEventBus = null;
        moduleDispatcher = null;
    };
}

/**
 * The module's eventBus, with a pre-initialize fallback: GoldenLayout can
 * construct the panel before initialize() has run.
 */
export function getModuleEventBus() {
    if (moduleEventBus) return moduleEventBus;
    return {
        publish: (event, data) => eventBus.publish(event, data, MENU_PANEL_MODULE_ID),
        subscribe: (event, callback) => eventBus.subscribe(event, callback, MENU_PANEL_MODULE_ID),
        unsubscribe: (event, callback) => eventBus.unsubscribe(event, callback, MENU_PANEL_MODULE_ID),
    };
}

// Test-only — reset module-scope state between cases.
export function _testOnly_resetModuleState() {
    rawJsonData = null;
    playerId = DEFAULT_PLAYER_ID;
    skipMenu = SKIP_MENU_DEFAULT;
    sawRawJson = false;
    sawRulesLoaded = false;
    moduleEventBus = null;
    moduleDispatcher = null;
}
