/**
 * jtaSubstrateWrapper — host module that:
 *  - Registers a Golden Layout panel that mounts a same-origin local
 *    iframe pointing at the JtA fork's index.html (the
 *    PeerInfinity/journey-to-ascension submodule under
 *    frontend/modules/journey-to-ascension/).
 *  - Registers a substrate registry entry (id: 'jta'), so procgenPlayer
 *    publishes jta:loadRegion when the player enters a region tagged
 *    with this substrate.
 *  - Acts as the host-side broker for the in-iframe bridge: pushes
 *    initial pool / reset-count state to the bridge on iframe:appReady,
 *    and handles `jta:bridgeDeductMana` events from the bridge by
 *    deducting from gameState's shared mana pool (triggering a loop
 *    reset when the pool hits ≤ 0).
 *
 * See NewDocs/plans/jta/jta-substrate-v1-plan.md for the broader
 * design and how this fits with the maze and text-adventure substrates.
 */

import { JtaSubstrateWrapperPanel } from './jtaSubstrateWrapperPanel.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { substrateRegistryEntry } from './jtaSubstrateWrapperLibrary.js';
import { getGameStateSingleton } from '../gameState/singleton.js';

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

const INITIAL_STATE_EVENT = 'jtaSubstrateWrapper:initialState';
const BRIDGE_DEDUCT_MANA_EVENT = 'jta:bridgeDeductMana';

let _initApi = null;

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

    // Sent up the dispatcher when the bridge runs out of pool mana
    // and we trigger a loop reset (mirrors maze / textAdventure).
    registrationApi.registerDispatcherSender('user:regionMove', 'bottom', 'first');

    // Events the bridge subscribes to. procgenPlayer publishes
    // jta:loadRegion on jta-region transitions; the bridge picks it
    // up via the iframeAdapter eventBus relay.
    registrationApi.registerEventBusPublisher('jta:loadRegion');
    registrationApi.registerEventBusPublisher(INITIAL_STATE_EVENT);

    // Events the host module subscribes to.
    registrationApi.registerEventBusSubscriberIntent('iframe:appReady');
    registrationApi.registerEventBusSubscriberIntent(BRIDGE_DEDUCT_MANA_EVENT);

    // Guarded register so re-registration of the same id is harmless
    // (mirrors the textAdventureSubstrateWrapper pattern).
    if (!substrateRegistry.has(substrateRegistryEntry.id)) {
        substrateRegistry.register(substrateRegistryEntry);
    }
}

export function initialize(_moduleId, _priorityIndex, initializationApi) {
    _initApi = initializationApi;
    const eventBus = initializationApi.getEventBus();
    if (!eventBus) return;

    // On every iframe app-ready event (this fires for any iframe
    // module, not just ours — payload is small + idempotent so the
    // cost is negligible), broadcast the current pool / reset-count
    // state so our bridge can seed its caches. The bridge's subscribe
    // to gameState:manaChanged + gameState:loopReset keeps it fresh
    // after that.
    eventBus.subscribe('iframe:appReady', () => {
        const gs = getGameStateSingleton();
        if (!gs) return;
        eventBus.publish(INITIAL_STATE_EVENT, {
            currentMana: gs.getCurrentMana(),
            maxMana: gs.getMaxMana(),
            loopResetCount: gs.getLoopResetCount(),
        });
    });

    // Bridge → host: mirror JtA's energy drain into the shared pool.
    // If the pool depletes, trigger a loop reset + teleport to the
    // resolved start region (the same pattern maze and textAdventure
    // use directly, since they're host-side modules).
    eventBus.subscribe(BRIDGE_DEDUCT_MANA_EVENT, (data) => {
        const gs = getGameStateSingleton();
        if (!gs) return;
        const amount = Number(data?.amount) || 0;
        if (amount <= 0) return;
        gs.deductMana(amount);
        if (gs.getCurrentMana() <= 0) {
            _fireLoopReset(gs);
        }
    });
}

function _fireLoopReset(gs) {
    gs.triggerLoopReset();
    const startRegion = _resolveStartRegion(gs);
    if (!startRegion) {
        console.warn('[jtaSubstrateWrapper] no resolvable start region; loop reset teleport skipped');
        return;
    }
    const dispatcher = _initApi?.getDispatcher?.();
    if (!dispatcher) return;
    dispatcher.publish('user:regionMove', {
        sourceRegion: gs.getCurrentRegion(),
        targetRegion: startRegion,
        fromReset: true,
        updatePath: false,
    }, { initialTarget: 'bottom' });
}

function _resolveStartRegion(gs) {
    const fn = _initApi?.getModuleFunction?.('procgenPlayer', 'getResolvedStartRegion');
    return fn?.() ?? gs.startRegions?.[0] ?? null;
}
