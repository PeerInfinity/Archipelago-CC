/**
 * noiz2saSubstrate — host module for the Noiz2sa (BulletML shoot-'em-up) substrate (`noiz2saSubstrateLibrary.js`
 * holds the registry entry and the rulings it follows).
 *
 * Like runnerDemo, it rides flashSubstrate's machinery as shared CODE: the panel class comes from
 * flashSubstratePanel.js's factory, pointed at this module's own game page (`game/index.html`, which imports
 * the engine from the `bulletml-dodge` submodule), and the injected bridge is flashSubstrate/bridge.js itself
 * (the page speaks the `__swfBridge` contract). What this module owns is its identity: the panel component
 * ('noiz2saSubstratePanel'), the load event ('noiz2sa:loadRegion', passed to the bridge in the iframe URL) and
 * the iframe id — so flash and runner region loads never configure this iframe.
 *
 * N4 — the bot and its training, host side:
 *  - the BOT: the registry entry declares `executeVia: 'solver'`, and `getPlaybackController` returns this module's
 *    proxy (`Noiz2saBotProxy`), whose `walkTo` carries the bot's settings to the page (the bridge's
 *    `botWalkTo(goal, options)`): the knobs at the trainer's CURRENT tracks, the speed and the retry cap (settings);
 *  - the TRAINER (`noiz2saTraining.js`): kept in localStorage, it earns from every play-clock report of a Noiz2sa
 *    region (live play and the Bot block: the visit's game seconds and score) and from every instant Playback of a
 *    Noiz2sa summary (`loops:summaryApplied`, the summary's `playStats`). Only Noiz2sa regions train it (⚖);
 *  - the TRAINING section of this panel (`noiz2saTrainingSection.js`), under the iframe (⚖ 2026-10-05).
 *
 * N4b:
 *  - the HOST STATE for the page (the bridge's `hostState` command → `__swfBridge.setHostState`): loop mode (in loop
 *    mode the page opens a region's exits only after a clear on this visit: the move IS the clear) and the bot's
 *    options for this visit, sent on every region load and on every change of loop mode, the tracks or the settings;
 *  - a BOT SEED PER VISIT (`drawBotSeed`, drawn on every region load), carried by the walk and the host state; the page
 *    reports it in its play-clock stats, so a Record summary carries it (`playStats.botSeed`). `pinBotSeed(n)` pins it
 *    (tests: the measured runs are at seed 1);
 *  - the FIRST CLEAR explores the region fully (`noiz2saFirstClear.js`): as many `loop:exploreCompleted` as it has
 *    locations and exits, the first time its clear is in the host's checked set.
 */

import { createSubstrateIframePanelClass } from '../flashSubstrate/flashSubstratePanel.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { Noiz2saBotProxy } from './noiz2saBotProxy.js';
import settingsManager from '../../app/core/settingsManager.js';
import { STORAGE_KINDS } from '../../app/core/storageKinds.js';
import {
    substrateRegistryEntry,
    setPlaybackProxy,
    NOIZ2SA_SUBSTRATE_ID,
    NOIZ2SA_PANEL_COMPONENT_TYPE,
    NOIZ2SA_LOAD_REGION_EVENT,
    NOIZ2SA_PLAYBACK_CONTROL_EVENT,
    NOIZ2SA_IFRAME_ID,
} from './noiz2saSubstrateLibrary.js';
import { createTrainerService, drawBotSeed, NOIZ2SA_SETTINGS_SCHEMA, NOIZ2SA_SETTINGS_DEFAULTS } from './noiz2saTraining.js';
import { createTrainingSection } from './noiz2saTrainingSection.js';
import { clearsOf, checkedNamesOf, exploresToFullyExplore, createFirstClearWatcher } from './noiz2saFirstClear.js';
import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js';
import { getGameStateSingleton } from '../gameState/singleton.js';

// In an iframe the page plays the region the bridge configures; opened directly in a tab it plays a region
// from its own URL (?start=1:2&end=1:3&seed=1), for development.
const GAME_IFRAME_SRC = `./modules/noiz2saSubstrate/game/index.html?iframeId=${NOIZ2SA_IFRAME_ID}`
    + `&loadRegionEvent=${NOIZ2SA_LOAD_REGION_EVENT}`
    + `&playbackControlEvent=${NOIZ2SA_PLAYBACK_CONTROL_EVENT}`;
const SETTINGS_PREFIX = 'moduleSettings.noiz2saSubstrate.';

// ── the trainer (created on first use: a panel may be built before initialize) ──
let _service = null;
let _eventBus = null;
const _sections = new Set();
/** the Noiz2sa regions loaded this session, and the last one (the surplus's region-XP target) */
const _regions = new Set();
let _lastRegion = null;

function storage() {
    try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

/** The trainer service (noiz2saTraining.js createTrainerService), shared by the host module, the panel and tests. */
export function getTrainerService() {
    _service ??= createTrainerService({ storage: storage(), settings: NOIZ2SA_SETTINGS_DEFAULTS, onChange: onTrainerChanged });
    return _service;
}

function onTrainerChanged(_tr, { tracksChanged }) {
    for (const s of _sections) s.render();
    if (tracksChanged) { _botProxy?.refresh(); publishHostState(); }
}

let _botProxy = null;

// ── N4b: the visit's bot seed, and the host state the page plays by ──
let _visitSeed = drawBotSeed();
let _pinnedSeed = null;
/** the bot's options for the current visit (its seed, the knobs at the current tracks) */
const visitBotOptions = () => getTrainerService().botOptions(_visitSeed);
/** a new visit: a new bot seed (or the pinned one) */
function newVisitSeed() {
    _visitSeed = _pinnedSeed ?? drawBotSeed();
    return _visitSeed;
}
/**
 * Pin the bot seed of every visit from the next region load on (null: a new one per visit again). Tests pin the
 * seeds their measurements were taken at; it also makes a recorded visit's seed replayable.
 */
export function pinBotSeed(seed) {
    _pinnedSeed = Number.isInteger(seed) && seed >= 1 && seed <= 0xffffffff ? seed : null;
    return _pinnedSeed;
}
/** the current visit's bot seed */
export const getVisitBotSeed = () => _visitSeed;

function isLoopModeActive() {
    try { return getGameStateSingleton()?.getLoopModeActive?.() === true; } catch { return false; }
}
let _loopMode = false;
/** the page's host state: loop mode and the visit's bot options (the bridge hands it to `__swfBridge.setHostState`) */
function publishHostState() {
    _eventBus?.publish(NOIZ2SA_PLAYBACK_CONTROL_EVENT, {
        method: 'hostState', args: [{ loopMode: _loopMode, bot: visitBotOptions() }],
    }, 'noiz2saSubstrate');
}

// ── N4b: a first clear explores the region fully ──
const _firstClears = createFirstClearWatcher();
function exploreFirstClears(snapshot) {
    const warehouse = _initApi?.getModuleFunction?.('procgenPlayer', 'getWarehouse')?.() ?? null;
    const regions = _firstClears.note(clearsOf(warehouse, NOIZ2SA_SUBSTRATE_ID), checkedNamesOf(snapshot));
    if (!regions.length || !_dispatcher) return;
    const staticRegions = stateManager?.getStaticData?.()?.regions;
    for (const region of regions) {
        const n = exploresToFullyExplore(staticRegions?.get?.(region));
        // The explores the discovery module answers one by one, as a full explore does elsewhere. `fromLoop`: loops
        // must not gate or capture them — the clear they follow already passed the action gate, and this
        // substrate has no explore action to record (⚖ N4b).
        for (let i = 0; i < n; i++) {
            _exploresSent++;
            _dispatcher.publish('loop:exploreCompleted', {
                regionName: region, fromLoop: true, source: 'noiz2sa:firstClear',
            }, { initialTarget: 'bottom' });
        }
    }
}
let _dispatcher = null;
let _exploresSent = 0;
/** test surface: the regions explored by a first clear since the last rules load, and the explores sent */
export const getFirstClearState = () => ({ explored: _firstClears.explored(), exploresSent: _exploresSent });

const BasePanel = createSubstrateIframePanelClass({
    componentType: NOIZ2SA_PANEL_COMPONENT_TYPE,
    title: 'Noiz2sa',
    iframeSrc: GAME_IFRAME_SRC,
    // Resolved against the iframe page URL (.../modules/noiz2saSubstrate/game/index.html).
    bridgeSrc: '../../flashSubstrate/bridge.js',
    moduleName: 'noiz2saSubstrate',
});

/** The iframe panel plus the training section under it (⚖ the host panel: visible between regions). */
export class Noiz2saSubstratePanel extends BasePanel {
    _initializeUI() {
        super._initializeUI();
        this._training = createTrainingSection(getTrainerService(), { xpTarget: () => _lastRegion, addRegionXp });
        this.rootElement.appendChild(this._training.root);
        _sections.add(this._training);
    }
    destroy() {
        _sections.delete(this._training);
        super.destroy?.();
    }
}

/** surplus → region XP: gameState's region-XP API (`addRegionXP`), then the loops panel is told */
function addRegionXp(region, xp) {
    const api = _initApi;
    const add = api?.getModuleFunction?.('gameState', 'addRegionXP');
    if (typeof add !== 'function') throw new Error('noiz2sa: gameState addRegionXP is not available');
    add(region, xp);
    const xpData = api.getModuleFunction?.('gameState', 'getRegionXP')?.(region);
    if (xpData) _eventBus?.publish('gameState:xpChanged', { regionName: region, xpData }, 'noiz2saSubstrate');
}

async function loadSettings() {
    const out = {};
    for (const key of Object.keys(NOIZ2SA_SETTINGS_DEFAULTS)) {
        try { out[key] = await settingsManager.getSetting(SETTINGS_PREFIX + key, NOIZ2SA_SETTINGS_DEFAULTS[key]); } catch { /* the default */ }
    }
    return out;
}
async function applySettingsFromManager() {
    const before = JSON.stringify(getTrainerService().settings);
    getTrainerService().applySettings(await loadSettings());
    if (JSON.stringify(getTrainerService().settings) !== before) { _botProxy?.refresh(); publishHostState(); }
}

export const moduleInfo = {
    name: 'noiz2saSubstrate',
    title: 'Noiz2sa',
    componentType: NOIZ2SA_PANEL_COMPONENT_TYPE,
    icon: '🚀',
    column: 3,
    category: 'Procgen Substrate Panels',
    description: 'Plays each region as a segment of Noiz2sa, a bullet-hell shoot-\'em-up: survive its scenes to clear it; a hit restarts the region.',
    requires: ['stateManager', 'iframeAdapter'],
    storage: [
        { key: 'noiz2sa:trainer:v1', kind: STORAGE_KINDS.user, label: 'Noiz2sa bot training (tracks, points, strategy)' },
    ],
};

let _initApi = null;

export function register(registrationApi) {
    // The panel reuses flashSubstrate's CSS classes (flashsub-root / flashsub-iframe).
    if (typeof document !== 'undefined'
        && !document.querySelector('link[href="modules/flashSubstrate/flashSubstrate.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'modules/flashSubstrate/flashSubstrate.css';
        document.head.appendChild(link);
    }

    if (typeof document !== 'undefined'
        && !document.querySelector('link[href="modules/noiz2saSubstrate/noiz2saSubstrate.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'modules/noiz2saSubstrate/noiz2saSubstrate.css';
        document.head.appendChild(link);
    }

    registrationApi.registerPanelComponent(NOIZ2SA_PANEL_COMPONENT_TYPE, Noiz2saSubstratePanel);
    // The bot's settings and the training rates (N4; every rate and price a user setting, ⚖).
    registrationApi.registerSettingsSchema(NOIZ2SA_SETTINGS_SCHEMA);

    // The bridge dispatches user:locationCheck (the region cleared) and user:regionMove (the player left by an
    // exit) up the dispatcher chain.
    registrationApi.registerDispatcherSender('user:locationCheck', 'bottom', 'first');
    registrationApi.registerDispatcherSender('user:regionMove', 'bottom', 'first');
    // N4b: a region's first clear explores it fully (noiz2saFirstClear.js).
    registrationApi.registerDispatcherSender('loop:exploreCompleted', 'bottom');

    // procgenPlayer publishes noiz2sa:loadRegion (the entry's loadRegionEvent); the bridge picks it up through
    // the iframeAdapter relay.
    registrationApi.registerEventBusPublisher(NOIZ2SA_LOAD_REGION_EVENT);
    // Brings the panel forward when the player enters a Noiz2sa region.
    registrationApi.registerEventBusPublisher('ui:activatePanel');
    // The bot's commands (host proxy → the in-iframe bridge), and the surplus's region XP.
    registrationApi.registerEventBusPublisher(NOIZ2SA_PLAYBACK_CONTROL_EVENT);
    registrationApi.registerEventBusPublisher('gameState:xpChanged');
    registrationApi.registerEventBusSubscriberIntent(NOIZ2SA_LOAD_REGION_EVENT);
    registrationApi.registerEventBusSubscriberIntent('substrate:playClock');
    registrationApi.registerEventBusSubscriberIntent('loops:summaryApplied');
    registrationApi.registerEventBusSubscriberIntent('gameState:loopModeChanged');
    registrationApi.registerEventBusSubscriberIntent('stateManager:snapshotUpdated');
    registrationApi.registerEventBusSubscriberIntent('stateManager:rulesLoaded');

    if (!substrateRegistry.has(substrateRegistryEntry.id)) {
        substrateRegistry.register(substrateRegistryEntry);
    }
}

export function initialize(_moduleId, _priorityIndex, initializationApi) {
    _initApi = initializationApi;
    const eventBus = initializationApi.getEventBus();
    if (!eventBus) return;
    _eventBus = eventBus;
    _dispatcher = initializationApi.getDispatcher?.() ?? null;
    const service = getTrainerService();

    // The bot: the proxy the registry entry's getPlaybackController returns (loops' walkTo solver).
    _botProxy = new Noiz2saBotProxy({
        eventBus,
        controlEvent: NOIZ2SA_PLAYBACK_CONTROL_EVENT,
        botOptions: () => visitBotOptions(),
        isDriving: () => {
            const region = initializationApi.getModuleFunction?.('loops', 'botSolverRegion')?.();
            return !!region && _regions.has(region);
        },
    });
    setPlaybackProxy(_botProxy);

    // Settings: read now, and again on every change of ours (or a bulk write).
    applySettingsFromManager().catch(() => {});
    eventBus.subscribe('settings:changed', (data) => {
        const key = data?.key ?? '';
        if (key === '*' || key.startsWith(SETTINGS_PREFIX) || key === 'moduleSettings.noiz2saSubstrate') {
            applySettingsFromManager().catch(() => {});
        }
    }, 'noiz2saSubstrate');

    // Bring the panel forward on a region load, unless loops is focus-locking another panel.
    eventBus.subscribe(NOIZ2SA_LOAD_REGION_EVENT, (payload) => {
        if (payload?.region_id) {
            _regions.add(payload.region_id);
            _lastRegion = payload.region_id;
            for (const s of _sections) s.render();
            // N4b: a new visit — its own bot seed; the page learns it (and loop mode) from the host state
            newVisitSeed();
            _loopMode = isLoopModeActive();
            publishHostState();
            // the first-clear watcher's baseline: the clears' state as the visit starts
            exploreFirstClears(stateManager?.getLatestStateSnapshot?.());
        }
        const isFocusLocked = initializationApi.getModuleFunction?.('loops', 'isFocusLocked');
        if (isFocusLocked?.()) return;
        eventBus.publish('ui:activatePanel', { panelId: NOIZ2SA_PANEL_COMPONENT_TYPE });
    }, 'noiz2saSubstrate');

    // Training: the page's play clock (live play and the bot) — a Noiz2sa region's visit stats only.
    eventBus.subscribe('substrate:playClock', (data) => {
        if (!data?.stats || !_regions.has(data.region)) return;
        service.notePlayClock(data.region, data.stats);
    }, 'noiz2saSubstrate');
    // N4b: loop mode decides when a region's exits open (the page's rule).
    eventBus.subscribe('gameState:loopModeChanged', (data) => {
        _loopMode = data?.active === true;
        publishHostState();
    }, 'noiz2saSubstrate');
    // N4b: a region's first clear explores it fully; a rules load starts over.
    eventBus.subscribe('stateManager:snapshotUpdated', (data) => {
        exploreFirstClears(data?.snapshot ?? stateManager?.getLatestStateSnapshot?.());
    }, 'noiz2saSubstrate');
    eventBus.subscribe('stateManager:rulesLoaded', (data) => {
        _firstClears.reset();
        exploreFirstClears(data?.snapshot ?? null);
    }, 'noiz2saSubstrate');
    // …and an instant Playback of a Noiz2sa summary earns the recorded visit.
    eventBus.subscribe('loops:summaryApplied', (data) => {
        if (data?.substrate !== NOIZ2SA_SUBSTRATE_ID) return;
        service.noteSummaryApplied(data.summary);
    }, 'noiz2saSubstrate');
}

export function getInitApi() {
    return _initApi;
}
