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
 *    initial pool / reset-count state to the bridge on iframe:appReady;
 *    mirrors the game's energy into gameState's shared mana pool both
 *    ways (`jta:bridgeDeductMana` / `jta:bridgeGainMana`, with the
 *    out-of-mana → triggerLoopReset path on depletion); and answers
 *    `jta:bridgeEnergyReset` (a game-initiated energy reset or
 *    prestige) with the matching loop reset.
 *
 * See docs/json/developer/procgen/jta.md.
 */

import { JtaSubstrateWrapperPanel } from './jtaSubstrateWrapperPanel.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { substrateRegistryEntry, setPlaybackProxy } from './jtaSubstrateWrapperLibrary.js';
import { getGameStateSingleton } from '../gameState/singleton.js';
import { PlaybackProxy } from '../textAdventureSubstrateWrapper/playbackProxy.js';
import settingsManager from '../../app/core/settingsManager.js';

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
const BRIDGE_GAIN_MANA_EVENT = 'jta:bridgeGainMana';
const BRIDGE_ENERGY_RESET_EVENT = 'jta:bridgeEnergyReset';
const PLAYBACK_CONTROL_EVENT = 'jta:playbackControl';

// How playback (walkTo / loops executeVia) completes a zone:
//   'activate' — the bridge switches the game's automation engine on for
//                the walk (auto-filling the zone's priorities only if the
//                player configured none) and restores it after. Works out
//                of the box.
//   'respect'  — the walk only designates the exit; zone completion is
//                entirely up to the player's own automation settings in
//                the JtA page (all-off defaults ⇒ the walk waits forever).
const PLAYBACK_AUTOMATION_SETTING = 'moduleSettings.jtaSubstrateWrapper.playbackAutomation';
const PLAYBACK_AUTOMATION_DEFAULT = 'activate';
let _playbackAutomation = PLAYBACK_AUTOMATION_DEFAULT;

async function _loadPlaybackAutomationSetting() {
    if (!settingsManager?.getSetting) return;
    try {
        const v = await settingsManager.getSetting(
            PLAYBACK_AUTOMATION_SETTING,
            PLAYBACK_AUTOMATION_DEFAULT,
        );
        _playbackAutomation = v === 'respect' ? 'respect' : 'activate';
    } catch {
        // Settings unavailable — keep current value.
    }
}

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
    // PlaybackController commands published by the host-side proxy,
    // executed by the in-iframe bridge (relayed via iframeAdapter).
    registrationApi.registerEventBusPublisher(PLAYBACK_CONTROL_EVENT);
    // Published by this module on jta:loadRegion so Golden Layout
    // brings the jta panel forward when the player enters a jta region.
    registrationApi.registerEventBusPublisher('ui:activatePanel');

    // Events the host module subscribes to.
    registrationApi.registerEventBusSubscriberIntent('iframe:appReady');
    registrationApi.registerEventBusSubscriberIntent(BRIDGE_DEDUCT_MANA_EVENT);
    registrationApi.registerEventBusSubscriberIntent(BRIDGE_GAIN_MANA_EVENT);
    registrationApi.registerEventBusSubscriberIntent(BRIDGE_ENERGY_RESET_EVENT);
    registrationApi.registerEventBusSubscriberIntent('jta:loadRegion');
    registrationApi.registerEventBusSubscriberIntent('settings:changed');

    // Guarded register so re-registration of the same id is harmless
    // (mirrors the textAdventureSubstrateWrapper pattern).
    if (!substrateRegistry.has(substrateRegistryEntry.id)) {
        substrateRegistry.register(substrateRegistryEntry);
    }

    if (typeof registrationApi.registerSettingsSchema === 'function') {
        registrationApi.registerSettingsSchema({
            type: 'object',
            properties: {
                playbackAutomation: {
                    type: 'string',
                    default: PLAYBACK_AUTOMATION_DEFAULT,
                    enum: ['activate', 'respect'],
                    label: 'Playback zone completion',
                    description:
                        'How the playback bot completes a JtA zone for a queued '
                        + 'region move: "activate" turns the game\'s automation '
                        + 'engine on for the walk (default); "respect" leaves zone '
                        + 'completion entirely to your own in-game automation '
                        + 'settings.',
                },
            },
        });
    }
}

export function initialize(_moduleId, _priorityIndex, initializationApi) {
    _initApi = initializationApi;
    const eventBus = initializationApi.getEventBus();
    if (!eventBus) return;

    // Host-side PlaybackController proxy (same class the tasw wrapper
    // uses, on jta's own control channel). Injected into the library
    // so the registry entry's getPlaybackController can return it.
    setPlaybackProxy(new PlaybackProxy({
        eventBus,
        controlEvent: PLAYBACK_CONTROL_EVENT,
    }));

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
            playbackAutomation: _playbackAutomation,
        });
    });

    // Load the playback policy now and re-push it to the bridge when
    // settings change (small idempotent payload; the bridge ignores
    // fields it already has).
    _loadPlaybackAutomationSetting();
    eventBus.subscribe('settings:changed', async () => {
        await _loadPlaybackAutomationSetting();
        const gs = getGameStateSingleton();
        if (!gs) return;
        eventBus.publish(INITIAL_STATE_EVENT, {
            currentMana: gs.getCurrentMana(),
            maxMana: gs.getMaxMana(),
            loopResetCount: gs.getLoopResetCount(),
            playbackAutomation: _playbackAutomation,
        });
    });

    // When procgen dispatches jta:loadRegion (e.g. on a transition
    // from a maze or text-adventure region into a jta one), bring the
    // jta panel forward in its Golden Layout stack. Mirrors the same
    // handler in textAdventureSubstrateWrapper/index.js. Skipped when
    // loops is focus-locking another panel (the "Keep this panel
    // focused" toggle); the bridge still picks up the loadRegion via
    // its own iframe-protocol subscription, only the tab-switch is
    // suppressed.
    eventBus.subscribe('jta:loadRegion', () => {
        const isFocusLocked = initializationApi.getModuleFunction?.('loops', 'isFocusLocked');
        if (isFocusLocked?.()) return;
        eventBus.publish('ui:activatePanel', { panelId: 'jtaSubstrateWrapperPanel' });
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

    // Bridge → host: mirror JtA's energy GAINS (energy items etc.)
    // into the shared pool, clamped to maxMana by gameState.
    eventBus.subscribe(BRIDGE_GAIN_MANA_EVENT, (data) => {
        const gs = getGameStateSingleton();
        if (!gs) return;
        const amount = Number(data?.amount) || 0;
        if (amount <= 0) return;
        gs.gainMana(amount);
    });

    // Bridge → host: the game ended its own run (energy-reset overlay
    // click, auto_continue_energy_reset, threshold End Run, prestige /
    // Auto-Prestige). Answer with a loop reset — UNLESS one already
    // fired since the bridge last synced its reset count (the
    // pool-exhaustion race: energy and pool hit 0 together, and the
    // deduct handler above already reset the loop before the game's
    // own game-over flow ran).
    eventBus.subscribe(BRIDGE_ENERGY_RESET_EVENT, (data) => {
        const gs = getGameStateSingleton();
        if (!gs) return;
        const bridgeCount = Number(data?.hostResetCount);
        if (Number.isFinite(bridgeCount) && gs.getLoopResetCount() > bridgeCount) {
            return; // a loop reset already covered this game reset
        }
        _fireLoopReset(gs);
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
