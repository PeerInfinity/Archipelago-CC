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
    walkerTrials: 20,
    walkerStepBudget: null, // null = auto (4 * width * height)
    minSuccessPct: 30,      // percent; null disables the difficulty gate
    maxSuccessPct: 90,      // percent; null disables the difficulty gate
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

const KEY_MAP = {
    ArrowUp: INPUT_N, w: INPUT_N, W: INPUT_N,
    ArrowDown: INPUT_S, s: INPUT_S, S: INPUT_S,
    ArrowLeft: INPUT_W, a: INPUT_W, A: INPUT_W,
    ArrowRight: INPUT_E, d: INPUT_E, D: INPUT_E,
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

        // Phase 5 single-trigger: the presets-panel bot publishes
        // playback:command events to remote-control this panel's
        // visualizer. Lets the user press Play once in the bot and
        // have the maze panel auto-walk across regions via the
        // existing exit-cross → user:regionMove → maze:loadRegion
        // chain.
        const commandHandler = (data) => {
            if (!this._visualizer) return;
            const cmd = data?.command;
            switch (cmd) {
                case 'play':    this._visualizer.play(data?.rateHz); break;
                case 'stop':    this._visualizer.stop(); break;
                case 'step':    this._visualizer.step(); break;
                case 'instant': this._visualizer.instant(); break;
                case 'reset':   this._visualizer.freshStart(); break;
                case 'setRate': this._visualizer.setRate(data?.rateHz); break;
                case 'walkTo':  this._handleWalkToCommand(data?.target); break;
                default: break;
            }
        };
        eventBus.subscribe('playback:command', commandHandler, 'mazeRoom');
        this._unsubPlaybackCommand = () => eventBus.unsubscribe('playback:command', commandHandler, 'mazeRoom');
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
     * Tiles that have been visible at any point during this session
     * for the current region. Lazily creates the entry for the
     * current region if it doesn't exist yet.
     */
    _seenTilesForCurrentRegion() {
        if (!this.currentRegionId) return null;
        let s = this.seenTilesByRegion.get(this.currentRegionId);
        if (!s) {
            s = new Set();
            this.seenTilesByRegion.set(this.currentRegionId, s);
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
        const seen = this.seenTilesByRegion.get(this.currentRegionId);
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
        //   - Fog OFF: walking into a region reveals every location
        //     and exit (matches the text-adventure substrate).
        //   - Fog ON: only tiles within the spawn's visibility are
        //     revealed. Further tiles uncover as the player explores
        //     (see _onStep). Re-entering a region keeps the seen-set
        //     it accumulated last visit.
        if (this.fogEnabled) {
            const initialVisible = this._computeVisibleAt(this.state.player_pos);
            this._expandFogVisibility(initialVisible);
        } else {
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
        if (this._unsubPlaybackCommand) { this._unsubPlaybackCommand(); this._unsubPlaybackCommand = null; }
        if (this._unsubDiscoveryMode) { this._unsubDiscoveryMode(); this._unsubDiscoveryMode = null; }
        if (this._unsubDiscoveryChanged) { this._unsubDiscoveryChanged(); this._unsubDiscoveryChanged = null; }
        if (this._playbackBar) { this._playbackBar.destroy(); this._playbackBar = null; }
        if (this._visualizer) { this._visualizer.stop(); this._visualizer = null; }
        setPanelInstance(null);
    }
    onPanelShow() { this.render(); this.rootElement?.focus(); }
    onPanelResize() {}

    render() {
        if (!this.rootElement) return;
        this.rootElement.innerHTML = '';
        this.rootElement.appendChild(this._renderParams());
        this.rootElement.appendChild(this._renderActions());
        this.rootElement.appendChild(this._renderPlaybackBar());
        this.rootElement.appendChild(this._renderStats());
        this.rootElement.appendChild(this._renderMaze());
        this.rootElement.appendChild(this._renderPlaybackLogSection());
        this.rootElement.appendChild(this._renderEditor());
        this.rootElement.appendChild(this._renderRules());
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
        dispatcher.publish('user:regionMove', {
            sourceRegion: sourceRegion ?? this.currentRegionId,
            targetRegion: exit.targetRegion,
            exitName: exit.exitName ?? null,
        }, { initialTarget: 'bottom' });
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
        dispatcher.publish('system:locationCheck', {
            locationName,
            regionName: regionId ?? this.currentRegionId,
            itemId: itemId ?? null,
        }, { initialTarget: 'bottom' });
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
        if (vState?.player_pos && this.state) {
            this.state.player_pos = { ...vState.player_pos };
        }
        // Fog of war: expand the seen-set on each visualizer step
        // the same way keyboard play does, so fog-on playback uncovers
        // tiles as the bot explores.
        if (this.fogEnabled && this.state) {
            this._expandFogVisibility(this._computeVisibleAt(this.state.player_pos));
        }
        this.render();
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
        section.innerHTML = '<div class="maze-room-section-title">Parameters</div>';

        const grid = document.createElement('div');
        grid.className = 'maze-room-grid';

        const fields = [
            { key: 'seed',             label: 'Seed',              min: 0 },
            { key: 'width',            label: 'Width',             min: 2,   max: 80 },
            { key: 'height',           label: 'Height',            min: 2,   max: 80 },
            { key: 'maxIterations',    label: 'Max iterations',    min: 1,   max: 100000 },
            { key: 'stallLimit',       label: 'Stall limit',       min: 1,   max: 10000 },
            { key: 'walkerTrials',     label: 'Walker trials',     min: 1,   max: 500 },
            { key: 'walkerStepBudget', label: 'Step budget',       min: 1,   max: 100000, nullable: true, placeholder: 'auto' },
            { key: 'minSuccessPct',    label: 'Min success %',     min: 0,   max: 100,    nullable: true, placeholder: 'off' },
            { key: 'maxSuccessPct',    label: 'Max success %',     min: 0,   max: 100,    nullable: true, placeholder: 'off' },
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

        const parts = [
            `iter ${this.stats.iterations}`,
            `accepted ${this.stats.accepted}`,
            `rej ${this.stats.rejected} (feas ${this.stats.rejectedFeasibility}, diff ${this.stats.rejectedDifficulty})`,
            `path ${this.stats.shortestPath ?? '—'}`,
        ];
        if (this.stats.difficultyGateOn && this.stats.finalSuccessFraction != null) {
            parts.push(`walker ${(this.stats.finalSuccessFraction * 100).toFixed(0)}%`);
        }
        if (this.stats.gateKeyPlaced) {
            parts.push('gate+key');
        } else if (this.stats.gateKeyReason && this.stats.gateKeyReason !== 'disabled') {
            parts.push(`no-gate (${this.stats.gateKeyReason})`);
        }
        let status = 'complete';
        if (this.stats.stalled) status = 'stalled';
        else if (this.stats.reachedTarget) status = 'target';
        parts.push(status);

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

        return row;
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
            const seen = this.seenTilesByRegion.get(this.currentRegionId);
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
                params: {
                    maxIterations: this.params.maxIterations,
                    stallLimit: this.params.stallLimit,
                    walkerTrials: this.params.walkerTrials,
                    walkerStepBudget: this.params.walkerStepBudget,
                    minSuccessPct: this.params.minSuccessPct == null ? null : this.params.minSuccessPct / 100,
                    maxSuccessPct: this.params.maxSuccessPct == null ? null : this.params.maxSuccessPct / 100,
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
        const input = KEY_MAP[e.key];
        if (!input) return;
        e.preventDefault();
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
        this.render();
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
