/**
 * omsiSubstrateWrapper — host module that:
 *  - Registers a Golden Layout panel that mounts a same-origin local
 *    iframe pointing at the omsi-loops fork's index.html in managed
 *    mode (the PeerInfinity/omsi-loops submodule under
 *    frontend/modules/omsi-loops/, `?managed=1`).
 *  - Registers a substrate registry entry (id: 'omsi') with a
 *    sharing.mana declaration, so procgenPlayer publishes
 *    omsi:loadRegion when the player enters an omsi region and the
 *    resourceChannels router accepts the bridge's generic channel
 *    events (substrate:resourceDelta/Bonus/Reset with substrateId
 *    'omsi') — no omsi-specific host resource handlers exist.
 *  - Acts as the host-side broker for the in-iframe bridge: pushes
 *    initial pool / reset-count state on iframe:appReady (the
 *    existing catch-up mechanism; region catch-up rides
 *    procgenPlayer's appReady re-publish keyed by the registry
 *    entry's iframeId).
 *
 * Cross-game plan R2 / omsi substrate plan Phase F v0. The fork needs
 * no changes: managed mode (managed.js + the driver.js clock gate and
 * restart hook) shipped with the automation-arc merge.
 */

import { OmsiSubstrateWrapperPanel } from './omsiSubstrateWrapperPanel.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { substrateRegistryEntry } from './omsiSubstrateWrapperLibrary.js';
import { getGameStateSingleton } from '../gameState/singleton.js';

export const moduleInfo = {
    name: 'omsiSubstrateWrapper',
    title: 'Idle Loops (substrate wrapper)',
    componentType: 'omsiSubstrateWrapperPanel',
    icon: '🔁',
    column: 3,
    description:
        'Idle Loops (omsi-loops) hosted in an iframe as a loop-mode '
        + 'substrate. v0: one AP region = Beginnersville; the game\'s '
        + 'per-loop mana budget mirrors into the shared loop-mode pool '
        + 'through the generic resource channels, and completing Start '
        + 'Journey checks the victory location.',
    requires: ['stateManager', 'gameState', 'iframeAdapter'],
};

const INITIAL_STATE_EVENT = 'omsiSubstrateWrapper:initialState';

export function register(registrationApi) {
    if (typeof document !== 'undefined') {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'modules/omsiSubstrateWrapper/omsiSubstrateWrapper.css';
        document.head.appendChild(link);
    }

    registrationApi.registerPanelComponent(
        'omsiSubstrateWrapperPanel',
        OmsiSubstrateWrapperPanel,
    );

    // Events the bridge subscribes to. procgenPlayer publishes
    // omsi:loadRegion on omsi-region transitions; the bridge picks it
    // up via the iframeAdapter eventBus relay.
    registrationApi.registerEventBusPublisher('omsi:loadRegion');
    registrationApi.registerEventBusPublisher(INITIAL_STATE_EVENT);
    // Published by this module on omsi:loadRegion so Golden Layout
    // brings the panel forward when the player enters an omsi region.
    registrationApi.registerEventBusPublisher('ui:activatePanel');

    registrationApi.registerEventBusSubscriberIntent('iframe:appReady');
    registrationApi.registerEventBusSubscriberIntent('omsi:loadRegion');

    // Guarded register so re-registration of the same id is harmless
    // (the library also registers on import — same pattern as jta).
    if (!substrateRegistry.has(substrateRegistryEntry.id)) {
        substrateRegistry.register(substrateRegistryEntry);
    }
}

export function initialize(_moduleId, _priorityIndex, initializationApi) {
    const eventBus = initializationApi.getEventBus();
    if (!eventBus) return;

    // On every iframe app-ready event (fires for any iframe module,
    // not just ours — payload is small + idempotent), broadcast the
    // current pool / reset-count state so our bridge can seed its
    // caches. The bridge's subscriptions to gameState:manaChanged +
    // gameState:loopReset keep it fresh after that.
    eventBus.subscribe('iframe:appReady', () => {
        const gs = getGameStateSingleton();
        if (!gs) return;
        eventBus.publish(INITIAL_STATE_EVENT, {
            currentMana: gs.getCurrentMana(),
            maxMana: gs.getMaxMana(),
            loopResetCount: gs.getLoopResetCount(),
        });
    });

    // When procgen dispatches omsi:loadRegion, bring the panel forward
    // in its Golden Layout stack — unless loops is focus-locking
    // another panel (the "Keep this panel focused" toggle); the bridge
    // still receives the loadRegion through its own subscription, only
    // the tab-switch is suppressed. Mirrors the jta/tasw handlers.
    eventBus.subscribe('omsi:loadRegion', () => {
        const isFocusLocked = initializationApi.getModuleFunction?.('loops', 'isFocusLocked');
        if (isFocusLocked?.()) return;
        eventBus.publish('ui:activatePanel', { panelId: 'omsiSubstrateWrapperPanel' });
    });

    // The bridge's mana mirroring (drains, gains, budget-bonus
    // reports, game-initiated resets) arrives as generic
    // substrate:resourceDelta / resourceBonus / resourceReset events
    // with substrateId 'omsi' and is handled by the resourceChannels
    // router — including the out-of-mana → loop-reset-teleport path
    // and the reset-count race guard.
}
