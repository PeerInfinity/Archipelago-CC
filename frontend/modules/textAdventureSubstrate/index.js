/**
 * textAdventureSubstrate — subscribes to textAdventure:loadRegion
 * (published by procgenPlayer when a procgen world transitions to a
 * region whose substrate is 'text_adventure'), activates the panel,
 * and renders the region as a textual description with clickable
 * exits and locations. Uses its own `textAdventureSubstratePanel`
 * Golden Layout component.
 *
 * See NewDocs/plans/procedural-generation/text-adventure-substrate.md
 * §"Text Adventure substrate" for the design.
 */

import { TextAdventureSubstrateUI } from './textAdventureSubstrateUI.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { substrateRegistryEntry } from './textAdventureSubstrateLibrary.js';
import settingsManager from '../../app/core/settingsManager.js';
import stateManagerProxySingleton from '../stateManager/stateManagerProxySingleton.js';
import { getGameStateSingleton } from '../gameState/singleton.js';
import { pickAutoLoadCustomDataUrl } from './textAdventureSubstrateStandalone.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';

export * from './textAdventureSubstrateLibrary.js';

const SETTINGS_DEFAULTS = Object.freeze({
    messageHistoryLimit: 10,
    autoFocusCommandInput: true,
    autoLoadCustomData: '',
});

const SETTINGS_SCHEMA = Object.freeze({
    messageHistoryLimit: {
        type: 'number',
        default: SETTINGS_DEFAULTS.messageHistoryLimit,
        description: 'Maximum number of messages to keep in the message history',
    },
    autoFocusCommandInput: {
        type: 'boolean',
        default: SETTINGS_DEFAULTS.autoFocusCommandInput,
        description: 'Auto-focus the command input on region entry',
    },
    autoLoadCustomData: {
        type: 'string',
        default: SETTINGS_DEFAULTS.autoLoadCustomData,
        description: 'Override URL (or bare name) for the custom-data JSON to load. Empty = auto-detect by game name from ./modules/shared/customData/<game>_textadventure.json.',
    },
});

let _settings = { ...SETTINGS_DEFAULTS };
let _customData = null;

// Operating mode. Set on rawJsonDataLoaded:
//   'procgen'    — rules.json has preset_sidecars[playerId];
//                  textAdventure:loadRegion drives the panel
//   'standalone' — no sidecars; gameState:regionChanged drives the
//                  panel via raw staticData.regions data
//   null         — not yet detected (panel renders the placeholder)
let _mode = null;

export function getTextAdventureSubstrateSettings() {
    return _settings;
}

export function getMode() {
    return _mode;
}

/** Returns the currently-loaded custom data document, or null. */
export function getCustomData() {
    return _customData;
}

/**
 * Replace the in-memory custom data and broadcast a load event so
 * any mounted panel re-renders. Public so callers (a future UI
 * picker, a test harness) can swap data at runtime.
 */
export function loadCustomData(data) {
    _customData = data ?? null;
    if (eventBus?.publish) {
        eventBus.publish('textAdventureSubstrate:customDataLoaded', { customData: _customData });
    }
}

export const moduleInfo = {
    name: 'textAdventureSubstrate',
    title: 'Text Adventure',
    componentType: 'textAdventureSubstratePanel',
    icon: '📜',
    column: 3,
    description:
        'Renders Archipelago regions as textual descriptions with clickable'
        + ' exits and locations. Handles both procgen-emitted text-adventure'
        + ' substrates and standalone (raw rules.json) playback.',
    requires: ['stateManager', 'gameState', 'discovery'],
};

let panelInstance = null;
let eventBus = null;
let dispatcher = null;
let unsubLoadRegion = null;

// Buffer for a textAdventure:loadRegion event that arrived before the
// panel was mounted. The panel's constructor drains it on mount via
// consumePendingLoadRegion(). Mirrors mazeRoom/index.js's pattern.
let pendingLoadRegion = null;

function handleLoadRegion(payload) {
    // Self-activate. No-op when this panel is already the active item;
    // ui:activatePanel brings it (or causes it to be created) into
    // focus in any other case.
    //
    // Skip activation when the loops panel has "Keep this panel focused"
    // on AND the queue is currently driving (loops.isFocusLocked()).
    // The substrate still picks up the loadRegion payload for rendering;
    // only the tab-switch is suppressed.
    const focusLocked = centralRegistry.getPublicFunction?.('loops', 'isFocusLocked')?.();
    if (!focusLocked && eventBus?.publish) {
        eventBus.publish('ui:activatePanel', { panelId: 'textAdventureSubstratePanel' });
    }
    if (panelInstance && typeof panelInstance.applyLoadedRegion === 'function') {
        panelInstance.applyLoadedRegion(payload);
    } else {
        // Panel will pick this up in its constructor on mount.
        pendingLoadRegion = payload;
    }
}

export function consumePendingLoadRegion() {
    const p = pendingLoadRegion;
    pendingLoadRegion = null;
    return p;
}

// Test-only — reset module-scope state between cases.
export function _testOnly_resetModuleState() {
    panelInstance = null;
    eventBus = null;
    dispatcher = null;
    pendingLoadRegion = null;
    _settings = { ...SETTINGS_DEFAULTS };
    _customData = null;
    _mode = null;
    if (unsubLoadRegion) { unsubLoadRegion(); unsubLoadRegion = null; }
    if (unsubSettingsChanged) { unsubSettingsChanged(); unsubSettingsChanged = null; }
    if (unsubRawJsonLoaded) { unsubRawJsonLoaded(); unsubRawJsonLoaded = null; }
    if (unsubRegionChanged) { unsubRegionChanged(); unsubRegionChanged = null; }
}

export function _testOnly_setMode(mode) {
    _mode = mode;
}

// Test-only — patch the in-memory settings without going through
// settingsManager. Used by Stage C tests for the command parser /
// auto-focus behaviour.
export function _testOnly_setSettings(patch) {
    _settings = { ..._settings, ...patch };
}

// Test-only — set the in-memory custom data without going through
// fetch. Skips the load event broadcast so tests can configure state
// before constructing the panel.
export function _testOnly_setCustomData(data) {
    _customData = data ?? null;
}

let unsubSettingsChanged = null;
let unsubRawJsonLoaded = null;
let unsubRegionChanged = null;

async function loadSettings() {
    if (!settingsManager?.getSetting) return;
    try {
        const next = { ..._settings };
        for (const key of Object.keys(SETTINGS_SCHEMA)) {
            next[key] = await settingsManager.getSetting(
                `moduleSettings.textAdventureSubstrate.${key}`,
                SETTINGS_DEFAULTS[key],
            );
        }
        _settings = next;
    } catch {
        // Settings unavailable — keep current cache (may be defaults).
    }
}

/**
 * Fetch a custom-data file from the given URL and broadcast a load
 * event. Failures (404, network, parse) are swallowed — the panel
 * falls back to its generic prose.
 */
async function fetchAndLoadCustomData(url) {
    if (!url) return;
    try {
        const response = await fetch(url);
        if (!response.ok) return;
        const data = await response.json();
        loadCustomData(data);
    } catch {
        // Network / parse failure — leave the previous _customData
        // (or null) in place.
    }
}

/**
 * Standalone-mode helpers. Imported lazily so the panel module
 * (which already imports getCustomData / settings from this file)
 * doesn't pull standaloneRegion logic in by default.
 */
function handleRawJsonLoaded(data) {
    const rulesJson = data?.rawJsonData;
    if (!rulesJson) return;
    const playerId = data?.selectedPlayerInfo?.playerId ?? '1';
    const hasSidecars = !!rulesJson?.preset_sidecars?.[playerId];
    _mode = hasSidecars ? 'procgen' : 'standalone';

    // Pick a custom-data URL to try. Explicit setting wins; otherwise
    // the rules.json's game name resolves to the conventional
    // ./modules/shared/customData/<game>_textadventure.json path. A
    // 404 is fine — the panel just keeps its generic prose.
    const url = pickAutoLoadCustomDataUrl(rulesJson, playerId, _settings.autoLoadCustomData);
    void fetchAndLoadCustomData(url);
}

function handleStandaloneRegionChanged(data) {
    if (_mode !== 'standalone') return;
    if (!panelInstance?.applyStandaloneRegion) return;
    const regionName = data?.newRegion;
    if (!regionName) return;
    const regionData = _lookupStandaloneRegion(regionName);
    if (!regionData) return;
    panelInstance.applyStandaloneRegion(regionName, regionData, data?.oldRegion ?? null);
}

function _lookupStandaloneRegion(regionName) {
    const staticData = stateManagerProxySingleton?.getStaticData?.();
    if (!staticData?.regions) return null;
    return staticData.regions.get(regionName) ?? null;
}

function _readCurrentStandaloneRegion() {
    const gs = getGameStateSingleton?.();
    const regionName = gs?.getCurrentRegion?.() ?? null;
    if (!regionName) return null;
    const regionData = _lookupStandaloneRegion(regionName);
    if (!regionData) return null;
    return { regionName, regionData };
}

/**
 * Helper for the panel constructor: when a panel mounts after
 * rulesLoaded has already fired, it needs to backfill its initial
 * standalone region. Returns null when the mode hasn't been
 * detected yet, when we're in procgen mode, or when no current
 * region is available.
 */
export function readPendingStandaloneRegion() {
    if (_mode !== 'standalone') return null;
    return _readCurrentStandaloneRegion();
}

export function register(registrationApi) {
    // No-op under headless tests; the stylesheet only matters when the
    // panel is actually rendered.
    if (typeof document !== 'undefined') {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'modules/textAdventureSubstrate/textAdventureSubstrate.css';
        document.head.appendChild(link);
    }

    registrationApi.registerPanelComponent(
        'textAdventureSubstratePanel',
        TextAdventureSubstrateUI,
    );

    registrationApi.registerEventBusPublisher('ui:activatePanel');
    registrationApi.registerEventBusPublisher('textAdventureSubstrate:customDataLoaded');

    // The text panel publishes user:locationCheck and user:regionMove
    // when the player clicks a location / exit, same chain-of-authority
    // slot the existing textAdventure module sits in. Step 6 wires
    // these click handlers; the registration goes here so they're
    // recognised dispatcher senders from the start.
    if (typeof registrationApi.registerDispatcherSender === 'function') {
        registrationApi.registerDispatcherSender('user:locationCheck', 'bottom', 'first');
        registrationApi.registerDispatcherSender('user:regionMove', 'bottom', 'first');
    }

    // Register with the substrate registry. mazeRoomLibrary's
    // side-effect import handles maze; this hook handles
    // text_adventure for the same reason — the procgen pipeline
    // dispatches via the registry, which has to be populated before
    // the driver runs. The library's own side-effect import already
    // registers, so this is idempotent.
    if (!substrateRegistry.has(substrateRegistryEntry.id)) {
        substrateRegistry.register(substrateRegistryEntry);
    }

    if (typeof registrationApi.registerSettingsSchema === 'function') {
        registrationApi.registerSettingsSchema(
            'textAdventureSubstrate',
            SETTINGS_SCHEMA,
        );
    }
}

export async function initialize(_moduleId, _priorityIndex, initializationApi) {
    eventBus = initializationApi.getEventBus();
    dispatcher = initializationApi.getDispatcher();

    TextAdventureSubstrateUI.setModuleApis({ eventBus, dispatcher });

    await loadSettings();

    if (eventBus?.subscribe) {
        unsubLoadRegion = eventBus.subscribe(
            substrateRegistryEntry.loadRegionEvent,
            handleLoadRegion,
        );
        unsubSettingsChanged = eventBus.subscribe(
            'settings:changed',
            () => { loadSettings(); },
        );
        unsubRawJsonLoaded = eventBus.subscribe(
            'stateManager:rawJsonDataLoaded',
            handleRawJsonLoaded,
        );
        // Initial standalone region pickup: gameState.reset() (called
        // by gameState's own stateManager:rulesLoaded handler)
        // unconditionally publishes gameState:regionChanged for the
        // start region, so this single subscription covers both initial
        // load and subsequent transitions. A panel that mounts after
        // those events fires backfills via readPendingStandaloneRegion.
        unsubRegionChanged = eventBus.subscribe(
            'gameState:regionChanged',
            handleStandaloneRegionChanged,
        );
    }

    // Custom-data auto-load now runs from handleRawJsonLoaded — we
    // need the rules.json's game name to pick the right file when
    // the user hasn't set autoLoadCustomData explicitly. Without a
    // rules.json there's nothing to render anyway, so no point
    // pre-fetching here.

    return () => {
        if (unsubLoadRegion) { unsubLoadRegion(); unsubLoadRegion = null; }
        if (unsubSettingsChanged) { unsubSettingsChanged(); unsubSettingsChanged = null; }
        if (unsubRawJsonLoaded) { unsubRawJsonLoaded(); unsubRawJsonLoaded = null; }
        if (unsubRulesLoaded) { unsubRulesLoaded(); unsubRulesLoaded = null; }
        if (unsubRegionChanged) { unsubRegionChanged(); unsubRegionChanged = null; }
        panelInstance = null;
        eventBus = null;
        dispatcher = null;
        pendingLoadRegion = null;
    };
}

export function setPanelInstance(instance) {
    panelInstance = instance;
}

export function getPanelInstance() {
    return panelInstance;
}

export function getModuleApis() {
    return { eventBus, dispatcher };
}
