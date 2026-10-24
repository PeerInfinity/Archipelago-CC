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
 * See docs/json/developer/procgen/playback-and-debugging.md.
 */

import { PlaybackBotUI } from './playbackBotUI.js';
import { setActivePanel } from './index.js';
import { getSphereStateSingleton } from '../sphereState/singleton.js';
import { stateManagerProxySingleton as stateManager, getLastRawJsonData } from '../stateManager/index.js';
import { PathFinder } from '../shared/pathfinder.js';
// Imported directly so the panel can subscribe even when its
// constructor runs before the module's initialize() has wired up
// PlaybackBotPanel.moduleApis. Mirrors the workaround in mazeRoomUI.
import eventBus from '../../app/core/eventBus.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';
import settingsManager from '../../app/core/settingsManager.js';
import discoveryStateSingleton from '../discovery/singleton.js';
import { evaluateRule } from '../shared/ruleEngine.js';
import { createSnapshotInterface } from '../shared/snapshotInterface.js';
import { blockKeyOf, resolveQueueBlocks } from '../loops/blockIdentity.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { mountChecksLine } from '../commonUI/checksLine.js';

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
        // Cache of the last loaded rules.json. Bot reads this via the
        // getRulesJson injection to look up per-region substrate from
        // preset_sidecars.
        this._cachedRulesJson = null;
        // The loaded slot's player id (rules.json's per-player blocks, e.g. `exporter[p].return_to_menu`).
        this._cachedPlayerId = null;
        // ⛓ MINI VIEW (modules/miniPanels) — the panel shrunk to one row: the bot's five buttons, its status
        // line, the checks line when Checks rides here, and ⤢ to expand. The rest stays built but hidden, so
        // expanding is instant and the run is untouched.
        this._mini = false;
        this._miniExtras = null;
        this._miniChecks = null;
        this._miniChecksLine = null;
        this._onExpand = null;

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
        this._placeMiniExtras();

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
        const onRawJsonLoaded = (data) => {
            // Stash the rules.json so the bot can look up per-region
            // substrate via preset_sidecars. The proxy doesn't keep
            // the parsed payload around — getRawJsonDataSource()
            // returns just the source filename.
            this._cachedRulesJson = data?.rawJsonData ?? null;
            this._cachedPlayerId = data?.selectedPlayerInfo?.playerId ?? null;
            this._bot?.reset?.();
        };
        eventBus.subscribe('stateManager:rawJsonDataLoaded', onRawJsonLoaded, 'playbackBot');
        this._sphereDataSubscriptions.push(() => {
            eventBus.unsubscribe?.('stateManager:rawJsonDataLoaded', onRawJsonLoaded, 'playbackBot');
        });

        // Catch up on the initial load: rawJsonDataLoaded fires during
        // init phase 10, BEFORE this deferred (readyForUiDataLoad-gated)
        // subscription exists — without this pull, _cachedRulesJson
        // stays null until the user reloads rules, and per-region
        // substrate lookups silently come up empty. No reset() here:
        // the bot is freshly constructed, there's no stale state.
        if (!this._cachedRulesJson) {
            const last = getLastRawJsonData();
            this._cachedRulesJson = last?.rawJsonData ?? null;
            this._cachedPlayerId = last?.selectedPlayerInfo?.playerId ?? null;
        }
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

    isMiniMode() { return this._mini; }

    /** The mini row sizes itself to this element's natural height. */
    getMiniContentElement() { return this.rootElement; }

    /** Show the mini view (or the full one). `onExpand` is what the mini view's ⤢ button calls. */
    setMiniMode(on, { onExpand = null } = {}) {
        if (!this.rootElement) return;
        this._mini = !!on;
        if (onExpand) this._onExpand = onExpand;
        this.rootElement.classList.toggle('pb-mini', this._mini);
        if (this._mini) this._ensureMiniExtras();
        this._placeMiniExtras();
    }

    /** Show the checks line inside the mini row (Checks on while the bot is mini). */
    setMiniChecks(on) {
        if (!this.rootElement) return;
        this._ensureMiniExtras();
        if (on && !this._miniChecksLine) {
            this._miniChecksLine = mountChecksLine(this._miniChecks, {
                bus: eventBus, stateManager, moduleName: 'playbackBot',
            });
        } else if (!on && this._miniChecksLine) {
            this._miniChecksLine.dispose();
            this._miniChecksLine = null;
            this._miniChecks.textContent = '';
        }
        this._miniChecks.hidden = !on;
    }

    _ensureMiniExtras() {
        if (this._miniExtras) return;
        const extras = document.createElement('div');
        extras.className = 'pb-mini-extras';
        const checks = document.createElement('span');
        checks.className = 'pb-mini-checks';
        checks.hidden = true;
        const expand = document.createElement('button');
        expand.type = 'button';
        expand.className = 'pb-mini-expand';
        expand.textContent = '⤢';
        expand.title = 'Expand: back to the full Playback Bot panel';
        expand.addEventListener('click', () => this._onExpand?.());
        extras.append(checks, expand);
        this._miniExtras = extras;
        this._miniChecks = checks;
    }

    /** The extras ride last in the root (after the bot and any placeholder); re-placed after each render. */
    _placeMiniExtras() {
        if (this._miniExtras && this.rootElement && this.rootElement.lastChild !== this._miniExtras) {
            this.rootElement.appendChild(this._miniExtras);
        }
    }

    onPanelShow() {}
    onPanelResize() {}

    destroy() {
        this._miniChecksLine?.dispose();
        this._miniChecksLine = null;
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
        this._bot = new PlaybackBotUI({
            getSphereData: () => {
                const sphereState = getSphereStateSingleton();
                return sphereState?.getSphereData?.() ?? [];
            },
            getStaticData: () => stateManager?.getStaticData?.() ?? null,
            getRulesJson: () => this._cachedRulesJson,
            pathFinder: new PathFinder(stateManager),
            // Pass the proxy so the bot can pingWorker before each
            // cross-region findPathWithExits call. The proxy's uiCache
            // updates asynchronously after stateManager processes a
            // pickup; without a flush, the bot's PathFinder reads a
            // stale snapshot and rejects routes through regions that
            // were just unlocked by the previous sphere's item.
            stateManagerProxy: stateManager,
            getPlayerId: () => this._cachedPlayerId ?? '1',
            // ⛓ RETURN TO MENU — a RESTART step takes the Menu panel's own Restart (the button's path).
            restart: () => centralRegistry.getPublicFunction?.('menuPanel', 'restart')?.() ?? null,
            // ⛓ DIRECT PLAY — the bot's own checks and moves for plain regions, published like a click.
            publish: (eventName, payload) => PlaybackBotPanel.moduleApis?.dispatcher
                ?.publish?.(eventName, payload, { initialTarget: 'bottom' }),
            getCurrentRegion: () => centralRegistry.getPublicFunction?.('gameState', 'getCurrentRegion')?.() ?? null,
            isLoopModeActive: () => !!centralRegistry.getPublicFunction?.('loops', 'isLoopModeActive')?.(),
            loopRunnerDeps: this._loopRunnerDeps(),
            timer: this._timerDeps(),
        });
    }

    /**
     * ⛓ TARGET SOURCE 'reachable' — the timer module's TimerLogic, as the bot drives it (Play = Begin, Step = Quick
     * Check). Null when the timer module is not loaded: the bot then offers the sphere log only.
     */
    _timerDeps() {
        const getLogic = centralRegistry.getPublicFunction?.('timer', 'getTimerLogic');
        if (typeof getLogic !== 'function') return null;
        const logic = () => getLogic() ?? null;
        return {
            begin: () => logic()?.begin(),
            stop: () => logic()?.stop(),
            quickCheck: async () => !!(await logic()?.determineAndDispatchQuickCheck()),
            isRunning: () => !!logic()?.isRunning(),
            onRunningChanged: (fn) => {
                const onStarted = () => fn(true);
                const onStopped = () => fn(false);
                eventBus.subscribe('timer:started', onStarted, 'playbackBot');
                eventBus.subscribe('timer:stopped', onStopped, 'playbackBot');
                return () => {
                    eventBus.unsubscribe?.('timer:started', onStarted, 'playbackBot');
                    eventBus.unsubscribe?.('timer:stopped', onStopped, 'playbackBot');
                };
            },
        };
    }

    /**
     * ⛓ LOOP MODE (loop-mode-bot S3) — what the bot's LoopModeRunner reads from the live game: the Loops module,
     * gameState, discovery, and the rules evaluated against the latest snapshot. Generic over any rules.json.
     */
    _loopRunnerDeps() {
        const api = (mod, fn) => centralRegistry.getPublicFunction?.(mod, fn) ?? null;
        let discoveryActive = false;
        settingsManager.getSetting?.('moduleSettings.discovery.enableDiscoveryMode', false)
            ?.then?.((v) => { discoveryActive = !!v; })?.catch?.(() => {});
        const onDiscoveryMode = (data) => {
            if (typeof data?.active === 'boolean') discoveryActive = data.active;
        };
        eventBus.subscribe('discovery:modeChanged', onDiscoveryMode, 'playbackBot');
        this._sphereDataSubscriptions.push(() => eventBus.unsubscribe?.('discovery:modeChanged', onDiscoveryMode, 'playbackBot'));
        const regionOf = (name) => stateManager?.getStaticData?.()?.regions?.get?.(name) ?? null;
        const ruleHolds = (rule) => {
            if (rule === undefined || rule === null) return true;
            const staticData = stateManager?.getStaticData?.();
            const snapshot = stateManager?.getLatestStateSnapshot?.();
            if (!staticData || !snapshot) return false;
            try { return evaluateRule(rule, createSnapshotInterface(snapshot, staticData)) === true; } catch { return false; }
        };
        return {
            getLoopState: () => api('loops', 'getLoopState')?.() ?? null,
            getGameState: () => api('gameState', 'getState')?.() ?? null,
            getStartRegion: () => api('loops', 'getLoopStartRegion')?.() ?? null,
            exitsOf: (region) => (regionOf(region)?.exits ?? [])
                .filter((e) => e?.name && e.connected_region && ruleHolds(e.access_rule))
                .map((e) => ({ name: e.name, to: e.connected_region })),
            locationsOf: (region) => (regionOf(region)?.locations ?? []).map((l) => l?.name).filter(Boolean),
            isLocationCheckable: (name) => {
                const snapshot = stateManager?.getLatestStateSnapshot?.();
                return !!snapshot && !(snapshot.checkedLocations ?? []).includes(name)
                    && snapshot.locationReachability?.[name] === 'reachable';
            },
            discovery: discoveryStateSingleton,
            isDiscoveryActive: () => discoveryActive,
            isSubstrateRegion: (region) => {
                const pid = String(this._cachedPlayerId ?? '1');
                return !!this._cachedRulesJson?.preset_sidecars?.[pid]?.[region];
            },
            queueBlocks: () => {
                const loopState = api('loops', 'getLoopState')?.();
                return loopState ? resolveQueueBlocks(loopState.getActionQueue()).visits : [];
            },
            blockKeyOf,
            supportsQueueAction: (region, actionType) => {
                const substrate = api('procgenPlayer', 'getRegionInfo')?.(region)?.substrate;
                if (!substrate) return true;    // AP-native: everything (loopBlockBuilder's rule)
                return substrateRegistry.get(substrate)?.loopSupport?.queueActions?.includes(actionType) ?? false;
            },
            regionOfLocation: (name) => {
                const loc = stateManager?.getStaticData?.()?.locations?.get?.(name);
                return loc?.parent_region ?? loc?.region ?? null;
            },
            subscribe: (eventName, handler) => {
                eventBus.subscribe(eventName, handler, 'playbackBot');
                return () => eventBus.unsubscribe?.(eventName, handler, 'playbackBot');
            },
        };
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
        // Without a sphere log the bot can still check any reachable location (its timer source): keep it
        // visible then, with the placeholder as a note above it.
        const usable = hasLog || !!this._bot?.hasTimer?.();
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
            botEl.style.display = usable ? '' : 'none';
        }

        if (!hasLog) {
            const placeholder = document.createElement('div');
            placeholder.className = 'playback-bot-empty-state';
            placeholder.innerHTML = `
                <div class="playback-bot-empty-state-heading">No sphere log loaded.</div>
                <div class="playback-bot-empty-state-body">
                    Generate a world in the Procgen Pipeline and press Load into frontend, or pick a preset with a sphere log in the Presets panel, to begin.
                    ${usable ? 'Without one, set <b>Check next</b> to <b>Any reachable location</b>: it needs no sphere log.' : ''}
                </div>
            `;
            if (usable && botEl) this.rootElement.insertBefore(placeholder, botEl);
            else this.rootElement.appendChild(placeholder);
            this._emptyEl = placeholder;
        }
        this._placeMiniExtras();
    }
}
