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
 *  - Owns the loop-mode seams (arc D1): the shared PlaybackProxy on
 *    `omsi:playbackControl`, and the pull-once stash for the bridge's
 *    per-visit recordings (`omsi:visitRecording`).
 *
 * Cross-game plan R2 / omsi substrate plan Phase F v0. The fork needs
 * no changes: managed mode (managed.js + the driver.js clock gate and
 * restart hook) shipped with the automation-arc merge.
 */

import { OmsiSubstrateWrapperPanel } from './omsiSubstrateWrapperPanel.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import {
    substrateRegistryEntry,
    setPlaybackProxy,
    ingestVisitRecording,
    convertQueueToPlan,
} from './omsiSubstrateWrapperLibrary.js';
import { getGameStateSingleton } from '../gameState/singleton.js';
import { PlaybackProxy } from '../textAdventureSubstrateWrapper/playbackProxy.js';

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
// PlaybackController commands, host proxy → in-iframe bridge (arc D1).
const PLAYBACK_CONTROL_EVENT = 'omsi:playbackControl';
// Per-visit recording, in-iframe bridge → host stash (published by the
// bridge's synthetic-exit callback since arc D slice 4).
const VISIT_RECORDING_EVENT = 'omsi:visitRecording';

// How often the step gate (arc D1 slice 2) is re-derived. A POLL rather
// than a set of event subscriptions, deliberately: the answer depends on
// loops' park state, which changes on a park, a successful exit, a wrong
// exit, a hard pause, a user pause, a loop reset, a block-mode change, a
// queue edit and a loop-mode toggle. Subscribing to eight edges means a
// missed ninth silently freezes the game (or silently lets it grind and
// drain the shared pool) — the failure mode the gate exists to prevent.
// Re-deriving two cheap reads five times a second cannot miss an edge, and
// only a CHANGE is pushed, so the iframe sees one message per transition.
const STEP_GATE_POLL_MS = 200;

/**
 * Fine-grained Playback (arc D slice 4): hand the bound recording back to
 * the game as its own authored plan and let the fork RUN it.
 *
 * Unlike jta there is no host-side executor to step: omsi's recording IS a
 * plan, and the fork's own queue is the thing that executes plans. So the
 * host's whole job is to convert the stored shared-vocabulary entries back
 * to native plan entries and send them over the control channel; the bridge
 * installs them, appends the recorded departure exit last, forces the loop
 * to recompile, and holds the replay window open until that exit fires.
 *
 * The replay is OPEN-ENDED by design (ruling 1): it grinds the recorded
 * queue until the departure's gate opens. If that gate never opens the block
 * parks indefinitely — Manual-equivalent, and explicitly NOT to be papered
 * over with a timeout teleport, which would be a replay that "worked" while
 * replaying nothing.
 *
 * ⚠ It does not grind ACROSS runs on its own: a fork loop boundary is
 * reported to the host, which fires a loop reset and teleports the player to
 * the loop start, ending the bridge's replay window. A replay that outlives
 * one run resumes through loops' generic queue-restart retry re-entering the
 * block and calling this again (see the bridge's `_startReplay`).
 *
 * `onComplete` is therefore not invoked here: there is no host-visible
 * completion moment short of the departing `user:regionMove`, which the
 * parked block already wakes on. (loopState passes a no-op reserved for
 * future UI; a UI that needs it would need the bridge to report the window
 * close.) `instant` is ignored — omsi declares no `instant` capability, so
 * the per-block checkbox never renders.
 */
function _driveReplay(eventBus, recordedActions, opts = {}) {
    const departureExitId = opts?.departureExitId ?? null;
    eventBus.publish(PLAYBACK_CONTROL_EVENT, {
        method: 'replayActions',
        args: [convertQueueToPlan(recordedActions), { departureExitId }],
    });
}

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
    // PlaybackController commands published by the host-side proxy,
    // executed by the in-iframe bridge (relayed via iframeAdapter).
    registrationApi.registerEventBusPublisher(PLAYBACK_CONTROL_EVENT);
    // Published by this module on omsi:loadRegion so Golden Layout
    // brings the panel forward when the player enters an omsi region.
    registrationApi.registerEventBusPublisher('ui:activatePanel');
    // Per-visit recording: published by the in-iframe bridge and relayed
    // host-side by the iframeAdapter — registered as a publisher so the
    // relay isn't warned about an unregistered event (the jta precedent).
    registrationApi.registerEventBusPublisher(VISIT_RECORDING_EVENT);

    registrationApi.registerEventBusSubscriberIntent('iframe:appReady');
    registrationApi.registerEventBusSubscriberIntent('omsi:loadRegion');
    registrationApi.registerEventBusSubscriberIntent(VISIT_RECORDING_EVENT);

    // Guarded register so re-registration of the same id is harmless
    // (the library also registers on import — same pattern as jta).
    if (!substrateRegistry.has(substrateRegistryEntry.id)) {
        substrateRegistry.register(substrateRegistryEntry);
    }
}

export function initialize(_moduleId, _priorityIndex, initializationApi) {
    const eventBus = initializationApi.getEventBus();
    if (!eventBus) return;

    // Host-side PlaybackController proxy (the shared class the tasw/jta
    // wrappers use, on omsi's own control channel — arc D1). Injected into
    // the library so the registry entry's getPlaybackController returns it.
    const playbackProxy = new PlaybackProxy({
        eventBus,
        controlEvent: PLAYBACK_CONTROL_EVENT,
    });
    // Slice 4: attach fine-grained Playback replay to THIS proxy instance,
    // not the shared PlaybackProxy class (the text adventure stays coarse-
    // only) — the jta precedent. Its presence is what routes loopState's
    // fine-grained replay path to omsi.
    playbackProxy.replayActions = (recordedActions, opts) =>
        _driveReplay(eventBus, recordedActions, opts);
    setPlaybackProxy(playbackProxy);

    // ── Step gate (arc D1 slice 2, ruling 3) ────────────────────────────
    //
    // The bridge advances the game only while the loops queue is parked on
    // the region it has loaded (or a replay is in flight — that half is the
    // bridge's own). Only the host can see the queue, so it derives the
    // live-play half and pushes it over the control channel.
    //
    // `enforced` mirrors loops' staged gate adoption: with loop mode off,
    // nothing is parked and freezing the game would brick a hypothetical
    // omsi world that carries no loop_costs. Since omsi declares
    // record + playback, "loop mode active" IS "this substrate is gated".
    //
    // The pushed region is loops' `livePlayRegion()` verbatim, NOT a
    // boolean: the queue may be parked on some other substrate's region,
    // and only the bridge knows which region it currently has loaded.
    let lastGateKey = null;
    const pushStepGate = (force = false) => {
        const gs = getGameStateSingleton();
        const enforced = gs?.isLoopModeActive === true;
        let livePlayRegion = null;
        if (enforced) {
            const fn = initializationApi.getModuleFunction?.('loops', 'livePlayRegion');
            livePlayRegion = fn?.() ?? null;
        }
        const key = `${enforced}|${livePlayRegion ?? ''}`;
        if (!force && key === lastGateKey) return;
        lastGateKey = key;
        eventBus.publish(PLAYBACK_CONTROL_EVENT, {
            method: 'setStepGate',
            args: [{ enforced, livePlayRegion }],
        });
    };
    if (typeof setInterval === 'function') {
        setInterval(() => pushStepGate(), STEP_GATE_POLL_MS);
    }

    // Stash each per-visit recording the bridge publishes, for the loops
    // sole-persister pull (takeLastRecording). Delivered BEFORE the visit's
    // departing user:regionMove over the same postMessage channel, so the
    // recording is in the slot when the loops Record-exit wake pulls it.
    eventBus.subscribe(VISIT_RECORDING_EVENT, (payload) => {
        ingestVisitRecording(payload);
    });

    // On every iframe app-ready event (fires for any iframe module,
    // not just ours — payload is small + idempotent), broadcast the
    // current pool / reset-count state so our bridge can seed its
    // caches. The bridge's subscriptions to gameState:manaChanged +
    // gameState:loopReset keep it fresh after that.
    eventBus.subscribe('iframe:appReady', () => {
        // Force-push the step gate: a freshly booted (or reloaded) bridge
        // starts at the OPEN default and would otherwise keep it until the
        // next host-side CHANGE, which may never come while it idles.
        pushStepGate(true);
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
        // Re-push on entry so the incoming region starts from the truth
        // rather than from up to one poll interval of the outgoing one.
        // (The payload deliberately carries no bridge-side region: the
        // bridge compares the pushed livePlayRegion against whichever
        // region it has loaded, so a region SWAP needs no push at all.)
        pushStepGate(true);
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
