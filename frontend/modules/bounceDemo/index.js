/**
 * bounceDemo — host module for the Bounce Demo (DJ-Metroidvania)
 * substrate's embed phase
 * (NewDocs/plans/procedural-generation/dj-metroidvania-v2.md §"App
 * integration").
 *
 * Bounce rides flashSubstrate's machinery as shared CODE, not shared
 * instances: the panel class comes from flashSubstratePanel.js's
 * factory (pointed at the bounce game page), and the injected bridge is
 * flashSubstrate/bridge.js itself (the game page speaks the same
 * `__swfBridge` contract — that was the point of building the renderer
 * as a `__swfBridge` page). What bounce owns is its identity: its own
 * panel component ('bounceDemoPanel'), its own load event
 * ('bounce:loadRegion', passed to the bridge via the iframe URL's
 * loadRegionEvent param), and its own iframeId — so flash region loads
 * configure the flash iframe, bounce region loads configure this one,
 * and host activation brings the right panel forward.
 *
 * The substrate registry entry (bounceDemoLibrary.js) is likewise a
 * merge: createFlashSubstrateEntry runtime plumbing + bounce's panel
 * identity + the zone-based build-time hooks (zoneCount /
 * extractZoneRules) that drive the procgen pipeline.
 */

import { createSubstrateIframePanelClass } from '../flashSubstrate/flashSubstratePanel.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { PlaybackProxy } from '../textAdventureSubstrateWrapper/playbackProxy.js';
import settingsManager from '../../app/core/settingsManager.js';
import {
    substrateRegistryEntry,
    setPlaybackProxy,
    setBounceRenderer,
    BOUNCE_PANEL_COMPONENT_TYPE,
    BOUNCE_LOAD_REGION_EVENT,
    BOUNCE_PLAYBACK_CONTROL_EVENT,
    BOUNCE_IFRAME_ID,
    BOUNCE_DJ_PANEL_COMPONENT_TYPE,
    BOUNCE_DJ_LOAD_REGION_EVENT,
    BOUNCE_DJ_IFRAME_ID,
} from './bounceDemoLibrary.js';

// Which renderer bounce region loads route to: 'js' (canvas renderer,
// default) or 'dj' (the real recompiled Doodle Jump page below).
// Settable from the Settings panel; read at initialize() and live via
// settings:changed — takes effect on the next bounce region entry.
const RENDERER_SETTING_KEY = 'moduleSettings.bounceDemo.renderer';

// Unique iframeId so this wrapper doesn't collide with the flash / JtA /
// textAdventure wrapper iframes in iframeAdapterCore.iframes (colliding
// ids overwrite each other's window pointer — events then reach only the
// most recently mounted wrapper). Shared with the registry entry so
// procgenPlayer can re-publish loadRegion on this iframe's appReady.
const IFRAME_ID = BOUNCE_IFRAME_ID;
// The standalone-first game page (build-order step 6). In an iframe
// (window !== window.parent) it skips its dev harness and just exposes
// the __swfBridge game side; loadRegionEvent tells the injected bridge
// which host event delivers this iframe's region loads.
const GAME_IFRAME_SRC = `./modules/bounceDemo/game/index.html?iframeId=${IFRAME_ID}`
    + `&loadRegionEvent=${BOUNCE_LOAD_REGION_EVENT}`
    + `&playbackControlEvent=${BOUNCE_PLAYBACK_CONTROL_EVENT}`;

export const BounceDemoPanel = createSubstrateIframePanelClass({
    componentType: BOUNCE_PANEL_COMPONENT_TYPE,
    title: 'Bounce Demo',
    iframeSrc: GAME_IFRAME_SRC,
    // Resolved against the iframe page URL (.../modules/bounceDemo/game/
    // index.html) — the shared flash bridge, not a bounce copy.
    bridgeSrc: '../../flashSubstrate/bridge.js',
    moduleName: 'bounceDemo',
});

// The real-DJ renderer: the loader-injected recompiled Doodle Jump SWF
// (SWFRecomp-CC's dj_loader, wide 600px build) behind the same
// __swfBridge contract. Its page bootstraps the Flash player lazily on
// first configure, so mounting this panel costs nothing while the JS
// renderer is selected. No playbackControlEvent: the playback bot is
// deferred for this renderer (input synthesis needs the botDriver,
// which lives in the JS page).
const DJ_IFRAME_SRC = `./modules/bounceDemo/djReal/index.html?iframeId=${BOUNCE_DJ_IFRAME_ID}`
    + `&loadRegionEvent=${BOUNCE_DJ_LOAD_REGION_EVENT}`;

export const BounceDjRealPanel = createSubstrateIframePanelClass({
    componentType: BOUNCE_DJ_PANEL_COMPONENT_TYPE,
    title: 'Doodle Jump',
    iframeSrc: DJ_IFRAME_SRC,
    bridgeSrc: '../../flashSubstrate/bridge.js',
    moduleName: 'bounceDemo',
});

export const moduleInfo = {
    name: 'bounceDemo',
    title: 'Bounce Demo',
    componentType: BOUNCE_PANEL_COMPONENT_TYPE,
    icon: '🏀',
    column: 3,
    description:
        'Procedurally generated bounce-platformer (DJ-Metroidvania) as a '
        + 'procgen substrate: every region is a vertical level whose access '
        + 'rules are DERIVED from the game\'s own physics (the canJump solver '
        + 'samples the real step function), so AP re-randomizes within '
        + 'provably playable logic. Rides the flashSubstrate panel class + '
        + 'bridge via the __swfBridge contract.',
    requires: ['stateManager', 'iframeAdapter'],
};

let _initApi = null;

export function register(registrationApi) {
    // The panel reuses flashSubstrate's CSS classes (flashsub-root /
    // flashsub-iframe); flashSubstrate.register() loads the stylesheet
    // and loads before this module, but guard anyway so bounce doesn't
    // silently depend on load order.
    if (typeof document !== 'undefined'
        && !document.querySelector('link[href="modules/flashSubstrate/flashSubstrate.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'modules/flashSubstrate/flashSubstrate.css';
        document.head.appendChild(link);
    }

    registrationApi.registerPanelComponent(
        BOUNCE_PANEL_COMPONENT_TYPE,
        BounceDemoPanel,
    );
    registrationApi.registerPanelComponent(
        BOUNCE_DJ_PANEL_COMPONENT_TYPE,
        BounceDjRealPanel,
    );

    // The bridge dispatches user:locationCheck (pickup landed) and
    // user:regionMove (exit portal landed) up the dispatcher chain.
    // Declared here so the dispatcher knows this module is a sender.
    registrationApi.registerDispatcherSender('user:locationCheck', 'bottom', 'first');
    registrationApi.registerDispatcherSender('user:regionMove', 'bottom', 'first');

    // procgenPlayer publishes bounce:loadRegion on bounce-region
    // transitions (the registry entry's loadRegionEvent); the bridge
    // picks it up via the iframeAdapter eventBus relay.
    registrationApi.registerEventBusPublisher(BOUNCE_LOAD_REGION_EVENT);
    // The dj renderer's load event: procgenPlayer registers the entry's
    // loadRegionEvent at its own init, but that getter reflects the
    // renderer selected at that moment — register the alternate event
    // up front so flipping the setting mid-session publishes cleanly.
    registrationApi.registerEventBusPublisher(BOUNCE_DJ_LOAD_REGION_EVENT);
    // Bot → bridge control channel: published by the host-side
    // PlaybackProxy (built in initialize), subscribed by the in-iframe
    // flash bridge's playback receiver.
    registrationApi.registerEventBusPublisher(BOUNCE_PLAYBACK_CONTROL_EVENT);
    // Published by this module on bounce:loadRegion so Golden Layout
    // brings the bounce panel forward when the player enters one of
    // its regions.
    registrationApi.registerEventBusPublisher('ui:activatePanel');

    // Events the host module subscribes to.
    registrationApi.registerEventBusSubscriberIntent(BOUNCE_LOAD_REGION_EVENT);
    registrationApi.registerEventBusSubscriberIntent(BOUNCE_DJ_LOAD_REGION_EVENT);

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

    // Renderer selection: seed the library from the persisted setting
    // and track live changes (the Settings panel writes through
    // settingsManager). The registry entry's identity getters read the
    // library value on every region move, so a change applies on the
    // next bounce region entry — no re-registration.
    settingsManager.getSetting(RENDERER_SETTING_KEY, 'js')
        .then((value) => setBounceRenderer(value))
        .catch(() => { /* keep the 'js' default */ });
    eventBus.subscribe('settings:changed', (data) => {
        if (data?.key === RENDERER_SETTING_KEY) {
            setBounceRenderer(data.value);
        } else if (data?.key === '*') {
            // Bulk write (Settings panel "Apply") — re-read the key.
            settingsManager.getSetting(RENDERER_SETTING_KEY, 'js')
                .then((value) => setBounceRenderer(value))
                .catch(() => {});
        }
    }, 'bounceDemo');

    // Host-side playback controller for the bot: the landed
    // textAdventureSubstrateWrapper proxy, pointed at bounce's own
    // control event. Injected into the library so the registry
    // entry's getPlaybackController returns it (null until now, and
    // forever in headless CLI contexts).
    setPlaybackProxy(new PlaybackProxy({
        eventBus,
        controlEvent: BOUNCE_PLAYBACK_CONTROL_EVENT,
    }));

    // When procgen dispatches bounce:loadRegion (e.g. on a transition
    // from a maze or flash region into a bounce one), bring the bounce
    // panel forward in its Golden Layout stack. Skipped when loops is
    // focus-locking another panel (the "Keep this panel focused"
    // toggle); the bridge still picks up the loadRegion via its own
    // iframe-protocol subscription, only the tab-switch is suppressed.
    eventBus.subscribe(BOUNCE_LOAD_REGION_EVENT, () => {
        const isFocusLocked = initializationApi.getModuleFunction?.('loops', 'isFocusLocked');
        if (isFocusLocked?.()) return;
        eventBus.publish('ui:activatePanel', { panelId: BOUNCE_PANEL_COMPONENT_TYPE });
    });
    // Same for the real-DJ renderer's panel (its own load event, so only
    // the selected renderer's iframe gets configured + surfaced).
    eventBus.subscribe(BOUNCE_DJ_LOAD_REGION_EVENT, () => {
        const isFocusLocked = initializationApi.getModuleFunction?.('loops', 'isFocusLocked');
        if (isFocusLocked?.()) return;
        eventBus.publish('ui:activatePanel', { panelId: BOUNCE_DJ_PANEL_COMPONENT_TYPE });
    });
}

// Exposed for symmetry with the other substrate host modules.
export function getInitApi() {
    return _initApi;
}
