/**
 * textAdventureSubstrateWrapper — phase 1 of the substrate-wrapper
 * experiment. Mounts an iframe panel that loads the synthetic
 * archipelago-naive text-adventure engine. An in-iframe bridge.js
 * translates host AP state into engine API calls.
 *
 * This module deliberately coexists with textAdventureSubstrate/ for
 * phase 1. It does NOT yet register a substrate registry entry — that
 * comes in phase 2 once the bridge can deserialize procgen sidecars.
 *
 * See NewDocs/plans/procedural-generation/textadventure-engine-spec.md
 * for the engine contract.
 */

import { TextAdventureSubstrateWrapperPanel, PANEL_SHOWN_EVENT } from './textAdventureSubstrateWrapperPanel.js';
import { getDiscoverySettings } from '../discovery/index.js';
import discoveryStateSingleton from '../discovery/singleton.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { substrateRegistryEntry } from './textAdventureSubstrateWrapperLibrary.js';
import { PlaybackProxy, PLAYBACK_CONTROL_EVENT } from './playbackProxy.js';
import settingsManager from '../../app/core/settingsManager.js';
import { initManaWiring, getHeaderInfoEvent } from './mana.js';
import { startTextAdventureRecorder } from './recorder.js';

const SETTINGS_DEFAULTS = Object.freeze({
    messageHistoryLimit: 10,
    autoFocusCommandInput: true,
    autoLoadCustomData: '',
});

const SETTINGS_SCHEMA = Object.freeze({
    messageHistoryLimit: {
        type: 'number',
        default: SETTINGS_DEFAULTS.messageHistoryLimit,
        description: 'Maximum number of messages to keep in the iframe engine\'s scrollback.',
    },
    autoFocusCommandInput: {
        type: 'boolean',
        default: SETTINGS_DEFAULTS.autoFocusCommandInput,
        description: 'Re-focus the command input after every click action in the engine.',
    },
    autoLoadCustomData: {
        type: 'string',
        default: SETTINGS_DEFAULTS.autoLoadCustomData,
        description: 'Override URL (or bare name) for the custom-data JSON to load. Empty = auto-detect by game name.',
    },
});

let _settings = { ...SETTINGS_DEFAULTS };
export function getTextAdventureSubstrateWrapperSettings() { return _settings; }

// Custom-data cache. Holds the most recently auto-loaded prose
// document; null until rules load (or after a fetch failure). Used by
// the bridge to template region/location/exit descriptions when
// custom-data templating lands.
let _customData = null;
export function getCustomData() { return _customData; }

// Resolve a setting value to a fetch URL. Bare names map to the
// conventional ./modules/shared/customData/<name>_textadventure.json
// path; anything with a slash or protocol is treated as a literal URL;
// empty returns null. Mirrors the original substrate so users can
// migrate their settings unchanged.
function resolveCustomDataUrl(value) {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.includes('/') || /^[a-z]+:/i.test(trimmed)) return trimmed;
    return customDataUrlForGame(trimmed);
}

function customDataUrlForGame(gameName) {
    if (!gameName || typeof gameName !== 'string') return null;
    const slug = gameName.trim().toLowerCase();
    if (!slug) return null;
    return `./modules/shared/customData/${slug}_textadventure.json`;
}

function pickAutoLoadCustomDataUrl(rulesJson, playerId, settingValue) {
    const explicit = resolveCustomDataUrl(settingValue);
    if (explicit) return explicit;
    const gameName = rulesJson?.world?.[playerId]?.game;
    return customDataUrlForGame(gameName);
}

async function fetchAndCacheCustomData(url) {
    if (!url) { _customData = null; return; }
    try {
        const response = await fetch(url);
        if (!response.ok) { _customData = null; return; }
        _customData = await response.json();
    } catch {
        _customData = null;
    }
}

export const moduleInfo = {
    name: 'textAdventureSubstrateWrapper',
    title: 'Text Adventure (wrapper)',
    componentType: 'textAdventureSubstrateWrapperPanel',
    icon: '📜',
    column: 3,
    description:
        'Parallel text-adventure renderer driven by the synthetic engine. '
        + 'Phase 1: standalone rules.json playback only. Coexists with '
        + 'textAdventureSubstrate; intended to eventually replace it.',
    requires: ['stateManager', 'gameState', 'discovery', 'iframeAdapter'],
};

const INITIAL_STATE_EVENT = 'textAdventureSubstrateWrapper:initialState';

// Singleton PlaybackProxy — created in initialize() once the eventBus
// is available. The substrate registry entry's getPlaybackController
// returns it so the playback bot can drive the iframe-side controller.
// Returns null before initialize() has run (registry callers handle
// the null case as "no panel mounted / no controller available").
let _playbackProxy = null;
export function getPlaybackProxy() { return _playbackProxy; }

export function register(registrationApi) {
    if (typeof document !== 'undefined') {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'modules/textAdventureSubstrateWrapper/textAdventureSubstrateWrapper.css';
        document.head.appendChild(link);
    }

    registrationApi.registerPanelComponent(
        'textAdventureSubstrateWrapperPanel',
        TextAdventureSubstrateWrapperPanel,
    );

    registrationApi.registerEventBusPublisher(INITIAL_STATE_EVENT);
    registrationApi.registerEventBusPublisher('ui:activatePanel');
    // Bot → bridge control channel. Published by PlaybackProxy on the
    // host side; subscribed by the iframe's playbackBridge.js.
    registrationApi.registerEventBusPublisher(PLAYBACK_CONTROL_EVENT);
    // Mana/header readout pushed to the bridge for engine.setHeaderInfo.
    registrationApi.registerEventBusPublisher(getHeaderInfoEvent());
    // Panel-shown event published by the panel's onShow lifecycle.
    // Bridge subscribes and refocuses the engine's command input.
    registrationApi.registerEventBusPublisher(PANEL_SHOWN_EVENT);
    // Substrate-internal recording channel. Bridge publishes one
    // event per engine command (move / examine / explore); the
    // saved-queue recorder subscribes.
    registrationApi.registerEventBusPublisher('textAdventure:commandRecorded');
    registrationApi.registerEventBusSubscriberIntent('iframe:appReady');
    registrationApi.registerEventBusSubscriberIntent('textAdventure:loadRegion');
    registrationApi.registerEventBusSubscriberIntent('textAdventure:commandRecorded');
    // Procgen mode detection — subscribe to rawJsonDataLoaded to spot
    // preset_sidecars and forward the substrate's sidecar-region set
    // to the bridge so it can filter Menu / other non-sidecar regions
    // out of the engine's world. Mirrors the procgen vs standalone
    // mode detection in textAdventureSubstrate/index.js.
    registrationApi.registerEventBusSubscriberIntent('stateManager:rawJsonDataLoaded');
    registrationApi.registerEventBusSubscriberIntent('settings:changed');
    // Mana-tracking subscriptions (see mana.js).
    registrationApi.registerEventBusSubscriberIntent('gameState:loopModeChanged');
    registrationApi.registerEventBusSubscriberIntent('gameState:manaChanged');
    registrationApi.registerEventBusSubscriberIntent('gameState:regionChanged');
    registrationApi.registerEventBusSubscriberIntent('stateManager:snapshotUpdated');
    registrationApi.registerEventBusSubscriberIntent('costDataManager:loaded');
    registrationApi.registerEventBusSubscriberIntent('costDataManager:cleared');

    // Click handlers in the bridge publish user:locationCheck and
    // user:regionMove (loop reset on mana-zero also publishes a fresh
    // user:regionMove). Register as dispatcher sender so the chain
    // accepts the publishes; mirrors the original textAdventureSubstrate.
    if (typeof registrationApi.registerDispatcherSender === 'function') {
        registrationApi.registerDispatcherSender('user:locationCheck', 'bottom', 'first');
        registrationApi.registerDispatcherSender('user:regionMove', 'bottom', 'first');
    }

    // Register the substrate entry so procgen recognizes
    // 'text_adventure' and dispatches loadRegion events to our panel.
    // Guarded by has() so we lose gracefully if the existing
    // textAdventureSubstrate is also enabled.
    if (!substrateRegistry.has(substrateRegistryEntry.id)) {
        substrateRegistry.register(substrateRegistryEntry);
    }

    if (typeof registrationApi.registerSettingsSchema === 'function') {
        registrationApi.registerSettingsSchema(SETTINGS_SCHEMA);
    }
}

async function loadSettings() {
    if (!settingsManager?.getSetting) return;
    try {
        const next = { ..._settings };
        for (const key of Object.keys(SETTINGS_SCHEMA)) {
            next[key] = await settingsManager.getSetting(
                `moduleSettings.textAdventureSubstrateWrapper.${key}`,
                SETTINGS_DEFAULTS[key],
            );
        }
        _settings = next;
    } catch {
        // Settings unavailable — keep current cache.
    }
}

// Procgen mode tracking — populated from stateManager:rawJsonDataLoaded.
// procgenMode is true when the current rules.json carries a
// preset_sidecars block (i.e. regions are tagged with substrates).
// procgenSidecarRegions is the set of region names that have a sidecar
// entry; the bridge uses it to filter non-sidecar regions (Menu, etc.)
// out of the engine's world.
let _procgenMode = false;
let _procgenSidecarRegions = [];

function _buildInitialStatePayload() {
    const settings = getDiscoverySettings();
    const active = !!settings?.enableDiscoveryMode;
    let discoveredRegions = [];
    let discoveredLocations = [];
    let discoveredExits = [];
    try {
        discoveredRegions = Array.from(discoveryStateSingleton.getDiscoveredRegions());
        discoveredLocations = Array.from(discoveryStateSingleton.getDiscoveredLocations());
        const exitsMap = discoveryStateSingleton.getDiscoveredExits();
        for (const [regionName, exitSet] of exitsMap.entries()) {
            for (const exitName of exitSet) {
                discoveredExits.push({ regionName, exitName });
            }
        }
    } catch {
        // Singleton may not be fully initialized; carry on with empties.
    }
    return {
        discoveryMode: active ? 'discovered' : 'full',
        discoveredRegions,
        discoveredLocations,
        discoveredExits,
        procgenMode: _procgenMode,
        procgenSidecarRegions: _procgenSidecarRegions,
        // Host settings pushed to the engine via setOption(). Bridge
        // applies them on receipt; runtime changes re-broadcast on
        // settings:changed.
        engineSettings: {
            messageHistoryLimit: _settings.messageHistoryLimit,
            autoFocusCommandInput: _settings.autoFocusCommandInput,
        },
        // Custom-data document for prose templating. Bridge caches it;
        // consumed once templating lands. null is a valid value (no
        // data fetched, or fetch failed).
        customData: _customData,
    };
}

export async function initialize(_moduleId, _priorityIndex, initializationApi) {
    const eventBus = initializationApi.getEventBus();
    const dispatcher = initializationApi.getDispatcher?.();
    if (!eventBus) return;

    // Load persisted settings before broadcasting initialState, so the
    // first iframe:appReady fire-back carries the user's saved values
    // instead of defaults.
    await loadSettings();

    // Build the host-side PlaybackProxy. Returned by the substrate
    // registry entry's getPlaybackController; publishes control events
    // that the in-iframe playbackBridge subscribes to.
    _playbackProxy = new PlaybackProxy({ eventBus });

    // Mana display + deduction wiring. Publishes a header-info event
    // the bridge subscribes to; deducts mana on observed user actions
    // when the current region has manaEnabled and loop mode is off.
    // Performs its own late-mount backfill from gameState +
    // stateManager so events that fired before this module subscribed
    // don't leave us with a null current region.
    initManaWiring({ eventBus, dispatcher });

    // Saved-queue recorder — subscribes to textAdventure:loadRegion
    // and textAdventure:commandRecorded; persists a SavedQueue to
    // savedQueueStore on every region exit. Lives for the module's
    // lifetime; this module isn't unloaded mid-session, so the
    // returned stop() is captured but not currently invoked.
    startTextAdventureRecorder({ eventBus });

    // Reload settings on change and re-broadcast initialState so the
    // bridge applies them. Cheap (small payload, idempotent for
    // unchanged fields) and the iframe ignores irrelevant fields.
    eventBus.subscribe('settings:changed', async () => {
        await loadSettings();
        eventBus.publish(INITIAL_STATE_EVENT, _buildInitialStatePayload());
    });

    // When ANY iframe app reports ready, broadcast the current
    // discovery state. The bridge subscribes to this event and
    // applies the state on receipt — fixing the "discovery mode not
    // set on first load" gap (the iframe protocol has no native
    // discovery snapshot to query).
    //
    // Publishing on every iframe:appReady (not just our own) is
    // harmless: the event is idempotent, payload is small, and our
    // bridge is the only subscriber to this custom event name.
    // When procgen dispatches textAdventure:loadRegion (e.g. on a
    // region transition from a maze region back to a text-adventure
    // one), bring the wrapper's panel forward in its Golden Layout
    // stack. Mirrors textAdventureSubstrate's handleLoadRegion.
    // Skipped when loops is focus-locking another panel.
    eventBus.subscribe('textAdventure:loadRegion', () => {
        // Skip activation when loops is focus-locking another panel
        // (the "Keep this panel focused" toggle in the Loops UI). The
        // bridge still picks up the loadRegion via its own iframe-
        // protocol subscription; only the tab-switch is suppressed.
        const isFocusLocked = initializationApi.getModuleFunction?.('loops', 'isFocusLocked');
        if (isFocusLocked?.()) return;
        eventBus.publish('ui:activatePanel', { panelId: 'textAdventureSubstrateWrapperPanel' });
    });

    // Procgen mode detection: when rules load with a preset_sidecars
    // block, capture the sidecar-region set and re-broadcast initial
    // state so the bridge can filter Menu / other non-sidecar regions
    // out of the engine's world. Also kicks off the custom-data auto-
    // load so prose for the current game is ready when templating runs.
    eventBus.subscribe('stateManager:rawJsonDataLoaded', async (data) => {
        const rulesJson = data?.rawJsonData;
        const playerId = data?.selectedPlayerInfo?.playerId ?? '1';
        const sidecars = rulesJson?.preset_sidecars?.[playerId];
        _procgenMode = !!sidecars;
        _procgenSidecarRegions = sidecars ? Object.keys(sidecars) : [];
        const url = pickAutoLoadCustomDataUrl(rulesJson, playerId, _settings.autoLoadCustomData);
        await fetchAndCacheCustomData(url);
        eventBus.publish(INITIAL_STATE_EVENT, _buildInitialStatePayload());
    });

    eventBus.subscribe('iframe:appReady', () => {
        eventBus.publish(INITIAL_STATE_EVENT, _buildInitialStatePayload());
    });
}
