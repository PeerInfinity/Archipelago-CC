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
    requires: ['stateManager', 'gameState', 'iframeAdapter'],
};

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
}

export function initialize(_moduleId, _priorityIndex, _initializationApi) {
    // Nothing host-side to do for phase 1 — the bridge inside the
    // iframe handles all AP-host subscriptions via IframeClient.
}
