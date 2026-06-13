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
    isDjRenderer,
    BOUNCE_PANEL_COMPONENT_TYPE,
    BOUNCE_LOAD_REGION_EVENT,
    BOUNCE_PLAYBACK_CONTROL_EVENT,
    BOUNCE_IFRAME_ID,
    BOUNCE_RENDERER_CHANGED_EVENT,
} from './bounceDemoLibrary.js';

// Which renderer bounce region loads route to: 'js' (canvas renderer,
// default), or the real-DJ page below with an explicit player tier —
// 'ruffle', 'swfrecomp' (browser-WASM), 'flash' (native NPAPI Flash,
// needs a Flash-capable browser like Basilisk + Clean Flash and a
// pre-built djReal/dj_loader.swf — see scripts/procgen/
// build-dj-loader-swf.mjs) — or legacy 'dj' (auto tier). Settable from
// the Settings panel; read at initialize() and live via
// settings:changed. js<->dj switches apply on the next bounce region
// entry; tier changes within the dj page apply on its next boot (page
// reload), since the player loads once per iframe lifetime.
const RENDERER_SETTING_KEY = 'moduleSettings.bounceDemo.renderer';
// Same-origin relay of the tier choice to the dj page (it reads this
// at player-boot time, which is always after initialize() wrote it;
// the page's ?player= query param still overrides for direct opens).
const DJ_PLAYER_STORAGE_KEY = 'bounceDjReal.player';

function applyRendererSetting(value) {
    setBounceRenderer(value);
    try {
        const tier = { ruffle: 'ruffle', swfrecomp: 'wasm', flash: 'flash' }[value];
        if (tier) {
            localStorage.setItem(DJ_PLAYER_STORAGE_KEY, tier);
        } else {
            // 'js' (irrelevant) or legacy 'dj' (page auto-detects).
            localStorage.removeItem(DJ_PLAYER_STORAGE_KEY);
        }
    } catch { /* storage unavailable (tests/headless) — page auto-detects */ }
}

// Unique iframeId so this wrapper doesn't collide with the flash / JtA /
// textAdventure wrapper iframes in iframeAdapterCore.iframes (colliding
// ids overwrite each other's window pointer — events then reach only the
// most recently mounted wrapper). Shared with the registry entry so
// procgenPlayer can re-publish loadRegion on this iframe's appReady. BOTH
// renderer pages load under this ONE id (only one is live at a time — the
// single panel swaps its src), so there's no collision.
const IFRAME_ID = BOUNCE_IFRAME_ID;

// The standalone-first JS game page (build-order step 6). In an iframe
// (window !== window.parent) it skips its dev harness and just exposes
// the __swfBridge game side; loadRegionEvent tells the injected bridge
// which host event delivers this iframe's region loads.
const GAME_IFRAME_SRC = `./modules/bounceDemo/game/index.html?iframeId=${IFRAME_ID}`
    + `&loadRegionEvent=${BOUNCE_LOAD_REGION_EVENT}`
    + `&playbackControlEvent=${BOUNCE_PLAYBACK_CONTROL_EVENT}`;

// The real-DJ renderer: the loader-injected recompiled Doodle Jump SWF
// (SWFRecomp-CC's dj_loader, wide 600px build) behind the same
// __swfBridge contract. Its page bootstraps the Flash player lazily on
// first configure, so it isn't loaded at all while the JS renderer is
// selected. Loads under the SAME iframeId + loadRegionEvent as the JS page
// — only the page URL differs. No playbackControlEvent: the playback bot
// is deferred for this renderer (input synthesis needs the botDriver,
// which lives in the JS page).
const DJ_IFRAME_SRC = `./modules/bounceDemo/djReal/index.html?iframeId=${IFRAME_ID}`
    + `&loadRegionEvent=${BOUNCE_LOAD_REGION_EVENT}`;

// One panel for both renderers. The src + tab title resolve from the live
// renderer setting; the panel re-reads them (and reloads the iframe) when
// the host publishes BOUNCE_RENDERER_CHANGED_EVENT after a setting change.
const getIframeSrc = () => (isDjRenderer() ? DJ_IFRAME_SRC : GAME_IFRAME_SRC);
const getPanelTitle = () => (isDjRenderer() ? 'Doodle Jump' : 'Bounce Demo');

export const BounceDemoPanel = createSubstrateIframePanelClass({
    componentType: BOUNCE_PANEL_COMPONENT_TYPE,
    title: getPanelTitle,
    iframeSrc: getIframeSrc,
    // Resolved against the iframe page URL (.../modules/bounceDemo/{game,
    // djReal}/index.html) — the shared flash bridge, not a bounce copy.
    bridgeSrc: '../../flashSubstrate/bridge.js',
    moduleName: 'bounceDemo',
    reloadEvent: BOUNCE_RENDERER_CHANGED_EVENT,
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

    // One panel for both renderers; it swaps its own iframe src between the
    // JS and real-DJ pages on the renderer setting (see BounceDemoPanel).
    registrationApi.registerPanelComponent(
        BOUNCE_PANEL_COMPONENT_TYPE,
        BounceDemoPanel,
    );

    // The bridge dispatches user:locationCheck (pickup landed) and
    // user:regionMove (exit portal landed) up the dispatcher chain.
    // Declared here so the dispatcher knows this module is a sender.
    registrationApi.registerDispatcherSender('user:locationCheck', 'bottom', 'first');
    registrationApi.registerDispatcherSender('user:regionMove', 'bottom', 'first');

    // procgenPlayer publishes bounce:loadRegion on bounce-region
    // transitions (the registry entry's loadRegionEvent); the bridge
    // picks it up via the iframeAdapter eventBus relay. Both renderer
    // pages use this one event, so there's no second load event.
    registrationApi.registerEventBusPublisher(BOUNCE_LOAD_REGION_EVENT);
    // Renderer-switch signal: published by initialize() after the renderer
    // setting changes; the single bounce panel reloads its iframe in
    // response (panel factory reloadEvent).
    registrationApi.registerEventBusPublisher(BOUNCE_RENDERER_CHANGED_EVENT);
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

    registrationApi.registerSettingsSchema({
        type: 'object',
        properties: {
            renderer: {
                type: 'string',
                default: 'js',
                enum: ['js', 'ruffle', 'swfrecomp', 'flash', 'dj'],
                label: 'Renderer',
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

    // Renderer selection: seed the library from the persisted setting and
    // track live changes (the Settings panel writes through
    // settingsManager). After applying, publish BOUNCE_RENDERER_CHANGED_EVENT
    // so the mounted bounce panel re-resolves its iframe src and reloads if
    // the renderer (js <-> dj page) changed. Publishing after
    // setBounceRenderer guarantees the panel reads the new value; an
    // unchanged src makes the panel's reload a no-op.
    const applyAndNotify = (value) => {
        applyRendererSetting(value);
        eventBus.publish(BOUNCE_RENDERER_CHANGED_EVENT, { renderer: value });
    };
    settingsManager.getSetting(RENDERER_SETTING_KEY, 'js')
        .then((value) => applyAndNotify(value))
        .catch(() => { /* keep the 'js' default */ });
    eventBus.subscribe('settings:changed', (data) => {
        if (data?.key === RENDERER_SETTING_KEY) {
            applyAndNotify(data.value);
        } else if (data?.key === '*') {
            // Bulk write (Settings panel "Apply") — re-read the key.
            settingsManager.getSetting(RENDERER_SETTING_KEY, 'js')
                .then((value) => applyAndNotify(value))
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
}

// Exposed for symmetry with the other substrate host modules.
export function getInitApi() {
    return _initApi;
}
