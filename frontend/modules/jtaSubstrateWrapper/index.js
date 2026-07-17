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
 *    initial pool / reset-count state to the bridge on iframe:appReady
 *    and re-pushes host settings on change. The energy↔mana mirroring
 *    itself (drains/gains, out-of-mana → loop reset, game-initiated
 *    reset answering) rides the generic resource-channel events
 *    (substrate:resourceDelta/Bonus/Reset with substrateId 'jta'),
 *    published by the bridge and handled by the resourceChannels
 *    router — no jta-specific host handlers remain.
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

// Whether JtA reports its own starting-energy bonuses (Energetic Memory,
// EnergySpell perk, Divine Supremacy, Energized) up into the shared loop
// starting-mana pool via setSubstrateMaxManaBonus. Default ON (user ruling
// 2026-07-08, superseding the 2026-07-05 pinned default): JtA owns its
// max_energy and its native starting-energy growth raises the shared
// maxMana, so substrate play is natively standalone-paced — the pacing
// target the zone-randomization balancer already anchors on. Turn OFF to
// pin JtA's max_energy to the host pool (the older neutralized-growth mode,
// kept for calibration/comparison).
const ENERGY_BONUS_SYNC_SETTING = 'moduleSettings.jtaSubstrateWrapper.energyBonusSync';
const ENERGY_BONUS_SYNC_DEFAULT = true;
let _energyBonusSync = ENERGY_BONUS_SYNC_DEFAULT;

async function _loadEnergyBonusSyncSetting() {
    if (!settingsManager?.getSetting) return;
    try {
        const v = await settingsManager.getSetting(
            ENERGY_BONUS_SYNC_SETTING,
            ENERGY_BONUS_SYNC_DEFAULT,
        );
        _energyBonusSync = v === true || v === 'true';
    } catch {
        // Settings unavailable — keep current value.
    }
}

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

    // Events the host module subscribes to. The bridge's channel
    // events (substrate:resourceDelta/Bonus/Reset) are handled by the
    // resourceChannels router, not here.
    registrationApi.registerEventBusSubscriberIntent('iframe:appReady');
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
                energyBonusSync: {
                    type: 'boolean',
                    default: ENERGY_BONUS_SYNC_DEFAULT,
                    label: 'Sync JtA starting-energy bonuses to the pool',
                    description:
                        'When on (default), JtA\'s own starting-energy bonuses '
                        + '(Energetic Memory, EnergySpell perk, Divine Supremacy, '
                        + 'Energized) raise the shared loop starting-mana pool, and '
                        + 'JtA owns its max energy — substrate play is standalone-'
                        + 'paced. When off, JtA\'s max energy is pinned to the '
                        + 'shared pool and its starting-energy growth is '
                        + 'neutralized. Changing this affects energy balance.',
                },
            },
        });
    }
}

export function initialize(_moduleId, _priorityIndex, initializationApi) {
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
            energyBonusSync: _energyBonusSync,
        });
    });

    // Load the host settings now and re-push them to the bridge when
    // settings change (small idempotent payload; the bridge ignores
    // fields it already has).
    _loadPlaybackAutomationSetting();
    _loadEnergyBonusSyncSetting();
    eventBus.subscribe('settings:changed', async () => {
        await _loadPlaybackAutomationSetting();
        await _loadEnergyBonusSyncSetting();
        const gs = getGameStateSingleton();
        if (!gs) return;
        // With bonus-sync off, JtA must not contribute to the shared pool;
        // clear any bonus it reported while the flag was on.
        if (!_energyBonusSync) gs.setSubstrateMaxManaBonus('jta', 0);
        eventBus.publish(INITIAL_STATE_EVENT, {
            currentMana: gs.getCurrentMana(),
            maxMana: gs.getMaxMana(),
            loopResetCount: gs.getLoopResetCount(),
            playbackAutomation: _playbackAutomation,
            energyBonusSync: _energyBonusSync,
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

    // The bridge's energy↔mana mirroring (drains, gains, bonus
    // reports, game-initiated resets) arrives as generic
    // substrate:resourceDelta / resourceBonus / resourceReset events
    // with substrateId 'jta' and is handled by the resourceChannels
    // router — including the out-of-mana → loop-reset-teleport path
    // and the reset-count race guard this module used to implement.
}
