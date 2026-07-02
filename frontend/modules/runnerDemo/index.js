/**
 * runnerDemo — host module for the Runner Demo (auto-runner platformer)
 * substrate (plan §4.7; bounceDemo/index.js is the model).
 *
 * Runner rides flashSubstrate's machinery as shared CODE, not shared
 * instances: the panel class comes from flashSubstratePanel.js's
 * factory (pointed at the runner game page), and the injected bridge is
 * flashSubstrate/bridge.js itself (the game page speaks the same
 * `__swfBridge` contract — that was the point of building the game page
 * standalone-first against a stubbed bridge). What runner owns is its
 * identity: its own panel component ('runnerDemoPanel'), its own load
 * event ('runner:loadRegion', passed to the bridge via the iframe URL's
 * loadRegionEvent param), and its own iframeId — so flash region loads
 * configure the flash iframe, runner region loads configure this one,
 * and host activation brings the right panel forward.
 *
 * The substrate registry entry (runnerDemoLibrary.js) is likewise a
 * merge: createFlashSubstrateEntry runtime plumbing + runner's panel
 * identity + the zone-based build-time hooks (zoneCount /
 * extractZoneRules) that drive the procgen pipeline.
 */

import { createSubstrateIframePanelClass } from '../flashSubstrate/flashSubstratePanel.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import settingsManager from '../../app/core/settingsManager.js';
import {
    substrateRegistryEntry,
    setTouchControlsOverride,
    RUNNER_PANEL_COMPONENT_TYPE,
    RUNNER_LOAD_REGION_EVENT,
    RUNNER_PLAYBACK_CONTROL_EVENT,
    RUNNER_IFRAME_ID,
} from './runnerDemoLibrary.js';

// Touch-controls host override for the game page: 'auto' (the page's
// coarse-pointer media query / ?touch= URL param decide) | 'on' | 'off'.
// Applied via the region payload's params.touchControls (the library
// stamps it in deserializeWorld), so a change takes effect on the next
// rules/world load. Exists mainly for desktop testing of the mobile
// layout (plan §4.7).
const TOUCH_SETTING_KEY = 'moduleSettings.runnerDemo.touchControls';

function applyTouchSetting(value) {
    setTouchControlsOverride(
        value === 'on' ? true : value === 'off' ? false : undefined);
}

// The standalone-first game page (phase 2). In an iframe
// (window !== window.parent) it skips its dev harness and just exposes
// the __swfBridge game side; loadRegionEvent tells the injected bridge
// which host event delivers this iframe's region loads, and
// playbackControlEvent is declared now so the phase-8 bot driver only
// has to inject the host-side proxy (the bridge already subscribes).
const GAME_IFRAME_SRC = `./modules/runnerDemo/game/index.html?iframeId=${RUNNER_IFRAME_ID}`
    + `&loadRegionEvent=${RUNNER_LOAD_REGION_EVENT}`
    + `&playbackControlEvent=${RUNNER_PLAYBACK_CONTROL_EVENT}`;

export const RunnerDemoPanel = createSubstrateIframePanelClass({
    componentType: RUNNER_PANEL_COMPONENT_TYPE,
    title: 'Runner Demo',
    iframeSrc: GAME_IFRAME_SRC,
    // Resolved against the iframe page URL (.../modules/runnerDemo/game/
    // index.html) — the shared flash bridge, not a runner copy.
    bridgeSrc: '../../flashSubstrate/bridge.js',
    moduleName: 'runnerDemo',
});

export const moduleInfo = {
    name: 'runnerDemo',
    title: 'Runner Demo',
    componentType: RUNNER_PANEL_COMPONENT_TYPE,
    icon: '🏃',
    column: 3,
    description:
        'Procedurally generated auto-runner platformer as a procgen '
        + 'substrate: every region is a horizontal strip whose access '
        + 'rules are DERIVED from the game\'s own physics (the canRun '
        + 'solver samples the real step function), so AP re-randomizes '
        + 'within provably playable logic. Rides the flashSubstrate '
        + 'panel class + bridge via the __swfBridge contract.',
    requires: ['stateManager', 'iframeAdapter'],
};

let _initApi = null;

export function register(registrationApi) {
    // The panel reuses flashSubstrate's CSS classes (flashsub-root /
    // flashsub-iframe); flashSubstrate.register() loads the stylesheet
    // and loads before this module, but guard anyway so runner doesn't
    // silently depend on load order.
    if (typeof document !== 'undefined'
        && !document.querySelector('link[href="modules/flashSubstrate/flashSubstrate.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'modules/flashSubstrate/flashSubstrate.css';
        document.head.appendChild(link);
    }

    registrationApi.registerPanelComponent(
        RUNNER_PANEL_COMPONENT_TYPE,
        RunnerDemoPanel,
    );

    // The bridge dispatches user:locationCheck (pickup touched) and
    // user:regionMove (exit portal touched) up the dispatcher chain.
    // Declared here so the dispatcher knows this module is a sender.
    registrationApi.registerDispatcherSender('user:locationCheck', 'bottom', 'first');
    registrationApi.registerDispatcherSender('user:regionMove', 'bottom', 'first');

    // procgenPlayer publishes runner:loadRegion on runner-region
    // transitions (the registry entry's loadRegionEvent); the bridge
    // picks it up via the iframeAdapter eventBus relay.
    registrationApi.registerEventBusPublisher(RUNNER_LOAD_REGION_EVENT);
    // Bot → bridge control channel (phase 8): published by the
    // host-side PlaybackProxy once the bot driver lands; subscribed by
    // the in-iframe flash bridge's playback receiver already.
    registrationApi.registerEventBusPublisher(RUNNER_PLAYBACK_CONTROL_EVENT);
    // Published by this module on runner:loadRegion so Golden Layout
    // brings the runner panel forward when the player enters one of
    // its regions.
    registrationApi.registerEventBusPublisher('ui:activatePanel');

    // Events the host module subscribes to.
    registrationApi.registerEventBusSubscriberIntent(RUNNER_LOAD_REGION_EVENT);

    registrationApi.registerSettingsSchema({
        type: 'object',
        properties: {
            touchControls: {
                type: 'string',
                default: 'auto',
                enum: ['auto', 'on', 'off'],
                label: 'Touch controls',
                description: "'auto' shows the touch overlay on coarse-pointer "
                    + "(mobile) devices; 'on'/'off' force it either way (host "
                    + 'override via params.touchControls — applies on the next '
                    + 'world load). Desktop-testing aid.',
            },
        },
    });

    // Guarded register so re-registration of the same id is harmless
    // (the library's import side-effect may already have run).
    if (!substrateRegistry.has(substrateRegistryEntry.id)) {
        substrateRegistry.register(substrateRegistryEntry);
    }
}

export function initialize(_moduleId, _priorityIndex, initializationApi) {
    _initApi = initializationApi;
    const eventBus = initializationApi.getEventBus();
    if (!eventBus) return;

    // Touch-controls override: seed the library from the persisted
    // setting and track live changes (the Settings panel writes through
    // settingsManager). The stamp lands at deserializeWorld time, so a
    // change applies from the next rules/world load.
    settingsManager.getSetting(TOUCH_SETTING_KEY, 'auto')
        .then((value) => applyTouchSetting(value))
        .catch(() => { /* keep the 'auto' default */ });
    eventBus.subscribe('settings:changed', (data) => {
        if (data?.key === TOUCH_SETTING_KEY) {
            applyTouchSetting(data.value);
        } else if (data?.key === '*') {
            // Bulk write (Settings panel "Apply") — re-read the key.
            settingsManager.getSetting(TOUCH_SETTING_KEY, 'auto')
                .then((value) => applyTouchSetting(value))
                .catch(() => {});
        }
    }, 'runnerDemo');

    // Playback bot: the host-side PlaybackProxy (setPlaybackProxy) is
    // injected here when the phase-8 bot driver lands; until then the
    // registry entry's getPlaybackController returns null and the bot /
    // loops executeVia path no-ops on runner regions.

    // When procgen dispatches runner:loadRegion (e.g. on a transition
    // from a maze or bounce region into a runner one), bring the runner
    // panel forward in its Golden Layout stack. Skipped when loops is
    // focus-locking another panel (the "Keep this panel focused"
    // toggle); the bridge still picks up the loadRegion via its own
    // iframe-protocol subscription, only the tab-switch is suppressed.
    eventBus.subscribe(RUNNER_LOAD_REGION_EVENT, () => {
        const isFocusLocked = initializationApi.getModuleFunction?.('loops', 'isFocusLocked');
        if (isFocusLocked?.()) return;
        eventBus.publish('ui:activatePanel', { panelId: RUNNER_PANEL_COMPONENT_TYPE });
    });
}

// Exposed for symmetry with the other substrate host modules.
export function getInitApi() {
    return _initApi;
}
