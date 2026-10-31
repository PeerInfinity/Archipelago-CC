/**
 * cloudberryDemo — host module for the Cloudberry Kingdom substrate (`cloudberry`).
 *
 * Like runnerDemo, it rides flashSubstrate's machinery as shared CODE: the panel
 * class comes from the flash panel factory and the injected bridge is
 * flashSubstrate/bridge.js. What is Cloudberry's own is its identity (panel
 * component, load event, iframe id, playback event) and WHERE the game page lives:
 * the Cloudberry repo's site, never this repository (⚖ R18).
 *
 * The bridge is injected into the iframe, so the page must be SAME-ORIGIN:
 *   - a local copy at ./external/cloudberry/ (scripts/setup/fetch-cloudberry-site.mjs
 *     downloads the live site there, or links a local build) — used when present;
 *   - else /cloudberry-kingdom-wasm/ — production on GitHub Pages, where both sites
 *     are on peerinfinity.github.io;
 *   - the module setting `siteUrl` overrides both.
 * The page gets `?embed=1` (the game side of `__swfBridge`), the bridge's event
 * names, and `packs=` this frontend's own art library (the check-coin logo).
 *
 * ⛔ Nothing is fetched before the first Cloudberry region: until then the panel shows
 * `waiting.html` (the game is ~26 MB, and most worlds have no Cloudberry region). The
 * first `cloudberry:loadRegion` probes for the local copy and swaps the iframe to the
 * game page; procgenPlayer re-publishes the active region when its bridge says appReady.
 */

import { createSubstrateIframePanelClass } from '../flashSubstrate/flashSubstratePanel.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { PlaybackProxy } from '../textAdventureSubstrateWrapper/playbackProxy.js';
import settingsManager from '../../app/core/settingsManager.js';
import {
    substrateRegistryEntry,
    setPlaybackProxy,
    CLOUDBERRY_PANEL_COMPONENT_TYPE,
    CLOUDBERRY_LOAD_REGION_EVENT,
    CLOUDBERRY_PLAYBACK_CONTROL_EVENT,
    CLOUDBERRY_IFRAME_ID,
} from './cloudberryLibrary.js';

const SITE_SETTING_KEY = 'moduleSettings.cloudberryDemo.siteUrl';
/** The same-origin local copy (relative to the frontend page). */
export const LOCAL_SITE = './external/cloudberry/';
/** Production: the Cloudberry repo's Pages site, same origin as /Archipelago-CC/ on Pages. */
export const PAGES_SITE = '/cloudberry-kingdom-wasm/';
/** Re-resolve the iframe URL (the panel reloads only when it changed). */
const SITE_CHANGED_EVENT = 'cloudberry:siteChanged';

const baseHref = () => (typeof document !== 'undefined' ? document.baseURI : 'http://localhost/');
const abs = (rel) => new URL(rel, baseHref()).href;

let _settingUrl = '';
let _probedSite = null;     // set by the probe, on the first Cloudberry region
let _active = false;        // a Cloudberry region has been entered
let _eventBus = null;

/** The site the panel iframes now (an absolute URL ending in '/'). */
export function cloudberrySiteUrl() {
    const raw = _settingUrl || _probedSite || PAGES_SITE;
    return abs(raw.endsWith('/') ? raw : `${raw}/`);
}

function iframeSrc() {
    if (!_active || (!_settingUrl && !_probedSite)) {
        const w = new URLSearchParams({ iframeId: CLOUDBERRY_IFRAME_ID, loadRegionEvent: CLOUDBERRY_LOAD_REGION_EVENT });
        return `./modules/cloudberryDemo/waiting.html?${w}`;
    }
    const q = new URLSearchParams({
        embed: '1',
        iframeId: CLOUDBERRY_IFRAME_ID,
        loadRegionEvent: CLOUDBERRY_LOAD_REGION_EVENT,
        playbackControlEvent: CLOUDBERRY_PLAYBACK_CONTROL_EVENT,
        packs: abs('./packs/'),
    });
    return `${cloudberrySiteUrl()}index.html?${q}`;
}

function siteChanged() {
    _eventBus?.publish?.(SITE_CHANGED_EVENT, { site: cloudberrySiteUrl() }, 'cloudberryDemo');
}

// Is the local copy there? Asked once, on the first Cloudberry region.
let _probe = null;
export function localSitePresent() {
    _probe ??= (typeof fetch === 'function'
        ? fetch(abs(`${LOCAL_SITE}build-info.json`), { cache: 'no-store' }).then((res) => res.ok, () => false)
        : Promise.resolve(false))
        .then((present) => { _probedSite = present ? LOCAL_SITE : PAGES_SITE; return present; });
    return _probe;
}

/** The first Cloudberry region: find the site, then swap the waiting page for the game. */
function activate() {
    if (_active) return;
    _active = true;
    if (_settingUrl) siteChanged();
    else localSitePresent().then(() => siteChanged());
}

export const CloudberryDemoPanel = createSubstrateIframePanelClass({
    componentType: CLOUDBERRY_PANEL_COMPONENT_TYPE,
    title: 'Cloudberry Kingdom',
    iframeSrc,
    // Absolute: the game page lives outside this frontend's tree (its own site folder).
    bridgeSrc: abs('./modules/flashSubstrate/bridge.js'),
    moduleName: 'cloudberryDemo',
    reloadEvent: SITE_CHANGED_EVENT,
});

export const moduleInfo = {
    name: 'cloudberryDemo',
    title: 'Cloudberry Kingdom',
    componentType: CLOUDBERRY_PANEL_COMPONENT_TYPE,
    icon: '🫐',
    column: 3,
    category: 'Procgen Substrate Panels',
    description: 'Plays each region as a Cloudberry Kingdom level: collect its check coins, then leave by the end door.',
    requires: ['stateManager', 'iframeAdapter'],
};

export function register(registrationApi) {
    if (typeof document !== 'undefined'
        && !document.querySelector('link[href="modules/flashSubstrate/flashSubstrate.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'modules/flashSubstrate/flashSubstrate.css';
        document.head.appendChild(link);
    }
    registrationApi.registerPanelComponent(CLOUDBERRY_PANEL_COMPONENT_TYPE, CloudberryDemoPanel);
    registrationApi.registerDispatcherSender('user:locationCheck', 'bottom', 'first');
    registrationApi.registerDispatcherSender('user:regionMove', 'bottom', 'first');
    registrationApi.registerEventBusPublisher(CLOUDBERRY_LOAD_REGION_EVENT);
    registrationApi.registerEventBusPublisher(CLOUDBERRY_PLAYBACK_CONTROL_EVENT);
    registrationApi.registerEventBusPublisher(SITE_CHANGED_EVENT);
    registrationApi.registerEventBusPublisher('ui:activatePanel');
    registrationApi.registerEventBusSubscriberIntent(CLOUDBERRY_LOAD_REGION_EVENT);
    registrationApi.registerSettingsSchema({
        type: 'object',
        properties: {
            siteUrl: {
                type: 'string',
                default: '',
                label: 'Cloudberry site URL',
                description: 'Where the game page is loaded from. Empty = the local copy at '
                    + `${LOCAL_SITE} when present (scripts/setup/fetch-cloudberry-site.mjs), else `
                    + `${PAGES_SITE}. It must be on this page's origin (the bridge is injected).`,
            },
        },
    });
    if (!substrateRegistry.has(substrateRegistryEntry.id)) {
        substrateRegistry.register(substrateRegistryEntry);
    }
}

export function initialize(_moduleId, _priorityIndex, initializationApi) {
    const eventBus = initializationApi.getEventBus();
    if (!eventBus) return;
    _eventBus = eventBus;

    const applySetting = (value) => {
        const next = typeof value === 'string' ? value.trim() : '';
        if (next === _settingUrl) return;
        _settingUrl = next;
        siteChanged();
    };
    settingsManager.getSetting(SITE_SETTING_KEY, '').then(applySetting).catch(() => {});
    eventBus.subscribe('settings:changed', (data) => {
        if (data?.key === SITE_SETTING_KEY) applySetting(data.value);
        else if (data?.key === '*') settingsManager.getSetting(SITE_SETTING_KEY, '').then(applySetting).catch(() => {});
    }, 'cloudberryDemo');

    setPlaybackProxy(new PlaybackProxy({ eventBus, controlEvent: CLOUDBERRY_PLAYBACK_CONTROL_EVENT }));

    eventBus.subscribe(CLOUDBERRY_LOAD_REGION_EVENT, () => {
        activate();
        const isFocusLocked = initializationApi.getModuleFunction?.('loops', 'isFocusLocked');
        if (isFocusLocked?.()) return;
        eventBus.publish('ui:activatePanel', { panelId: CLOUDBERRY_PANEL_COMPONENT_TYPE });
    }, 'cloudberryDemo');
}
