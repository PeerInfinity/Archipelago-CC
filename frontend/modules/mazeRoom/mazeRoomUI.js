/**
 * mazeRoom UI panel — generator controls + canvas renderer + keyboard
 * play for the walls-only maze. The engine (mazeRoomEngine.js) is
 * headless; this file is the thin DOM wrapper over it.
 */

import { setPanelInstance, getModuleApis, consumePendingLoadRegion } from './index.js';
import {
    TILE_WALL,
    INPUT_N, INPUT_S, INPUT_E, INPUT_W,
    createState,
    getTile,
    getObstacle, getItem,
    step,
    detectStepEvents,
    generateMaze,
    extractPathsAndObstacles,
    isExit,
} from './mazeRoomEngine.js';
import {
    DEFAULT_ITEMS, DEFAULT_OBSTACLES,
    isObstacleCleared, getItemRenderHints,
} from '../shared/procgen/library.js';
import { compileRegion } from '../shared/procgen/pathsAndObstaclesCompiler.js';
import stateManagerProxySingleton from '../stateManager/stateManagerProxySingleton.js';
import { evaluateRule } from '../shared/ruleEngine.js';
import { createSnapshotInterface } from '../shared/snapshotInterface.js';
import discoveryStateSingleton from '../discovery/singleton.js';
import { getDiscoverySettings } from '../discovery/index.js';
// Imported directly so the panel can subscribe even when its
// constructor runs before its module's initialize() (Golden Layout
// may build panels during its own init, ahead of module init — at
// which point `this.apis.eventBus` is still null).
import eventBus from '../../app/core/eventBus.js';
import { PlaybackControlBar } from '../shared/playbackControlBar.js';
import { MazeRoomEditor, PALETTE_ENTRIES, PALETTE_TYPES } from './mazeRoomEditor.js';
import { MazeRoomVisualizer } from './mazeRoomVisualizer.js';
import { BIOMES, DEFAULT_BIOME_ID } from './mazeRoomBiomeLibrary.js';
import { getGameStateSingleton } from '../gameState/singleton.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';
import { applyRegionXpCostEffect } from '../loops/xpFormulas.js';
import { bestPathKey, findPath, stepsToActions } from './mazeAutopather.js';
import {
    MazeRoomQueue,
    ACTION_MOVE,
    ACTION_WAIT,
    ACTION_LOCATION_CHECK,
} from './mazeRoomQueue.js';

// stateManager's snapshot.inventory is a plain object { itemName: count }.
// Convert to a Set of item ids that the player currently holds (count > 0)
// — that's what step() and the rendering code want.
function inventoryFromSnapshot(snapshot) {
    if (!snapshot || !snapshot.inventory) return new Set();
    const set = new Set();
    for (const [id, count] of Object.entries(snapshot.inventory)) {
        if (count > 0) set.add(id);
    }
    return set;
}

// Snapshot's checkedLocations is a Set in some code paths, an Array
// in others (depends on how the snapshot was constructed). Normalise
// to a Set for fast membership testing during render.
function checkedLocationsFromSnapshot(snapshot) {
    const v = snapshot?.checkedLocations;
    if (v instanceof Set) return v;
    if (Array.isArray(v)) return new Set(v);
    return new Set();
}

const LS_KEY = 'mazeRoom_params';
// Display / view settings stored separately from generation params,
// so existing saved params don't need a shape migration. Currently
// just the fog-of-war toggle.
const LS_VIEW_KEY = 'mazeRoom_view';

const DEFAULT_PARAMS = {
    seed: 1,
    width: 16,
    height: 12,
    maxIterations: 2000,
    stallLimit: 200,
    biomeId: DEFAULT_BIOME_ID,
};

const TILE_PX = 20;
const COLORS = {
    floor: '#2a2a2a',
    wall: '#000000',
    // §5 tile-rendering rules:
    // - Entrance: 2px solid green border
    // - Exit (no gate / open gate): solid green fill
    // - Exit (closed gate): solid red fill
    // - Location (closed gate): item sprite + 2px solid red border
    // - Both entrance and exit: follow the exit row
    entrance: '#3aa85a',
    exit: '#3aa85a',
    exitBlocked: '#d04040',
    locationBlocked: '#d04040',
    player: '#4aa8ff',
    grid: '#1a1a1a',
};

// Maps DOM key strings to queue action specs. Queue verbs are the
// substrate-neutral representation; the move executor translates
// dir→engine input via MOVE_DIR_TO_INPUT.
const KEY_MAP = {
    ArrowUp:    { type: ACTION_MOVE, dir: 'N' },
    w:          { type: ACTION_MOVE, dir: 'N' },
    W:          { type: ACTION_MOVE, dir: 'N' },
    ArrowDown:  { type: ACTION_MOVE, dir: 'S' },
    s:          { type: ACTION_MOVE, dir: 'S' },
    S:          { type: ACTION_MOVE, dir: 'S' },
    ArrowLeft:  { type: ACTION_MOVE, dir: 'W' },
    a:          { type: ACTION_MOVE, dir: 'W' },
    A:          { type: ACTION_MOVE, dir: 'W' },
    ArrowRight: { type: ACTION_MOVE, dir: 'E' },
    d:          { type: ACTION_MOVE, dir: 'E' },
    D:          { type: ACTION_MOVE, dir: 'E' },
    ' ':        { type: ACTION_WAIT },
};

const MOVE_DIR_TO_INPUT = {
    N: INPUT_N,
    S: INPUT_S,
    E: INPUT_E,
    W: INPUT_W,
};

export class MazeRoomUI {
    static moduleApis = null;
    static setModuleApis(apis) { MazeRoomUI.moduleApis = apis; }

    constructor(container, componentState) {
        this.container = container;
        this.params = { ...DEFAULT_PARAMS };
        this.world = null;
        this.state = null;
        this.stats = null;
        this.isGenerating = false;
        this.message = '';

        // Inventory truth in playback mode (after a maze:loadRegion).
        // null means we're in the standalone "Generate" dev flow and
        // the panel should fall back to state.inventory — which step()
        // continues to maintain in that mode (see mazeRoomEngine.js
        // step's inventoryOverride contract).
        this.externalInventory = null;
        // Per-location pickup truth in playback mode. Tracks which
        // AP-canonical location names have been checked, so the
        // renderer can hide the item sprite for THIS tile when it's
        // checked without hiding sprites for other tiles that hold
        // the same item id. (Adventure has 12 Freeincarnate locations
        // — using inventory as a proxy for "collected" makes them all
        // disappear after the first pickup.)
        this.externalCheckedLocations = null;
        // AP-canonical region name for the currently-loaded region.
        // Set in playback mode; null in Generate dev flow. Used as
        // sourceRegion / regionName when publishing dispatcher events.
        this.currentRegionId = null;
        this._unsubSnapshot = null;

        // Discovery-mode UI filter. When active, undiscovered exits
        // skip their green/red fill and undiscovered locations skip
        // their item sprite. Discovery state populates on region
        // entry when fog of war is OFF (matches the text-adventure
        // substrate); when fog is ON, discoveries fire per-tile as
        // the player explores.
        this.discoveryModeActive = false;
        try {
            this.discoveryModeActive = !!getDiscoverySettings()?.enableDiscoveryMode;
        } catch {
            // Discovery module not loaded yet; default off.
        }
        this._unsubDiscoveryMode = null;
        this._unsubDiscoveryChanged = null;

        // Loop-mode tracking (Phase 3). Mirrors the textAdventure
        // substrate pattern: when loop mode is active, the loops queue
        // handles mana deduction; this panel stays passive. When loop
        // mode is inactive AND world.manaEnabled is set, the panel
        // deducts per-tile mana on each step via gameState.deductMana.
        this._isLoopModeActive = false;
        this._costDataManager = null; // lazy via centralRegistry
        this._unsubLoopMode = null;
        this._unsubManaChanged = null;

        // Phase 6: substrate-handled completion. Non-null while the
        // panel is walking through a loops queue action's autopath via
        // the visualizer. Signals to dispatched events that they
        // should carry fromLoop:true so gameState skips a duplicate
        // path entry (the queue already has the original).
        this._loopsDrivenAction = null;
        this._unsubLoopsBegan = null;

        // Playback control bar — Phase 1.3 stub mount. Actions log to
        // the console for now; Phase 3 wires them to the visualizer.
        // The bar instance lives across renders; render() re-appends
        // its element after clearing the panel's innerHTML.
        this._playbackBar = null;

        // Tile editor — Phase 2. Edit mode persists to mazeRoom_view
        // alongside fog. When enabled, the panel renders a palette
        // and attaches a click handler to the canvas. The verifier
        // section reports rules.json-shaped access rules computed from
        // the current world; auto-runs after each edit.
        this.editMode = false;
        this._editor = null;
        this._editorMessage = '';
        this._verifierResult = null;

        // Playthrough visualizer — Phase 3. Owns its own clock, state
        // and step log. Publishes playback:snapshotUpdated for opt-in
        // subscribers (this panel itself, for inventory display) and
        // does NOT touch stateManager. The instance lives across
        // renders; setWorld is called from _adoptLoadedRegion.
        this._visualizer = new MazeRoomVisualizer({
            eventBus,
            onStateChange: () => this._onVisualizerChange(),
            onExitCross: (exit, sourceRegion) => this._onVisualizerExitCross(exit, sourceRegion),
            onLocationCheck: (locationName, itemId, regionId) =>
                this._onVisualizerLocationCheck(locationName, itemId, regionId),
        });

        // Tile-level action queue (Cavernous-2-style). Player keydowns
        // route through this rather than calling step() directly. The
        // executor is bound here so the queue can run actions
        // synchronously; the UI re-renders after each handleInput in
        // _handleKeydown. Cleared on region transitions. See
        // NewDocs/plans/procedural-generation/maze-content-modules.md.
        this._mazeQueue = new MazeRoomQueue({
            executor: (action) => this._executeQueueAction(action),
        });

        // Replay driver state. Non-null while a saved best-queue is
        // being replayed; holds the setInterval handle so direct input
        // can cancel it cleanly.
        this._replayDriver = null;
        this._replayTickMs = 200;

        // Direct-walk recording state. Populated on region entry (when
        // manaEnabled), accumulated by the per-tile mana deduction and
        // pickup events, consumed when the player reaches an exit or
        // checks a location via direct keyboard play. Distinct from
        // _loopsDrivenSteps which tracks the visualizer-driven walks.
        this._directWalkCost = 0;
        this._directWalkItems = [];
        this._directWalkLocations = [];

        // Fog of war. When enabled, only tiles in the seen-set for
        // the current region render with their full overlays —
        // everything else paints solid black. Seen = visited ∪
        // 4-coord-adjacent-to-current-position; once a tile enters
        // the set it stays. Per-region (so re-entering a previous
        // region doesn't re-fog the parts the player explored
        // earlier this session). Session-only — not persisted across
        // page reloads in v1; the toggle itself IS persisted.
        this.fogEnabled = false; // overridden by _loadFromLocalStorage
        this.seenTilesByRegion = new Map(); // regionId -> Set<posKey>
        // Direct-explore button state: set true while a user-initiated
        // explore is walking, false otherwise. Mutually exclusive with
        // _loopsDrivenAction so the two chains don't fight.
        this._directExploreActive = false;

        // Phase 8 panel cleanup. genControlsVisible hides the
        // generation-only sections (Parameters, Generate / Reset
        // Player, Stats, Editor, Playback log, Rules) so the panel
        // can act as a playback-only view during loop-mode play.
        // collapsedSections holds the IDs of sections the user has
        // collapsed. Both persisted via LS_VIEW_KEY.
        this.genControlsVisible = true; // overridden by _loadFromLocalStorage
        this.collapsedSections = new Set();

        // Guard DOM creation so the panel constructs cleanly in
        // headless test environments (vitest runs under 'node').
        // Mirrors the textAdventureSubstrateUI pattern.
        if (typeof document !== 'undefined') {
            this.rootElement = document.createElement('div');
            this.rootElement.className = 'maze-room-panel';
            this.rootElement.tabIndex = 0;
            this.rootElement.addEventListener('keydown', (e) => this._handleKeydown(e));
        } else {
            this.rootElement = null;
        }

        setPanelInstance(this);
        this._loadFromLocalStorage();
        this._subscribeToSnapshotUpdates();
        this._subscribeToDiscoveryEvents();
        this._subscribeToLoopMode();
        this._subscribeToManaChanges();
        this._subscribeToCostDataChanges();
        this._subscribeToLoopsQueue();

        // If a maze:loadRegion event was published before this panel
        // mounted, the index.js handler buffered the payload. Pick it
        // up here so the panel comes up showing the loaded region
        // instead of the empty "click Generate" hint.
        const pending = consumePendingLoadRegion();
        if (pending) {
            this._adoptLoadedRegion(pending, { skipRender: true });
        }

        this.render();
    }

    _subscribeToSnapshotUpdates() {
        // Subscribe through the raw eventBus with an explicit module
        // name. Can't use this.apis.eventBus here: Golden Layout may
        // build the panel before maze/index.js's initialize() has run,
        // so the per-module wrapper isn't set up yet.
        const handler = (data) => {
            // Only the playback flow cares about the snapshot's inventory;
            // the Generate dev flow keeps using state.inventory directly.
            if (this.externalInventory === null) return;
            this.externalInventory = inventoryFromSnapshot(data?.snapshot);
            this.externalCheckedLocations = checkedLocationsFromSnapshot(data?.snapshot);
            this.render();
        };
        eventBus.subscribe('stateManager:snapshotUpdated', handler, 'mazeRoom');
        this._unsubSnapshot = () => eventBus.unsubscribe('stateManager:snapshotUpdated', handler, 'mazeRoom');

        // Phase 1.1 playback event — handler shape mirrors the live
        // snapshot subscription so the renderer is idempotent across
        // both sources.
        const playbackHandler = (data) => {
            if (this.externalInventory === null) return;
            this.externalInventory = inventoryFromSnapshot(data?.snapshot);
            this.externalCheckedLocations = checkedLocationsFromSnapshot(data?.snapshot);
            this.render();
        };
        eventBus.subscribe('playback:snapshotUpdated', playbackHandler, 'mazeRoom');
        this._unsubPlaybackSnapshot = () => eventBus.unsubscribe('playback:snapshotUpdated', playbackHandler, 'mazeRoom');
    }

    _subscribeToDiscoveryEvents() {
        if (!eventBus?.subscribe) return;
        const onModeChanged = (data) => {
            this.discoveryModeActive = !!data?.active;
            this.render();
        };
        const onDiscoveryChanged = () => {
            // Re-render — could be an external module marking
            // something discovered while the panel wasn't looking.
            this.render();
        };
        eventBus.subscribe('discovery:modeChanged', onModeChanged, 'mazeRoom');
        eventBus.subscribe('discovery:changed', onDiscoveryChanged, 'mazeRoom');
        this._unsubDiscoveryMode =
            () => eventBus.unsubscribe?.('discovery:modeChanged', onModeChanged, 'mazeRoom');
        this._unsubDiscoveryChanged =
            () => eventBus.unsubscribe?.('discovery:changed', onDiscoveryChanged, 'mazeRoom');
    }

    /**
     * Phase 3: track loop-mode active state so the panel knows whether
     * to deduct mana on per-tile movement. Loops queue's _processFrame
     * deducts when active; substrate stays passive to avoid double-billing.
     */
    _subscribeToLoopMode() {
        if (!eventBus?.subscribe) return;
        const handler = (data) => {
            this._isLoopModeActive = !!data?.active;
        };
        eventBus.subscribe('loopUI:modeChanged', handler, 'mazeRoom');
        this._unsubLoopMode =
            () => eventBus.unsubscribe?.('loopUI:modeChanged', handler, 'mazeRoom');
    }

    /** Re-render the mana display whenever currentMana / maxMana change. */
    _subscribeToManaChanges() {
        if (!eventBus?.subscribe) return;
        const handler = () => { this.render(); };
        eventBus.subscribe('gameState:manaChanged', handler, 'mazeRoom');
        this._unsubManaChanged =
            () => eventBus.unsubscribe?.('gameState:manaChanged', handler, 'mazeRoom');
    }

    /**
     * Re-render when cost data flips on/off so the mana readout
     * appears as soon as the loops module finishes loading
     * loop_costs (otherwise the first render captures isLoaded=false
     * and the readout never shows).
     */
    _subscribeToCostDataChanges() {
        if (!eventBus?.subscribe) return;
        const handler = () => {
            this._costDataManager = null; // invalidate lazy cache
            this.render();
        };
        eventBus.subscribe('costDataManager:loaded', handler, 'mazeRoom');
        eventBus.subscribe('costDataManager:cleared', handler, 'mazeRoom');
        this._unsubCostData = () => {
            eventBus.unsubscribe?.('costDataManager:loaded', handler, 'mazeRoom');
            eventBus.unsubscribe?.('costDataManager:cleared', handler, 'mazeRoom');
        };
    }

    // -------------------- Phase 6: substrate-handled completion --------------------

    /**
     * Receive the loops queue's substrateActionBegan event: when this
     * panel's region matches the action's sourceRegion, plan an
     * autopath and drive the visualizer. The walk completes via the
     * existing onExitCross / onLocationCheck callbacks (which will
     * publish loops:substrateActionCompleted when _loopsDrivenAction is
     * set). Unsupported / unresolvable actions immediately fail back
     * to loops with completed:false so the queue can stop.
     */
    _subscribeToLoopsQueue() {
        if (!eventBus?.subscribe) return;
        const handler = (data) => this._onLoopsSubstrateActionBegan(data);
        eventBus.subscribe('loops:substrateActionBegan', handler, 'mazeRoom');
        this._unsubLoopsBegan = () =>
            eventBus.unsubscribe?.('loops:substrateActionBegan', handler, 'mazeRoom');
    }

    _onLoopsSubstrateActionBegan(data) {
        const action = data?.action;
        if (!action || !this.world || !this.currentRegionId) return;
        // Only the panel currently showing the action's region handles
        // it. Other instances ignore.
        if (action.sourceRegion !== this.currentRegionId) return;

        const target = this._resolveLoopsActionTarget(action);
        if (!target) {
            // Unknown action type or unresolvable target — bail out so
            // the queue isn't parked indefinitely.
            this._publishLoopsCompleted(false);
            return;
        }
        // Phase 6h: explore-with-no-frontier (or fog off). Counts as a
        // successful completion per the design: clearing all reachable
        // fog is "explore done," even when no movement happened.
        if (target.alreadyComplete) {
            this._publishLoopsCompleted(true);
            return;
        }

        // Mark walk as queue-driven so dispatched events carry
        // fromLoop:true.
        this._loopsDrivenAction = action;
        // Phase 6e: best-path tracking. Capture the starting tile and
        // arrival exit; accumulate steps + cost as the visualizer walks.
        // Recorded into gameState.bestPaths on successful completion.
        const startPos = this.state?.player_pos ?? { x: 0, y: 0 };
        this._loopsDrivenSteps = [{ x: startPos.x, y: startPos.y }];
        this._loopsDrivenCost = 0;
        this._loopsDrivenArrivedFrom = this.arrivedFromExitId;
        this._loopsDrivenItems = [];
        this._loopsDrivenLocations = [];

        // Already at the target tile? Fire the completion synchronously
        // by simulating what walkToTile would do at the destination.
        // For exits this means firing onExitCross (the visualizer
        // handles the in-place exit case); for locations the panel
        // should have already triggered the check on prior arrival,
        // so just declare complete.
        const visualizer = this._visualizer;
        if (!visualizer) {
            this._publishLoopsCompleted(false);
            this._loopsDrivenAction = null;
            return;
        }
        visualizer.walkToTile({ x: target.x, y: target.y, name: target.name ?? null });
        // walkToTile only plans the path; the caller is responsible
        // for starting the clock so _tick actually fires. Without
        // this, queue-driven walks just sit there with a plan and the
        // queue parks indefinitely. play() is idempotent when already
        // running.
        this._ensureVisualizerPlaying();
    }

    /**
     * Make sure the visualizer's tick clock is running so a freshly
     * planned walkToTile actually executes. Idempotent — checks
     * isRunning() first to avoid restarting an already-ticking clock
     * (which can cause double-tick races).
     */
    _ensureVisualizerPlaying() {
        const v = this._visualizer;
        if (!v) return;
        if (typeof v.isRunning === 'function' && v.isRunning()) return;
        v.play?.();
    }

    /**
     * Record the path actually walked into gameState's bestPaths if it
     * beats the existing entry. Called on successful queue-driven walk
     * completion (not on reset). `toRef` is the destination shape that
     * bestPathKey understands —
     * { kind: 'exit', exitId } or { kind: 'location', locationName }.
     *
     * Translates the loops-delegation walk's tile-coord sequence into
     * the canonical action-verb shape (move N/S/E/W) so saved entries
     * have a single format regardless of which walk path produced them.
     * Side-effect aggregates (items picked up, locations checked) are
     * captured from tracking state — populated during the walk via
     * substrate's pickup callbacks.
     */
    _recordBestPathIfBetter(toRef) {
        const gs = getGameStateSingleton?.();
        if (!gs || !this.currentRegionId) return;
        if (!Array.isArray(this._loopsDrivenSteps) || this._loopsDrivenSteps.length === 0) return;
        const key = bestPathKey(this.currentRegionId, this._loopsDrivenArrivedFrom, toRef);
        if (!key) return;
        const actions = stepsToActions(this._loopsDrivenSteps);
        // Append the explicit terminal verb for location targets so the
        // saved queue replays the check at arrival (exits cross
        // naturally via _publishPlaybackEvents on tile entry).
        if (toRef.kind === 'location' && toRef.locationName) {
            actions.push({ type: 'locationCheck', locationName: toRef.locationName });
        }
        gs.recordBestPath(key, {
            actions,
            totalCost: this._loopsDrivenCost,
            itemsPickedUp: Array.isArray(this._loopsDrivenItems)
                ? [...this._loopsDrivenItems] : [],
            locationsChecked: Array.isArray(this._loopsDrivenLocations)
                ? [...this._loopsDrivenLocations] : [],
        });
    }

    _clearLoopsDrivenTracking() {
        this._loopsDrivenAction = null;
        this._loopsDrivenSteps = null;
        this._loopsDrivenCost = 0;
        this._loopsDrivenArrivedFrom = null;
        this._loopsDrivenItems = null;
        this._loopsDrivenLocations = null;
    }

    /**
     * Resolve a queue action to a tile target on this region's world.
     * regionMove → exit tile whose targetRegion matches. When multiple
     *   exits match, prefer the one with the lowest saved best-path
     *   cost; if no saved data, prefer the closest BFS distance.
     * locationCheck → location tile via reverse lookup.
     * customAction('explore') → closest unseen walkable tile via the
     *   autopather (Phase 6h). Returns { alreadyComplete: true } when
     *   fog is off, the seen-set is empty, or no reachable un-seen
     *   tile remains under the current inventory — caller treats that
     *   as "the reachable region is fully explored" and completes the
     *   action successfully.
     */
    _resolveLoopsActionTarget(action) {
        if (!this.world) return null;
        if (action.type === 'regionMove') {
            const candidates = [];
            for (const exit of this.world.exits.values()) {
                if (exit.targetRegion === action.destinationRegion) {
                    candidates.push(exit);
                }
            }
            if (candidates.length === 0) return null;
            const exit = candidates.length === 1
                ? candidates[0]
                : this._pickBestExit(candidates);
            return { x: exit.x, y: exit.y, name: exit.exitName ?? null };
        }
        if (action.type === 'locationCheck') {
            if (!this.world.itemLocationNames) return null;
            for (const [key, name] of this.world.itemLocationNames) {
                if (name === action.locationName) {
                    const [x, y] = key.split(',').map(Number);
                    return { x, y, name };
                }
            }
            return null;
        }
        if (action.type === 'customAction' && action.actionName === 'explore') {
            return this._resolveExploreTarget();
        }
        return null;
    }

    /**
     * Phase 6h: explore action target resolver. Returns the next
     * walkToTile target — the closest walkable un-seen tile reachable
     * under the current inventory — or { alreadyComplete: true } when
     * no un-seen tile remains (or fog is off entirely; in that case
     * the region was auto-discovered on entry, so "explore" is a
     * no-op). The path's last step lands on the un-seen tile, which
     * becomes seen on arrival via _onVisualizerChange's per-step fog
     * expansion — that primes the next chain leg.
     */
    _resolveExploreTarget() {
        if (!this.fogEnabled) return { alreadyComplete: true };
        const seenTiles = this.seenTilesByRegion.get(this._seenSetKey());
        if (!seenTiles || seenTiles.size === 0) {
            // No fog state yet — the panel hasn't initialized the
            // seen-set for this region (shouldn't happen in normal
            // flow, _adoptLoadedRegion seeds it). Treat as complete
            // rather than parking the queue.
            return { alreadyComplete: true };
        }
        const fromPos = this.state?.player_pos;
        if (!fromPos) return { alreadyComplete: true };
        const result = findPath(
            this.world,
            fromPos,
            { kind: 'closestUnexplored' },
            {
                seenTiles,
                inventory: this.externalInventory,
                obstacleLib: this.world?.obstacleLib,
                excludeOtherExits: true,
            },
        );
        if (!result || !Array.isArray(result.steps) || result.steps.length === 0) {
            // No reachable frontier under current inventory — explore
            // has nothing more to do. Per design, count as complete.
            return { alreadyComplete: true };
        }
        const last = result.steps[result.steps.length - 1];
        return { x: last.x, y: last.y, name: null };
    }

    /**
     * Phase 6f: pick the cheapest exit among candidates that all lead
     * to the same destination region. Prefer the lowest-cost saved
     * best path (recorded by previous successful walks); fall back to
     * the shortest BFS distance from current position. Final fallback
     * is the first candidate so the caller never gets null.
     */
    _pickBestExit(candidates) {
        // getGameStateSingleton throws when uninitialized (some test
        // contexts; not expected in production). Treat it as "no
        // saved-path data available" rather than crashing the panel.
        let gs = null;
        try { gs = getGameStateSingleton?.(); } catch { gs = null; }
        const arrivedFrom = this.arrivedFromExitId;

        // 1. Saved best-path winner (lowest cost).
        if (gs) {
            let bestByCost = null;
            let bestCost = Infinity;
            for (const exit of candidates) {
                const key = bestPathKey(this.currentRegionId, arrivedFrom, {
                    kind: 'exit', exitId: exit.exit_id,
                });
                if (!key) continue;
                const stored = gs.getBestPath(key);
                if (stored && stored.totalCost < bestCost) {
                    bestCost = stored.totalCost;
                    bestByCost = exit;
                }
            }
            if (bestByCost) return bestByCost;
        }

        // 2. Closest by BFS distance from current player position.
        const fromPos = this.state?.player_pos;
        if (fromPos) {
            let bestByDistance = null;
            let bestDistance = Infinity;
            for (const exit of candidates) {
                const result = findPath(
                    this.world, fromPos,
                    { kind: 'tile', x: exit.x, y: exit.y },
                    {
                        inventory: this.externalInventory,
                        obstacleLib: this.world?.obstacleLib,
                        excludeOtherExits: true,
                    },
                );
                if (result && result.length < bestDistance) {
                    bestDistance = result.length;
                    bestByDistance = exit;
                }
            }
            if (bestByDistance) return bestByDistance;
        }

        // 3. Defensive fallback.
        return candidates[0];
    }

    _publishLoopsCompleted(completed) {
        const bus = eventBus;
        if (!bus?.publish) return;
        bus.publish('loops:substrateActionCompleted', { completed }, 'mazeRoom');
    }

    /** True when this region's mana hooks should fire on per-tile steps.
     *
     * Three play modes:
     *   - Direct keyboard play: deduct (loop mode inactive, no queue).
     *   - Loops queue → substrate-driven walk (Phase 6): deduct via
     *     visualizer-step hook. Queue's _processFrame is parked so it
     *     can't double-bill.
     *   - Loops queue without delegation (manaEnabled off, or substrate
     *     not maze): loops queue handles deduction; substrate stays
     *     passive.
     */
    _shouldDeductMazeMana() {
        if (!this.world?.manaEnabled) return false;
        if (this._loopsDrivenAction) return true;
        if (this._isLoopModeActive) return false;
        return true;
    }

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

    /**
     * Per-tile move cost for the current region:
     *   baseRegionCost / longestShortestPath
     * with XP-level reduction applied at deduction time. Falls back to
     * the loops default region cost (50) divided by the path length
     * when no cost data is loaded.
     */
    _perTileMoveCost() {
        const path = Math.max(1, this.world?.longestShortestPath ?? 1);
        const cdm = this._getCostDataManager();
        let baseRegion = 50;
        if (cdm?.isLoaded?.() && this.currentRegionId) {
            const c = cdm.getRegionCost?.(this.currentRegionId);
            if (typeof c === 'number') baseRegion = c;
        }
        const baseTile = baseRegion / path;
        return this._applyXpReduction(baseTile);
    }

    /**
     * Cost of stepping onto an unchecked location tile. Replaces the
     * per-tile move cost for that step.
     */
    _locationTileCost(locationName) {
        const cdm = this._getCostDataManager();
        let base = 10;
        if (cdm?.isLoaded?.() && typeof cdm.getLocationCost === 'function') {
            const c = cdm.getLocationCost(locationName);
            if (typeof c === 'number') base = c;
        }
        return this._applyXpReduction(base);
    }

    _applyXpReduction(cost) {
        if (!this.currentRegionId) return cost;
        try {
            const gs = getGameStateSingleton?.();
            if (!gs) return cost;
            const xpData = gs.getRegionXP(this.currentRegionId);
            const effect = this._getCostDataManager()?.getRegionXpEffect?.(this.currentRegionId);
            return applyRegionXpCostEffect(cost, xpData?.level ?? 0, effect);
        } catch {
            return cost;
        }
    }

    /**
     * Deduct mana for a single tile-step. Called from _handleKeydown
     * after a successful step in direct keyboard play, and from
     * _onVisualizerChange during queue-driven walks (Phase 6d).
     * Awards XP equal to mana spent (1 XP : 1 mana, matching loops
     * _processFrame), and triggers a loop reset when mana hits 0.
     *
     * @param {{x: number, y: number}} newPos
     * @param {Object} [opts]
     * @param {string|null} [opts.freshLocationCheck] - when set, names
     *   the location that was just freshly checked at this step. Used
     *   by queue-driven walks where the visualizer updates its own
     *   _checkedLocations BEFORE this fires, so the panel-side
     *   "is this location unchecked" lookup would give the wrong
     *   answer. The visualizer's onLocationCheck callback fires only
     *   for fresh checks, so we know the truth at that point.
     */
    _deductMazeStepMana(newPos, opts = {}) {
        if (!this._shouldDeductMazeMana()) return 0;
        const gs = getGameStateSingleton?.();
        if (!gs) return 0;

        const key = `${newPos.x},${newPos.y}`;
        const locationName = this.world?.itemLocationNames?.get(key);
        let isUncheckedLocation;
        if (opts.freshLocationCheck) {
            isUncheckedLocation = !!locationName;
        } else {
            const checked = this._currentCheckedLocations();
            isUncheckedLocation = locationName && !checked.has(locationName);
        }
        const cost = isUncheckedLocation
            ? this._locationTileCost(locationName)
            : this._perTileMoveCost();
        gs.deductMana(cost);
        if (this.currentRegionId) gs.addRegionXP(this.currentRegionId, cost);
        if (gs.getCurrentMana() <= 0) {
            this._fireLoopReset();
        }
        return cost;
    }

    /**
     * Substrate-driven loop reset: refill mana, clear path, and
     * dispatch user:regionMove with fromReset:true so procgenPlayer
     * loads the start region's payload and the substrate's
     * regionChanged handler skips its own deduction.
     *
     * Targets procgenPlayer's resolvedStartRegion (the first warehoused
     * region after the synthetic Menu wrapper) when available — Menu
     * has no playable payload, so dispatching to it would leave the
     * panel stuck on the old region.
     *
     * Phase 6c: when this fires mid-walk under loops queue direction,
     * also notify loops with completed:false so it stops processing
     * the queue (the path was just cleared by triggerLoopReset).
     */
    _fireLoopReset() {
        const gs = getGameStateSingleton?.();
        const dispatcher = this.apis?.dispatcher;
        if (!gs) return;
        const startRegion = this._resolveStartRegion(gs);
        const sourceRegion = this.currentRegionId;

        // Notify loops first — clear the queue-driven tracking and
        // emit completed:false so stopProcessing fires on the loops
        // side before the regionMove dispatch lands. The walk was
        // interrupted, so don't record a best-path (incomplete walks
        // aren't "discovered routes" per the design).
        if (this._loopsDrivenAction) {
            this._clearLoopsDrivenTracking();
            this._publishLoopsCompleted(false);
        }

        // Stop the visualizer so any in-flight tile-by-tile walk doesn't
        // continue into the new region after teleport.
        this._visualizer?.stop?.();

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
            // procgenPlayer not loaded; fall through.
        }
        return gs.startRegions?.[0] ?? null;
    }

    /**
     * Mark every location and exit in the current region as discovered.
     * v1 semantics — matches the text-adventure substrate. Step 2's
     * fog-of-war work will gate this on the fog toggle: when fog is
     * on, discoveries fire per-tile as the player explores instead
     * of everything-on-entry.
     */
    _discoverEverythingInRegion() {
        if (!this.world || !this.currentRegionId) return;
        if (!discoveryStateSingleton) return;
        if (this.world.itemLocationNames) {
            for (const locationName of this.world.itemLocationNames.values()) {
                if (locationName) discoveryStateSingleton.discoverLocation?.(locationName);
            }
        }
        if (this.world.exits) {
            for (const exit of this.world.exits.values()) {
                const name = exit.exitName ?? exit.exit_id;
                if (name) discoveryStateSingleton.discoverExit?.(this.currentRegionId, name);
            }
        }
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

    // --- Fog of war ---

    /**
     * Key used to store the seen-tile set for the currently-loaded
     * world. Falls back to a sentinel string in dev/Generate mode
     * (where there's no procgen region context — currentRegionId is
     * null) so fog of war and the Explore button work uniformly
     * across both flows. The Generate handler clears the sentinel
     * entry before running so seen-sets from a prior Generate don't
     * leak into a new one.
     */
    _seenSetKey() {
        return this.currentRegionId ?? '__local__';
    }

    /**
     * Tiles that have been visible at any point during this session
     * for the current world. Lazily creates the entry if it doesn't
     * exist yet. Always returns a Set — uses _seenSetKey()'s sentinel
     * when no procgen region is loaded.
     */
    _seenTilesForCurrentRegion() {
        const key = this._seenSetKey();
        let s = this.seenTilesByRegion.get(key);
        if (!s) {
            s = new Set();
            this.seenTilesByRegion.set(key, s);
        }
        return s;
    }

    /**
     * Compute the set of tiles visible from `pos`: the tile itself
     * plus 4-coord-adjacent tiles (regardless of walls). Out-of-
     * bounds neighbors are skipped. The user requested coord-only
     * adjacency — walls show as walls but anything beyond stays
     * hidden until you walk to it.
     */
    _computeVisibleAt(pos) {
        const w = this.world;
        const visible = new Set();
        if (!w || !pos) return visible;
        const candidates = [
            [pos.x, pos.y],
            [pos.x, pos.y - 1],
            [pos.x, pos.y + 1],
            [pos.x - 1, pos.y],
            [pos.x + 1, pos.y],
        ];
        for (const [x, y] of candidates) {
            if (x >= 0 && x < w.width && y >= 0 && y < w.height) {
                visible.add(`${x},${y}`);
            }
        }
        return visible;
    }

    /**
     * Add tiles to the seen-set for the current region, then fire
     * discovery for any item / exit whose tile newly entered the set.
     * Called from _adoptLoadedRegion (with the spawn-visibility set)
     * and from _onStep (with post-step visibility).
     */
    _expandFogVisibility(visibleTiles) {
        const seen = this._seenTilesForCurrentRegion();
        if (!seen || !this.world) return;
        const newlyAdded = [];
        for (const k of visibleTiles) {
            if (!seen.has(k)) {
                seen.add(k);
                newlyAdded.push(k);
            }
        }
        if (newlyAdded.length === 0) return;
        // Discover items / exits at newly-visible tiles.
        if (!discoveryStateSingleton) return;
        // Build a pos-key → exit lookup once (small map, world.exits
        // typically <10 entries). Faster than O(exits) per newly-
        // added tile if many tiles entered at once.
        const exitAt = new Map();
        for (const e of this.world.exits.values()) {
            exitAt.set(`${e.x},${e.y}`, e);
        }
        for (const k of newlyAdded) {
            const itemId = this.world.items?.get(k);
            if (itemId) {
                const locationName = this.world.itemLocationNames?.get(k);
                if (locationName) discoveryStateSingleton.discoverLocation?.(locationName);
            }
            const exit = exitAt.get(k);
            if (exit) {
                const name = exit.exitName ?? exit.exit_id;
                if (name) discoveryStateSingleton.discoverExit?.(this.currentRegionId, name);
            }
        }
    }

    /**
     * Returns true when the tile at (x, y) should be drawn in full;
     * false when fog of war should black it out. With fog disabled
     * every tile is "visible." With fog enabled, only tiles in the
     * current region's seen-set show.
     */
    _isTileVisibleForRender(x, y) {
        if (!this.fogEnabled) return true;
        const seen = this.seenTilesByRegion.get(this._seenSetKey());
        if (!seen) return false;
        return seen.has(`${x},${y}`);
    }

    _currentInventory() {
        if (this.externalInventory !== null) return this.externalInventory;
        return this.state?.inventory ?? new Set();
    }

    // Per-location pickup tracking for playback mode. The Generate
    // dev flow doesn't use locationName at all (state.inventory keys
    // by item id), so the local-collected check there continues to
    // use _currentInventory.has(itemId).
    _currentCheckedLocations() {
        return this.externalCheckedLocations ?? new Set();
    }

    /**
     * Build an evaluator for `clear_set_type: 'rule'` obstacles that
     * dispatches through stateManager's snapshot interface and the
     * shared Rule-Builder engine. This handles the full schema —
     * CountItem, helpers, count_check, etc. — that the procgen-local
     * `evaluateRuleAgainstInventory` doesn't understand.
     *
     * Returns null when stateManager isn't loaded yet (no snapshot or
     * no static data); callers fall back to the local subset
     * evaluator. See top-down-driver.md §8.
     */
    _currentRuleEvaluator() {
        const snapshot = stateManagerProxySingleton.getSnapshot();
        const staticData = stateManagerProxySingleton.getStaticData();
        if (!snapshot || !staticData) return null;
        const snapshotInterface = createSnapshotInterface(snapshot, staticData);
        // The library's evaluator signature is (rule, inventory) — we
        // ignore the inventory argument here because the snapshot
        // interface already encapsulates the player's inventory.
        return (rule) => evaluateRule(rule, snapshotInterface);
    }

    /**
     * Apply a region payload published via maze:loadRegion. Called by
     * the module-level handler when this panel is already mounted, and
     * (via constructor) on initial mount with any buffered payload.
     */
    applyLoadedRegion(payload) {
        this._adoptLoadedRegion(payload);
    }

    _adoptLoadedRegion(payload, { skipRender = false } = {}) {
        // Payload shape (per procgen-player.md §"Event flow"):
        //   { region_id, world, arrivedFrom }
        // arrivedFrom.exit_id (when present) names the exit IN THE
        // LOADED REGION that the player arrived through — spawn at
        // that exit's tile so the player faces inward. Falls back to
        // world.entrance when the lookup misses (initial load, or a
        // sidecar predating the bidirectional changes).
        //
        // Maze queue is per-region: clear on entry so the new region
        // starts with an empty queue. Loops-driven entry will refill
        // it via Phase 6 delegation in a later phase; for now the
        // queue is keyboard-input-only and the manual-entry "empty
        // queue" rule applies. Also stop any in-flight replay driver
        // — its actions are for the previous region.
        this._stopReplay?.();
        this._mazeQueue?.clearAll();
        // Reset direct-walk tracking. Items / locations are session-
        // scoped to the region; cost accumulates from the entrance.
        this._directWalkCost = 0;
        this._directWalkItems = [];
        this._directWalkLocations = [];
        this.world = payload.world;
        this.state = createState(this.world);
        const arrivedExitId = payload.arrivedFrom?.exit_id;
        let spawnAt = null;
        if (arrivedExitId && this.world.exits?.has(arrivedExitId)) {
            const exit = this.world.exits.get(arrivedExitId);
            spawnAt = { x: exit.x, y: exit.y };
            this.state.player_pos = spawnAt;
        }
        this.stats = null;
        this.message = payload.region_id
            ? `Loaded region: ${payload.region_id}`
            : 'Loaded region';
        this.currentRegionId = payload.region_id ?? null;
        // Phase 6h: per-region fog control. When the sidecar carries an
        // explicit fogEnabled flag (procgen with loop mode on), it
        // overrides the LS-persisted checkbox state — fog becomes a
        // property of the world, not a UI preference. The checkbox is
        // kept as a session-only debug override; toggling it after a
        // region load works for that region until the next load.
        // Worlds without the field (legacy presets, debug regenerates)
        // fall back to the LS value loaded at panel init.
        if (typeof this.world.fogEnabled === 'boolean') {
            this.fogEnabled = this.world.fogEnabled;
        }
        // Visualizer is per-region — feed it the loaded world so its
        // step log and tile-pathfinder match what's on the canvas.
        // Forward spawnAt so the visualizer's state matches the panel's
        // — without this its createState(world) would reset to the
        // geometric-center entrance, then _onVisualizerChange mirrors
        // that back into the panel and clobbers the arrivedFrom spawn.
        this._visualizer?.setWorld(this.world, this.currentRegionId, { spawnAt });
        // Switch into playback mode: inventory truth comes from
        // stateManager snapshots from now on. Seed from the current
        // cached snapshot if one exists; further updates arrive via
        // the snapshot subscription.
        const snapshot = stateManagerProxySingleton.getSnapshot();
        this.externalInventory = inventoryFromSnapshot(snapshot);
        this.externalCheckedLocations = checkedLocationsFromSnapshot(snapshot);
        // Discovery semantics depend on fog of war:
        //   - Panel fog rendering ON: only tiles within the spawn's
        //     visibility are revealed. Further tiles uncover as the
        //     player explores (see _onStep). Re-entering a region
        //     keeps the seen-set it accumulated last visit.
        //   - World explicitly opts out (`fogEnabled: false` in the
        //     sidecar): walking into a region reveals every location
        //     and exit (legacy behavior; matches the text-adventure
        //     substrate's opt-out).
        //   - Otherwise: don't auto-reveal. Discovery state is
        //     governed by the discovery module's per-action paths
        //     (clicks, explore actions). Matches the new fog-on default.
        if (this.fogEnabled) {
            const initialVisible = this._computeVisibleAt(this.state.player_pos);
            this._expandFogVisibility(initialVisible);
        } else if (this.world?.fogEnabled === false) {
            this._discoverEverythingInRegion();
        }
        if (!skipRender) {
            this.render();
            this.rootElement?.focus();
        }
    }

    get apis() { return MazeRoomUI.moduleApis || getModuleApis(); }

    getRootElement() { return this.rootElement; }
    destroy() {
        if (this._unsubSnapshot) { this._unsubSnapshot(); this._unsubSnapshot = null; }
        if (this._unsubPlaybackSnapshot) { this._unsubPlaybackSnapshot(); this._unsubPlaybackSnapshot = null; }
        if (this._unsubDiscoveryMode) { this._unsubDiscoveryMode(); this._unsubDiscoveryMode = null; }
        if (this._unsubDiscoveryChanged) { this._unsubDiscoveryChanged(); this._unsubDiscoveryChanged = null; }
        if (this._unsubLoopMode) { this._unsubLoopMode(); this._unsubLoopMode = null; }
        if (this._unsubManaChanged) { this._unsubManaChanged(); this._unsubManaChanged = null; }
        if (this._unsubCostData) { this._unsubCostData(); this._unsubCostData = null; }
        if (this._unsubLoopsBegan) { this._unsubLoopsBegan(); this._unsubLoopsBegan = null; }
        if (this._playbackBar) { this._playbackBar.destroy(); this._playbackBar = null; }
        if (this._visualizer) { this._visualizer.stop(); this._visualizer = null; }
        this._stopReplay();
        setPanelInstance(null);
    }
    onPanelShow() { this.render(); this.rootElement?.focus(); }
    onPanelResize() {}

    render() {
        if (!this.rootElement) return;
        this.rootElement.innerHTML = '';
        // Top toolbar: "Show generator controls" toggle. Always visible
        // so the user can re-enable the generator sections after
        // hiding them. Renders before any conditionally-hidden section.
        this.rootElement.appendChild(this._renderTopToolbar());
        if (this.genControlsVisible) {
            this.rootElement.appendChild(this._renderCollapsibleSection(
                'parameters', 'Generator', this._renderParams(),
            ));
            this.rootElement.appendChild(this._renderActions());
        }
        this.rootElement.appendChild(this._renderCollapsibleSection(
            'playback', 'Playback controls', this._renderPlaybackBar(),
        ));
        // Maze action queue lives directly under Playback controls.
        // Always rendered (not gated on genControlsVisible) since
        // it's part of normal play, not a generator dev tool.
        this.rootElement.appendChild(this._renderCollapsibleSection(
            'actionQueue', 'Action queue', this._renderActionQueue(),
        ));
        if (this.genControlsVisible) {
            this.rootElement.appendChild(this._renderStats());
        }
        const manaEl = this._renderManaDisplay();
        if (manaEl) {
            this.rootElement.appendChild(this._renderCollapsibleSection(
                'mana', 'Mana', manaEl,
            ));
        }
        this.rootElement.appendChild(this._renderMaze());
        if (this.genControlsVisible) {
            this.rootElement.appendChild(this._renderPlaybackLogSection());
            this.rootElement.appendChild(this._renderCollapsibleSection(
                'editor', 'Edit mode', this._renderEditor(),
            ));
            this.rootElement.appendChild(this._renderRules());
        }
    }

    /**
     * Top toolbar with the "Show generator controls" checkbox.
     * Always rendered (regardless of genControlsVisible) so the user
     * can flip the toggle back on. Persists to LS_VIEW_KEY via
     * _saveViewSettings.
     */
    _renderTopToolbar() {
        const bar = document.createElement('div');
        bar.className = 'maze-room-top-toolbar';

        const label = document.createElement('label');
        label.className = 'maze-room-top-toolbar-toggle';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!this.genControlsVisible;
        input.addEventListener('change', () => {
            this.genControlsVisible = input.checked;
            this._saveViewSettings();
            this.render();
        });
        label.appendChild(input);
        label.appendChild(document.createTextNode(' Show generator controls'));
        bar.appendChild(label);
        return bar;
    }

    /**
     * Wrap content in an accordion-style section with a clickable
     * header that toggles between expanded and collapsed. Per-section
     * collapse state lives in this.collapsedSections (a Set of IDs)
     * and persists via _saveViewSettings.
     *
     * @param {string} sectionId - Stable ID for persistence (e.g. 'parameters').
     * @param {string} titleText - Header label.
     * @param {HTMLElement} contentEl - The section's content node.
     * @returns {HTMLElement} The wrapper.
     */
    _renderCollapsibleSection(sectionId, titleText, contentEl) {
        const isCollapsed = this.collapsedSections.has(sectionId);
        const wrap = document.createElement('div');
        wrap.className = `maze-room-collapsible ${isCollapsed ? 'is-collapsed' : 'is-expanded'}`;
        wrap.dataset.sectionId = sectionId;

        const header = document.createElement('div');
        header.className = 'maze-room-collapsible-header';
        const indicator = document.createElement('span');
        indicator.className = 'maze-room-collapsible-indicator';
        indicator.textContent = isCollapsed ? '▶' : '▼';
        const title = document.createElement('span');
        title.className = 'maze-room-collapsible-title';
        title.textContent = titleText;
        header.appendChild(indicator);
        header.appendChild(title);
        header.addEventListener('click', () => {
            if (this.collapsedSections.has(sectionId)) {
                this.collapsedSections.delete(sectionId);
            } else {
                this.collapsedSections.add(sectionId);
            }
            this._saveViewSettings();
            this.render();
        });
        wrap.appendChild(header);

        if (!isCollapsed && contentEl) {
            const body = document.createElement('div');
            body.className = 'maze-room-collapsible-body';
            body.appendChild(contentEl);
            wrap.appendChild(body);
        }
        return wrap;
    }

    /**
     * Phase 3 mana readout. Visible whenever cost data is loaded —
     * the player always sees their resource regardless of whether the
     * current region has manaEnabled. 1-decimal formatting per spec.
     */
    _renderManaDisplay() {
        const cdm = this._getCostDataManager();
        if (!cdm?.isLoaded?.()) return null;
        let gs;
        try { gs = getGameStateSingleton?.(); } catch { gs = null; }
        if (!gs) return null;
        const wrap = document.createElement('div');
        wrap.className = 'maze-mana-display';
        const cur = gs.getCurrentMana?.() ?? 0;
        const max = gs.getMaxMana?.() ?? 0;
        wrap.textContent = `mana: ${cur.toFixed(1)} / ${max.toFixed(1)}`;
        return wrap;
    }

    /**
     * Resolve a walkTo target ({kind, name}) against the loaded
     * world's exits / item-location map and aim the visualizer at the
     * resulting tile. Used by the playback bot's outer-layer
     * commands; the panel is the natural place for the world-level
     * lookup since the visualizer is one layer below substrate-aware
     * state.
     *
     *   { kind: 'location', name }     → reverse-lookup via
     *       world.itemLocationNames (Map<"x,y", locationName>) and
     *       walkToTile that position.
     *   { kind: 'exit', name }         → world.exits.get(name); fall
     *       back to a scan over exits by exitName/exit_id when the
     *       caller passed the AP-side exit name.
     *   { kind: 'tile', region, x, y } → walk to (x, y). The region
     *       must match the panel's currently-loaded region; cross-
     *       region tile targets are routed by the bot through exits
     *       one region at a time, and only land here once the
     *       destination region is loaded.
     *
     * Unknown / unresolvable targets are logged at console.warn and
     * silently dropped so a stray command doesn't crash the panel.
     */
    _handleWalkToCommand(target) {
        if (!this._visualizer) return;
        if (!target || typeof target !== 'object') return;
        const world = this.world;
        if (!world) {
            console.warn('[mazeRoom] walkTo received before world loaded; ignoring');
            return;
        }
        const tile = this._resolveWalkToTile(target, world);
        if (!tile) {
            console.warn('[mazeRoom] walkTo: could not resolve target', target);
            return;
        }
        // Refresh externalInventory from the latest cached snapshot
        // before the visualizer's tile-pathfinder runs. The snapshot
        // we cached at setWorld time may not have reflected starting
        // items yet (worker had not finished applying loadFromJSON's
        // initial inventory), and a stale cache makes isObstacleCleared
        // think gated exits are still locked — so the pathfinder
        // refuses to plan a route through them. The bot already
        // pings the worker before publishing walkTo, so by the time
        // we're here the proxy's uiCache is fresh.
        //
        // The panel's externalInventory feeds the renderer, but the
        // visualizer keeps its own _inventory Set for its tile
        // pathfinder and step (it gets populated by in-region pickups
        // during fresh-start play). In playback mode that internal
        // set never sees starting_items — push the fresh snapshot
        // into the visualizer too so isObstacleCleared inside
        // _planTilePath sees the same world the renderer does.
        const snap = stateManagerProxySingleton.getLatestStateSnapshot?.();
        if (snap) {
            this.externalInventory = inventoryFromSnapshot(snap);
            this.externalCheckedLocations = checkedLocationsFromSnapshot(snap);
            this._visualizer.setInventory?.(this.externalInventory);
        }
        this._visualizer.walkToTile({ x: tile.x, y: tile.y, name: target.name ?? null });
    }

    /**
     * Substrate-neutral playback controller for the bot to call into
     * via substrateRegistry. Cached so identity is stable across calls.
     * Each method delegates to the existing visualizer / walkTo
     * machinery — the controller is just a uniform interface view.
     */
    getPlaybackController() {
        if (!this._playbackController) {
            this._playbackController = {
                play:    (rateHz) => this._visualizer?.play(rateHz),
                stop:    () => this._visualizer?.stop(),
                step:    () => this._visualizer?.step(),
                instant: () => this._visualizer?.instant(),
                reset:   () => this._visualizer?.freshStart(),
                setRate: (rateHz) => this._visualizer?.setRate(rateHz),
                walkTo:  (target) => this._handleWalkToCommand(target),
            };
        }
        return this._playbackController;
    }

    _resolveWalkToTile(target, world) {
        if (target.kind === 'location') {
            // world.itemLocationNames is keyed "x,y" → locationName.
            // Scan once: location lookup is rare (per-leg) so a
            // dedicated reverse index isn't worth the bookkeeping.
            const map = world.itemLocationNames;
            if (!map) return null;
            for (const [key, name] of map.entries()) {
                if (name !== target.name) continue;
                const [xs, ys] = key.split(',');
                return { x: Number.parseInt(xs, 10), y: Number.parseInt(ys, 10) };
            }
            return null;
        }
        if (target.kind === 'exit') {
            const exits = world.exits;
            if (!exits) return null;
            // Try exit_id first (Map key), then fall back to a scan
            // matching exitName — the caller may pass either depending
            // on how PathFinder names the connection.
            if (exits.has(target.name)) {
                const e = exits.get(target.name);
                return { x: e.x, y: e.y };
            }
            for (const e of exits.values()) {
                if (e.exitName === target.name || e.exit_id === target.name) {
                    return { x: e.x, y: e.y };
                }
            }
            return null;
        }
        if (target.kind === 'tile') {
            // Defensive: the bot only publishes a tile walkTo when its
            // _currentRegion matches target.region, but a stale dispatch
            // mid-region-transition would walk to the wrong tile in the
            // newly-loaded world. Drop instead.
            if (target.region && target.region !== this.currentRegionId) return null;
            if (!Number.isFinite(target.x) || !Number.isFinite(target.y)) return null;
            return { x: target.x, y: target.y };
        }
        return null;
    }

    /**
     * Visualizer detected an exit-cross with a targetRegion. Mirror
     * the keyboard-play exit-cross flow: publish user:regionMove on
     * the dispatcher so the procgen player module loads the next
     * region into this panel via maze:loadRegion. The visualizer
     * itself paused on _awaitingRegionLoad until setWorld arrives.
     */
    _onVisualizerExitCross(exit, sourceRegion) {
        const dispatcher = this.apis?.dispatcher;
        if (!dispatcher?.publish) return;
        if (!exit?.targetRegion) return;
        // Phase 6c: when this walk was driven by the loops queue, mark
        // the dispatched event so gameState skips a duplicate path
        // entry (the queue already enqueued the original regionMove).
        const fromLoop = this._loopsDrivenAction != null;
        dispatcher.publish('user:regionMove', {
            sourceRegion: sourceRegion ?? this.currentRegionId,
            targetRegion: exit.targetRegion,
            exitName: exit.exitName ?? null,
            ...(fromLoop ? { fromLoop: true } : {}),
        }, { initialTarget: 'bottom' });

        // Hand control back to the loops queue. Record the walked path
        // first (Phase 6e), then clear the queue-driven marker BEFORE
        // publishing completion so any re-entrant flows see we're idle.
        if (fromLoop) {
            this._recordBestPathIfBetter({ kind: 'exit', exitId: exit.exit_id });
            this._clearLoopsDrivenTracking();
            this._publishLoopsCompleted(true);
        }
    }

    /**
     * Visualizer picked up an item with a known locationName. Mirror
     * the keyboard-play _publishPlaybackEvents path: publish a
     * locationCheck on the dispatcher so stateManager records the
     * check and the playback bot's onLocationCheck advances its
     * cursor. Without this, bot-driven playback stalls on the first
     * pickup — the visualizer's internal state updates but no event
     * reaches the rest of the app.
     *
     * Uses `system:locationCheck` (not `user:`) so the playback bot's
     * Phase 2 click-intercept doesn't swallow the bot's own progress
     * and infinite-loop. Terminal handlers subscribe to both events
     * with the same handler so behavior is otherwise identical.
     *
     * stateManager already de-duplicates against its checkedLocations
     * set, so re-publishing for an already-checked location is a
     * benign no-op.
     */
    _onVisualizerLocationCheck(locationName, itemId, regionId) {
        const dispatcher = this.apis?.dispatcher;
        if (!dispatcher?.publish) return;
        if (!locationName) return;
        // Phase 6c: substrate-driven walk under loops queue → fromLoop
        // so gameState skips path-add (the queue already enqueued the
        // original locationCheck).
        const fromLoop = this._loopsDrivenAction != null;
        const fromLoopThisLocation = fromLoop
            && this._loopsDrivenAction?.type === 'locationCheck'
            && this._loopsDrivenAction?.locationName === locationName;

        // Phase 6d: signal _onVisualizerChange that this step was a
        // fresh location check. Set BEFORE _onVisualizerChange runs
        // (the visualizer fires _publishSnapshot then _notifyChange
        // immediately after this callback). The visualizer suppresses
        // this callback for already-checked locations, so reaching
        // here means the location was genuinely fresh.
        this._pendingFreshLocationCheck = locationName;

        // Track side effects of the current loops-driven walk so
        // _recordBestPathIfBetter can stamp itemsPickedUp /
        // locationsChecked into the bestPaths entry on completion.
        if (this._loopsDrivenAction) {
            if (Array.isArray(this._loopsDrivenLocations)
                && !this._loopsDrivenLocations.includes(locationName)) {
                this._loopsDrivenLocations.push(locationName);
            }
            if (itemId && Array.isArray(this._loopsDrivenItems)
                && !this._loopsDrivenItems.includes(itemId)) {
                this._loopsDrivenItems.push(itemId);
            }
        }

        dispatcher.publish('system:locationCheck', {
            locationName,
            regionName: regionId ?? this.currentRegionId,
            itemId: itemId ?? null,
            ...(fromLoop ? { fromLoop: true } : {}),
        }, { initialTarget: 'bottom' });

        // Only the location the queue specifically asked for completes
        // the action. Incidental pickups along the way (a regionMove
        // walk passing over a location tile) shouldn't trigger
        // completion — the queue is targeting a different tile.
        if (fromLoopThisLocation) {
            this._recordBestPathIfBetter({ kind: 'location', locationName });
            this._clearLoopsDrivenTracking();
            this._publishLoopsCompleted(true);
        }
    }

    /**
     * Visualizer ticked — mirror its player_pos into the panel's
     * state so the canvas redraws show the bot moving. The
     * visualizer's inventory + checkedLocations flow through the
     * playback:snapshotUpdated event into externalInventory /
     * externalCheckedLocations (see _subscribeToSnapshotUpdates),
     * but player_pos isn't carried in the snapshot — the substrate
     * tracks it on its own state object. We bridge that here.
     */
    _onVisualizerChange() {
        const vState = this._visualizer?.getState();
        let stepHappened = false;
        let newPos = null;
        if (vState?.player_pos && this.state) {
            const oldPos = this.state.player_pos;
            newPos = { ...vState.player_pos };
            stepHappened = !!oldPos && (oldPos.x !== newPos.x || oldPos.y !== newPos.y);
            this.state.player_pos = newPos;
        }
        // Phase 6d: per-step mana deduction during queue-driven walks.
        // The visualizer's tick fires (a) _handleEvent → onLocationCheck
        // (which sets _pendingFreshLocationCheck for fresh pickups)
        // (b) _publishSnapshot, then (c) _notifyChange → us. By here
        // the externalCheckedLocations already reflects any pickup,
        // so we use the pending flag to charge location vs move cost
        // correctly.
        if (stepHappened && newPos && this._loopsDrivenAction) {
            const fresh = this._pendingFreshLocationCheck;
            const cost = this._deductMazeStepMana(newPos, { freshLocationCheck: fresh });
            // Phase 6e: append to the in-progress best-path tracking
            // (cleared by reset, recorded into gameState on completion).
            if (Array.isArray(this._loopsDrivenSteps)) {
                this._loopsDrivenSteps.push({ x: newPos.x, y: newPos.y });
                this._loopsDrivenCost += cost;
            }
        }
        this._pendingFreshLocationCheck = null;
        // Fog of war: expand the seen-set on each visualizer step
        // the same way keyboard play does, so fog-on playback uncovers
        // tiles as the bot explores.
        if (this.fogEnabled && this.state) {
            this._expandFogVisibility(this._computeVisibleAt(this.state.player_pos));
        }
        // Phase 6c: under loops-queue direction, a "stuck" visualizer
        // means the autopath couldn't be planned (e.g. unreachable
        // target). Fail back to loops so the queue stops cleanly.
        if (this._loopsDrivenAction && vState?.stuck) {
            this._clearLoopsDrivenTracking();
            this._publishLoopsCompleted(false);
        }
        // Phase 6h: explore-action chaining. When the queue-driven
        // action is a customAction('explore') and the visualizer's
        // current leg has completed (target cleared after the last
        // tile of the planned path), recompute the closestUnexplored
        // frontier against the now-expanded seenTiles. Frontier
        // remains → walkToTile the next leg. None → publish
        // completed:true. Out-of-mana is already handled upstream by
        // _fireLoopReset (which clears tracking + publishes false).
        if (
            stepHappened
            && this._loopsDrivenAction?.type === 'customAction'
            && this._loopsDrivenAction?.actionName === 'explore'
            && vState
            && !vState.stuck
            && !vState.target
        ) {
            this._chainExploreOrComplete();
        }
        // Direct-explore (Explore button) chaining. Same shape as the
        // queue-driven version above, but uses the local _directExploreActive
        // flag instead of publishing to the loops queue. Stuck → end
        // direct explore with a message; leg complete → next leg or
        // alreadyComplete.
        if (this._directExploreActive && vState?.stuck) {
            this._directExploreActive = false;
            this.message = 'Explore halted: visualizer stuck (unreachable target).';
        }
        if (
            stepHappened
            && this._directExploreActive
            && vState
            && !vState.stuck
            && !vState.target
        ) {
            this._chainDirectExplore();
        }
        this.render();
    }

    _chainExploreOrComplete() {
        const next = this._resolveExploreTarget();
        if (next?.alreadyComplete) {
            this._clearLoopsDrivenTracking();
            this._publishLoopsCompleted(true);
            return;
        }
        if (!next || !this._visualizer) {
            // Defensive: treat as success rather than parking the queue.
            this._clearLoopsDrivenTracking();
            this._publishLoopsCompleted(true);
            return;
        }
        this._visualizer.walkToTile({ x: next.x, y: next.y, name: null });
        this._ensureVisualizerPlaying();
    }

    _renderPlaybackBar() {
        if (!this._playbackBar) {
            this._playbackBar = new PlaybackControlBar({
                label: 'Playback',
                actions: {
                    instant: () => this._visualizer?.instant(),
                    step:    () => this._visualizer?.step(),
                    play:    (rateHz) => this._visualizer?.play(rateHz),
                    stop:    () => this._visualizer?.stop(),
                    reset:   () => this._visualizer?.reset(),
                    setRate: (rateHz) => this._visualizer?.setRate(rateHz),
                },
            });
        }
        // Reflect visualizer state on every render so the buttons +
        // status line stay in sync after each tick.
        const vState = this._visualizer?.getState();
        if (this._playbackBar) {
            this._playbackBar.setRunning(!!vState?.running);
            const status = this._buildPlaybackStatus(vState);
            this._playbackBar.setStatus(status);
        }
        const wrapper = document.createElement('div');
        wrapper.className = 'maze-room-playback';
        const el = this._playbackBar.getElement();
        if (el) wrapper.appendChild(el);
        return wrapper;
    }

    /**
     * Renders the maze action queue: a Cavernous-2-style horizontal
     * icon row showing queued actions, a status line, and a
     * Clear button. Lives under Playback controls (see render()).
     *
     * Icon click sets the edit cursor BEFORE that icon (subsequent
     * keypresses insert there rather than appending). The trailing
     * empty slot clears the cursor back to tail / null. Done actions
     * are visually faded; the next-to-run action is highlighted.
     *
     * Backspace deletes the action just before the cursor — handled
     * directly in _handleKeydown rather than via a button, mirroring
     * Cavernous's `B` convention.
     */
    _renderActionQueue() {
        const wrap = document.createElement('div');
        wrap.className = 'maze-room-queue';

        const snap = this._mazeQueue.snapshot();
        const pending = snap.actions.length - snap.executionIndex;

        const status = document.createElement('div');
        status.className = 'maze-room-queue-status';
        if (snap.actions.length === 0) {
            status.textContent = 'Empty — press a movement key or Space to wait.';
        } else {
            const cursorText = snap.editCursor !== null
                ? ` · cursor @ ${snap.editCursor}`
                : '';
            status.textContent
                = `${snap.actions.length} action${snap.actions.length === 1 ? '' : 's'}`
                + ` · ${pending} pending${cursorText}`;
        }
        wrap.appendChild(status);

        const row = document.createElement('div');
        row.className = 'maze-room-queue-row';
        for (let i = 0; i < snap.actions.length; i++) {
            if (snap.editCursor === i) {
                row.appendChild(this._renderQueueCursor());
            }
            row.appendChild(this._renderQueueIcon(snap.actions[i], i));
        }
        // Cursor placed exactly at the tail (== length, not null).
        // editCursor === null means "default tail" (no visible bar);
        // editCursor === length means the user explicitly placed it
        // there. They're equivalent for input behavior but rendered
        // differently for clarity.
        if (snap.editCursor !== null && snap.editCursor === snap.actions.length) {
            row.appendChild(this._renderQueueCursor());
        }
        // Trailing click region: clicking here clears the cursor.
        // Always present so the user has somewhere to click to exit
        // edit-cursor mode without keyboard input.
        const tailSlot = document.createElement('div');
        tailSlot.className = 'maze-room-queue-tail-slot';
        tailSlot.title = 'Click to insert at tail (clear cursor)';
        tailSlot.addEventListener('click', () => {
            this._mazeQueue.setEditCursor(null);
            this.render();
            this.rootElement?.focus();
        });
        row.appendChild(tailSlot);
        wrap.appendChild(row);

        const controls = document.createElement('div');
        controls.className = 'maze-room-queue-controls';
        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'maze-room-queue-clear';
        clearBtn.textContent = 'Clear pending';
        clearBtn.disabled = pending === 0;
        clearBtn.addEventListener('click', () => {
            this._mazeQueue.clearPending();
            this.render();
            this.rootElement?.focus();
        });
        controls.appendChild(clearBtn);

        if (this._replayDriver) {
            const stopBtn = document.createElement('button');
            stopBtn.type = 'button';
            stopBtn.className = 'maze-room-queue-clear';
            stopBtn.textContent = 'Stop replay';
            stopBtn.addEventListener('click', () => {
                this._stopReplay();
                this.render();
                this.rootElement?.focus();
            });
            controls.appendChild(stopBtn);
        }
        wrap.appendChild(controls);

        // Replay buttons for each saved best-queue matching the current
        // (region, arrivedFromExitId). Hidden when nothing's saved.
        const replayables = this._getReplayableTargets();
        if (replayables.length > 0) {
            const replayWrap = document.createElement('div');
            replayWrap.className = 'maze-room-queue-replay';
            const label = document.createElement('div');
            label.className = 'maze-room-queue-replay-label';
            label.textContent = 'Saved best paths from here:';
            replayWrap.appendChild(label);
            const replayRow = document.createElement('div');
            replayRow.className = 'maze-room-queue-replay-buttons';
            for (const entry of replayables) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'maze-room-queue-replay-button';
                btn.textContent
                    = `${entry.label}  (cost ${entry.totalCost.toFixed(1)}, ${entry.actionCount} actions)`;
                btn.title = 'Load and play this saved queue';
                btn.addEventListener('click', () => {
                    this._replayBestPath(entry.key);
                });
                replayRow.appendChild(btn);
            }
            replayWrap.appendChild(replayRow);
            wrap.appendChild(replayWrap);
        }

        return wrap;
    }

    _renderQueueCursor() {
        const el = document.createElement('div');
        el.className = 'maze-room-queue-cursor';
        el.setAttribute('aria-hidden', 'true');
        return el;
    }

    _renderQueueIcon(action, index) {
        const el = document.createElement('div');
        const isDone = action.status === 'done';
        const isNext = !isDone && index === this._mazeQueue.executionIndex;
        el.className = 'maze-room-queue-icon'
            + (isDone ? ' is-done' : ' is-pending')
            + (isNext ? ' is-next' : '');
        el.dataset.index = String(index);

        let glyph;
        let tooltip;
        if (action.type === ACTION_MOVE) {
            glyph = { N: '↑', S: '↓', E: '→', W: '←' }[action.dir] ?? '?';
            tooltip = `move ${action.dir}`;
        } else if (action.type === ACTION_WAIT) {
            glyph = '◌';
            tooltip = 'wait';
        } else if (action.type === ACTION_LOCATION_CHECK) {
            glyph = '✓';
            tooltip = `check ${action.locationName ?? ''}`;
        } else {
            glyph = '?';
            tooltip = action.type;
        }
        el.textContent = glyph;
        el.title = `${tooltip} (#${index}${isDone ? ', done' : ''})`;

        if (!isDone) {
            // Click sets edit cursor BEFORE this icon. Done actions
            // are non-interactive (the cursor can't enter the done
            // region anyway — setEditCursor clamps to executionIndex).
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                this._mazeQueue.setEditCursor(index);
                this.render();
                this.rootElement?.focus();
            });
        }
        return el;
    }

    _renderPlaybackLogSection() {
        const wrap = document.createElement('div');
        wrap.className = 'maze-room-playback-log-section';
        const vState = this._visualizer?.getState();
        if (!vState || !this.world) {
            wrap.style.display = 'none';
            return wrap;
        }
        wrap.appendChild(this._renderPlaybackLog(vState));
        return wrap;
    }

    _buildPlaybackStatus(vState) {
        if (!vState) return '';
        if (vState.stuck) return 'Stuck — reset to retry.';
        if (vState.completed) return 'Done.';
        if (vState.target) {
            return `seeking ${vState.target.kind}: ${vState.target.name} at (${vState.target.x},${vState.target.y})`;
        }
        if (vState.running) return 'Running…';
        return 'Idle. Press Step or Play to walk the region.';
    }

    _renderPlaybackLog(vState) {
        const wrap = document.createElement('div');
        wrap.className = 'maze-room-playback-log';

        const log = vState?.log ?? [];
        if (log.length === 0) {
            const hint = document.createElement('div');
            hint.className = 'maze-room-hint';
            hint.textContent = 'Step log will appear here.';
            wrap.appendChild(hint);
            return wrap;
        }

        // Show only the most recent entries to keep the panel tight.
        const TAIL = 40;
        const tail = log.slice(-TAIL);
        for (const entry of tail) {
            const row = document.createElement('div');
            row.className = `maze-room-playback-log-entry maze-room-playback-log-${entry.type}`;
            row.textContent = formatLogEntry(entry);
            wrap.appendChild(row);
        }
        if (log.length > TAIL) {
            const more = document.createElement('div');
            more.className = 'maze-room-hint';
            more.textContent = `(${log.length - TAIL} earlier entries hidden)`;
            wrap.insertBefore(more, wrap.firstChild);
        }
        return wrap;
    }

    // --- Parameter UI ---

    _renderParams() {
        const section = document.createElement('div');
        section.className = 'maze-room-params';
        // Title is supplied by the collapsible wrapper ("Generator")
        // in render(); no inline section-title here.

        const grid = document.createElement('div');
        grid.className = 'maze-room-grid';

        // Biome dropdown — feeds config.biome.id on the next generate.
        const biomeRow = document.createElement('div');
        biomeRow.className = 'maze-room-field';
        const biomeLabel = document.createElement('label');
        biomeLabel.textContent = 'Biome';
        biomeLabel.htmlFor = 'maze-room-biome';
        const biomeSelect = document.createElement('select');
        biomeSelect.id = 'maze-room-biome';
        for (const [id, entry] of Object.entries(BIOMES)) {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = entry.name;
            opt.title = entry.description;
            if (id === (this.params.biomeId ?? DEFAULT_BIOME_ID)) {
                opt.selected = true;
            }
            biomeSelect.appendChild(opt);
        }
        biomeSelect.addEventListener('change', () => {
            this.params.biomeId = biomeSelect.value;
        });
        biomeRow.appendChild(biomeLabel);
        biomeRow.appendChild(biomeSelect);
        grid.appendChild(biomeRow);

        const fields = [
            { key: 'seed',             label: 'Seed',              min: 0 },
            { key: 'width',            label: 'Width',             min: 2,   max: 80 },
            { key: 'height',           label: 'Height',            min: 2,   max: 80 },
            { key: 'maxIterations',    label: 'Max iterations',    min: 1,   max: 100000 },
            { key: 'stallLimit',       label: 'Stall limit',       min: 1,   max: 10000 },
        ];

        for (const f of fields) {
            const row = document.createElement('div');
            row.className = 'maze-room-field';

            const label = document.createElement('label');
            label.textContent = f.label;
            label.htmlFor = `maze-room-${f.key}`;

            const input = document.createElement('input');
            input.type = 'number';
            input.id = `maze-room-${f.key}`;
            const currentValue = this.params[f.key];
            input.value = currentValue == null ? '' : currentValue;
            if (f.min !== undefined) input.min = f.min;
            if (f.max !== undefined) input.max = f.max;
            if (f.placeholder) input.placeholder = f.placeholder;
            input.addEventListener('change', () => {
                if (input.value === '' && f.nullable) {
                    this.params[f.key] = null;
                    return;
                }
                const v = parseInt(input.value, 10);
                if (Number.isFinite(v)) this.params[f.key] = v;
            });

            row.appendChild(label);
            row.appendChild(input);
            grid.appendChild(row);
        }

        section.appendChild(grid);

        const btnRow = document.createElement('div');
        btnRow.className = 'maze-room-btn-row';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'maze-room-btn';
        saveBtn.textContent = 'Save Params';
        saveBtn.addEventListener('click', () => this._saveToLocalStorage());

        const loadBtn = document.createElement('button');
        loadBtn.className = 'maze-room-btn';
        loadBtn.textContent = 'Load Params';
        loadBtn.addEventListener('click', () => {
            this._loadFromLocalStorage();
            this.render();
        });

        const resetBtn = document.createElement('button');
        resetBtn.className = 'maze-room-btn';
        resetBtn.textContent = 'Reset Defaults';
        resetBtn.addEventListener('click', () => {
            this.params = { ...DEFAULT_PARAMS };
            this.render();
        });

        btnRow.appendChild(saveBtn);
        btnRow.appendChild(loadBtn);
        btnRow.appendChild(resetBtn);
        section.appendChild(btnRow);

        return section;
    }

    // --- Actions ---

    _renderActions() {
        const section = document.createElement('div');
        section.className = 'maze-room-actions';

        const genBtn = document.createElement('button');
        genBtn.className = 'maze-room-btn maze-room-btn-primary';
        genBtn.textContent = this.isGenerating ? 'Generating…' : 'Generate';
        genBtn.disabled = this.isGenerating;
        genBtn.addEventListener('click', () => this._runGeneration());
        section.appendChild(genBtn);

        if (this.world) {
            const resetPlayerBtn = document.createElement('button');
            resetPlayerBtn.className = 'maze-room-btn';
            resetPlayerBtn.textContent = 'Reset Player';
            resetPlayerBtn.addEventListener('click', () => {
                this.state = createState(this.world);
                this.message = '';
                this.render();
                this.rootElement.focus();
            });
            section.appendChild(resetPlayerBtn);
        }

        if (this.message) {
            const msg = document.createElement('span');
            msg.className = 'maze-room-message';
            msg.textContent = this.message;
            section.appendChild(msg);
        }

        return section;
    }

    // --- Stats ---

    _renderStats() {
        const section = document.createElement('div');
        section.className = 'maze-room-stats';
        if (!this.stats) return section;

        const parts = [];
        if (this.stats.biome) parts.push(`biome ${this.stats.biome}`);
        if (this.stats.usedFallback) parts.push('fallback');
        parts.push(
            `iter ${this.stats.iterations}`,
            `accepted ${this.stats.accepted}`,
            `rej ${this.stats.rejected}`,
            `path ${this.stats.shortestPath ?? '—'}`,
        );
        if (this.stats.gateKeyPlaced) {
            parts.push('gate+key');
        } else if (this.stats.gateKeyReason && this.stats.gateKeyReason !== 'disabled') {
            parts.push(`no-gate (${this.stats.gateKeyReason})`);
        }
        parts.push(this.stats.stalled ? 'stalled' : 'complete');

        const line = document.createElement('div');
        line.textContent = parts.join(' · ');
        section.appendChild(line);

        const currentInv = this._currentInventory();
        if (this.state && currentInv.size > 0) {
            const inv = document.createElement('div');
            inv.className = 'maze-room-inventory';
            const itemNames = [...currentInv].map((id) => {
                const item = (this.world?.itemLib ?? DEFAULT_ITEMS)[id];
                return item?.name ?? id;
            });
            inv.textContent = `inventory: ${itemNames.join(', ')}`;
            section.appendChild(inv);
        }
        return section;
    }

    // --- Rules (paths-and-obstacles) ---

    _renderRules() {
        const container = document.createElement('div');
        container.className = 'maze-room-rules-container';
        if (!this.world) {
            container.style.display = 'none';
            return container;
        }

        const extracted = extractPathsAndObstacles(this.world);
        const compiled = compileRegion(extracted, {
            obstacleLib: this.world.obstacleLib ?? DEFAULT_OBSTACLES,
        });

        container.appendChild(this._renderJsonBlock(
            'Paths & obstacles (extracted)',
            extracted,
        ));
        container.appendChild(this._renderJsonBlock(
            'Compiled rules (Rule Builder JSON)',
            compiled,
        ));
        return container;
    }

    _renderJsonBlock(title, data) {
        const section = document.createElement('details');
        section.className = 'maze-room-rules';

        const summary = document.createElement('summary');
        summary.textContent = title;
        section.appendChild(summary);

        const json = JSON.stringify(data, null, 2);

        const btnRow = document.createElement('div');
        btnRow.className = 'maze-room-btn-row';
        const copyBtn = document.createElement('button');
        copyBtn.className = 'maze-room-btn';
        copyBtn.textContent = 'Copy JSON';
        copyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Fall back to the legacy execCommand path if clipboard API
            // isn't available — some embedded contexts (iframes without
            // focus, older browsers) don't expose navigator.clipboard.
            if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(json)
                    .then(() => { copyBtn.textContent = 'Copied'; setTimeout(() => { copyBtn.textContent = 'Copy JSON'; }, 1200); })
                    .catch(() => { copyBtn.textContent = 'Copy failed'; });
            } else {
                const ta = document.createElement('textarea');
                ta.value = json;
                document.body.appendChild(ta);
                ta.select();
                try { document.execCommand('copy'); copyBtn.textContent = 'Copied'; setTimeout(() => { copyBtn.textContent = 'Copy JSON'; }, 1200); }
                catch (err) { copyBtn.textContent = 'Copy failed'; }
                document.body.removeChild(ta);
            }
        });
        btnRow.appendChild(copyBtn);
        section.appendChild(btnRow);

        const pre = document.createElement('pre');
        pre.className = 'maze-room-rules-json';
        pre.textContent = json;
        section.appendChild(pre);
        return section;
    }

    // --- Canvas rendering ---

    _renderMaze() {
        const section = document.createElement('div');
        section.className = 'maze-room-canvas-wrap';

        // Display toggles row — small controls above the canvas that
        // change rendering without re-running generation.
        section.appendChild(this._renderViewToggles());

        if (!this.world) {
            const hint = document.createElement('div');
            hint.className = 'maze-room-hint';
            hint.textContent = 'Click Generate to build a maze. Use arrow keys or WASD to play.';
            section.appendChild(hint);
            return section;
        }

        const canvas = document.createElement('canvas');
        canvas.className = 'maze-room-canvas';
        canvas.width = this.world.width * TILE_PX;
        canvas.height = this.world.height * TILE_PX;
        if (this.editMode) {
            canvas.classList.add('maze-room-canvas-editing');
            canvas.addEventListener('click', (e) => this._handleCanvasClick(e, canvas));
        }
        this._drawWorld(canvas);
        section.appendChild(canvas);
        return section;
    }

    _handleCanvasClick(event, canvas) {
        if (!this.world || !this.editMode) return;
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((event.clientX - rect.left) / TILE_PX);
        const y = Math.floor((event.clientY - rect.top) / TILE_PX);
        if (x < 0 || x >= this.world.width || y < 0 || y >= this.world.height) return;

        const editor = this._ensureEditor();
        const result = editor.applyAt(this.world, x, y);
        this._editorMessage = result.description;
        if (result.ok && result.type !== 'noop') {
            this._runVerifier();
        }
        this.render();
    }

    _ensureEditor() {
        if (!this._editor) {
            this._editor = new MazeRoomEditor({
                itemLib: this.world?.itemLib ?? DEFAULT_ITEMS,
                obstacleLib: this.world?.obstacleLib ?? DEFAULT_OBSTACLES,
            });
        } else {
            // World may have been regenerated; refresh library refs.
            this._editor.setLibraries(
                this.world?.itemLib ?? DEFAULT_ITEMS,
                this.world?.obstacleLib ?? DEFAULT_OBSTACLES,
            );
        }
        return this._editor;
    }

    _renderEditor() {
        if (!this.editMode || !this.world) {
            const empty = document.createElement('div');
            empty.style.display = 'none';
            return empty;
        }
        const section = document.createElement('div');
        section.className = 'maze-room-editor';

        section.appendChild(this._renderEditorPalette());
        section.appendChild(this._renderVerifier());
        return section;
    }

    _renderEditorPalette() {
        const editor = this._ensureEditor();
        const wrap = document.createElement('div');
        wrap.className = 'maze-room-editor-palette';

        const title = document.createElement('div');
        title.className = 'maze-room-section-title';
        title.textContent = 'Palette';
        wrap.appendChild(title);

        const swatches = document.createElement('div');
        swatches.className = 'maze-room-editor-swatches';
        for (const entry of PALETTE_ENTRIES) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'maze-room-editor-swatch';
            if (entry.type === editor.selectedType) btn.classList.add('is-selected');
            btn.textContent = `${entry.glyph} ${entry.label}`;
            btn.addEventListener('click', () => {
                editor.selectType(entry.type);
                this.render();
            });
            swatches.appendChild(btn);
        }
        wrap.appendChild(swatches);

        // Item / obstacle ID pickers — visible only when relevant.
        if (editor.selectedType === PALETTE_TYPES.ITEM) {
            wrap.appendChild(this._renderIdPicker(
                'Item id',
                Object.keys(this.world.itemLib ?? DEFAULT_ITEMS),
                editor.selectedItemId,
                (id) => { editor.selectItemId(id); this.render(); },
            ));
        } else if (editor.selectedType === PALETTE_TYPES.OBSTACLE) {
            wrap.appendChild(this._renderIdPicker(
                'Obstacle id',
                Object.keys(this.world.obstacleLib ?? DEFAULT_OBSTACLES),
                editor.selectedObstacleId,
                (id) => { editor.selectObstacleId(id); this.render(); },
            ));
        }

        if (this._editorMessage) {
            const msg = document.createElement('div');
            msg.className = 'maze-room-editor-message';
            msg.textContent = this._editorMessage;
            wrap.appendChild(msg);
        }
        return wrap;
    }

    _renderIdPicker(label, ids, selectedId, onChange) {
        const row = document.createElement('div');
        row.className = 'maze-room-editor-id-picker';
        const lbl = document.createElement('label');
        lbl.textContent = label;
        const select = document.createElement('select');
        for (const id of ids) {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = id;
            if (id === selectedId) opt.selected = true;
            select.appendChild(opt);
        }
        select.addEventListener('change', () => onChange(select.value));
        lbl.appendChild(select);
        row.appendChild(lbl);
        return row;
    }

    _runVerifier() {
        if (!this.world) {
            this._verifierResult = null;
            return;
        }
        try {
            const extracted = extractPathsAndObstacles(this.world);
            const compiled = compileRegion(extracted, {
                obstacleLib: this.world.obstacleLib ?? DEFAULT_OBSTACLES,
            });
            const falseRules = countFalseRules(compiled);
            this._verifierResult = {
                compiled,
                falseRules,
                exits: compiled.exits ?? [],
                locations: compiled.locations ?? [],
            };
        } catch (err) {
            this._verifierResult = { error: err?.message ?? String(err) };
        }
    }

    _renderVerifier() {
        const wrap = document.createElement('div');
        wrap.className = 'maze-room-verifier';

        const header = document.createElement('div');
        header.className = 'maze-room-verifier-header';
        const title = document.createElement('div');
        title.className = 'maze-room-section-title';
        title.textContent = 'Verifier';
        header.appendChild(title);

        const rerunBtn = document.createElement('button');
        rerunBtn.type = 'button';
        rerunBtn.className = 'maze-room-btn';
        rerunBtn.textContent = 'Rerun';
        rerunBtn.addEventListener('click', () => {
            this._runVerifier();
            this.render();
        });
        header.appendChild(rerunBtn);
        wrap.appendChild(header);

        const result = this._verifierResult;
        if (!result) {
            const hint = document.createElement('div');
            hint.className = 'maze-room-hint';
            hint.textContent = 'Click an edit or press Rerun to run the verifier.';
            wrap.appendChild(hint);
            return wrap;
        }
        if (result.error) {
            const err = document.createElement('div');
            err.className = 'maze-room-verifier-error';
            err.textContent = `Error: ${result.error}`;
            wrap.appendChild(err);
            return wrap;
        }

        const summary = document.createElement('div');
        summary.className = 'maze-room-verifier-summary';
        const exitsCount = result.exits.length;
        const locsCount = result.locations.length;
        const falseCount = result.falseRules;
        if (falseCount > 0) summary.classList.add('has-false-rules');
        summary.textContent = `${exitsCount} exits, ${locsCount} locations · ${falseCount} False_ rule${falseCount === 1 ? '' : 's'}`;
        wrap.appendChild(summary);

        if (falseCount > 0) {
            const banner = document.createElement('div');
            banner.className = 'maze-room-verifier-banner';
            banner.textContent = '⚠ Unreachable exit/location detected. Path extractor returned no walkable paths from the entrance.';
            wrap.appendChild(banner);
        }

        wrap.appendChild(this._renderVerifierEntries('Exits', result.exits));
        wrap.appendChild(this._renderVerifierEntries('Locations', result.locations));
        return wrap;
    }

    _renderVerifierEntries(label, entries) {
        const section = document.createElement('div');
        section.className = 'maze-room-verifier-entries';
        const heading = document.createElement('div');
        heading.className = 'maze-room-verifier-entries-heading';
        heading.textContent = `${label}:`;
        section.appendChild(heading);

        if (!entries || entries.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'maze-room-hint';
            empty.textContent = '(none)';
            section.appendChild(empty);
            return section;
        }

        for (const entry of entries) {
            const row = document.createElement('div');
            row.className = 'maze-room-verifier-entry';
            const name = entry.global_name ?? entry.id ?? '?';
            const ruleStr = describeRule(entry.rule);
            const isFalse = isFalseRule(entry.rule);
            if (isFalse) row.classList.add('is-false');
            row.textContent = `${name} — ${ruleStr}`;
            section.appendChild(row);
        }
        return section;
    }

    _renderViewToggles() {
        const row = document.createElement('div');
        row.className = 'maze-room-view-toggles';

        const fogLabel = document.createElement('label');
        fogLabel.className = 'maze-room-view-toggle';
        const fogInput = document.createElement('input');
        fogInput.type = 'checkbox';
        fogInput.checked = this.fogEnabled;
        fogInput.addEventListener('change', () => {
            this.fogEnabled = fogInput.checked;
            this._saveViewSettings();
            if (this.fogEnabled) {
                // Toggling fog ON keeps the existing seen-set, but
                // also reveals the player's current tile + 4-coord-
                // adjacent so the player isn't blacked into a
                // single-tile pocket. Anything previously explored
                // stays visible; everything else fogs out.
                if (this.state) {
                    this._expandFogVisibility(this._computeVisibleAt(this.state.player_pos));
                }
            } else {
                // Toggling fog OFF reveals the current region in
                // full, matching the "fog off = all-on-entry"
                // semantics. Items and exits that haven't been
                // discovered yet under fog get marked discovered
                // now, so the discovery-mode filter (if on) doesn't
                // keep hiding them. Other regions the player
                // visited under fog stay partially discovered — they
                // get fully discovered next time the player walks
                // into them with fog off.
                this._discoverEverythingInRegion();
            }
            this.render();
        });
        fogLabel.appendChild(fogInput);
        fogLabel.appendChild(document.createTextNode(' Fog of war'));
        row.appendChild(fogLabel);

        const editLabel = document.createElement('label');
        editLabel.className = 'maze-room-view-toggle';
        const editInput = document.createElement('input');
        editInput.type = 'checkbox';
        editInput.checked = this.editMode;
        editInput.addEventListener('change', () => {
            this.editMode = editInput.checked;
            this._saveViewSettings();
            if (this.editMode && this.world) {
                // Auto-run the verifier on entering edit mode so the
                // initial state is visible without requiring an edit.
                this._runVerifier();
            }
            this.render();
        });
        editLabel.appendChild(editInput);
        editLabel.appendChild(document.createTextNode(' Edit mode'));
        row.appendChild(editLabel);

        // Direct Explore button — sidesteps the loops queue and the
        // substrate-handled-completion protocol so the explore mechanic
        // itself can be tested in isolation. Clicking kicks off the
        // same _resolveExploreTarget + walkToTile chain the queue would
        // drive, but completion just clears the local flag instead of
        // publishing loops:substrateActionCompleted. Disabled when no
        // world is loaded or when an explore is already running.
        const exploreBtn = document.createElement('button');
        exploreBtn.className = 'maze-room-explore-btn';
        exploreBtn.type = 'button';
        exploreBtn.textContent = 'Explore';
        exploreBtn.disabled = !this.world || !!this._directExploreActive || !!this._loopsDrivenAction;
        exploreBtn.addEventListener('click', () => this._onExploreButtonClick());
        row.appendChild(exploreBtn);

        return row;
    }

    /**
     * Direct-explore entry point bound to the Explore button. Drives
     * the same closestUnexplored autopath the queue's customAction
     * delegation uses, but with a separate `_directExploreActive` flag
     * so _onVisualizerChange's chain logic and the queue's completion
     * protocol stay independent.
     */
    _onExploreButtonClick() {
        if (!this.world) return;
        // Don't double-fire on top of an in-progress explore (direct or
        // queue-driven).
        if (this._directExploreActive || this._loopsDrivenAction) return;
        // Need a state with a player position. createState() seeds
        // state.player_pos on Generate; _adoptLoadedRegion seeds it
        // for procgen playback. Bail with a message in the unlikely
        // case neither has run.
        if (!this.state?.player_pos) return;
        this._directExploreActive = true;
        this.message = 'Exploring…';
        this.render();
        this._chainDirectExplore();
    }

    /**
     * Resolve the next explore leg and either walk it or finish.
     * Mirrors _chainExploreOrComplete's shape but uses the direct
     * flag instead of publishing to the loops queue.
     */
    _chainDirectExplore() {
        if (!this._directExploreActive) return;
        const next = this._resolveExploreTarget();
        if (next?.alreadyComplete) {
            this._directExploreActive = false;
            this.message = 'Explore complete: no reachable un-seen tiles.';
            this.render();
            return;
        }
        if (!next || !this._visualizer) {
            this._directExploreActive = false;
            this.render();
            return;
        }
        this._visualizer.walkToTile({ x: next.x, y: next.y, name: null });
        // walkToTile plans the path; we have to start the clock so
        // _tick actually fires through the plan.
        this._ensureVisualizerPlaying();
    }

    _drawWorld(canvas) {
        const ctx = canvas.getContext('2d');
        const w = this.world;
        const itemLib = w.itemLib ?? DEFAULT_ITEMS;
        const obstacleLib = w.obstacleLib ?? DEFAULT_OBSTACLES;
        const currentInv = this._currentInventory();
        // Build a clearance options bag once. When stateManager has
        // a snapshot ready, isObstacleCleared dispatches rule-typed
        // obstacles through the shared rule engine (full Rule Builder
        // schema). When it doesn't (dev/standalone), the local subset
        // evaluator handles Has/And/Or/True_/False_ as before.
        const ruleEvaluator = this._currentRuleEvaluator();
        const clearOpts = ruleEvaluator ? { evaluateRule: ruleEvaluator } : undefined;

        // Tile base layer: floor / wall.
        for (let y = 0; y < w.height; y++) {
            for (let x = 0; x < w.width; x++) {
                const tile = getTile(w, x, y);
                ctx.fillStyle = tile === TILE_WALL ? COLORS.wall : COLORS.floor;
                ctx.fillRect(x * TILE_PX, y * TILE_PX, TILE_PX, TILE_PX);
            }
        }

        // Build a quick lookup from tile coords to the exit at that
        // position (if any), so the per-tile rendering decisions
        // below don't have to walk world.exits each time.
        const exitAt = new Map();
        for (const e of w.exits.values()) {
            exitAt.set(`${e.x},${e.y}`, e);
        }

        // Per-location pickup truth in playback mode — see
        // _currentCheckedLocations for why inventory-keyed checks
        // can't stand in for this (multi-instance items, e.g.
        // Adventure's 12 Freeincarnates).
        const isPlayback = this.externalInventory !== null;
        const checkedLocations = this._currentCheckedLocations();

        // §5 rendering pass — exits, entrance border, combo-list
        // obstacles, items, and gate borders, in an order that gets
        // each tile's stack of overlays right.
        for (let y = 0; y < w.height; y++) {
            for (let x = 0; x < w.width; x++) {
                const key = `${x},${y}`;
                // Fog of war: tiles outside the seen-set get blacked
                // out at the end of this method. Skip overlay work
                // here so undiscovered items / exits / gate borders
                // don't even render before the blackout.
                if (this.fogEnabled && !this._isTileVisibleForRender(x, y)) continue;
                const obstacleId = w.obstacles.get(key);
                const obstacle = obstacleId ? obstacleLib[obstacleId] : null;
                const isLogicGate = obstacle?.clear_set_type === 'rule';
                const gateClosed = isLogicGate
                    && !isObstacleCleared(obstacleId, currentInv, obstacleLib, clearOpts);
                const exit = exitAt.get(key);
                const isExit = !!exit;
                const isEntrance = (x === w.entrance.x && y === w.entrance.y);
                const itemId = w.items.get(key);
                // Playback mode tracks pickups per-location (locationName
                // baked into the sidecar) so multi-instance items only
                // disappear at the specific tile that was checked.
                // Generate dev flow has no locationNames — falls back
                // to the inventory-keyed check.
                const locationName = isPlayback ? w.itemLocationNames?.get(key) : null;
                const itemCollected = isPlayback
                    ? (locationName ? checkedLocations.has(locationName) : false)
                    : currentInv.has(itemId);
                const itemHere = itemId && !itemCollected;

                // Discovery filter — only applies in playback mode.
                // Exits hide their fill and items hide their sprite
                // when discovery mode is active and the entry hasn't
                // been discovered yet. Underlying tile (floor / wall /
                // entrance) still renders; only the AP-overlays gate.
                const exitVisible = !isPlayback || !exit
                    || this._isExitVisibleToUI(exit);
                const locationVisible = !isPlayback || !locationName
                    || this._isLocationVisibleToUI(locationName);

                // Exit fill: green by default, red when a logic gate
                // sits on the tile and isn't cleared. (Both-row of
                // §5 table is "follows the exit row" — this branch
                // covers it because we don't paint the entrance
                // border when isExit is true.)
                if (isExit && exitVisible) {
                    ctx.fillStyle = (isLogicGate && gateClosed) ? COLORS.exitBlocked : COLORS.exit;
                    ctx.fillRect(x * TILE_PX, y * TILE_PX, TILE_PX, TILE_PX);
                }

                // Combo-list obstacles (colored doors) keep their
                // existing rendering. Logic gates are NOT painted as
                // tile-fill obstacles — their visual is handled
                // through the exit-fill / location-border paths.
                if (obstacle && !isLogicGate) {
                    const color = obstacle.color ?? '#b84040';
                    // combo_list obstacles (colored doors) don't use
                    // the rule engine — clearOpts is harmless here
                    // but unnecessary; pass it for symmetry.
                    const cleared = isObstacleCleared(obstacleId, currentInv, obstacleLib, clearOpts);
                    if (cleared) {
                        ctx.save();
                        ctx.globalAlpha = 0.4;
                        ctx.strokeStyle = color;
                        ctx.lineWidth = 1.5;
                        ctx.setLineDash([3, 3]);
                        ctx.strokeRect(x * TILE_PX + 3, y * TILE_PX + 3, TILE_PX - 6, TILE_PX - 6);
                        ctx.restore();
                    } else {
                        ctx.fillStyle = color;
                        ctx.fillRect(x * TILE_PX + 2, y * TILE_PX + 2, TILE_PX - 4, TILE_PX - 4);
                        ctx.strokeStyle = '#000';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(x * TILE_PX + 2, y * TILE_PX + 2, TILE_PX - 4, TILE_PX - 4);
                    }
                }

                // Items: a circle in the library's color. Skipped
                // when the player already collected the item, or when
                // discovery mode hides this location. Foreign items
                // (no library entry) get a hash-derived color and a
                // first-letter label so they're visually distinguishable
                // from each other and from known items.
                if (itemHere && locationVisible) {
                    const hints = getItemRenderHints(itemId, itemLib);
                    ctx.fillStyle = hints.color;
                    const cx = x * TILE_PX + TILE_PX / 2;
                    const cy = y * TILE_PX + TILE_PX / 2;
                    ctx.beginPath();
                    ctx.arc(cx, cy, TILE_PX * 0.3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                    if (hints.label) {
                        ctx.save();
                        ctx.fillStyle = '#000';
                        ctx.font = `bold ${Math.floor(TILE_PX * 0.45)}px sans-serif`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(hints.label, cx, cy);
                        ctx.restore();
                    }
                }

                // Closed logic gate marker: 2px red border. Drawn
                // independently of the item sprite so the gate stays
                // visible even after its underlying location's item
                // has been "collected" — which can happen for any
                // tile sharing an item id with an already-checked
                // location, since `currentInv` is keyed by item name
                // not location name. (See §5 — the spec's "Location
                // closed" row anticipated only the item-present case;
                // this fallback covers the no-item case too.) Skipped
                // on exit tiles, which already render their closed
                // state via the full red fill above. Also hidden when
                // discovery mode filters this location — otherwise
                // the border would leak "something's here" before the
                // location was supposed to be visible.
                if (isLogicGate && gateClosed && !isExit && locationVisible) {
                    ctx.strokeStyle = COLORS.locationBlocked;
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x * TILE_PX + 1, y * TILE_PX + 1, TILE_PX - 2, TILE_PX - 2);
                }

                // Entrance border: 2px solid green, only when the
                // tile isn't also an exit (per the §5 "both = exit
                // row" rule).
                if (isEntrance && !isExit) {
                    ctx.strokeStyle = COLORS.entrance;
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x * TILE_PX + 1, y * TILE_PX + 1, TILE_PX - 2, TILE_PX - 2);
                }
            }
        }

        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1;
        for (let x = 0; x <= w.width; x++) {
            ctx.beginPath();
            ctx.moveTo(x * TILE_PX + 0.5, 0);
            ctx.lineTo(x * TILE_PX + 0.5, w.height * TILE_PX);
            ctx.stroke();
        }
        for (let y = 0; y <= w.height; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * TILE_PX + 0.5);
            ctx.lineTo(w.width * TILE_PX, y * TILE_PX + 0.5);
            ctx.stroke();
        }

        // Fog overlay — paint solid black over every unseen tile. Runs
        // after grid lines so the grid doesn't leak the unexplored
        // shape, and before the player render so the player always
        // shows on top. Player's own tile is always in the seen-set
        // (any movement onto it expanded visibility), so this never
        // covers the player.
        if (this.fogEnabled) {
            const seen = this.seenTilesByRegion.get(this._seenSetKey());
            ctx.fillStyle = '#000';
            for (let y = 0; y < w.height; y++) {
                for (let x = 0; x < w.width; x++) {
                    if (seen && seen.has(`${x},${y}`)) continue;
                    ctx.fillRect(x * TILE_PX, y * TILE_PX, TILE_PX, TILE_PX);
                }
            }
        }

        if (this.state) {
            const { x, y } = this.state.player_pos;
            ctx.fillStyle = COLORS.player;
            ctx.beginPath();
            ctx.arc(x * TILE_PX + TILE_PX / 2, y * TILE_PX + TILE_PX / 2, TILE_PX * 0.35, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // --- Generation ---

    _runGeneration() {
        if (this.isGenerating) return;
        this.isGenerating = true;
        this.message = '';
        this.render();

        try {
            const { world, stats } = generateMaze({
                width: this.params.width,
                height: this.params.height,
                seed: this.params.seed,
                biome: { id: this.params.biomeId ?? DEFAULT_BIOME_ID },
                params: {
                    maxIterations: this.params.maxIterations,
                    stallLimit: this.params.stallLimit,
                },
            });
            this.world = world;
            this.state = createState(world);
            this.stats = stats;
            // Generate dev flow uses state.inventory directly — drop
            // any external inventory left over from a prior LoadRegion
            // session in this panel.
            this.externalInventory = null;
            this.externalCheckedLocations = null;
            this.currentRegionId = null;
            // Reset the local-flow seen-set so a fresh Generate doesn't
            // inherit fog state from the prior maze. Then seed the
            // spawn's 4-coord-adjacent visibility so the player isn't
            // blacked into a single tile when fog is on. (Procgen
            // playback's _adoptLoadedRegion does the same thing keyed
            // by the loaded region id.)
            this.seenTilesByRegion.delete('__local__');
            if (this.fogEnabled) {
                this._expandFogVisibility(this._computeVisibleAt(this.state.player_pos));
            }
            // Re-point the visualizer at the freshly-generated world so
            // its step log starts clean and pathfinding sees the new
            // tile layout. Pass freshStart: true to clear any
            // inventory carried over from a prior playback session
            // (e.g., if the user was running through preset regions
            // before clicking Generate).
            this._visualizer?.setWorld(world, null, { freshStart: true });
        } catch (e) {
            this.message = `ERROR: ${e.message}`;
        }

        this.isGenerating = false;
        this.render();
        this.rootElement.focus();
    }

    // --- Play ---

    _handleKeydown(e) {
        if (!this.world || !this.state) return;
        // Backspace: editing op (not a queue verb). Removes the action
        // just before the cursor (or the last pending action if cursor
        // is at tail / null). No-ops in the done region.
        if (e.key === 'Backspace') {
            e.preventDefault();
            const q = this._mazeQueue;
            const cursor = q.editCursor ?? q.length;
            if (cursor > q.executionIndex) {
                q.deleteAt(cursor - 1);
                this.render();
            }
            return;
        }
        const spec = KEY_MAP[e.key];
        if (!spec) return;
        e.preventDefault();
        // Cancel an active replay so direct input takes over. Pressed
        // key still routes through the queue as normal — replay's
        // pending tail is preserved, but the user is now in control.
        if (this._replayDriver) {
            this._stopReplay();
        }
        // Route through the queue. Append-and-execute fires the
        // executor synchronously when cursor is at tail; pure insert
        // when cursor is set mid-queue. Either way the queue's state
        // is current before render().
        this._mazeQueue.handleInput(spec);
        this.render();
    }

    /**
     * Load a saved best-queue into the maze queue and start a replay
     * driver that calls stepOne() on a fixed clock. Saved actions are
     * appended after any existing pending actions (which are kept) so
     * the user's in-progress queue isn't silently destroyed. Cancels
     * any prior replay first.
     *
     * @param {string} key - bestPathKey() result for the entry.
     */
    _replayBestPath(key) {
        const gs = getGameStateSingleton?.();
        if (!gs) return;
        const stored = gs.getBestPath(key);
        if (!stored || !Array.isArray(stored.actions) || stored.actions.length === 0) return;
        this._stopReplay();
        this._mazeQueue.appendAll(stored.actions);
        this._startReplayDriver();
        this.render();
        this.rootElement?.focus();
    }

    _startReplayDriver() {
        if (this._replayDriver) return;
        const tick = () => {
            if (this._mazeQueue.isIdle()) {
                this._stopReplay();
                this.render();
                return;
            }
            this._mazeQueue.stepOne();
            this.render();
        };
        this._replayDriver = setInterval(tick, this._replayTickMs);
    }

    _stopReplay() {
        if (this._replayDriver) {
            clearInterval(this._replayDriver);
            this._replayDriver = null;
        }
    }

    /**
     * Collect saved best-queue entries for the current (region,
     * arrivedFromExitId) so the UI can render replay buttons. Each
     * entry is decoded from its key into a human-readable label —
     * "exit: <exitName>" / "check: <locationName>". Sorted cheapest
     * first.
     */
    _getReplayableTargets() {
        const gs = getGameStateSingleton?.();
        if (!gs || !this.currentRegionId) return [];
        const fromPart = this.arrivedFromExitId ?? 'entrance';
        const prefix = `${this.currentRegionId}|${fromPart}|`;
        const out = [];
        for (const [key, value] of gs.bestPaths.entries()) {
            if (!key.startsWith(prefix)) continue;
            const tail = key.substring(prefix.length);
            let label = null;
            if (tail.startsWith('exit:')) {
                const exitId = tail.substring('exit:'.length);
                const exit = this.world?.exits?.get?.(exitId);
                const exitLabel = exit?.exitName ?? exit?.targetRegion ?? exitId;
                label = `exit: ${exitLabel}`;
            } else if (tail.startsWith('loc:')) {
                label = `check: ${tail.substring('loc:'.length)}`;
            }
            if (label) {
                out.push({
                    key,
                    label,
                    totalCost: value.totalCost,
                    actionCount: value.actions.length,
                });
            }
        }
        out.sort((a, b) => a.totalCost - b.totalCost);
        return out;
    }

    /**
     * Record the direct-keyboard walk's path-so-far into gameState's
     * bestPaths if it beats the existing entry. Called on fresh
     * pickup / exit cross during direct play (not loops-delegated).
     *
     * Uses the queue's done actions as the action sequence — every
     * keypress that ran via append-and-execute produced exactly one
     * done action. Skips when manaEnabled is off (cost = 0 makes
     * "best" comparisons meaningless).
     */
    _recordDirectWalkIfBetter(toRef) {
        const gs = getGameStateSingleton?.();
        if (!gs || !this.currentRegionId) return;
        if (!this.world?.manaEnabled) return;
        if (this.externalInventory === null) return;
        if (this._loopsDrivenAction) return;
        const key = bestPathKey(this.currentRegionId, this.arrivedFromExitId, toRef);
        if (!key) return;
        const doneSlice = this._mazeQueue.actions.slice(0, this._mazeQueue.executionIndex);
        if (doneSlice.length === 0) return;
        const actions = doneSlice.map((a) => {
            const out = { type: a.type };
            if (a.dir !== undefined) out.dir = a.dir;
            if (a.locationName !== undefined) out.locationName = a.locationName;
            return out;
        });
        // For location targets the pickup happened as a side effect of
        // the last move (no locationCheck verb in the done slice). Add
        // the explicit verb so saved-queue replay reproduces the check.
        if (toRef.kind === 'location' && toRef.locationName) {
            actions.push({ type: 'locationCheck', locationName: toRef.locationName });
        }
        gs.recordBestPath(key, {
            actions,
            totalCost: this._directWalkCost,
            itemsPickedUp: [...this._directWalkItems],
            locationsChecked: [...this._directWalkLocations],
        });
    }

    /**
     * Executor injected into the queue. Dispatches on action type.
     * Called synchronously by MazeRoomQueue.handleInput (append-and-
     * execute path) and by stepOne (replay paths, future phases).
     */
    _executeQueueAction(action) {
        if (action.type === ACTION_MOVE) {
            this._executeMoveAction(action.dir);
        } else if (action.type === ACTION_WAIT) {
            this._executeWaitAction();
        } else if (action.type === ACTION_LOCATION_CHECK) {
            this._executeLocationCheckAction(action.locationName);
        }
    }

    /**
     * Execute a queued move. Mirrors the pre-queue _handleKeydown
     * move logic exactly: step() with the panel's rule evaluator,
     * playback-mode mana deduction + event publishing, fog
     * expansion, end-of-region message. A blocked move (step returns
     * null) is a no-op for state/mana/events — the queue still
     * advances per the plan's "queued move becomes a no-op for that
     * step" semantics.
     */
    _executeMoveAction(dir) {
        if (!this.world || !this.state) return;
        const input = MOVE_DIR_TO_INPUT[dir];
        if (!input) return;
        // In playback mode (externalInventory non-null) the snapshot is
        // truth and step() must not mutate state.inventory; in Generate
        // dev mode the override is undefined and step keeps its
        // historical pickup-into-state.inventory behavior.
        const oldPos = { x: this.state.player_pos.x, y: this.state.player_pos.y };
        // Use the same clearance evaluator path as the renderer so a
        // visibly-open logic gate is also walkable (and a closed one
        // blocks). Falls through to the local subset evaluator when
        // no snapshot is loaded.
        const ruleEvaluator = this._currentRuleEvaluator();
        const clearOpts = ruleEvaluator ? { evaluateRule: ruleEvaluator } : undefined;
        const next = step(this.world, this.state, input, this.externalInventory ?? undefined, clearOpts);
        if (next === null) return;
        this.state = next;
        if (this.externalInventory !== null) {
            // Phase 3: deduct mana for the tile-step before publishing
            // events. Charges location cost if the new tile holds an
            // unchecked location, otherwise the per-tile move cost.
            // The deduction is gated on world.manaEnabled and on loop
            // mode being inactive (loops queue handles deduction itself
            // when active). The check uses pre-event checkedLocations,
            // matching the user's spec ("moving onto a tile with an
            // unchecked location uses the location cost").
            const cost = this._deductMazeStepMana(next.player_pos);
            if (this.world?.manaEnabled && !this._loopsDrivenAction) {
                this._directWalkCost += cost;
            }
            this._publishPlaybackEvents(oldPos, next.player_pos);
        }
        // Fog of war: expand the seen-set with the new position's
        // visibility (the new tile + 4-coord-adjacent). Newly-visible
        // items / exits get their discoveries fired here. Cheap when
        // fog is off — _expandFogVisibility no-ops if seen-set hasn't
        // been initialised, and we don't compute visibility unless
        // fog is enabled.
        if (this.fogEnabled) {
            this._expandFogVisibility(this._computeVisibleAt(next.player_pos));
        }
        if (isExit(this.world, this.state.player_pos.x, this.state.player_pos.y)) {
            this.message = `Reached exit in ${this.state.turn} steps.`;
        }
    }

    /**
     * Execute a queued wait. No movement, no event publish, no fog
     * change. In playback mode, deducts mana at the per-tile-move
     * rate (same cost as a move-onto-floor, per the plan's "wait
     * has same mana cost as move"). When hazards land in a later
     * phase, this is where the per-tick hazard advance fires.
     */
    _executeWaitAction() {
        if (!this.world || !this.state) return;
        if (this.externalInventory === null) return;
        if (!this._shouldDeductMazeMana()) return;
        const gs = getGameStateSingleton?.();
        if (!gs) return;
        const cost = this._perTileMoveCost();
        gs.deductMana(cost);
        if (this.currentRegionId) gs.addRegionXP(this.currentRegionId, cost);
        if (!this._loopsDrivenAction) {
            this._directWalkCost += cost;
        }
        if (gs.getCurrentMana() <= 0) {
            this._fireLoopReset();
        }
    }

    /**
     * Execute a queued locationCheck. Direct keyboard input doesn't
     * emit this verb in v1 — location checks fire as a side effect of
     * stepping onto a location tile via _publishPlaybackEvents. This
     * path exists for loops-delegation expansion and saved-queue
     * replay (later phases): when the queue is asked to check a
     * specific named location, fire the dispatcher event.
     *
     * No-ops outside playback mode (no AP snapshot to claim against).
     */
    _executeLocationCheckAction(locationName) {
        if (!locationName) return;
        if (this.externalInventory === null) return;
        const dispatcher = this.apis?.dispatcher;
        if (!dispatcher?.publish) return;
        dispatcher.publish('user:locationCheck', {
            locationName,
            regionName: this.currentRegionId,
        }, { initialTarget: 'bottom' });
    }

    /**
     * Translate substrate-internal step events into AP-level
     * dispatcher events. Only called in playback mode (after a
     * maze:loadRegion). Skips events that lack the AP metadata they
     * would need (no locationName for a pickup, no targetRegion for
     * an exit cross — both can be null when the sidecar didn't have
     * them, e.g. unstitched grid-edge exits).
     */
    _publishPlaybackEvents(oldPos, newPos) {
        const dispatcher = this.apis?.dispatcher;
        if (!dispatcher?.publish) return;
        const events = detectStepEvents(this.world, oldPos, newPos, this.externalInventory);
        const checkedLocations = this._currentCheckedLocations();
        for (const ev of events) {
            if (ev.type === 'pickup') {
                const key = `${ev.position.x},${ev.position.y}`;
                const locationName = this.world.itemLocationNames?.get(key);
                if (!locationName) continue;
                // Idempotency is per-location, not per-item: stepping
                // onto a second instance of an already-collected item
                // (Adventure has 12 Freeincarnates) must still fire
                // a check for THIS location.
                if (checkedLocations.has(locationName)) continue;
                // Track + record direct walk before publishing — the
                // publish may trigger a region transition synchronously
                // (rare for locationCheck, but defensive).
                if (this.world?.manaEnabled && !this._loopsDrivenAction) {
                    if (ev.itemId && !this._directWalkItems.includes(ev.itemId)) {
                        this._directWalkItems.push(ev.itemId);
                    }
                    if (!this._directWalkLocations.includes(locationName)) {
                        this._directWalkLocations.push(locationName);
                    }
                    this._recordDirectWalkIfBetter({ kind: 'location', locationName });
                }
                // system:locationCheck (not user:) — keyboard play
                // and bot play both route through here; using system:
                // avoids the Phase 2 intercept swallowing the bot's
                // own pickups.
                dispatcher.publish('system:locationCheck', {
                    locationName,
                    regionName: this.currentRegionId,
                }, { initialTarget: 'bottom' });
            } else if (ev.type === 'exit_cross') {
                const exit = this.world.exits.get(ev.exit_id);
                if (!exit?.targetRegion) continue;
                // Record direct walk to this exit BEFORE publishing —
                // the publish triggers the region transition, which
                // clears the queue + tracking state.
                if (this.world?.manaEnabled && !this._loopsDrivenAction) {
                    this._recordDirectWalkIfBetter({ kind: 'exit', exitId: ev.exit_id });
                }
                dispatcher.publish('user:regionMove', {
                    sourceRegion: this.currentRegionId,
                    targetRegion: exit.targetRegion,
                    exitName: exit.exitName ?? null,
                }, { initialTarget: 'bottom' });
            }
        }
    }

    // --- localStorage ---

    _saveToLocalStorage() {
        try {
            localStorage.setItem(LS_KEY, JSON.stringify(this.params));
            this.message = 'Parameters saved.';
            this.render();
        } catch (e) {
            this.message = `ERROR saving params: ${e.message}`;
            this.render();
        }
    }

    _loadFromLocalStorage() {
        try {
            const stored = localStorage.getItem(LS_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                this.params = { ...DEFAULT_PARAMS, ...parsed };
            }
        } catch (e) {
            // ignore
        }
        try {
            const view = localStorage.getItem(LS_VIEW_KEY);
            if (view) {
                const parsed = JSON.parse(view);
                this.fogEnabled = !!parsed?.fogEnabled;
                this.editMode = !!parsed?.editMode;
                if (typeof parsed?.genControlsVisible === 'boolean') {
                    this.genControlsVisible = parsed.genControlsVisible;
                }
                if (Array.isArray(parsed?.collapsedSections)) {
                    this.collapsedSections = new Set(parsed.collapsedSections);
                }
            }
        } catch (e) {
            // ignore
        }
    }

    _saveViewSettings() {
        try {
            localStorage.setItem(LS_VIEW_KEY, JSON.stringify({
                fogEnabled: this.fogEnabled,
                editMode: this.editMode,
                genControlsVisible: this.genControlsVisible,
                collapsedSections: Array.from(this.collapsedSections),
            }));
        } catch (e) {
            // ignore
        }
    }
}

function countFalseRules(compiled) {
    let count = 0;
    for (const arr of [compiled.exits ?? [], compiled.locations ?? []]) {
        for (const entry of arr) {
            if (isFalseRule(entry.rule)) count += 1;
        }
    }
    return count;
}

function isFalseRule(rule) {
    return rule?.rule === 'False_';
}

function formatLogEntry(entry) {
    if (!entry) return '';
    if (entry.description) return entry.description;
    if (entry.type === 'step') {
        const eventStr = entry.events?.length ? `  [${entry.events.join('; ')}]` : '';
        return `step ${entry.input}: (${entry.from.x},${entry.from.y}) → (${entry.to.x},${entry.to.y})${eventStr}`;
    }
    return entry.type;
}

function describeRule(rule) {
    if (!rule) return '(none)';
    if (rule.rule === 'True_') return 'True_';
    if (rule.rule === 'False_') return 'False_  ⚠';
    if (rule.rule === 'Has') return `Has(${rule.args?.item_name ?? '?'})`;
    if (rule.rule === 'HasAll') return `HasAll(${(rule.args?.items ?? []).join(', ')})`;
    if (rule.rule === 'HasAny') return `HasAny(${(rule.args?.items ?? []).join(', ')})`;
    if (rule.rule === 'And') return `And(${(rule.children ?? []).map(describeRule).join(', ')})`;
    if (rule.rule === 'Or') return `Or(${(rule.children ?? []).map(describeRule).join(', ')})`;
    return rule.rule ?? JSON.stringify(rule);
}
