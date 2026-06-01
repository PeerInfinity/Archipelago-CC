/**
 * flashSubstrate — host module that:
 *  - Registers a Golden Layout panel that mounts a same-origin local
 *    iframe pointing at a recompiled Flash game page (SWF -> C -> WASM
 *    via SWFRecomp-CC). v1 ships a placeholder page so the module is
 *    testable before the real recompiled-game page lands.
 *  - Registers a substrate registry entry (id: 'flash'), so
 *    procgenPlayer publishes flash:loadRegion when the player enters
 *    a region tagged with this substrate.
 *  - Acts as the host-side broker for the in-iframe bridge: relays the
 *    flash:loadRegion activation and brings the panel forward.
 *
 * The in-iframe bridge (bridge.js) completes the iframeAdapter
 * handshake, configures the game from the region payload, applies
 * received items (pollItems), and dispatches user:locationCheck when the
 * game's ActionScript cooperatively calls __swfBridge.sendLocation.
 *
 * See NewDocs/plans/procedural-generation/flash-substrate-converged.md
 * for the broader design (one substrate, two modes) and how this fits
 * with the maze / text-adventure / JtA substrates (the iframe-substrate
 * precedents this module clones).
 */

import { FlashSubstratePanel } from './flashSubstratePanel.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { substrateRegistryEntry } from './flashSubstrateLibrary.js';

export const moduleInfo = {
    name: 'flashSubstrate',
    title: 'Flash',
    componentType: 'flashSubstratePanel',
    icon: '🎞️',
    column: 3,
    description:
        'A Flash game hosted in an iframe as a procgen substrate, runtime-'
        + 'neutral across SWFRecomp (SWF -> WASM), Ruffle, and native Flash '
        + '(the runtime is chosen by the game page, not this module). Mode 1: '
        + 'one AP region = one game instance; the region\'s AP locations = the '
        + 'game\'s in-game objectives, reported cooperatively via the '
        + '__swfBridge contract.',
    requires: ['stateManager', 'iframeAdapter'],
};

let _initApi = null;

export function register(registrationApi) {
    if (typeof document !== 'undefined') {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'modules/flashSubstrate/flashSubstrate.css';
        document.head.appendChild(link);
    }

    registrationApi.registerPanelComponent(
        'flashSubstratePanel',
        FlashSubstratePanel,
    );

    // The bridge dispatches user:locationCheck (objective complete) and
    // user:regionMove (exit chosen) up the dispatcher chain. Declared
    // here so the dispatcher knows this module is a sender. Mirrors maze
    // / textAdventure / JtA.
    registrationApi.registerDispatcherSender('user:locationCheck', 'bottom', 'first');
    registrationApi.registerDispatcherSender('user:regionMove', 'bottom', 'first');

    // Events the bridge subscribes to. procgenPlayer publishes
    // flash:loadRegion on flash-region transitions; the bridge
    // picks it up via the iframeAdapter eventBus relay.
    registrationApi.registerEventBusPublisher('flash:loadRegion');
    // Published by this module on flash:loadRegion so Golden Layout
    // brings the flash panel forward when the player enters one of
    // its regions.
    registrationApi.registerEventBusPublisher('ui:activatePanel');

    // Events the host module subscribes to.
    registrationApi.registerEventBusSubscriberIntent('flash:loadRegion');

    // Guarded register so re-registration of the same id is harmless
    // (mirrors the jtaSubstrateWrapper / textAdventureSubstrateWrapper
    // pattern; the library's import side-effect may already have run).
    if (!substrateRegistry.has(substrateRegistryEntry.id)) {
        substrateRegistry.register(substrateRegistryEntry);
    }
}

export function initialize(_moduleId, _priorityIndex, initializationApi) {
    _initApi = initializationApi;
    const eventBus = initializationApi.getEventBus();
    if (!eventBus) return;

    // When procgen dispatches flash:loadRegion (e.g. on a transition
    // from a maze or text-adventure region into a flash one), bring
    // the flash panel forward in its Golden Layout stack. Mirrors the
    // same handler in jtaSubstrateWrapper/index.js. Skipped when loops is
    // focus-locking another panel (the "Keep this panel focused" toggle);
    // the bridge still picks up the loadRegion via its own iframe-protocol
    // subscription, only the tab-switch is suppressed.
    eventBus.subscribe('flash:loadRegion', () => {
        const isFocusLocked = initializationApi.getModuleFunction?.('loops', 'isFocusLocked');
        if (isFocusLocked?.()) return;
        eventBus.publish('ui:activatePanel', { panelId: 'flashSubstratePanel' });
    });
}

// Exposed for symmetry / future host-side helpers. Currently unused
// beyond keeping a handle on the init API.
export function getInitApi() {
    return _initApi;
}
