/**
 * Playback Bot panel — Golden Layout wrapper around PlaybackBotUI.
 *
 * Responsibilities:
 *   - Build the bot UI with its dependencies (sphereState, stateManager,
 *     PathFinder, eventBus). The bot itself is substrate-agnostic; the
 *     panel is the only place that knows about those singletons.
 *   - Register/unregister with the active-panel singleton so the
 *     module's dispatcher receivers can reach the bot.
 *   - Expose `getBot()` for those receivers + the test harness.
 *   - Render an empty-state placeholder when no sphere log is loaded
 *     (panel mounted before a preset is picked, or preset has no
 *     sphere log).
 *
 * Plan reference:
 * NewDocs/plans/procedural-generation/playback-bot-refactor.md (Phase 1)
 */

import { PlaybackBotUI } from './playbackBotUI.js';
import { setActivePanel } from './index.js';
import { getSphereStateSingleton } from '../sphereState/singleton.js';
import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js';
import { PathFinder } from '../shared/pathfinder.js';
// Imported directly so the panel can subscribe even when its
// constructor runs before the module's initialize() has wired up
// PlaybackBotPanel.moduleApis. Mirrors the workaround in mazeRoomUI.
import eventBus from '../../app/core/eventBus.js';

export class PlaybackBotPanel {
    static moduleApis = null;
    static setModuleApis(apis) { PlaybackBotPanel.moduleApis = apis; }

    constructor(container, componentState) {
        this.container = container;
        this.componentState = componentState;
        this._bot = null;
        this._emptyEl = null;
        this._sphereDataSubscriptions = [];
        this._initialized = false;

        if (typeof document === 'undefined') {
            this.rootElement = null;
            return;
        }

        this.rootElement = document.createElement('div');
        this.rootElement.className = 'playback-bot-panel';

        // Render an "initializing" placeholder so the panel isn't
        // empty during the gap between Golden Layout panel creation
        // and the module-init pass that populates sphereState.
        this._renderInitializing();

        // Defer the rest until app:readyForUiDataLoad. Until that
        // fires, sphereState's singleton may not exist yet, and the
        // PathFinder/stateManager dependencies aren't reliably ready
        // either. Mirrors the spoilerChecklistUI / locationUI
        // initialization pattern.
        const onReady = () => {
            this._initialize();
            eventBus.unsubscribe?.('app:readyForUiDataLoad', onReady, 'playbackBot');
        };
        eventBus.subscribe('app:readyForUiDataLoad', onReady, 'playbackBot');

        setActivePanel(this);
    }

    /**
     * Deferred initialization — called when `app:readyForUiDataLoad`
     * fires (or immediately, if the singleton already exists by the
     * time the panel constructs in a later session). Builds the bot
     * UI with its dependencies, wires sphere-state subscriptions, and
     * renders the real content for the first time.
     */
    _initialize() {
        if (this._initialized) return;
        this._initialized = true;

        // Clear the initializing placeholder before mounting the
        // bot. _renderEmptyOverlay only detaches placeholders it
        // owns (tracked in this._emptyEl), so the initial "Initializing…"
        // div needs to be wiped explicitly.
        if (this.rootElement) this.rootElement.innerHTML = '';

        this._mountBot();
        this._render();

        // Re-render on sphere-log load events so the empty-state
        // placeholder swaps for the bot UI when the user picks a
        // preset (and vice-versa on dataCleared), and the bot's
        // internal status line picks up the current sphere count.
        const onChange = () => this._render();
        for (const ev of ['sphereState:dataLoaded', 'sphereState:dataCleared']) {
            eventBus.subscribe(ev, onChange, 'playbackBot');
            this._sphereDataSubscriptions.push(() => {
                eventBus.unsubscribe?.(ev, onChange, 'playbackBot');
            });
        }

        // When a new rules.json is loaded (preset switch, drag-and-drop,
        // etc.), the bot's queue/cursor/region/checked-set/log all
        // pertain to the *previous* world and would corrupt the new
        // run's first play(). Reset everything to a clean slate; the
        // user-preference toggles (intercept, rate) survive — those
        // live outside the playback-state set that reset() touches.
        //
        // Subscribe to rawJsonDataLoaded (fires BEFORE rulesLoaded),
        // not rulesLoaded itself: procgenPlayer's handleRulesLoaded
        // publishes the synthesized initial user:regionMove inside
        // its own rulesLoaded handler, and the bot's onRegionMove
        // receiver consumes it to set _currentRegion. If we reset on
        // rulesLoaded, our handler would fire AFTER procgenPlayer's
        // (subscription order matches initialize() order) and wipe
        // _currentRegion back to null — leaving the bot stuck on
        // "waiting for region" forever. rawJsonDataLoaded fires first
        // (data fetched, processing pending), so reset lands before
        // procgenPlayer publishes its initial regionMove.
        const onRawJsonLoaded = () => this._bot?.reset?.();
        eventBus.subscribe('stateManager:rawJsonDataLoaded', onRawJsonLoaded, 'playbackBot');
        this._sphereDataSubscriptions.push(() => {
            eventBus.unsubscribe?.('stateManager:rawJsonDataLoaded', onRawJsonLoaded, 'playbackBot');
        });
    }

    _hasSphereLog() {
        const sphereState = getSphereStateSingleton();
        const data = sphereState?.getSphereData?.();
        return Array.isArray(data) && data.length > 0;
    }

    _renderInitializing() {
        if (!this.rootElement) return;
        this.rootElement.innerHTML = `
            <div class="playback-bot-empty-state">
                <div class="playback-bot-empty-state-heading">Initializing…</div>
            </div>
        `;
    }

    getRootElement() { return this.rootElement; }

    getBot() { return this._bot; }

    onPanelShow() {}
    onPanelResize() {}

    destroy() {
        for (const off of this._sphereDataSubscriptions) {
            try { off(); } catch (_e) { /* noop */ }
        }
        this._sphereDataSubscriptions.length = 0;
        if (this._bot) {
            this._bot.destroy();
            this._bot = null;
        }
        setActivePanel(null);
    }

    _mountBot() {
        const eventBus = PlaybackBotPanel.moduleApis?.eventBus;
        this._bot = new PlaybackBotUI({
            getSphereData: () => {
                const sphereState = getSphereStateSingleton();
                return sphereState?.getSphereData?.() ?? [];
            },
            getStaticData: () => stateManager?.getStaticData?.() ?? null,
            eventBus,
            pathFinder: new PathFinder(stateManager),
            // Pass the proxy so the bot can pingWorker before each
            // cross-region findPathWithExits call. The proxy's uiCache
            // updates asynchronously after stateManager processes a
            // pickup; without a flush, the bot's PathFinder reads a
            // stale snapshot and rejects routes through regions that
            // were just unlocked by the previous sphere's item.
            stateManagerProxy: stateManager,
        });
    }

    _render() {
        if (!this.rootElement) return;
        // Bot's internal status line caches "No sphere log loaded."
        // text from when it was constructed against empty sphere data;
        // poke it to refresh against current sphereState.
        this._bot?.refresh?.();
        // Clear the slot the empty-state placeholder occupies, leaving
        // the bot UI element attached underneath. The bot UI manages
        // its own internal rendering; we just toggle visibility via
        // the placeholder.
        this._renderEmptyOverlay();
    }

    _renderEmptyOverlay() {
        const hasLog = this._hasSphereLog();
        const botEl = this._bot?.getElement();

        // Detach previous placeholder if any.
        if (this._emptyEl && this._emptyEl.parentNode) {
            this._emptyEl.parentNode.removeChild(this._emptyEl);
            this._emptyEl = null;
        }

        // Always keep the bot element mounted; toggle visibility so the
        // bot's internal state survives between sphere-log loads. When
        // the empty-state placeholder is up, hide the bot (display:none)
        // — the placeholder takes its place visually.
        if (botEl) {
            if (botEl.parentNode !== this.rootElement) {
                this.rootElement.appendChild(botEl);
            }
            botEl.style.display = hasLog ? '' : 'none';
        }

        if (!hasLog) {
            const placeholder = document.createElement('div');
            placeholder.className = 'playback-bot-empty-state';
            placeholder.innerHTML = `
                <div class="playback-bot-empty-state-heading">No sphere log loaded.</div>
                <div class="playback-bot-empty-state-body">
                    Open the Presets panel and pick a preset with a sphere log to begin.
                </div>
            `;
            this.rootElement.appendChild(placeholder);
            this._emptyEl = placeholder;
        }
    }
}
