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

import { TextAdventureSubstrateWrapperPanel } from './textAdventureSubstrateWrapperPanel.js';
import { getDiscoverySettings } from '../discovery/index.js';
import discoveryStateSingleton from '../discovery/singleton.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { substrateRegistryEntry } from './textAdventureSubstrateWrapperLibrary.js';
import { PlaybackProxy, PLAYBACK_CONTROL_EVENT } from './playbackProxy.js';

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
    registrationApi.registerEventBusSubscriberIntent('iframe:appReady');
    registrationApi.registerEventBusSubscriberIntent('textAdventure:loadRegion');

    // Register the substrate entry so procgen recognizes
    // 'text_adventure' and dispatches loadRegion events to our panel.
    // Guarded by has() so we lose gracefully if the existing
    // textAdventureSubstrate is also enabled.
    if (!substrateRegistry.has(substrateRegistryEntry.id)) {
        substrateRegistry.register(substrateRegistryEntry);
    }
}

export function initialize(_moduleId, _priorityIndex, initializationApi) {
    const eventBus = initializationApi.getEventBus();
    if (!eventBus) return;

    // Build the host-side PlaybackProxy. Returned by the substrate
    // registry entry's getPlaybackController; publishes control events
    // that the in-iframe playbackBridge subscribes to.
    _playbackProxy = new PlaybackProxy({ eventBus });

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

    eventBus.subscribe('iframe:appReady', () => {
        const settings = getDiscoverySettings();
        const active = !!settings?.enableDiscoveryMode;
        let discoveredRegions = [];
        let discoveredLocations = [];
        let discoveredExits = [];
        try {
            discoveredRegions = Array.from(discoveryStateSingleton.getDiscoveredRegions());
            discoveredLocations = Array.from(discoveryStateSingleton.getDiscoveredLocations());
            const exitsMap = discoveryStateSingleton.getDiscoveredExits();  // Map<regionName, Set<exitName>>
            for (const [regionName, exitSet] of exitsMap.entries()) {
                for (const exitName of exitSet) {
                    discoveredExits.push({ regionName, exitName });
                }
            }
        } catch {
            // Singleton may not be fully initialized; carry on with empties.
        }
        eventBus.publish(INITIAL_STATE_EVENT, {
            discoveryMode: active ? 'discovered' : 'full',
            discoveredRegions,
            discoveredLocations,
            discoveredExits,
        });
    });
}
