/**
 * Text Adventure substrate panel — renders a procgen-emitted region
 * as a textual description with clickable exits and locations.
 *
 * Features:
 *   - Self-activation on textAdventure:loadRegion
 *   - Region heading
 *   - Exits rendered into a 3×3 compass grid (N/E/S/W cardinals,
 *     center cell for null-side / teleporter exits). Each link shows
 *     a shorthand label ([n], [n1], …) and accessibility classes via
 *     stateManager + Rule Builder evaluation.
 *   - Location list with checked/unchecked separation; unchecked are
 *     clickable with shorthand labels ([l], [l1], …); checked are
 *     plain text.
 *   - Click handlers publish user:regionMove and user:locationCheck
 *     through the module dispatcher
 *   - Always-visible command input at the bottom: text + Enter dispatches
 *     a parsed command (shorthand n/e/s/w/c/l + indices, plus the
 *     verb vocabulary ported from the textAdventure module). Auto-
 *     focused on region entry when autoFocusCommandInput is on.
 *   - Reactivity to stateManager:snapshotUpdated (re-renders on
 *     inventory / checkedLocations changes so accessibility flips
 *     immediately)
 *   - Item-on-discovery highlighting (lifts the existing module's
 *     <span class="item-name"> pattern)
 *   - Inventory display ("Your inventory: ...")
 *   - Message history (limit from settings)
 *   - Arrival message keyed off arrivedFrom.exit_id
 *   - Discovery mode integration
 *
 * v2 / deferred:
 *   - Custom-data prose templating
 *   - Standalone mode (load AP rules.json without procgen)
 *
 * The panel reads from the deserialized tile-grid world (same shape
 * the maze panel consumes): exits.Map, items.Map, obstacles.Map,
 * obstacleLib, itemLocationNames. Tile geometry is unused — exits
 * are addressed by exit_id, locations by world.itemLocationNames
 * (canonical AP location names baked in by the pipeline).
 */

import {
    setPanelInstance, consumePendingLoadRegion, getModuleApis,
    getTextAdventureSubstrateSettings, getCustomData,
    readPendingStandaloneRegion,
} from './index.js';
import { isObstacleCleared } from '../shared/procgen/library.js';
import stateManagerProxySingleton from '../stateManager/stateManagerProxySingleton.js';
import { getGameStateSingleton } from '../gameState/singleton.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';
import { evaluateRule } from '../shared/ruleEngine.js';
import { createSnapshotInterface } from '../shared/snapshotInterface.js';
import discoveryStateSingleton from '../discovery/singleton.js';
import { getDiscoverySettings } from '../discovery/index.js';
import { TextAdventurePlaybackController } from './textAdventureSubstratePlayback.js';
import { TextAdventureSubstrateParser } from './textAdventureSubstrateParser.js';
import {
    customRegionEnterMessage,
    customLocationCheckMessage,
    customLocationInaccessibleMessage,
    customLocationAlreadyCheckedMessage,
    customExitMoveMessage,
    customExitInaccessibleMessage,
} from './textAdventureSubstrateTemplating.js';
import { synthesizeStandaloneWorld } from './textAdventureSubstrateStandalone.js';
// Subscribe through the raw eventBus with an explicit module name —
// can't rely on this.apis.eventBus because Golden Layout may build
// the panel before this module's initialize() has run.
import eventBus from '../../app/core/eventBus.js';

// Compass words for each side. Used to render "Exit {direction} to ..."
const SIDE_TO_DIRECTION = Object.freeze({
    N: 'north', S: 'south', E: 'east', W: 'west',
});

// Cells of the 3×3 exits grid. N/E/S/W are the cardinals; C is the
// center cell, used for null-side exits (teleporters and unstitched
// edges).
const COMPASS_CELLS = Object.freeze(['N', 'E', 'S', 'W', 'C']);

// Lowercase letter that prefixes shorthand for each cell. Mirrors
// textAdventureSubstrateParser.SHORTHAND_RE.
const CELL_SHORTHAND_LETTER = Object.freeze({
    N: 'n', E: 'e', S: 's', W: 'w', C: 'c',
});

// Fallback used when the settings module hasn't loaded (headless tests).
const MESSAGE_HISTORY_LIMIT_FALLBACK = 10;

function currentMessageHistoryLimit() {
    const v = getTextAdventureSubstrateSettings?.()?.messageHistoryLimit;
    return Number.isFinite(v) && v > 0 ? v : MESSAGE_HISTORY_LIMIT_FALLBACK;
}

function currentAutoFocusCommandInput() {
    const v = getTextAdventureSubstrateSettings?.()?.autoFocusCommandInput;
    return v !== false; // default true
}

/**
 * Bucket exits by compass cell. exit.side ∈ {N,S,E,W} → that cell;
 * anything else (null, undefined, unknown) → 'C'. Order within each
 * cell is preserved from the input.
 *
 * Exported so tests can verify bucketing without DOM setup.
 */
export function groupExitsByCell(exits) {
    const cells = { N: [], E: [], S: [], W: [], C: [] };
    if (!exits) return cells;
    for (const exit of exits) {
        const cell = (exit && cells[exit.side]) ? exit.side : 'C';
        cells[cell].push(exit);
    }
    return cells;
}

/**
 * Shorthand label for the i-th exit in a compass cell. Drops the
 * digit when the cell holds exactly one exit; otherwise emits
 * `<letter><1-based-index>`. Returns `''` if `cellId` isn't a
 * known cell letter.
 */
export function formatExitShorthand(cellId, i, total) {
    const letter = CELL_SHORTHAND_LETTER[cellId];
    if (!letter) return '';
    if (total <= 1) return letter;
    return `${letter}${i + 1}`;
}

/**
 * Shorthand label for the i-th unchecked location. Drops the digit
 * when there's only one.
 */
export function formatLocationShorthand(i, total) {
    if (total <= 1) return 'l';
    return `l${i + 1}`;
}

/**
 * Shorthand label for the i-th exit in standalone-mode's flat list.
 * Always uses the `x` prefix (the parser's universal flat-exit
 * shorthand). Drops the digit when there's only one.
 */
export function formatFlatExitShorthand(i, total) {
    if (total <= 1) return 'x';
    return `x${i + 1}`;
}

// Coerce stateManager's snapshot.inventory ({ itemName: count }) into
// the Set<itemId> shape isObstacleCleared expects.
function inventoryFromSnapshot(snapshot) {
    if (!snapshot?.inventory) return new Set();
    const set = new Set();
    for (const [id, count] of Object.entries(snapshot.inventory)) {
        if (count > 0) set.add(id);
    }
    return set;
}

function checkedLocationsFromSnapshot(snapshot) {
    const v = snapshot?.checkedLocations;
    if (v instanceof Set) return v;
    if (Array.isArray(v)) return new Set(v);
    return new Set();
}

export class TextAdventureSubstrateUI {
    static moduleApis = null;
    static setModuleApis(apis) { TextAdventureSubstrateUI.moduleApis = apis; }

    constructor(container, _componentState) {
        this.container = container;
        this.world = null;
        this.currentRegionId = null;
        this.arrivedFromExitId = null;
        this.messageHistory = [];

        // Snapshot view; refreshed on stateManager:snapshotUpdated.
        this.inventory = new Set();
        this.checkedLocations = new Set();

        // Track the previous checked-locations set so we can detect new
        // discoveries between snapshots and trigger item-name
        // highlighting in the message history.
        this._previousCheckedLocations = new Set();

        // Discovery-mode filter state. When active, locations and
        // exits not in discoveryStateSingleton are hidden from the UI.
        // Mode flips via discovery:modeChanged; discovery state changes
        // (e.g. populated by another module) are observed via
        // discovery:changed. Initial state read at construction so we
        // don't miss the discovery module's own boot-time setup.
        this.discoveryModeActive = false;
        try {
            this.discoveryModeActive = !!getDiscoverySettings()?.enableDiscoveryMode;
        } catch {
            // Discovery module not loaded yet (headless tests); default off.
        }

        // Loop-mode tracking — flipped by loopUI:modeChanged. When loop
        // mode is active, the loops queue handles mana deduction, so the
        // substrate stays passive. When inactive, the substrate deducts
        // mana directly on observed location/region changes (Phase 4).
        this._isLoopModeActive = false;

        // Lazy cache of the loops module's costDataManager. Looked up via
        // centralRegistry on first read so module load order doesn't matter.
        this._costDataManager = null;

        // Guard DOM creation so the panel constructs cleanly in
        // headless test environments (vitest runs under 'node').
        if (typeof document !== 'undefined') {
            this.rootElement = document.createElement('div');
            this.rootElement.className = 'text-adventure-substrate-panel';
            this.rootElement.addEventListener('click', (e) => this._handleClick(e));
        } else {
            this.rootElement = null;
        }

        // Substrate-neutral playback controller exposed to the bot via
        // substrateRegistry.getPlaybackController. One per panel instance,
        // so the controller's clock dies with the panel.
        this._playbackController = new TextAdventurePlaybackController(this);

        // Command parser. Stateless; one per panel for symmetry with
        // playback controller.
        this._parser = new TextAdventureSubstrateParser();

        // Cached per-render context the parser shorthand resolves
        // against. Recomputed in render(); read by _handleSubmit.
        this._commandContext = { exitsBySide: { N: [], E: [], S: [], W: [], C: [] }, locations: [] };

        // Reference to the input element so applyLoadedRegion can
        // re-focus it after re-render. Set in _renderCommandInput.
        this._commandInputElement = null;

        setPanelInstance(this);

        // If textAdventure:loadRegion fired before this panel mounted,
        // index.js buffered the payload. Drain it now.
        const pending = consumePendingLoadRegion();
        if (pending) {
            this._adoptLoadedRegion(pending);
        }

        // Standalone-mode mount-after-rulesLoaded backfill: pull the
        // current region from gameState + staticData if the mode is
        // already known.
        const pendingStandalone = readPendingStandaloneRegion();
        if (pendingStandalone) {
            const world = synthesizeStandaloneWorld(pendingStandalone.regionData);
            if (world) {
                this._adoptLoadedRegion({
                    region_id: pendingStandalone.regionName,
                    world,
                    arrivedFrom: null,
                });
            }
        }

        this._subscribeToSnapshotUpdates();
        this._subscribeToDiscoveryEvents();
        this._subscribeToCustomDataEvents();
        this._subscribeToLoopMode();
        this._subscribeToManaChanges();
        this._subscribeToRegionChanges();
        this._subscribeToCostDataChanges();
        this.render();

        // The Golden Layout factory wrapper (frontend/app/layout/
        // desktopLayout.js:createGoldenLayoutComponentFactory) calls
        // getRootElement() and appends the returned node to its
        // container. Don't append here too — that would double-mount.
    }

    get apis() { return TextAdventureSubstrateUI.moduleApis || getModuleApis(); }

    getRootElement() { return this.rootElement; }

    getPlaybackController() { return this._playbackController; }

    _subscribeToSnapshotUpdates() {
        const handler = (data) => {
            const newChecked = checkedLocationsFromSnapshot(data?.snapshot);
            this.inventory = inventoryFromSnapshot(data?.snapshot);
            const oldChecked = this.checkedLocations;
            // Phase 4: deduct mana for newly-checked locations when the
            // current region has manaEnabled and loop mode is NOT active
            // (when active, the loops queue's _processFrame already
            // deducts and we'd otherwise double-bill).
            if (this._shouldDeductMana()) {
                const newlyChecked = [];
                for (const name of newChecked) {
                    if (!oldChecked.has(name)) newlyChecked.push(name);
                }
                if (newlyChecked.length > 0) {
                    this._deductLocationCheckMana(newlyChecked);
                }
            }
            this._previousCheckedLocations = oldChecked;
            this.checkedLocations = newChecked;
            this.render();
        };
        if (eventBus?.subscribe) {
            eventBus.subscribe('stateManager:snapshotUpdated', handler, 'textAdventureSubstrate');
            this._unsubSnapshot = () =>
                eventBus.unsubscribe?.('stateManager:snapshotUpdated', handler, 'textAdventureSubstrate');
        }
    }

    /**
     * Phase 4: subscribe to loop-mode toggle so the substrate knows
     * whether to deduct mana itself (loop mode off) or defer to the
     * loops queue's per-frame deduction (loop mode on).
     */
    _subscribeToLoopMode() {
        if (!eventBus?.subscribe) return;
        const handler = (data) => {
            this._isLoopModeActive = !!data?.active;
        };
        eventBus.subscribe('loopUI:modeChanged', handler, 'textAdventureSubstrate');
        this._unsubLoopMode = () =>
            eventBus.unsubscribe?.('loopUI:modeChanged', handler, 'textAdventureSubstrate');
    }

    /**
     * Re-render when mana changes so the panel header reflects the
     * latest values. Mana display is only shown when costDataManager
     * has cost data loaded.
     */
    _subscribeToManaChanges() {
        if (!eventBus?.subscribe) return;
        const handler = () => { this.render(); };
        eventBus.subscribe('gameState:manaChanged', handler, 'textAdventureSubstrate');
        this._unsubMana = () =>
            eventBus.unsubscribe?.('gameState:manaChanged', handler, 'textAdventureSubstrate');
    }

    /**
     * Phase 4: deduct the source region's moveCost when the player
     * leaves a manaEnabled region in non-loop-mode. Loop-mode active
     * region moves are handled by the loops queue.
     */
    _subscribeToRegionChanges() {
        if (!eventBus?.subscribe) return;
        const handler = (data) => {
            // The reset trigger dispatches a user:regionMove with
            // fromReset:true that ends up here too — skip the deduction
            // on the teleport-to-start transition.
            if (data?.fromReset) return;
            const oldRegion = data?.oldRegion;
            if (!oldRegion || oldRegion !== this.currentRegionId) return;
            if (!this._shouldDeductMana()) return;
            this._deductRegionMoveMana(oldRegion);
        };
        eventBus.subscribe('gameState:regionChanged', handler, 'textAdventureSubstrate');
        this._unsubRegionChange = () =>
            eventBus.unsubscribe?.('gameState:regionChanged', handler, 'textAdventureSubstrate');
    }

    /**
     * Re-render when cost data flips on/off so the mana readout in
     * the panel header appears as soon as costDataManager loads
     * (otherwise the first render captures isLoaded=false and the
     * mana readout never shows up until something else triggers a
     * render).
     */
    _subscribeToCostDataChanges() {
        if (!eventBus?.subscribe) return;
        const handler = () => {
            this._costDataManager = null; // invalidate lazy cache
            this.render();
        };
        eventBus.subscribe('costDataManager:loaded', handler, 'textAdventureSubstrate');
        eventBus.subscribe('costDataManager:cleared', handler, 'textAdventureSubstrate');
        this._unsubCostData = () => {
            eventBus.unsubscribe?.('costDataManager:loaded', handler, 'textAdventureSubstrate');
            eventBus.unsubscribe?.('costDataManager:cleared', handler, 'textAdventureSubstrate');
        };
    }

    /** True when this region has loop-mode mana hooks enabled and the
     *  loops queue isn't doing its own deduction. */
    _shouldDeductMana() {
        return !!this.world?.manaEnabled && !this._isLoopModeActive;
    }

    /** Lazily resolve the loops module's costDataManager via centralRegistry. */
    _getCostDataManager() {
        if (this._costDataManager) return this._costDataManager;
        try {
            const fn = centralRegistry.getPublicFunction?.('loops', 'getCostDataManager');
            this._costDataManager = fn?.() ?? null;
        } catch {
            this._costDataManager = null;
        }
        return this._costDataManager;
    }

    _getLocationCost(locationName) {
        const cdm = this._getCostDataManager();
        if (cdm?.isLoaded?.() && typeof cdm.getLocationCost === 'function') {
            const cost = cdm.getLocationCost(locationName);
            if (typeof cost === 'number') return cost;
        }
        return 10; // default
    }

    _getRegionMoveCost(regionName) {
        const cdm = this._getCostDataManager();
        if (cdm?.isLoaded?.() && typeof cdm.getRegionCost === 'function') {
            const cost = cdm.getRegionCost(regionName);
            if (typeof cost === 'number') return cost;
        }
        return 50; // default
    }

    _deductLocationCheckMana(locationNames) {
        const gs = getGameStateSingleton?.();
        if (!gs) return;
        for (const name of locationNames) {
            const cost = this._getLocationCost(name);
            gs.deductMana(cost);
            // Award XP equal to mana spent (matches loops _processFrame's
            // 1 XP : 1 mana ratio).
            if (this.currentRegionId) gs.addRegionXP(this.currentRegionId, cost);
            if (gs.getCurrentMana() <= 0) {
                this._fireLoopReset();
                return;
            }
        }
    }

    _deductRegionMoveMana(regionName) {
        const gs = getGameStateSingleton?.();
        if (!gs) return;
        const cost = this._getRegionMoveCost(regionName);
        gs.deductMana(cost);
        gs.addRegionXP(regionName, cost);
        if (gs.getCurrentMana() <= 0) {
            this._fireLoopReset();
        }
    }

    /**
     * Substrate-driven loop reset: refill mana, clear path, and
     * dispatch a user:regionMove (with fromReset:true / updatePath:false)
     * to the start region so procgenPlayer loads its payload and the
     * substrate's regionChanged handler skips its own deduction.
     *
     * Targets procgenPlayer's resolvedStartRegion (the first warehoused
     * region after the synthetic Menu wrapper) when available — Menu
     * itself has no playable payload, so dispatching to it would leave
     * the panel stuck on the old region. Falls back to the declared
     * start region for non-procgen flows.
     */
    _fireLoopReset() {
        const gs = getGameStateSingleton?.();
        const dispatcher = this.apis?.dispatcher;
        if (!gs) return;
        const startRegion = this._resolveStartRegion(gs);
        const sourceRegion = this.currentRegionId;
        gs.triggerLoopReset();
        if (startRegion && dispatcher?.publish) {
            dispatcher.publish('user:regionMove', {
                sourceRegion,
                targetRegion: startRegion,
                fromReset: true,
                updatePath: false,
            }, { initialTarget: 'bottom' });
        }
    }

    _resolveStartRegion(gs) {
        try {
            const fn = centralRegistry.getPublicFunction?.(
                'procgenPlayer', 'getResolvedStartRegion',
            );
            const resolved = fn?.();
            if (resolved) return resolved;
        } catch {
            // procgenPlayer not loaded (e.g. standalone TA); fall through.
        }
        return gs.startRegions?.[0] ?? null;
    }

    _subscribeToCustomDataEvents() {
        if (!eventBus?.subscribe) return;
        const onLoaded = () => { this.render(); };
        eventBus.subscribe('textAdventureSubstrate:customDataLoaded', onLoaded, 'textAdventureSubstrate');
        this._unsubCustomData = () =>
            eventBus.unsubscribe?.('textAdventureSubstrate:customDataLoaded', onLoaded, 'textAdventureSubstrate');
    }

    _subscribeToDiscoveryEvents() {
        if (!eventBus?.subscribe) return;
        const onModeChanged = (data) => {
            this.discoveryModeActive = !!data?.active;
            this.render();
        };
        const onDiscoveryChanged = () => {
            // Re-render when something gets discovered — e.g. another
            // module marked a location while the player wasn't looking.
            this.render();
        };
        eventBus.subscribe('discovery:modeChanged', onModeChanged, 'textAdventureSubstrate');
        eventBus.subscribe('discovery:changed', onDiscoveryChanged, 'textAdventureSubstrate');
        this._unsubDiscoveryMode = () =>
            eventBus.unsubscribe?.('discovery:modeChanged', onModeChanged, 'textAdventureSubstrate');
        this._unsubDiscoveryChanged = () =>
            eventBus.unsubscribe?.('discovery:changed', onDiscoveryChanged, 'textAdventureSubstrate');
    }

    /**
     * Mark every location and exit in the current region as discovered.
     * Text-adventure substrate semantics: walking into a region reveals
     * the whole region. Idempotent — discoveryStateSingleton's
     * mutators no-op when already discovered.
     */
    _discoverEverythingInRegion() {
        if (!this.world || !this.currentRegionId) return;
        if (!discoveryStateSingleton) return;
        // Locations: keyed by AP-canonical name baked into world.itemLocationNames
        // by the pipeline at serialization time.
        if (this.world.itemLocationNames) {
            for (const locationName of this.world.itemLocationNames.values()) {
                if (locationName) discoveryStateSingleton.discoverLocation?.(locationName);
            }
        }
        // Exits: keyed by exitName on each entry. The region itself
        // is also marked via discoverExit's internal cascade.
        if (this.world.exits) {
            for (const exit of this.world.exits.values()) {
                const name = exit.exitName ?? exit.exit_id;
                if (name) discoveryStateSingleton.discoverExit?.(this.currentRegionId, name);
            }
        }
    }

    /**
     * Apply a region payload published via textAdventure:loadRegion.
     * Called by the module-level handler when this panel is mounted,
     * and via the constructor on initial mount with any buffered
     * payload.
     */
    applyLoadedRegion(payload) {
        this._adoptLoadedRegion(payload);
        this.render();
        if (currentAutoFocusCommandInput()) {
            this._commandInputElement?.focus?.();
        }
    }

    /**
     * Standalone-mode entry point. Mirrors applyLoadedRegion but
     * synthesises the world from raw AP region data
     * (`staticData.regions.get(regionName)`) instead of consuming a
     * procgen sidecar payload.
     */
    applyStandaloneRegion(regionName, regionData, _oldRegionName) {
        const world = synthesizeStandaloneWorld(regionData);
        if (!world) return;
        this._adoptLoadedRegion({
            region_id: regionName,
            world,
            // gameState:regionChanged doesn't carry an exit name, so
            // arrival messages fall through to the generic / custom
            // form without per-direction context.
            arrivedFrom: null,
        });
        this.render();
        if (currentAutoFocusCommandInput()) {
            this._commandInputElement?.focus?.();
        }
    }

    _adoptLoadedRegion(payload) {
        // Payload shape (per procgen-player.md §"Event flow"):
        //   { region_id, world, arrivedFrom }
        this.world = payload?.world ?? null;
        this.currentRegionId = payload?.region_id ?? null;
        this.arrivedFromExitId = payload?.arrivedFrom?.exit_id ?? null;

        // Refresh state view eagerly so the first render after a
        // region change reflects current inventory / checked locations
        // even if no snapshotUpdated event has arrived yet.
        const snapshot = stateManagerProxySingleton?.getSnapshot?.();
        this.inventory = inventoryFromSnapshot(snapshot);
        this.checkedLocations = checkedLocationsFromSnapshot(snapshot);
        this._previousCheckedLocations = new Set(this.checkedLocations);

        // Text-adventure semantics: entering a region reveals its
        // entire contents. Discovery mode (the UI filter) only
        // affects rendering — the discovery state grows on entry
        // either way.
        this._discoverEverythingInRegion();

        this._addMessage(this._arrivalMessage());
    }

    _arrivalMessage() {
        if (!this.currentRegionId) return '';

        // Custom data takes precedence: when an enterMessage exists for
        // this region, it replaces the generic arrival prose entirely
        // (the source-region / direction context is exposed as template
        // vars for the author to use or ignore).
        const arrivalExit = this.arrivedFromExitId
            ? this.world?.exits?.get(this.arrivedFromExitId) ?? null
            : null;
        const direction = arrivalExit ? SIDE_TO_DIRECTION[arrivalExit.side] : null;
        const sourceRegion = arrivalExit?.targetRegion ?? null;

        const custom = customRegionEnterMessage(getCustomData(), this.currentRegionId, {
            direction: direction ?? '',
            sourceRegion: sourceRegion ?? '',
        });
        if (custom) return custom;

        if (!arrivalExit) {
            return `You are now in ${this.currentRegionId}.`;
        }
        // The arrival exit is the exit IN THIS REGION that points back
        // to where the player came from. Its `side` is the wall that
        // exit sits on, so the player arrived from THAT direction
        // — not the opposite. Standing facing inward at the east
        // wall means you arrived from the east.
        if (!direction) {
            return `You arrive in ${this.currentRegionId} from ${arrivalExit.targetRegion ?? 'elsewhere'}.`;
        }
        if (sourceRegion) {
            return `You arrive in ${this.currentRegionId} from ${sourceRegion} (to the ${direction}).`;
        }
        return `You arrive in ${this.currentRegionId} from the ${direction}.`;
    }

    // --- Accessibility lookups ---

    _ruleEvaluator() {
        const snapshot = stateManagerProxySingleton?.getSnapshot?.();
        const staticData = stateManagerProxySingleton?.getStaticData?.();
        if (!snapshot || !staticData) return null;
        const snapshotInterface = createSnapshotInterface(snapshot, staticData);
        return (rule) => evaluateRule(rule, snapshotInterface);
    }

    _isObstacleAtCleared(x, y) {
        const obstacleId = this.world?.obstacles?.get(`${x},${y}`);
        if (!obstacleId) return true; // no gate → trivially open
        const evaluateRuleObstacle = this._ruleEvaluator();
        return isObstacleCleared(obstacleId, this.inventory, this.world.obstacleLib, {
            evaluateRule: evaluateRuleObstacle,
        });
    }

    _evaluateAccessRule(rule) {
        if (rule == null) return true;
        const evaluator = this._ruleEvaluator();
        if (!evaluator) return true;
        try { return !!evaluator(rule); }
        catch { return false; }
    }

    _isExitOpen(exit) {
        // Standalone exits carry an access_rule directly. Procgen exits
        // store their gate as an obstacle at the exit's tile coord.
        if (exit?.access_rule !== undefined) {
            return this._evaluateAccessRule(exit.access_rule);
        }
        return this._isObstacleAtCleared(exit.x, exit.y);
    }

    _isLocationOpen(itemPosKey) {
        // Standalone locations are keyed by `loc:<i>`; their access
        // rule lives on world.locationAccessRules, looked up by
        // location name.
        if (this.world?.mode === 'standalone') {
            const locationName = this.world.itemLocationNames?.get(itemPosKey);
            const rule = this.world.locationAccessRules?.get(locationName);
            return this._evaluateAccessRule(rule);
        }
        const [x, y] = itemPosKey.split(',').map(Number);
        return this._isObstacleAtCleared(x, y);
    }

    // --- Rendering ---

    render() {
        // Always rebuild context so the parser shorthand stays current,
        // even in headless tests where the DOM render path bails out.
        this._commandContext = this._buildCommandContext();

        if (!this.rootElement) return;

        // Preserve the command input's value + focus across renders.
        // Snapshot updates re-render the whole panel; without this,
        // pressing Enter mid-region would lose focus to the body and
        // any in-progress typing would be wiped on the next snapshot.
        const prevInput = this._commandInputElement;
        const preservedValue = prevInput?.value ?? '';
        const preservedSelectionStart = prevInput?.selectionStart ?? null;
        const preservedSelectionEnd = prevInput?.selectionEnd ?? null;
        const preservedFocus =
            typeof document !== 'undefined'
            && prevInput
            && document.activeElement === prevInput;

        this.rootElement.innerHTML = '';
        this._commandInputElement = null;

        if (!this.world || !this.currentRegionId) {
            const placeholder = document.createElement('div');
            placeholder.className = 'text-adventure-placeholder';
            placeholder.textContent = 'Waiting for region…';
            this.rootElement.appendChild(placeholder);
            return;
        }

        this.rootElement.appendChild(this._renderHeading());

        const locationsSection = this._renderLocations();
        if (locationsSection) this.rootElement.appendChild(locationsSection);

        const exitsSection = this._renderExits();
        if (exitsSection) this.rootElement.appendChild(exitsSection);

        this.rootElement.appendChild(this._renderInventory());
        this.rootElement.appendChild(this._renderMessageHistory());
        this.rootElement.appendChild(this._renderCommandInput());

        // Restore the input's volatile state on the new element. Focus
        // restored last so caret position survives the focus call.
        if (this._commandInputElement) {
            if (preservedValue) {
                this._commandInputElement.value = preservedValue;
            }
            if (preservedFocus) {
                this._commandInputElement.focus?.();
                if (preservedSelectionStart !== null && preservedSelectionEnd !== null) {
                    try {
                        this._commandInputElement.setSelectionRange(
                            preservedSelectionStart, preservedSelectionEnd,
                        );
                    } catch {
                        // Some input types reject setSelectionRange; not fatal.
                    }
                }
            }
        }
    }

    /**
     * Build the per-render context the parser shorthand resolves
     * against — same enumeration the cell labels use, so a label like
     * `[n2]` always matches what `n2` typed into the input would do.
     *
     * Filters by the same visibility rules as the renderers
     * (discovery mode for exits and locations; checkedLocations
     * removes already-searched entries from the locations list, since
     * the renderer surfaces those separately).
     */
    _buildCommandContext() {
        const ctx = {
            exitsBySide: { N: [], E: [], S: [], W: [], C: [] },
            locations: [],
        };
        if (!this.world) return ctx;

        if (this.world.exits) {
            // Standalone has no compass; all exits sit in the C bucket
            // so `c<n>` and `x<n>` (flat, N→E→S→W→C) both resolve them.
            const isStandalone = this.world.mode === 'standalone';
            for (const exit of this.world.exits.values()) {
                if (!this._isExitVisibleToUI(exit)) continue;
                let cell = 'C';
                if (!isStandalone) {
                    cell = ctx.exitsBySide[exit?.side] ? exit.side : 'C';
                }
                ctx.exitsBySide[cell].push(exit);
            }
        }

        if (this.world.items && this.world.itemLocationNames) {
            for (const [posKey, itemId] of this.world.items) {
                const locationName = this.world.itemLocationNames.get(posKey);
                if (!locationName) continue;
                if (!this._isLocationVisibleToUI(locationName)) continue;
                if (this.checkedLocations.has(locationName)) continue;
                ctx.locations.push({ posKey, itemId, locationName });
            }
        }

        return ctx;
    }

    _renderHeading() {
        // Wrap the region name + (optional) mana readout in a header
        // container so they sit side-by-side with consistent styling.
        const wrap = document.createElement('div');
        wrap.className = 'text-adventure-heading';

        const heading = document.createElement('h2');
        heading.className = 'text-adventure-region-name';
        heading.textContent = this.currentRegionId;
        wrap.appendChild(heading);

        // Mana readout (Phase 4): visible whenever the loops module's
        // cost data is loaded — the player always sees their resource,
        // whether or not this particular region has manaEnabled.
        const cdm = this._getCostDataManager();
        if (cdm?.isLoaded?.()) {
            const gs = getGameStateSingleton?.();
            if (gs) {
                const manaEl = document.createElement('span');
                manaEl.className = 'text-adventure-mana';
                const cur = gs.getCurrentMana?.() ?? 0;
                const max = gs.getMaxMana?.() ?? 0;
                manaEl.textContent = `mana: ${cur.toFixed(1)} / ${max.toFixed(1)}`;
                wrap.appendChild(manaEl);
            }
        }

        return wrap;
    }

    _renderExits() {
        if (!this.world?.exits || this.world.exits.size === 0) return null;

        if (this.world.mode === 'standalone') {
            return this._renderExitsFlat();
        }

        const cells = this._commandContext.exitsBySide;
        const totalVisible = COMPASS_CELLS.reduce(
            (n, c) => n + (cells[c]?.length ?? 0), 0,
        );
        if (totalVisible === 0) return null;

        const section = document.createElement('div');
        section.className = 'text-adventure-section text-adventure-exits';

        const label = document.createElement('div');
        label.className = 'text-adventure-section-label';
        label.textContent = 'Exits';
        section.appendChild(label);

        const grid = document.createElement('div');
        grid.className = 'text-adventure-exits-grid';
        for (const cellId of COMPASS_CELLS) {
            const cellDiv = document.createElement('div');
            cellDiv.className =
                `text-adventure-exits-cell text-adventure-exits-cell-${cellId.toLowerCase()}`;
            const list = cells[cellId];
            list.forEach((exit, i) => {
                const shorthand = formatExitShorthand(cellId, i, list.length);
                cellDiv.appendChild(this._renderExitLink(exit, shorthand));
            });
            grid.appendChild(cellDiv);
        }
        section.appendChild(grid);
        return section;
    }

    /**
     * Standalone-mode exit renderer. No compass grid — exits go in
     * a flat vertical list, prefixed with the universal `[x<n>]`
     * shorthand. Drops the digit when there's only one exit.
     */
    _renderExitsFlat() {
        // Standalone files all exits into the C bucket; iterate
        // through every cell anyway in case future code paths put
        // them elsewhere.
        const cells = this._commandContext.exitsBySide;
        const flat = [];
        for (const cellId of COMPASS_CELLS) {
            for (const exit of cells[cellId] ?? []) flat.push(exit);
        }
        if (flat.length === 0) return null;

        const section = document.createElement('div');
        section.className = 'text-adventure-section text-adventure-exits text-adventure-exits-flat';

        const label = document.createElement('div');
        label.className = 'text-adventure-section-label';
        label.textContent = 'Exits';
        section.appendChild(label);

        const list = document.createElement('div');
        list.className = 'text-adventure-exits-list';
        flat.forEach((exit, i) => {
            const shorthand = formatFlatExitShorthand(i, flat.length);
            list.appendChild(this._renderExitLink(exit, shorthand));
        });
        section.appendChild(list);
        return section;
    }

    _isExitVisibleToUI(exit) {
        if (!this.discoveryModeActive) return true;
        if (!discoveryStateSingleton || !this.currentRegionId) return true;
        const name = exit.exitName ?? exit.exit_id;
        return discoveryStateSingleton.isExitDiscovered?.(this.currentRegionId, name) ?? true;
    }

    _isLocationVisibleToUI(locationName) {
        if (!this.discoveryModeActive) return true;
        if (!discoveryStateSingleton || !locationName) return true;
        return discoveryStateSingleton.isLocationDiscovered?.(locationName) ?? true;
    }

    _renderExitLink(exit, shorthand) {
        const accessible = this._isExitOpen(exit);
        const direction = SIDE_TO_DIRECTION[exit.side];
        const target = exit.targetRegion ?? '???';
        const body = direction
            ? `Exit ${direction} to ${target}`
            : `Exit to ${target}`;
        const label = shorthand ? `[${shorthand}] ${body}` : body;

        const span = document.createElement('span');
        span.className = `text-adventure-link ${accessible ? 'accessible' : 'inaccessible'}`;
        span.dataset.kind = 'exit';
        span.dataset.exitId = exit.exit_id;
        span.textContent = label;
        return span;
    }

    _renderLocations() {
        if (!this.world?.items || this.world.items.size === 0) return null;

        // Unchecked locations come from the command context (already
        // visibility-filtered + checked-filtered, in stable order so
        // the shorthand indices match what the parser sees).
        const unchecked = this._commandContext.locations;

        // Already-searched are derived inline since the context
        // intentionally omits them.
        const checked = [];
        for (const [posKey, itemId] of this.world.items) {
            const locationName = this.world.itemLocationNames?.get(posKey);
            if (!locationName) continue;
            if (!this._isLocationVisibleToUI(locationName)) continue;
            if (this.checkedLocations.has(locationName)) {
                checked.push({ posKey, itemId, locationName });
            }
        }

        if (unchecked.length === 0 && checked.length === 0) return null;

        const section = document.createElement('div');
        section.className = 'text-adventure-section text-adventure-locations';

        if (unchecked.length > 0) {
            const label = document.createElement('div');
            label.className = 'text-adventure-section-label';
            label.textContent = 'You can search';
            section.appendChild(label);

            const list = document.createElement('div');
            unchecked.forEach((entry, i) => {
                const shorthand = formatLocationShorthand(i, unchecked.length);
                list.appendChild(this._renderLocationLink(entry, shorthand));
                list.appendChild(document.createTextNode(' '));
            });
            section.appendChild(list);
        }

        if (checked.length > 0) {
            const label = document.createElement('div');
            label.className = 'text-adventure-section-label';
            label.textContent = 'Already searched';
            section.appendChild(label);

            const list = document.createElement('div');
            list.textContent = checked.map((e) => e.locationName).join(', ');
            section.appendChild(list);
        }

        return section;
    }

    _renderLocationLink(entry, shorthand) {
        const accessible = this._isLocationOpen(entry.posKey);
        const span = document.createElement('span');
        span.className = `text-adventure-link ${accessible ? 'accessible' : 'inaccessible'}`;
        span.dataset.kind = 'location';
        span.dataset.locationName = entry.locationName;
        span.textContent = shorthand ? `[${shorthand}] ${entry.locationName}` : entry.locationName;
        return span;
    }

    _renderInventory() {
        const section = document.createElement('div');
        section.className = 'text-adventure-section text-adventure-inventory';

        const label = document.createElement('div');
        label.className = 'text-adventure-section-label';
        label.textContent = 'Inventory';
        section.appendChild(label);

        const list = document.createElement('div');
        if (this.inventory.size === 0) {
            list.textContent = 'empty';
        } else {
            list.textContent = [...this.inventory].sort().join(', ');
        }
        section.appendChild(list);
        return section;
    }

    _renderMessageHistory() {
        const section = document.createElement('div');
        section.className = 'text-adventure-message-history';
        for (const entry of this.messageHistory) {
            const div = document.createElement('div');
            div.className = 'text-adventure-message';
            div.innerHTML = entry.html;
            section.appendChild(div);
        }
        return section;
    }

    _renderCommandInput() {
        const form = document.createElement('form');
        form.className = 'text-adventure-command-form';
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const value = this._commandInputElement?.value ?? '';
            this._handleSubmit(value);
        });

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'text-adventure-command-input';
        input.placeholder = 'Type a command (n, s, l1, "help", …) and press Enter';
        input.autocomplete = 'off';
        input.spellcheck = false;
        form.appendChild(input);

        this._commandInputElement = input;
        return form;
    }

    // --- Command input ---

    /**
     * Parse a typed command and dispatch the resulting action. Public
     * (sans underscore) entry points are kept underscore-private —
     * tests reach in via the panel instance directly, mirroring how
     * existing tests call _onExitClick / _onLocationClick.
     */
    _handleSubmit(rawValue) {
        const value = String(rawValue ?? '');
        if (!value.trim()) return;

        const result = this._parser.parseCommand(value, this._commandContext);

        if (this._commandInputElement) {
            this._commandInputElement.value = '';
            this._commandInputElement.focus?.();
        }

        switch (result?.type) {
            case 'move': {
                const exit = this._findExitByName(result.target);
                if (!exit) {
                    this._addMessage(`No exit named "${result.target}" in this region.`);
                    return;
                }
                this._onExitClick(exit.exit_id);
                return;
            }
            case 'check': {
                this._onLocationClick(result.target);
                return;
            }
            case 'inventory': {
                const inv = this.inventory.size === 0
                    ? 'empty'
                    : [...this.inventory].sort().join(', ');
                this._addMessage(`Your inventory: ${inv}`);
                return;
            }
            case 'help': {
                this._addMessage(this._parser.getHelpText());
                return;
            }
            case 'look': {
                // Silent no-op, matching the panel's "look does nothing" decision.
                return;
            }
            case 'error': {
                this._addMessage(result.message ?? 'Unrecognized command.');
                return;
            }
            default: {
                this._addMessage('Unrecognized command.');
            }
        }
    }

    /**
     * Look up an exit by exitName (preferred) or exit_id (fallback).
     * The parser returns `target` set to whichever the exit carries.
     */
    _findExitByName(name) {
        if (!name || !this.world?.exits) return null;
        for (const exit of this.world.exits.values()) {
            if (exit.exitName === name || exit.exit_id === name) return exit;
        }
        return null;
    }

    // --- Click handling ---

    _handleClick(event) {
        const target = event.target?.closest('[data-kind]');
        if (!target) return;
        const kind = target.dataset.kind;
        if (kind === 'exit') {
            this._onExitClick(target.dataset.exitId);
        } else if (kind === 'location') {
            this._onLocationClick(target.dataset.locationName);
        }
    }

    _onExitClick(exitId) {
        const exit = this.world?.exits?.get(exitId);
        if (!exit || !exit.targetRegion) return;
        const exitName = exit.exitName ?? exit.exit_id;
        const direction = SIDE_TO_DIRECTION[exit.side];

        if (!this._isExitOpen(exit)) {
            const custom = customExitInaccessibleMessage(getCustomData(), exitName, {
                direction: direction ?? '',
                destinationRegion: exit.targetRegion,
            });
            if (custom) {
                this._addMessageHtml(custom);
            } else {
                const dirText = direction ? ` ${direction}` : '';
                this._addMessage(`The exit${dirText} to ${exit.targetRegion} is blocked.`);
            }
            return;
        }

        // Optional pre-transition move message. The substrate didn't
        // emit any text on a successful exit before custom-data; the
        // arrival message in the destination region is the only
        // narration. With custom data we can opt in to a short "you
        // travel through ..." line in the message history before the
        // transition fires.
        const move = customExitMoveMessage(getCustomData(), exitName, {
            direction: direction ?? '',
            destinationRegion: exit.targetRegion,
        });
        if (move) this._addMessageHtml(move);

        const dispatcher = this.apis?.dispatcher;
        if (!dispatcher?.publish) return;
        dispatcher.publish('user:regionMove', {
            sourceRegion: this.currentRegionId,
            targetRegion: exit.targetRegion,
            exitName,
        }, { initialTarget: 'bottom' });
    }

    _onLocationClick(locationName) {
        if (!locationName) return;
        const customData = getCustomData();

        if (this.checkedLocations.has(locationName)) {
            const custom = customLocationAlreadyCheckedMessage(customData, locationName);
            if (custom) this._addMessageHtml(custom);
            else this._addMessage(`You have already searched ${locationName}.`);
            return;
        }
        // Find the location's tile to verify accessibility.
        let posKey = null;
        let itemId = null;
        if (this.world?.itemLocationNames) {
            for (const [k, name] of this.world.itemLocationNames) {
                if (name === locationName) {
                    posKey = k;
                    itemId = this.world.items?.get(k);
                    break;
                }
            }
        }
        if (posKey && !this._isLocationOpen(posKey)) {
            const custom = customLocationInaccessibleMessage(customData, locationName);
            if (custom) this._addMessageHtml(custom);
            else this._addMessage(`You cannot reach ${locationName} from here.`);
            return;
        }

        const dispatcher = this.apis?.dispatcher;
        if (!dispatcher?.publish) return;
        dispatcher.publish('user:locationCheck', {
            locationName,
            regionName: this.currentRegionId,
        }, { initialTarget: 'bottom' });

        // Optimistic discovery message: stateManager will dispatch
        // back via snapshotUpdated, and that's when the panel re-renders
        // with the location moved into "Already searched". The message
        // is added eagerly so the player sees feedback even if the
        // snapshot pipeline is asynchronous.
        const custom = customLocationCheckMessage(customData, locationName, {
            item: itemId ?? '',
            wasUnchecked: true,
        });
        if (custom) {
            this._addMessageHtml(custom);
        } else {
            const itemHtml = itemId
                ? `<span class="item-name">${escapeHtml(itemId)}</span>`
                : 'something';
            this._addMessageHtml(`You search ${escapeHtml(locationName)} and find ${itemHtml}.`);
        }
    }

    // --- Messages ---

    /** Add a plain-text message; HTML is escaped before display. */
    _addMessage(text) {
        if (!text) return;
        this._pushMessage(escapeHtml(text));
    }

    /**
     * Add an HTML-pre-formatted message. Caller is responsible for
     * escaping any user-controlled fields (location names, etc.); only
     * trusted markup (e.g. `<span class="item-name">…</span>`) should
     * be passed unescaped.
     */
    _addMessageHtml(html) {
        if (!html) return;
        this._pushMessage(html);
    }

    _pushMessage(html) {
        this.messageHistory.push({ html, timestamp: Date.now() });
        const limit = currentMessageHistoryLimit();
        while (this.messageHistory.length > limit) {
            this.messageHistory.shift();
        }
    }

    destroy() {
        if (this._unsubSnapshot) { this._unsubSnapshot(); this._unsubSnapshot = null; }
        if (this._unsubDiscoveryMode) { this._unsubDiscoveryMode(); this._unsubDiscoveryMode = null; }
        if (this._unsubDiscoveryChanged) { this._unsubDiscoveryChanged(); this._unsubDiscoveryChanged = null; }
        if (this._unsubCustomData) { this._unsubCustomData(); this._unsubCustomData = null; }
        if (this._playbackController) { this._playbackController.reset(); this._playbackController = null; }
        this.rootElement = null;
        this.world = null;
    }
}

// Minimal HTML-escape for messages we render via innerHTML. Shows up
// when the only HTML content is the item-name highlight span we
// inject ourselves; everything else (location names, region names)
// must be escaped because they come from rules.json.
function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
