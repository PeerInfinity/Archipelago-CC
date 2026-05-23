/**
 * jtaSubstrateWrapper — host module that:
 *  - Registers a Golden Layout panel that mounts a same-origin local
 *    iframe pointing at the JtA fork's index.html (the
 *    PeerInfinity/journey-to-ascension submodule under
 *    frontend/modules/journey-to-ascension/).
 *  - Registers a substrate registry entry (id: 'jta'), so procgenPlayer
 *    publishes jta:loadRegion when the player enters a region tagged
 *    with this substrate.
 *
 * Phase 4 scope (this commit):
 *  - The wrapper mounts JtA in its own iframe and the in-iframe
 *    bridge.js completes the iframeAdapter handshake.
 *  - It does NOT yet drive the substrate API hooks (setManagedMode is
 *    set by the bridge for now; full loadRegion handling, energy
 *    sync, synthetic exit tasks, etc. land in Phase 5).
 *
 * See NewDocs/plans/jta/jta-substrate-v1-plan.md for the broader
 * design and how this fits with the maze and text-adventure substrates.
 */

import { JtaSubstrateWrapperPanel } from './jtaSubstrateWrapperPanel.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { substrateRegistryEntry } from './jtaSubstrateWrapperLibrary.js';

export const moduleInfo = {
    name: 'jtaSubstrateWrapper',
    title: 'JtA (substrate wrapper)',
    componentType: 'jtaSubstrateWrapperPanel',
    icon: '⚔️',
    column: 3,
    description:
        'Journey to Ascension hosted in an iframe as a loop-mode '
        + 'substrate. v1: one AP region = one JtA zone; the player '
        + 'works the zone\'s tasks and the substrate dispatches region '
        + 'transitions on Travel-task completion or exit-choice tasks.',
    requires: ['stateManager', 'gameState', 'iframeAdapter'],
};

export function register(registrationApi) {
    if (typeof document !== 'undefined') {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'modules/jtaSubstrateWrapper/jtaSubstrateWrapper.css';
        document.head.appendChild(link);
    }

    registrationApi.registerPanelComponent(
        'jtaSubstrateWrapperPanel',
        JtaSubstrateWrapperPanel,
    );

    // procgenPlayer publishes this event on jta-region transitions;
    // the bridge subscribes via the iframeAdapter eventBus relay.
    registrationApi.registerEventBusPublisher('jta:loadRegion');
    registrationApi.registerEventBusSubscriberIntent('iframe:appReady');

    // Guarded register so re-registration of the same id is harmless
    // (mirrors the textAdventureSubstrateWrapper pattern).
    if (!substrateRegistry.has(substrateRegistryEntry.id)) {
        substrateRegistry.register(substrateRegistryEntry);
    }
}

export function initialize(_moduleId, _priorityIndex, _initializationApi) {
    // Phase 4: no initialization-time wiring yet. Phase 5 will hook
    // gameState:loopReset, manage the host-side reset-count cache,
    // relay initial state on iframe:appReady, and provide a
    // PlaybackProxy for the bot.
}
