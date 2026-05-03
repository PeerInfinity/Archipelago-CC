/**
 * textAdventureSubstrate — substrate-style replacement for the
 * existing `textAdventure/` module. Subscribes to
 * textAdventure:loadRegion (published by procgenPlayer when a procgen
 * world transitions to a region whose substrate is 'text_adventure'),
 * activates the panel, and renders the region as a textual
 * description with clickable exits and locations.
 *
 * The existing `textAdventure/` module continues to handle non-
 * procgen rules.json playback (load via stateManager + render via
 * `textAdventurePanel`); this substrate module handles the
 * procgen path via its own `textAdventureSubstratePanel` Golden
 * Layout component. They coexist.
 *
 * See NewDocs/plans/procedural-generation/text-adventure-substrate.md
 * §"Text Adventure substrate" for the design.
 */

import { TextAdventureSubstrateUI } from './textAdventureSubstrateUI.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { substrateRegistryEntry } from './textAdventureSubstrateLibrary.js';
import settingsManager from '../../app/core/settingsManager.js';

export * from './textAdventureSubstrateLibrary.js';

const SETTINGS_DEFAULTS = Object.freeze({
    messageHistoryLimit: 10,
    autoFocusCommandInput: true,
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
});

let _settings = { ...SETTINGS_DEFAULTS };

export function getTextAdventureSubstrateSettings() {
    return _settings;
}

export const moduleInfo = {
    name: 'textAdventureSubstrate',
    title: 'Text Adventure (Substrate)',
    componentType: 'textAdventureSubstratePanel',
    icon: '📜',
    column: 3,
    description:
        'Renders procgen-emitted regions whose substrate is `text_adventure`'
        + ' as textual descriptions with clickable exits and locations.',
    requires: [],
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
    if (eventBus?.publish) {
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
    if (unsubLoadRegion) { unsubLoadRegion(); unsubLoadRegion = null; }
    if (unsubSettingsChanged) { unsubSettingsChanged(); unsubSettingsChanged = null; }
}

// Test-only — patch the in-memory settings without going through
// settingsManager. Used by Stage C tests for the command parser /
// auto-focus behaviour.
export function _testOnly_setSettings(patch) {
    _settings = { ..._settings, ...patch };
}

let unsubSettingsChanged = null;

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
    }

    return () => {
        if (unsubLoadRegion) { unsubLoadRegion(); unsubLoadRegion = null; }
        if (unsubSettingsChanged) { unsubSettingsChanged(); unsubSettingsChanged = null; }
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
