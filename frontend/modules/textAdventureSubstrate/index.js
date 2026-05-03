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

export * from './textAdventureSubstrateLibrary.js';

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
    if (unsubLoadRegion) { unsubLoadRegion(); unsubLoadRegion = null; }
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
}

export async function initialize(_moduleId, _priorityIndex, initializationApi) {
    eventBus = initializationApi.getEventBus();
    dispatcher = initializationApi.getDispatcher();

    TextAdventureSubstrateUI.setModuleApis({ eventBus, dispatcher });

    if (eventBus?.subscribe) {
        unsubLoadRegion = eventBus.subscribe(
            substrateRegistryEntry.loadRegionEvent,
            handleLoadRegion,
        );
    }

    return () => {
        if (unsubLoadRegion) { unsubLoadRegion(); unsubLoadRegion = null; }
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
