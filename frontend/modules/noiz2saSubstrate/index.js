/**
 * noiz2saSubstrate — host module for the Noiz2sa (BulletML shoot-'em-up) substrate (`noiz2saSubstrateLibrary.js`
 * holds the registry entry and the rulings it follows).
 *
 * Like runnerDemo, it rides flashSubstrate's machinery as shared CODE: the panel class comes from
 * flashSubstratePanel.js's factory, pointed at this module's own game page (`game/index.html`, which imports
 * the engine from the `bulletml-dodge` submodule), and the injected bridge is flashSubstrate/bridge.js itself
 * (the page speaks the `__swfBridge` contract). What this module owns is its identity: the panel component
 * ('noiz2saSubstratePanel'), the load event ('noiz2sa:loadRegion', passed to the bridge in the iframe URL) and
 * the iframe id — so flash and runner region loads never configure this iframe.
 */

import { createSubstrateIframePanelClass } from '../flashSubstrate/flashSubstratePanel.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import {
    substrateRegistryEntry,
    NOIZ2SA_PANEL_COMPONENT_TYPE,
    NOIZ2SA_LOAD_REGION_EVENT,
    NOIZ2SA_IFRAME_ID,
} from './noiz2saSubstrateLibrary.js';

// In an iframe the page plays the region the bridge configures; opened directly in a tab it plays a region
// from its own URL (?start=1:2&end=1:3&seed=1), for development.
const GAME_IFRAME_SRC = `./modules/noiz2saSubstrate/game/index.html?iframeId=${NOIZ2SA_IFRAME_ID}`
    + `&loadRegionEvent=${NOIZ2SA_LOAD_REGION_EVENT}`;

export const Noiz2saSubstratePanel = createSubstrateIframePanelClass({
    componentType: NOIZ2SA_PANEL_COMPONENT_TYPE,
    title: 'Noiz2sa',
    iframeSrc: GAME_IFRAME_SRC,
    // Resolved against the iframe page URL (.../modules/noiz2saSubstrate/game/index.html).
    bridgeSrc: '../../flashSubstrate/bridge.js',
    moduleName: 'noiz2saSubstrate',
});

export const moduleInfo = {
    name: 'noiz2saSubstrate',
    title: 'Noiz2sa',
    componentType: NOIZ2SA_PANEL_COMPONENT_TYPE,
    icon: '🚀',
    column: 3,
    category: 'Procgen Substrate Panels',
    description: 'Plays each region as a segment of Noiz2sa, a bullet-hell shoot-\'em-up: survive its scenes to clear it; a hit restarts the region.',
    requires: ['stateManager', 'iframeAdapter'],
};

let _initApi = null;

export function register(registrationApi) {
    // The panel reuses flashSubstrate's CSS classes (flashsub-root / flashsub-iframe).
    if (typeof document !== 'undefined'
        && !document.querySelector('link[href="modules/flashSubstrate/flashSubstrate.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'modules/flashSubstrate/flashSubstrate.css';
        document.head.appendChild(link);
    }

    registrationApi.registerPanelComponent(NOIZ2SA_PANEL_COMPONENT_TYPE, Noiz2saSubstratePanel);

    // The bridge dispatches user:locationCheck (the region cleared) and user:regionMove (the player left by an
    // exit) up the dispatcher chain.
    registrationApi.registerDispatcherSender('user:locationCheck', 'bottom', 'first');
    registrationApi.registerDispatcherSender('user:regionMove', 'bottom', 'first');

    // procgenPlayer publishes noiz2sa:loadRegion (the entry's loadRegionEvent); the bridge picks it up through
    // the iframeAdapter relay.
    registrationApi.registerEventBusPublisher(NOIZ2SA_LOAD_REGION_EVENT);
    // Brings the panel forward when the player enters a Noiz2sa region.
    registrationApi.registerEventBusPublisher('ui:activatePanel');
    registrationApi.registerEventBusSubscriberIntent(NOIZ2SA_LOAD_REGION_EVENT);

    if (!substrateRegistry.has(substrateRegistryEntry.id)) {
        substrateRegistry.register(substrateRegistryEntry);
    }
}

export function initialize(_moduleId, _priorityIndex, initializationApi) {
    _initApi = initializationApi;
    const eventBus = initializationApi.getEventBus();
    if (!eventBus) return;
    // Bring the panel forward on a region load, unless loops is focus-locking another panel.
    eventBus.subscribe(NOIZ2SA_LOAD_REGION_EVENT, () => {
        const isFocusLocked = initializationApi.getModuleFunction?.('loops', 'isFocusLocked');
        if (isFocusLocked?.()) return;
        eventBus.publish('ui:activatePanel', { panelId: NOIZ2SA_PANEL_COMPONENT_TYPE });
    }, 'noiz2saSubstrate');
}

export function getInitApi() {
    return _initApi;
}
