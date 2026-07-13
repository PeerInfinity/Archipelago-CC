/**
 * procgenPipeline UI — two-section library picker, pipeline
 * parameters, a Generate button, a composited grid canvas, and a
 * collapsible compiled-rules JSON block.
 */

import { setPanelInstance, getModuleApis } from './index.js';
import eventBus from '../../app/core/eventBus.js';
import {
    growMaze,
    rebuildSphereTopology,
    buildRulesJson,
    stringifyRulesJson,
    getRegionExits,
    reRollSphereRegion,
    buildRegionContract,
    buildTopDownRegionContract,
    moveSphereRegion,
    swapSphereRegions,
    moveSphereExitSide,
    swapSphereExitSides,
    Grid,
} from './procgenPipelineEngine.js';
// The sphere-growth pipeline steps + envelope serde live in the shared
// runner now; the panel delegates each step to it (no drift with the CLI).
import {
    SPHERE_STEPS, runStep, nextSphereStep, growConfigFrom,
    serializeEnvelope, importSphereEnvelope, detectCompleted,
    resolveSpheresPerBatch, truncateSphereWorld, appendSphere,
} from './sphereSteps.js';
// The top-down pipeline steps live in their own shared runner (same pattern as
// sphereSteps): layout → realise (streamed) → finalize → compile.
import {
    TOPDOWN_STEPS, runTopDownStep, nextTopDownStep, buildTopDownEnvelope,
} from './topDownSteps.js';
// The shuffled-spiral pipeline steps live in their own shared runner too (same
// harness as sphere/top-down): ① arrange → ② content [no-op] → ③ regions →
// ④ compile. Running all four reproduces the monolithic arrangeShuffledSpiral +
// buildRulesJson byte-for-byte (dump-spiral-byteidentity.mjs).
import {
    SPIRAL_STEPS, runSpiralStep, nextSpiralStep, newSpiralEnvelope,
} from './spiralSteps.js';
import {
    TILE_WALL, getTile, getObstacle, getItem,
} from '../mazeRoom/mazeRoomEngine.js';
import {
    DEFAULT_ITEMS, DEFAULT_OBSTACLES,
    isObstacleCleared, getItemRenderHints,
} from '../shared/procgen/library.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import {
    defaultProcgenParams, activeSubstrateIds,
    collectSphereGrowthPrep, assembleRegionParams,
} from './sphereConfigHooks.js';
import { getRegionEditor } from './regionEditors.js';
import { peekSphereStateSingleton } from '../sphereState/singleton.js';
import {
    SHIPPED_PRESETS, capturePresetState, applyPresetState,
    getPresetById, loadUserPresets, saveUserPreset, deleteUserPreset,
} from './presetDefs.js';
// Region-library (F3/F5) — the headless loader core (fetch/parse/validate served
// + ad-hoc libraries; selection → spiral config) plus the identity stamper the
// F5 capture-and-download path needs. All DOM/persistence chrome lives here.
import {
    loadServedIndex, loadServedLibrary, parseRegionLibrary,
    serializeLibrarySelection, resolveLibrarySelection,
    buildLibrarySpiralConfig,
} from './regionLibraryLoader.js';
import { stampLibraryIdentity, REGION_LIBRARY_SCHEMA_VERSION } from './regionLibraryValidator.js';

const LS_KEY = 'procgenPipeline_params';
// View preferences (toggle states etc.) live under a separate key so
// they don't churn the saved scenario state on every render.
const LS_VIEW_KEY = 'procgenPipeline_view';
// F5 "working library" (regions captured from the ③ view, pending export) —
// its own key so a capture doesn't churn the main params bundle.
const LS_WORKING_LIBRARY_KEY = 'procgenPipeline_workingLibrary';
const TILE_PX = 14;

const COLORS = {
    floor: '#2a2a2a',
    wall: '#000000',
    // Same §5 palette as mazeRoomUI — keep the two views consistent.
    entrance: '#3aa85a',
    exit: '#3aa85a',
    exitBlocked: '#d04040',
    locationBlocked: '#d04040',
    grid: '#1a1a1a',
    cellBorder: '#3a3a50',
    emptyCell: '#141414',
    // Text-adventure cells: warm parchment tint so they stand apart
    // from the dark maze cells at a glance, without losing the cell
    // border / exit / blocked palette.
    textAdventureBg: '#3a3326',
    textAdventureFg: '#f0e6c8',
    textAdventureFgDim: '#a89d80',
    genericBg: '#2a2a3a',
};

/**
 * Resolve a list of exits to their tile (x, y) inside the cell.
 *
 * Substrates whose adapter populates per-exit tile coords (current maze
 * + text-adventure path) round-trip their `(x, y)` verbatim. Future
 * substrates that omit them get an even distribution along their wall,
 * keyed by `side` (N/S/E/W). Mixing both modes per region is fine.
 *
 * Returns `[{ exit, x, y }, …]` in the input order.
 */
export function resolveExitTilePositions(exits, regionSize) {
    // Accept either the on-disk Array shape (sidecar JSON) or the
    // in-memory Map shape (after deserializeWorld), since both paths
    // feed _drawRegion. Normalize to a plain array.
    let list;
    if (Array.isArray(exits)) list = exits;
    else if (exits && typeof exits.values === 'function') list = [...exits.values()];
    else return [];
    if (list.length === 0) return [];
    const result = [];
    const bySide = { N: [], S: [], E: [], W: [] };
    for (const exit of list) {
        const hasXY = Number.isFinite(exit?.x) && Number.isFinite(exit?.y);
        if (hasXY) {
            result.push({ exit, x: exit.x, y: exit.y });
        } else if (exit?.side && bySide[exit.side]) {
            bySide[exit.side].push({ exit, slotIndex: result.length });
            result.push(null);
        } else {
            result.push(null);
        }
    }
    const lastX = regionSize.width - 1;
    const lastY = regionSize.height - 1;
    for (const side of ['N', 'S', 'E', 'W']) {
        const queue = bySide[side];
        if (queue.length === 0) continue;
        const horizontal = (side === 'N' || side === 'S');
        const span = horizontal ? regionSize.width : regionSize.height;
        // Even distribution: slot k of N gets the (k+1)/(N+1) fraction
        // of the span (avoids landing on the corners).
        for (let i = 0; i < queue.length; i++) {
            const frac = (i + 1) / (queue.length + 1);
            const along = Math.max(0, Math.min(span - 1, Math.round(frac * (span - 1))));
            let x; let y;
            if (side === 'N') { x = along; y = 0; }
            else if (side === 'S') { x = along; y = lastY; }
            else if (side === 'W') { x = 0; y = along; }
            else { x = lastX; y = along; }
            const { exit, slotIndex } = queue[i];
            result[slotIndex] = { exit, x, y };
        }
    }
    return result.filter(Boolean);
}

/**
 * Truncate `text` with an ellipsis so it fits within `maxPx` using the
 * canvas's currently-set font. No-op if the text already fits.
 */
export function fitTextToWidth(ctx, text, maxPx) {
    if (!text) return '';
    if (ctx.measureText(text).width <= maxPx) return text;
    const ellipsis = '…';
    let lo = 0;
    let hi = text.length;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (ctx.measureText(text.slice(0, mid) + ellipsis).width <= maxPx) lo = mid;
        else hi = mid - 1;
    }
    return lo > 0 ? text.slice(0, lo) + ellipsis : ellipsis;
}

const DEFAULT_PARAMS = {
    seed: 1,
    gridWidth: 3,
    gridHeight: 3,
    regionWidth: 8,
    regionHeight: 6,
    maxItemsPerRegion: 2,
    maxRegions: null,
    // Quota-mode start-region override. 'auto' (or empty) lets
    // pickSubstrate choose via the active quota / mix chain. Setting
    // it to a specific substrate id pins the start region's
    // substrate; in quota mode that pick still counts against the
    // substrate's quota.
    startSubstrate: 'auto',
    // When true, growMaze ends the moment the item pool is empty.
    // When false (default), growth continues and later regions are
    // built with empty item plans — useful in quota mode where the
    // user wants a fixed region count regardless of items left.
    stopOnPoolEmpty: false,
    // How the bidirectional post-pass reconciles cross-branch
    // asymmetric exit pairs. 'add' (default) inserts a reciprocal
    // back-exit on the target region; 'remove' drops the one-way
    // forward exit.
    asymmetricExits: 'add',
    // Loop-mode toggle (Phase 2/3 of loop-mode-substrate-integration).
    // When on, buildRulesJson computes a loop_costs sidecar AND every
    // region's playable_payload gets manaEnabled=true so substrates
    // deduct mana on movement / location checks at runtime.
    enableLoopMode: false,
    // Region XP effect mode stamped on every loop_costs region entry
    // when enableLoopMode is on. 'cost' (default) discounts mana cost
    // proportionally to XP level; 'speed' / 'both' are reserved for v2;
    // 'none' disables the XP discount. See Phase 7.
    regionXpEffect: 'cost',
    // Hazard module (maze content modules Phase 2). When enabled,
    // every region gets `count` hazards placed by hazardPathGen +
    // applyHazardModule in the procgen pipeline. Disabled by default
    // — existing presets stay hazard-free unless the caller opts in.
    enableHazards: false,
    hazardCount: 3,
    hazardMaxConsecutiveFails: 10,
    hazardWallOverlapAllowed: false,
    // Sphere-growth mode parameters (sphere-driven-growth.md). The
    // planner assigns the scenario items to `sphereCount` spheres;
    // fillerCount adds itemless regions; revisitPercent is the chance
    // a wave's attachment lands on an older region instead of the
    // frontier (the "come back with the new item" texture).
    sphereCount: 3,
    fillerCount: 0,
    revisitPercent: 25,
    // null = "all spheres in one batch" (byte-identical default). A positive
    // integer < sphereCount grows the middle phases sphere-major in batches
    // (Phase 2). Phase 1 only carries the knob; no visible control yet.
    spheresPerBatch: null,
    // Substrate-specific params (e.g. bounce's fall behavior / physics
    // profile / braid layout) are NOT here — each substrate declares its
    // own defaults via the registry `defaultProcgenParams` hook, merged
    // in by _defaultParams(). See bounceProcgenParams.js.
};

const REGION_XP_EFFECT_OPTIONS = [
    { value: 'cost', label: 'Cost', disabled: false },
    { value: 'speed', label: 'Speed (v2)', disabled: true },
    { value: 'both', label: 'Both (v2)', disabled: true },
    { value: 'none', label: 'None', disabled: false },
];

const DEFAULT_SCENARIO = {
    // `victory` is the auto-completion-condition item — opt out by
    // removing it from the items pool. See library.js for details.
    // Duplicate pools (key_red: 2) work too since count gates landed
    // (a split instance gates on its cumulative count); distinct keys
    // are kept as the default for the friendlier two-color texture.
    items: { victory: 1, key_red: 1, key_blue: 1 },
    obstacles: { door_red: 1, door_blue: 1 },
};

/**
 * Group library entries by which of the selected substrates declare
 * each entry's `feature`. Pure function — exported for testing.
 *
 * Inputs:
 *   allEntries: [{ id, def, kind }] where def has a `feature` field.
 *   selectedEntries: substrate registry entries (each has
 *     `id` + `supportedFeatures: string[]`). Caller is expected to
 *     have filtered out entries with weight 0.
 *
 * Returns:
 *   {
 *     common: [{ id, def, kind }],         // supported by every selected
 *     substrateSpecific: [{ label, entries: [...] }],
 *                                          // supported by some-but-not-all,
 *                                          // grouped by supporter set
 *     unsupported: [...],                  // supported by none of the
 *                                          // selected (or all entries
 *                                          // when nothing is selected)
 *   }
 *
 * When `selectedEntries` is empty, every entry falls into `unsupported`
 * (there's no selection to compare against). The UI hides the
 * unsupported group behind a toggle, so the empty-selection default is
 * "library appears empty until you pick a substrate."
 */
export function groupLibraryByFeature(allEntries, selectedEntries) {
    const groups = {
        common: [],
        substrateSpecific: [],
        unsupported: [],
    };
    if (selectedEntries.length === 0) {
        groups.unsupported = [...allEntries];
        return groups;
    }
    // Map of "supporters key" → bucket. The key is the sorted list of
    // supporter ids joined with '|', so two entries supported by the
    // same exact set merge into one labelled group.
    const specificMap = new Map();
    for (const entry of allEntries) {
        const feature = entry.def.feature;
        const supporters = selectedEntries
            .filter((s) => Array.isArray(s.supportedFeatures)
                && s.supportedFeatures.includes(feature))
            .map((s) => s.id)
            .sort();
        if (supporters.length === selectedEntries.length) {
            groups.common.push(entry);
        } else if (supporters.length === 0) {
            groups.unsupported.push(entry);
        } else {
            const key = supporters.join('|');
            if (!specificMap.has(key)) {
                const label = `${supporters.join(', ')} only`;
                specificMap.set(key, { label, entries: [] });
            }
            specificMap.get(key).entries.push(entry);
        }
    }
    groups.substrateSpecific = [...specificMap.values()]
        .sort((a, b) => a.label.localeCompare(b.label));
    return groups;
}

/**
 * Reconstruct a Grid + composite-view payload from a rules.json that
 * carries `preset_sidecars`. Returns the same shape `growMaze` /
 * `topDownFromRulesJson` produce as their `result` (subset of
 * fields — poolRemaining is unknown post-hoc), so the existing
 * _renderGrid / _renderStats paths can paint it without further
 * branching. Returns null if the input has no procgen data, or if no
 * registered substrate can deserialize any of the regions.
 *
 * Pure function — exported for testing.
 */
export function reconstructResultFromSidecars(rulesJson) {
    const sidecarsByPlayer = rulesJson?.preset_sidecars;
    if (!sidecarsByPlayer || typeof sidecarsByPlayer !== 'object') return null;
    // v1 single-player: pick the first player. (Per-player composite
    // views would need a player picker in the panel; deferred.)
    const playerKeys = Object.keys(sidecarsByPlayer);
    if (playerKeys.length === 0) return null;
    const playerSidecars = sidecarsByPlayer[playerKeys[0]];
    const regionEntries = Object.entries(playerSidecars ?? {});
    if (regionEntries.length === 0) return null;

    let maxGx = 0;
    let maxGy = 0;
    let maxW = 0;
    let maxH = 0;
    for (const [, sc] of regionEntries) {
        const cell = sc?.grid_cell;
        if (cell) {
            if (cell.gx > maxGx) maxGx = cell.gx;
            if (cell.gy > maxGy) maxGy = cell.gy;
        }
        const payload = sc?.playable_payload || {};
        if (payload.width > maxW) maxW = payload.width;
        if (payload.height > maxH) maxH = payload.height;
    }
    if (maxW === 0 || maxH === 0) return null;

    const grid = new Grid({ width: maxGx + 1, height: maxGy + 1 });
    let placed = 0;
    let teleporters = 0;
    for (const [region_id, sc] of regionEntries) {
        if (!sc?.grid_cell) continue;
        const substrateId = sc.substrate ?? 'maze';
        const adapter = substrateRegistry.get(substrateId);
        if (!adapter || typeof adapter.deserializeWorld !== 'function') continue;
        const world = adapter.deserializeWorld(sc.playable_payload);
        if (world?.exits) {
            for (const e of world.exits.values()) {
                if (e.isTeleporter) teleporters += 1;
            }
        }
        grid.placeRegion(sc.grid_cell, {
            region_id,
            substrate: substrateId,
            render_hint: sc.render_hint ?? substrateId,
            playable_payload: world,
            grow_telemetry: sc.grow_telemetry ?? null,
        });
        placed += 1;
    }
    if (placed === 0) return null;

    const meta = rulesJson.procgen_metadata ?? {};
    return {
        grid,
        regionSize: { width: maxW, height: maxH },
        stats: {
            regionsBuilt: placed,
            regionsSkipped: 0,
            stopReason: meta.stop_reason ?? null,
            teleportersPlaced: teleporters,
        },
        poolRemaining: null,
        // Marker for the renderers that this view came from a loaded
        // rules.json rather than a fresh pipeline run, so labels can
        // signal that and we don't claim a fresh-generation pool stat.
        fromLoadedPreset: true,
    };
}

// Sphere-growth runs as a stepped pipeline. The tree build (2 Build tree)
// is subdivided into three editable sub-steps, so the pipeline has 6 steps.
// `completed` is the index of the last finished step (0..5; -1 = not started).
// Everything keys off these tables so adding/relabelling a step is one edit.
const SPHERE_STEP_LABELS = [
    '1 Plan', '2a Allocate', '2b Topology', '2c Items', '3 Build regions', '4 Compile',
];
const SPHERE_STEP_RUN_LABELS = [
    'Run 1 Plan', 'Run 2a Allocate', 'Run 2b Topology', 'Run 2c Items',
    'Run 3 Build regions', 'Run 4 Compile',
];
const SPHERE_LAST_STEP = SPHERE_STEP_LABELS.length - 1; // 5

// Top-down's four steps (the source rules.json is read-only, so there is no
// editable "plan" step). Same `completed` index convention (0..3; -1 = not
// started); the step indicator + actions key off these tables.
const TOPDOWN_STEP_LABELS = [
    '1 Layout', '2 Realise', '3 Finalize', '4 Compile',
];
const TOPDOWN_STEP_RUN_LABELS = [
    'Run 1 Layout', 'Run 2 Realise', 'Run 3 Finalize', 'Run 4 Compile',
];
const TOPDOWN_LAST_STEP = TOPDOWN_STEP_LABELS.length - 1; // 3

// Shuffled-spiral's four steps. Same `completed` index convention (0..3; -1 =
// not started). ② Content is a no-op for every current substrate (JtA's dataset
// lands there in Part 3) — there is no editing surface, so its block renders a
// "no content substrate" note.
const SPIRAL_STEP_LABELS = [
    '1 Arrange', '2 Content', '3 Regions', '4 Compile',
];
const SPIRAL_STEP_RUN_LABELS = [
    'Run 1 Arrange', 'Run 2 Content', 'Run 3 Regions', 'Run 4 Compile',
];
const SPIRAL_LAST_STEP = SPIRAL_STEP_LABELS.length - 1; // 3

export class ProcgenPipelineUI {
    static moduleApis = null;
    static setModuleApis(apis) { ProcgenPipelineUI.moduleApis = apis; }

    constructor(container, componentState) {
        this.container = container;
        this.params = this._defaultParams();
        this.scenario = {
            items: { ...DEFAULT_SCENARIO.items },
            obstacles: { ...DEFAULT_SCENARIO.obstacles },
        };
        // Substrate weights for mixed-substrate generation. Map of
        // { [substrateId]: weight }. Empty → engine falls back to its
        // default ('maze' for both growMaze and topDownFromRulesJson),
        // matching pre-mixed-substrate behaviour. Used when
        // substrateMode === 'mix'.
        this.substrateMix = {};
        // Per-substrate region quotas for fixed-count generation.
        // Map of { [substrateId]: regionCount }. Used when
        // substrateMode === 'quotas'. growMaze stops once every
        // substrate's count has been reached (or earlier on
        // frontier-empty / pool-empty per stopOnPoolEmpty).
        this.substrateQuotas = {};
        // Which allocation strategy the substrate picker uses.
        // 'quotas' (default for new users) → fixed per-substrate
        // region counts. 'mix' → weighted-random sampling per region.
        // Top-down driver always uses the mix.
        this.substrateMode = 'quotas';
        // Region-library (F3) working selection: the RESOLVED docs the user has
        // ticked/loaded, each { source:'served'|'adhoc', file?, library, count }.
        // Persistence rides the hybrid shape (regionLibraryLoader
        // serializeLibrarySelection); served refs re-fetch on load into this list.
        this.regionLibraries = [];
        // Persisted `libraries` refs awaiting the async resolve kicked off by a
        // load/preset-apply. Held so a save during the (ms-long) fetch window
        // round-trips the untouched refs instead of clobbering them with an
        // empty regionLibraries. Cleared once resolution lands. See
        // _serializedLibraries / _setPersistedLibraries / _resolveRegionLibraries.
        this._pendingLibraryRefs = null;
        // Cached served-library index (region_library_files.json). null = not yet
        // fetched; [] = fetched-but-empty. _renderRegionLibrariesSubsection kicks
        // the fetch on first render and re-renders when it lands.
        this._servedLibraryIndex = null;
        this._servedLibraryError = null;
        this._servedLibraryFetching = false;
        // F5 capture: a session "working library" of regions saved from the ③
        // view / region editor, exportable as a committable library JSON file.
        // Persisted under LS_WORKING_LIBRARY_KEY.
        this.workingLibrary = { entries: [] };
        // View preference: when true, the Library subsection shows an
        // "Unsupported by selected substrates" group with library
        // entries no selected substrate declares. Default off so
        // selecting a substrate visibly narrows the library to what
        // it can use. Persisted under LS_VIEW_KEY.
        this.showUnsupportedLibrary = false;
        // Per-section collapsed state. Stable section IDs let the
        // user's preferences survive panel rebuilds and reloads.
        // Persisted via LS_VIEW_KEY alongside showUnsupportedLibrary.
        this.collapsedSections = new Set();
        // 'sphereGrowth' (default — the sphere-plan-first driver,
        // replacing gridGrowth as the default world-building mode per
        // sphere-driven-growth.md step 8) builds a fresh world from a
        // scenario pool with an exact sphere oracle. 'gridGrowth' is
        // the legacy pool-driven grower; 'topDown' realises an
        // existing rules.json as maze regions on a grid.
        this.mode = 'sphereGrowth';
        // Top-down's source rules.json (raw object) and a friendly
        // label used in the panel UI. null until the user picks a file
        // or copies in the currently-loaded rules.json.
        this.topDownSource = null;
        this.topDownSourceLabel = '';
        // Optional authoritative sphere log for top-down (§3). An array of
        // JSONL entries from a picked _sphere_log.jsonl; when set (or when
        // the source rules.json embeds a `sphere_log`), top-down attributes
        // wave + sphere_plan from it and emits driver 'top-down-sphere'.
        // null = plain 'top-down'. Like topDownSource, not persisted.
        this.topDownSphereLog = null;
        this.topDownSphereLogLabel = '';
        // Cache of the latest rules.json the frontend has loaded —
        // populated via stateManager:rawJsonDataLoaded. Lets the user
        // re-feed whatever's currently active without a file picker.
        this.loadedRulesJson = null;
        this.loadedRulesJsonLabel = '';
        // "Use currently-loaded rules.json / sphere log" checkboxes (top-down
        // source picker), checked by default: until the user browses a file, the
        // source/log is whatever the frontend currently has loaded. Browsing a
        // file unchecks the corresponding box. Session-only.
        this.useLoadedRules = true;
        this.useLoadedSphereLog = true;
        this.result = null;
        // Sphere-growth stepped-pipeline state (null until step 1 runs).
        // See _stepPlan / _renderSphereSteps. Session-only (not persisted).
        this._stepState = null;
        // Top-down stepped-pipeline state (null until step 1 Layout runs).
        // See _stepTDLayout / _renderTopDownSteps. Session-only.
        this._tdState = null;
        // Shuffled-spiral stepped-pipeline state (null until step 1 Arrange runs).
        // See _stepSpiralArrange / _renderSpiralSteps. Session-only.
        this._spiralState = null;
        // 2b Topology view mode: 'tree' (indented directory tree) or 'flat'
        // (numerical index order). Session-only view preference.
        this._topologyView = 'tree';
        // Composite-map interaction mode: 'edit' (click opens the region
        // editor), 'moveRegion' (click region → click cell to move/swap),
        // 'moveExit' (click a green square → click a side to move/swap). The
        // pending first-click selection lives in _mapSel. Session-only.
        this._mapMode = 'edit';
        this._mapSel = null;
        this.isGenerating = false;
        // Live generation progress (sphere mode): event-stream state +
        // the indicator element below the Generate button.
        this._progressState = null;
        this._progressEl = null;
        this.message = '';
        // Prominent post-generation warning (rendered red, on its own
        // line under the message) — e.g. sphere-growth quota fallback.
        this.warning = '';

        // Preset drop-down state: the user's saved presets (from the
        // dedicated presets localStorage key) and which preset the panel
        // currently reflects. null = "Custom". Any edit gesture clears
        // the selection (every change handler saves via
        // _saveToLocalStorage, which resets it unless the save came from
        // a preset apply).
        this.userPresets = loadUserPresets(localStorage);
        this.activePresetId = null;

        this.rootElement = document.createElement('div');
        this.rootElement.className = 'procgen-pipeline-panel';
        setPanelInstance(this);
        this._loadFromLocalStorage();
        this._loadViewFromLocalStorage();
        this._loadWorkingLibraryFromLocalStorage();
        // Subscribe through the raw eventBus so the panel sees raw-
        // json-loaded events even when constructed before the module's
        // initialize() has wired up apis. Same workaround the maze
        // panel uses (procgen-player.md "Substrate adapter contract:
        // addendum from the smoke test").
        const handler = (data) => {
            if (!data?.rawJsonData) return;
            this.loadedRulesJson = data.rawJsonData;
            this.loadedRulesJsonLabel = data.source || data.selectedPlayerInfo?.playerName || 'currently loaded';
            // "Use currently-loaded rules.json" checked (default) → adopt it as the
            // top-down source as soon as it's available.
            if (this.useLoadedRules) this._applyLoadedRules();
            // If the loaded rules.json carries preset_sidecars,
            // reconstruct a Grid so the composite-view canvas paints
            // all regions side-by-side. A subsequent local Generate
            // overwrites this.result, so the user always sees the
            // most recent state. We avoid clobbering an in-progress
            // local generation result on top.
            const reconstructed = reconstructResultFromSidecars(data.rawJsonData);
            if (reconstructed) this.result = reconstructed;
            this.render();
        };
        eventBus.subscribe('stateManager:rawJsonDataLoaded', handler, 'procgenPipeline');
        this._unsubRawJsonLoaded = () => eventBus.unsubscribe(
            'stateManager:rawJsonDataLoaded', handler, 'procgenPipeline',
        );
        // The sphere log loads asynchronously into sphereState (after the panel's
        // first render), so re-render when it lands/clears — otherwise the
        // top-down source picker shows "(no sphere log)" until an unrelated
        // re-render corrects it. _resolveTopDownSphereLog reads the live log.
        const sphereLogHandler = () => this.render();
        eventBus.subscribe('sphereState:dataLoaded', sphereLogHandler, 'procgenPipeline');
        eventBus.subscribe('sphereState:dataCleared', sphereLogHandler, 'procgenPipeline');
        this._unsubSphereLog = () => {
            eventBus.unsubscribe('sphereState:dataLoaded', sphereLogHandler, 'procgenPipeline');
            eventBus.unsubscribe('sphereState:dataCleared', sphereLogHandler, 'procgenPipeline');
        };
        this.render();
    }

    get apis() { return ProcgenPipelineUI.moduleApis || getModuleApis(); }

    getRootElement() { return this.rootElement; }
    destroy() {
        if (this._unsubRawJsonLoaded) { this._unsubRawJsonLoaded(); this._unsubRawJsonLoaded = null; }
        if (this._unsubSphereLog) { this._unsubSphereLog(); this._unsubSphereLog = null; }
        setPanelInstance(null);
    }
    onPanelShow() { this.render(); }
    onPanelResize() {}

    render() {
        this.rootElement.innerHTML = '';
        // Preset bar, mode toggle and the Generate-button row stay
        // unwrapped — they anchor the panel and shouldn't be foldable.
        // Everything else is wrapped in an accordion section so users
        // can hide sections they aren't actively using. Per-section
        // state lives in this.collapsedSections.
        this.rootElement.appendChild(this._renderPresetBar());
        this.rootElement.appendChild(this._renderModeToggle());
        // Scenario Pool: Substrates subsection always visible; Library
        // and Counts subsections grid-growth-only (the scenario pool
        // is a grid-growth concept — top-down's items come from its
        // source rules.json).
        this.rootElement.appendChild(this._renderCollapsibleSection(
            'scenario', 'Scenario Pool', this._renderScenarioPicker(),
        ));
        if (this.mode === 'topDown') {
            this.rootElement.appendChild(this._renderCollapsibleSection(
                'topdown-source', 'Top-down source', this._renderTopDownSourcePicker(),
            ));
        }
        this.rootElement.appendChild(this._renderCollapsibleSection(
            'parameters', 'Parameters', this._renderParams(),
        ));
        this.rootElement.appendChild(this._renderActions());
        if (this.mode === 'sphereGrowth' && this._stepState) {
            this.rootElement.appendChild(this._renderCollapsibleSection(
                'sphere-pipeline', 'Sphere pipeline', this._renderSphereSteps(),
            ));
        }
        if (this.mode === 'topDown' && this._tdState) {
            this.rootElement.appendChild(this._renderCollapsibleSection(
                'topdown-pipeline', 'Top-down pipeline', this._renderTopDownSteps(),
            ));
        }
        if (this.mode === 'shuffledSpiral' && this._spiralState) {
            this.rootElement.appendChild(this._renderCollapsibleSection(
                'spiral-pipeline', 'Spiral pipeline', this._renderSpiralSteps(),
            ));
        }
        this.rootElement.appendChild(this._renderCollapsibleSection(
            'stats', 'Stats', this._renderStats(),
        ));
        this.rootElement.appendChild(this._renderGrid());
        this.rootElement.appendChild(this._renderCollapsibleSection(
            'compiled', 'Compiled output', this._renderCompiled(),
        ));
    }

    /**
     * Wrap content in an accordion-style section with a clickable
     * header that toggles between expanded and collapsed. Per-section
     * collapse state lives in this.collapsedSections (a Set of IDs)
     * and persists via _saveViewToLocalStorage. Mirrors the maze
     * panel's collapsible pattern.
     *
     * @param {string} sectionId - Stable ID for persistence (e.g. 'scenario').
     * @param {string} titleText - Header label.
     * @param {HTMLElement} contentEl - The section's content node.
     * @returns {HTMLElement} The wrapper.
     */
    _renderCollapsibleSection(sectionId, titleText, contentEl) {
        const isCollapsed = this.collapsedSections.has(sectionId);
        const wrap = document.createElement('div');
        wrap.className = `procgen-pipeline-collapsible ${isCollapsed ? 'is-collapsed' : 'is-expanded'}`;
        wrap.dataset.sectionId = sectionId;

        const header = document.createElement('div');
        header.className = 'procgen-pipeline-collapsible-header';
        const indicator = document.createElement('span');
        indicator.className = 'procgen-pipeline-collapsible-indicator';
        indicator.textContent = isCollapsed ? '▶' : '▼';
        const title = document.createElement('span');
        title.className = 'procgen-pipeline-collapsible-title';
        title.textContent = titleText;
        header.appendChild(indicator);
        header.appendChild(title);
        header.addEventListener('click', () => {
            if (this.collapsedSections.has(sectionId)) {
                this.collapsedSections.delete(sectionId);
            } else {
                this.collapsedSections.add(sectionId);
            }
            this._saveViewToLocalStorage();
            this.render();
        });
        wrap.appendChild(header);

        if (!isCollapsed && contentEl) {
            const body = document.createElement('div');
            body.className = 'procgen-pipeline-collapsible-body';
            body.appendChild(contentEl);
            wrap.appendChild(body);
        }
        return wrap;
    }

    // --- Preset bar ---

    /**
     * Drop-down at the top of the panel selecting a shipped or user
     * preset (presetDefs.js). Selecting one is an explicit gesture: it
     * overwrites the panel setup, auto-saves, and re-renders — no
     * confirm. Any subsequent edit flips the selection back to
     * "Custom" (via _saveToLocalStorage clearing activePresetId).
     */
    _renderPresetBar() {
        const section = document.createElement('div');
        section.className = 'procgen-pipeline-presets';
        const title = document.createElement('div');
        title.className = 'procgen-pipeline-section-title';
        title.textContent = 'Preset';
        section.appendChild(title);

        const row = document.createElement('div');
        row.className = 'procgen-pipeline-presets-row';

        const select = document.createElement('select');
        select.className = 'procgen-pipeline-preset-select';
        const customOpt = document.createElement('option');
        customOpt.value = '';
        customOpt.textContent = 'Custom';
        select.appendChild(customOpt);
        const addGroup = (label, presets) => {
            if (presets.length === 0) return;
            const group = document.createElement('optgroup');
            group.label = label;
            for (const p of presets) {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.label;
                if (p.description) opt.title = p.description;
                group.appendChild(opt);
            }
            select.appendChild(group);
        };
        addGroup('Shipped', [...SHIPPED_PRESETS]);
        addGroup('User', this.userPresets);
        select.value = this.activePresetId ?? '';
        // A stale persisted id (e.g. the preset was deleted) falls back
        // to Custom rather than showing a blank control.
        if (select.value !== (this.activePresetId ?? '')) select.value = '';
        select.addEventListener('change', () => {
            if (select.value) {
                this._applyPreset(select.value);
            } else {
                this.activePresetId = null;
                this._saveToLocalStorage();
                this.render();
            }
        });
        row.appendChild(select);

        row.appendChild(this._btn('Save as…', () => {
            const label = window.prompt('Preset name:');
            if (label == null) return;
            const saved = saveUserPreset(
                localStorage, label,
                capturePresetState({ ...this, libraries: this._serializedLibraries() }),
            );
            if (!saved) {
                this.message = 'ERROR: preset name must contain letters or digits.';
                this.render();
                return;
            }
            this.userPresets = saved.presets;
            this.activePresetId = saved.id;
            this._saveToLocalStorage({ fromPreset: true });
            this.message = `Preset "${label.trim()}" saved.`;
            this.render();
        }));

        const isUserPreset = (this.activePresetId ?? '').startsWith('user:');
        const deleteBtn = this._btn('Delete', () => {
            const preset = getPresetById(this.activePresetId, this.userPresets);
            if (!preset) return;
            if (!window.confirm(`Delete preset "${preset.label}"?`)) return;
            this.userPresets = deleteUserPreset(localStorage, preset.id);
            this.activePresetId = null;
            this._saveToLocalStorage();
            this.message = `Preset "${preset.label}" deleted.`;
            this.render();
        });
        deleteBtn.disabled = !isUserPreset;
        deleteBtn.title = isUserPreset
            ? 'Delete the selected user preset'
            : 'Only user presets can be deleted';
        row.appendChild(deleteBtn);

        section.appendChild(row);
        return section;
    }

    /**
     * Overwrite the panel setup with a preset and auto-save. Clears
     * the generation result and stepped-pipeline state — a preset is a
     * "fresh setup" gesture, so stale step envelopes from the previous
     * params must not survive it.
     */
    _applyPreset(id) {
        const preset = getPresetById(id, this.userPresets);
        if (!preset) return;
        const next = applyPresetState(preset.state, {
            defaults: this._defaultParams(),
            hasSubstrate: (sid) => substrateRegistry.has(sid),
            current: this,
        });
        this.params = next.params;
        this.scenario = next.scenario;
        this.substrateMix = next.substrateMix;
        this.substrateQuotas = next.substrateQuotas;
        this.substrateMode = next.substrateMode;
        this.mode = next.mode;
        this._setPersistedLibraries(next.libraries);
        this.result = null;
        this._stepState = null;
        this._tdState = null;
        this._spiralState = null;
        this.warning = '';
        this.activePresetId = id;
        this._saveToLocalStorage({ fromPreset: true });
        this.message = `Preset "${preset.label}" applied.`;
        this.render();
    }

    // --- Mode toggle ---

    _renderModeToggle() {
        const section = document.createElement('div');
        section.className = 'procgen-pipeline-mode';
        const title = document.createElement('div');
        title.className = 'procgen-pipeline-section-title';
        title.textContent = 'Mode';
        section.appendChild(title);

        const row = document.createElement('div');
        row.className = 'procgen-pipeline-mode-row';
        for (const [value, label] of [
            ['gridGrowth', 'Grid growth (build from a scenario pool)'],
            ['sphereGrowth', 'Sphere growth (plan spheres, grow waves)'],
            ['shuffledSpiral', 'Shuffled spiral (zones laid out from center)'],
            ['topDown', 'Top-down (realise an existing rules.json)'],
        ]) {
            const btn = document.createElement('label');
            btn.className = 'procgen-pipeline-mode-option';
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = 'procgen-pipeline-mode';
            input.value = value;
            input.checked = this.mode === value;
            input.addEventListener('change', () => {
                this.mode = value;
                this.result = null;
                this.message = '';
                this._saveToLocalStorage();
                this.render();
            });
            const span = document.createElement('span');
            span.textContent = label;
            btn.appendChild(input);
            btn.appendChild(span);
            row.appendChild(btn);
        }
        section.appendChild(row);
        return section;
    }

    // --- Top-down source picker ---

    // Adopt the frontend's currently-loaded rules.json as the top-down source
    // (the "Use currently-loaded rules.json" checkbox / the rawJsonDataLoaded
    // event when that box is checked). No-op when nothing is loaded yet.
    _applyLoadedRules() {
        if (!this.loadedRulesJson) return;
        this.topDownSource = this.loadedRulesJson;
        this.topDownSourceLabel = `loaded (${this.loadedRulesJsonLabel})`;
        this._applyGridDimsFromSource(this.loadedRulesJson);
    }

    // A small inline checkbox + label (used by the source picker's two
    // "Use currently-loaded …" toggles). onChange receives the new checked state.
    _renderInlineCheckbox(label, checked, onChange, { title = '' } = {}) {
        const wrap = document.createElement('label');
        wrap.className = 'procgen-pipeline-use-loaded';
        if (title) wrap.title = title;
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = checked;
        cb.addEventListener('change', () => onChange(cb.checked));
        wrap.appendChild(cb);
        wrap.appendChild(document.createTextNode(` ${label}`));
        return wrap;
    }

    _renderTopDownSourcePicker() {
        const section = document.createElement('div');
        section.className = 'procgen-pipeline-source';
        // Title supplied by the collapsible wrapper in render().

        const row = document.createElement('div');
        row.className = 'procgen-pipeline-source-row';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json,application/json';
        fileInput.className = 'procgen-pipeline-source-input';
        fileInput.addEventListener('change', async () => {
            const file = fileInput.files?.[0];
            if (!file) return;
            // Browsing a file overrides the currently-loaded rules.json.
            this.useLoadedRules = false;
            try {
                const text = await file.text();
                const parsed = JSON.parse(text);
                this.topDownSource = parsed;
                this.topDownSourceLabel = file.name;
                this._applyGridDimsFromSource(parsed);
                this.message = `Loaded source: ${file.name}`;
            } catch (e) {
                this.topDownSource = null;
                this.topDownSourceLabel = '';
                this.message = `ERROR parsing ${file.name}: ${e.message}`;
            }
            this.render();
        });
        row.appendChild(fileInput);

        // Quick path: use whatever rules.json the frontend currently has loaded
        // (via Presets panel or ?game= URL). Checked by default; browsing a file
        // unchecks it. Unchecking drops the loaded source so the user can browse.
        row.appendChild(this._renderInlineCheckbox(
            'Use currently-loaded rules.json',
            this.useLoadedRules,
            (checked) => {
                this.useLoadedRules = checked;
                if (checked) {
                    this._applyLoadedRules();
                    this.message = this.loadedRulesJson ? 'Using currently-loaded rules.json' : '';
                } else if (this.topDownSource === this.loadedRulesJson) {
                    this.topDownSource = null;
                    this.topDownSourceLabel = '';
                }
                this.render();
            },
            {
                title: this.loadedRulesJson ? ''
                    : 'Load any preset (Presets panel) or open a ?game= URL first.',
            },
        ));

        const status = document.createElement('span');
        status.className = 'procgen-pipeline-source-status';
        status.textContent = this.topDownSource
            ? `Loaded: ${this.topDownSourceLabel}`
            : '(no source loaded)';
        row.appendChild(status);

        if (this.topDownSource) {
            const clearBtn = this._btn('Clear', () => {
                this.topDownSource = null;
                this.topDownSourceLabel = '';
                this.topDownSphereLog = null;
                this.topDownSphereLogLabel = '';
                // Clearing is explicit — don't immediately re-adopt the loaded
                // rules.json/log (uncheck both "use currently-loaded" boxes).
                this.useLoadedRules = false;
                this.useLoadedSphereLog = false;
                this.result = null;
                this.message = '';
                this.render();
            });
            row.appendChild(clearBtn);
        }

        section.appendChild(row);

        // Sphere-log row: an authoritative _sphere_log.jsonl to attribute
        // wave + sphere_plan from (driver 'top-down-sphere'). The source's
        // embedded `sphere_log` is used automatically when present, so this
        // picker is only needed for a separate log file.
        const logRow = document.createElement('div');
        logRow.className = 'procgen-pipeline-source-row';

        const logInput = document.createElement('input');
        logInput.type = 'file';
        logInput.accept = '.jsonl,.json,application/json';
        logInput.className = 'procgen-pipeline-source-input';
        logInput.addEventListener('change', async () => {
            const file = logInput.files?.[0];
            if (!file) return;
            // Browsing a file overrides the currently-loaded sphere log.
            this.useLoadedSphereLog = false;
            try {
                const text = await file.text();
                const entries = text.split('\n').map((l) => l.trim())
                    .filter(Boolean).map((l) => JSON.parse(l));
                this.topDownSphereLog = entries;
                this.topDownSphereLogLabel = file.name;
                this.message = `Loaded sphere log: ${file.name} (${entries.length} entries)`;
            } catch (e) {
                this.topDownSphereLog = null;
                this.topDownSphereLogLabel = '';
                this.message = `ERROR parsing ${file.name}: ${e.message}`;
            }
            this.render();
        });
        logRow.appendChild(logInput);

        // Quick path: use the sphere log the frontend currently has loaded
        // (a preset's _sphere_log.jsonl pulled into sphereState by the
        // loops / playback / spoiler features). getRawLogWithMetadata
        // restores the canonical metadata header sphereState parses out, so
        // the embedded log keeps the source's real event metadata. Disabled
        // until one is loaded.
        const loadedLog = peekSphereStateSingleton()?.getRawLogWithMetadata?.() ?? [];
        const hasLoadedLog = Array.isArray(loadedLog) && loadedLog.length > 0;
        // Checked by default; browsing a log file unchecks it. The resolution
        // (_resolveTopDownSphereLog) reads this flag, so no imperative apply is
        // needed — checked means "prefer the loaded log".
        logRow.appendChild(this._renderInlineCheckbox(
            'Use currently-loaded sphere log',
            this.useLoadedSphereLog,
            (checked) => {
                this.useLoadedSphereLog = checked;
                this.message = checked && hasLoadedLog ? 'Using currently-loaded sphere log' : '';
                this.render();
            },
            {
                title: hasLoadedLog ? ''
                    : 'Load a preset that ships a _sphere_log.jsonl '
                        + '(e.g. open it in the Presets / playback / loops view) first.',
            },
        ));

        const { entries: resolvedLog, label: logLabel } = this._resolveTopDownSphereLog();
        const logStatus = document.createElement('span');
        logStatus.className = 'procgen-pipeline-source-status';
        logStatus.textContent = resolvedLog
            ? `Sphere log: ${logLabel} → driver 'top-down-sphere'`
            : '(no sphere log — plain top-down)';
        logRow.appendChild(logStatus);

        if (this.topDownSphereLog) {
            logRow.appendChild(this._btn('Clear log', () => {
                this.topDownSphereLog = null;
                this.topDownSphereLogLabel = '';
                this.message = '';
                this.render();
            }));
        }

        section.appendChild(logRow);
        return section;
    }

    /**
     * Resolve the sphere log to attribute from. Precedence: the
     * currently-loaded log when "Use currently-loaded sphere log" is checked;
     * otherwise an explicitly picked log file; otherwise the source rules.json's
     * embedded `sphere_log`; otherwise none. Returns { entries: array|null, label }.
     */
    _resolveTopDownSphereLog() {
        if (this.useLoadedSphereLog) {
            const entries = peekSphereStateSingleton()?.getRawLogWithMetadata?.() ?? [];
            if (Array.isArray(entries) && entries.length > 0) {
                const n = entries.filter((e) => e.type === 'state_update').length;
                return { entries, label: `currently loaded (${n} entries)` };
            }
        }
        if (Array.isArray(this.topDownSphereLog) && this.topDownSphereLog.length > 0) {
            return { entries: this.topDownSphereLog, label: this.topDownSphereLogLabel };
        }
        const embedded = this.topDownSource?.sphere_log;
        if (Array.isArray(embedded) && embedded.length > 0) {
            return { entries: embedded, label: 'embedded in source' };
        }
        return { entries: null, label: '' };
    }

    // --- Scenario pool picker ---

    _renderScenarioPicker() {
        const section = document.createElement('div');
        section.className = 'procgen-pipeline-scenario';
        // Title supplied by the collapsible wrapper in render().

        // Top: Substrates (always visible — every mode needs them).
        section.appendChild(this._renderSubstratesSubsection());

        // Region libraries (F3) — pre-built regions loaded from JSON as
        // `library:<id>` spiral content sources. Shuffled-spiral only (the
        // content-source seam is the spiral driver's).
        if (this.mode === 'shuffledSpiral') {
            section.appendChild(this._renderRegionLibrariesSubsection());
        }

        // Bottom: Library + Counts. Shown for the modes that build
        // regions from a scenario pool. Top-down's items come from
        // its source rules.json, not the pool, so it skips.
        if (this.mode === 'gridGrowth' || this.mode === 'shuffledSpiral'
                || this.mode === 'sphereGrowth') {
            section.appendChild(this._renderLibrarySubsection());
        }

        return section;
    }

    _renderSubstratesSubsection() {
        const wrap = document.createElement('div');

        // Top: mode toggle (quotas vs mix). Grid-growth only —
        // shuffled-spiral always uses quotas; top-down always uses
        // the mix.
        if (this.mode === 'gridGrowth') {
            wrap.appendChild(this._renderSubstrateModeToggle());
        }

        const dict = this._activeSubstrateDict();
        const isQuotas = this.mode === 'shuffledSpiral'
            || this.mode === 'sphereGrowth'
            || (this.mode === 'gridGrowth' && this.substrateMode === 'quotas');

        const grid = document.createElement('div');
        grid.className = 'procgen-pipeline-scenario-grid';

        // Left: registered substrates (click to add).
        const left = document.createElement('div');
        left.className = 'procgen-pipeline-scenario-library';
        const leftHeader = document.createElement('div');
        leftHeader.className = 'procgen-pipeline-scenario-subheader';
        leftHeader.textContent = 'Substrates (click to add)';
        left.appendChild(leftHeader);

        const registered = substrateRegistry.getAll();
        if (registered.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'procgen-pipeline-scenario-empty';
            empty.textContent = '(no substrates registered)';
            left.appendChild(empty);
        } else {
            for (const entry of registered) {
                left.appendChild(this._renderSubstrateLibraryRow(entry));
            }
        }

        // Right: selected substrates with weights/quotas.
        const right = document.createElement('div');
        right.className = 'procgen-pipeline-scenario-selected';
        const rightHeader = document.createElement('div');
        rightHeader.className = 'procgen-pipeline-scenario-subheader';
        rightHeader.textContent = isQuotas ? 'Substrate quotas' : 'Substrate weights';
        right.appendChild(rightHeader);

        const selectedIds = Object.keys(dict);
        if (selectedIds.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'procgen-pipeline-scenario-empty';
            empty.textContent = '(none selected — defaults to maze)';
            right.appendChild(empty);
        } else {
            for (const id of selectedIds) {
                right.appendChild(this._renderSubstrateSelectedRow(id, dict[id]));
            }
            if (isQuotas) {
                const total = selectedIds.reduce(
                    (s, id) => s + (Number(dict[id]) > 0 ? Number(dict[id]) : 0), 0,
                );
                const totalRow = document.createElement('div');
                totalRow.className = 'procgen-pipeline-scenario-empty';
                totalRow.textContent = `Total regions: ${total}`;
                right.appendChild(totalRow);
            }
        }

        grid.appendChild(left);
        grid.appendChild(right);
        wrap.appendChild(grid);

        // Start-substrate dropdown — applies to the pool-building
        // modes. 'auto' delegates to pickSubstrate (weighted-by-mix
        // or weighted-by-remaining-quota) in grid-growth, and lets
        // the shuffle choose in shuffled-spiral.
        if (this.mode === 'gridGrowth' || this.mode === 'shuffledSpiral'
                || this.mode === 'sphereGrowth') {
            wrap.appendChild(this._renderStartSubstrateRow());
        }

        return wrap;
    }

    // ── Region libraries (F3) — pre-built regions loaded from JSON ───
    // Left column: served libraries (index-driven checkboxes) + an ad-hoc file
    // loader. Right column: the working selection with per-library region counts.
    // Everything mutates this.regionLibraries (resolved docs) + _saveToLocalStorage.
    _renderRegionLibrariesSubsection() {
        const wrap = document.createElement('div');
        wrap.className = 'procgen-pipeline-region-libraries';

        const header = document.createElement('div');
        header.className = 'procgen-pipeline-scenario-subheader';
        header.textContent = 'Region libraries (pre-built regions from JSON)';
        header.title = 'Load committed or ad-hoc libraries of pre-built maze/bounce '
            + 'regions; each ticked library becomes a content source with its own region count.';
        wrap.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'procgen-pipeline-scenario-grid';

        // Left: available (served list + ad-hoc file load).
        const left = document.createElement('div');
        left.className = 'procgen-pipeline-scenario-library';
        const leftHeader = document.createElement('div');
        leftHeader.className = 'procgen-pipeline-scenario-subheader';
        leftHeader.textContent = 'Available (tick to add)';
        left.appendChild(leftHeader);
        left.appendChild(this._renderServedLibraryList());
        left.appendChild(this._renderAdhocLibraryLoader());

        // Right: selected libraries (count + remove).
        const right = document.createElement('div');
        right.className = 'procgen-pipeline-scenario-selected';
        const rightHeader = document.createElement('div');
        rightHeader.className = 'procgen-pipeline-scenario-subheader';
        rightHeader.textContent = 'Selected libraries';
        right.appendChild(rightHeader);
        if (this.regionLibraries.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'procgen-pipeline-scenario-empty';
            empty.textContent = this._pendingLibraryRefs ? '(resolving…)' : '(none selected)';
            right.appendChild(empty);
        } else {
            for (const w of this.regionLibraries) {
                right.appendChild(this._renderSelectedLibraryRow(w));
            }
        }

        grid.appendChild(left);
        grid.appendChild(right);
        wrap.appendChild(grid);

        // F5 — capture regions from the last generation into a working library,
        // downloadable as a committable library JSON file.
        wrap.appendChild(this._renderLibraryCaptureArea());
        return wrap;
    }

    // F5 capture UI: a "capture from last generation" list (one Save button per
    // region in this.result.grid) + the working-library summary with Download /
    // Clear. Self-contained in this section so capture + export live together.
    _renderLibraryCaptureArea() {
        const wrap = document.createElement('div');
        wrap.className = 'procgen-pipeline-library-capture';

        const header = document.createElement('div');
        header.className = 'procgen-pipeline-scenario-subheader';
        header.textContent = 'Capture to library (from last generation)';
        header.title = 'Save a generated region into a working library, then download '
            + 'it as a committable region-library JSON.';
        wrap.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'procgen-pipeline-scenario-grid';

        // Left: regions available to capture.
        const left = document.createElement('div');
        left.className = 'procgen-pipeline-scenario-library';
        const regions = this.result?.grid ? [...this.result.grid.allRegions()] : [];
        const capturable = regions.filter((r) => {
            const sub = substrateRegistry.get(r?.substrate);
            return sub && typeof sub.captureLibraryEntry === 'function';
        });
        if (capturable.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'procgen-pipeline-scenario-empty';
            empty.textContent = regions.length
                ? '(no capturable regions in the last generation)'
                : '(generate a world to capture regions)';
            left.appendChild(empty);
        } else {
            for (const region of capturable) {
                left.appendChild(this._renderCaptureRegionRow(region));
            }
        }

        // Right: the working library + Download / Clear.
        const right = document.createElement('div');
        right.className = 'procgen-pipeline-scenario-selected';
        const rightHeader = document.createElement('div');
        rightHeader.className = 'procgen-pipeline-scenario-subheader';
        const n = this.workingLibrary.entries.length;
        rightHeader.textContent = `Working library (${n} entr${n === 1 ? 'y' : 'ies'})`;
        right.appendChild(rightHeader);
        if (n === 0) {
            const empty = document.createElement('div');
            empty.className = 'procgen-pipeline-scenario-empty';
            empty.textContent = '(nothing captured yet)';
            right.appendChild(empty);
        } else {
            for (const entry of this.workingLibrary.entries) {
                const row = document.createElement('div');
                row.className = 'procgen-pipeline-selected-row';
                const name = document.createElement('span');
                name.className = 'procgen-pipeline-selected-name';
                name.textContent = `${entry.entry_id} (${entry.substrate})`;
                name.title = `${entry.exit_sides?.join(',') ?? ''} · ${entry.location_slots ?? 0} slots`;
                row.appendChild(name);
                const rm = document.createElement('button');
                rm.className = 'procgen-pipeline-btn-small';
                rm.textContent = '×';
                rm.title = 'Remove from working library';
                rm.addEventListener('click', () => this._removeCapturedEntry(entry.entry_id));
                row.appendChild(rm);
                right.appendChild(row);
            }
            const btnRow = document.createElement('div');
            btnRow.style.cssText = 'display:flex;gap:6px;margin-top:4px;';
            btnRow.appendChild(this._btn('Download working library', () => this._downloadWorkingLibrary()));
            btnRow.appendChild(this._btn('Clear', () => this._clearWorkingLibrary()));
            right.appendChild(btnRow);
        }

        grid.appendChild(left);
        grid.appendChild(right);
        wrap.appendChild(grid);
        return wrap;
    }

    _renderCaptureRegionRow(region) {
        const row = document.createElement('div');
        row.className = 'procgen-pipeline-library-row';
        const name = document.createElement('span');
        name.style.cssText = 'flex:1;';
        name.textContent = `${region.region_id} (${region.substrate})`;
        row.appendChild(name);
        const save = this._btn('Save to library ▸', () => this._captureRegionToLibrary(region));
        save.title = 'Serialize this region into the working library';
        row.appendChild(save);
        return row;
    }

    // Serialize a live region into the working library via its substrate's
    // captureLibraryEntry hook, revalidating the captured entry against its own
    // payload before adding (a re-capture of the same entry_id replaces).
    _captureRegionToLibrary(region) {
        const sub = substrateRegistry.get(region?.substrate);
        if (!sub || typeof sub.captureLibraryEntry !== 'function') {
            this.warning = `Substrate "${region?.substrate}" has no library capture hook.`;
            this.render();
            return;
        }
        try {
            const entry = sub.captureLibraryEntry(region);
            const check = typeof sub.validateLibraryEntry === 'function'
                ? sub.validateLibraryEntry(entry) : { errors: [] };
            if (check.errors?.length) {
                this.warning = `Capture rejected: ${check.errors.join('; ')}`;
                this.render();
                return;
            }
            this.workingLibrary.entries = this.workingLibrary.entries
                .filter((e) => e.entry_id !== entry.entry_id);
            this.workingLibrary.entries.push(entry);
            this._saveWorkingLibraryToLocalStorage();
            const total = this.workingLibrary.entries.length;
            this.message = `Captured "${entry.entry_id}" → working library `
                + `(${total} entr${total === 1 ? 'y' : 'ies'}).`;
            this.warning = '';
            this.render();
        } catch (e) {
            this.warning = `Capture failed: ${e.message}`;
            this.render();
        }
    }

    _removeCapturedEntry(entryId) {
        this.workingLibrary.entries = this.workingLibrary.entries.filter((e) => e.entry_id !== entryId);
        this._saveWorkingLibraryToLocalStorage();
        this.render();
    }

    _clearWorkingLibrary() {
        this.workingLibrary = { entries: [] };
        this._saveWorkingLibraryToLocalStorage();
        this.render();
    }

    // Stamp a content-hash identity onto the working entries and download a valid
    // region-library document (committable to frontend/region-libraries/ + indexed).
    _downloadWorkingLibrary() {
        if (!this.workingLibrary.entries.length) return;
        const doc = {
            schema_version: REGION_LIBRARY_SCHEMA_VERSION,
            name: 'Captured Library',
            description: 'Regions captured from the procgen pipeline.',
            entries: JSON.parse(JSON.stringify(this.workingLibrary.entries)),
        };
        stampLibraryIdentity(doc);
        this._downloadText(JSON.stringify(doc, null, 2), `${doc.library_id}.json`);
        this.message = `Downloaded working library "${doc.library_id}" `
            + `(${doc.entries.length} entries).`;
        this.render();
    }

    _renderServedLibraryList() {
        const box = document.createElement('div');
        this._ensureServedLibraryIndex();
        const note = (txt) => {
            const n = document.createElement('div');
            n.className = 'procgen-pipeline-scenario-empty';
            n.textContent = txt;
            return n;
        };
        if (this._servedLibraryError) {
            box.appendChild(note(`(served index error: ${this._servedLibraryError})`));
            return box;
        }
        if (this._servedLibraryIndex === null) {
            box.appendChild(note('(loading served libraries…)'));
            return box;
        }
        if (this._servedLibraryIndex.length === 0) {
            box.appendChild(note('(no served libraries)'));
            return box;
        }
        for (const idx of this._servedLibraryIndex) {
            box.appendChild(this._renderServedLibraryRow(idx));
        }
        return box;
    }

    _renderServedLibraryRow(idx) {
        const row = document.createElement('div');
        row.className = 'procgen-pipeline-library-row';
        const selected = this.regionLibraries.some(
            (w) => w.source === 'served' && w.file === idx.file);
        const label = document.createElement('label');
        label.style.cssText = 'flex:1;cursor:pointer;display:flex;align-items:center;gap:4px;';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = selected;
        cb.className = 'procgen-pipeline-served-library-cb';
        cb.dataset.file = idx.file;
        cb.addEventListener('change', () => this._toggleServedLibrary(idx, cb.checked));
        label.appendChild(cb);
        const subs = (idx.substrates ?? []).join(', ');
        const n = idx.entry_count;
        label.appendChild(document.createTextNode(
            `${idx.name ?? idx.file} — ${n ?? '?'} entr${n === 1 ? 'y' : 'ies'}`
            + `${subs ? ` (${subs})` : ''}`));
        if (idx.description) label.title = idx.description;
        row.appendChild(label);
        return row;
    }

    _renderAdhocLibraryLoader() {
        const wrap = document.createElement('div');
        wrap.className = 'procgen-pipeline-field';
        const label = document.createElement('label');
        label.textContent = 'Load file';
        label.title = 'Load an ad-hoc region-library JSON (validated + restamped on load).';
        wrap.appendChild(label);
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.className = 'procgen-pipeline-library-file';
        input.addEventListener('change', () => {
            const file = input.files?.[0];
            if (file) this._loadAdhocLibraryFile(file);
            input.value = '';
        });
        wrap.appendChild(input);
        return wrap;
    }

    _renderSelectedLibraryRow(w) {
        const row = document.createElement('div');
        row.className = 'procgen-pipeline-selected-row';
        const name = document.createElement('span');
        name.className = 'procgen-pipeline-selected-name';
        const tag = w.source === 'adhoc' ? ' [ad-hoc]' : '';
        name.textContent = `${w.library.name ?? w.library.library_id}${tag}`;
        name.title = `${w.library.library_id} · ${w.library.entries.length} entries`;
        row.appendChild(name);

        const input = document.createElement('input');
        input.type = 'number';
        input.min = 1; input.max = 999; input.step = 1;
        input.value = w.count;
        input.className = 'procgen-pipeline-count-input';
        input.title = 'Spiral regions to fill from this library (repetition allowed once its entries run out).';
        input.addEventListener('change', () => {
            const v = parseInt(input.value, 10);
            w.count = Number.isFinite(v) && v > 0 ? v : 1;
            this._saveToLocalStorage();
            this.render();
        });
        row.appendChild(input);

        const rm = document.createElement('button');
        rm.className = 'procgen-pipeline-btn-small';
        rm.textContent = '×';
        rm.title = 'Remove this library';
        rm.addEventListener('click', () => this._removeLibrary(w));
        row.appendChild(rm);
        return row;
    }

    // Lazily fetch the served index once; re-render when it lands. Errors leave an
    // empty index + a surfaced message (the ad-hoc loader still works offline).
    _ensureServedLibraryIndex() {
        if (this._servedLibraryIndex !== null || this._servedLibraryFetching) return;
        this._servedLibraryFetching = true;
        loadServedIndex(window.fetch.bind(window), this._libraryBasePath())
            .then((libs) => { this._servedLibraryIndex = libs; this._servedLibraryError = null; })
            .catch((e) => { this._servedLibraryIndex = []; this._servedLibraryError = e.message; })
            .finally(() => { this._servedLibraryFetching = false; this.render(); });
    }

    // A user gesture is authoritative over any in-flight restore, so clear
    // _pendingLibraryRefs (the pre-resolve raw refs) whenever the working list is
    // edited — persistence then serializes the live regionLibraries.
    async _toggleServedLibrary(idx, checked) {
        if (!checked) {
            this.regionLibraries = this.regionLibraries.filter(
                (w) => !(w.source === 'served' && w.file === idx.file));
            this._pendingLibraryRefs = null;
            this._saveToLocalStorage();
            this.render();
            return;
        }
        if (this.regionLibraries.some((w) => w.source === 'served' && w.file === idx.file)) return;
        const res = await loadServedLibrary(window.fetch.bind(window), idx.file, {
            basePath: this._libraryBasePath(),
        });
        if (!res.ok) {
            this.warning = `Region library '${idx.file}': ${res.errors.join('; ')}`;
            this.render();
            return;
        }
        this.regionLibraries.push({ source: 'served', file: idx.file, library: res.library, count: 1 });
        this._pendingLibraryRefs = null;
        this.warning = res.warnings?.length ? `Region library '${idx.file}': ${res.warnings.join('; ')}` : '';
        this._saveToLocalStorage();
        this.render();
    }

    async _loadAdhocLibraryFile(file) {
        try {
            const text = await file.text();
            const res = parseRegionLibrary(text, { restamp: true });
            if (!res.ok) {
                this.warning = `Ad-hoc library '${file.name}': ${res.errors.join('; ')}`;
                this.render();
                return;
            }
            // A re-load of the same document replaces the prior working entry.
            this.regionLibraries = this.regionLibraries.filter(
                (w) => w.library.library_id !== res.library.library_id);
            this.regionLibraries.push({ source: 'adhoc', library: res.library, count: 1 });
            this._pendingLibraryRefs = null;
            this.message = `Loaded ad-hoc library '${res.library.name ?? res.library.library_id}' `
                + `(${res.library.entries.length} entries).`;
            this.warning = res.warnings?.length ? res.warnings.join('; ') : '';
            this._saveToLocalStorage();
            this.render();
        } catch (e) {
            this.warning = `Ad-hoc library '${file.name}': ${e.message}`;
            this.render();
        }
    }

    _removeLibrary(w) {
        this.regionLibraries = this.regionLibraries.filter((x) => x !== w);
        this._pendingLibraryRefs = null;
        this._saveToLocalStorage();
        this.render();
    }

    _renderSubstrateModeToggle() {
        const row = document.createElement('div');
        row.className = 'procgen-pipeline-field';
        const label = document.createElement('label');
        label.textContent = 'Substrate allocation';
        label.title = 'Quotas: fixed per-substrate region count. Mix: weighted random per region.';
        row.appendChild(label);

        const group = document.createElement('span');
        for (const opt of [
            { value: 'quotas', text: 'Quotas (fixed counts)' },
            { value: 'mix', text: 'Mix (weighted random)' },
        ]) {
            const wrap = document.createElement('label');
            wrap.style.marginRight = '8px';
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'procgen-pipeline-substrate-mode';
            radio.value = opt.value;
            radio.checked = this.substrateMode === opt.value;
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    this.substrateMode = opt.value;
                    this._saveToLocalStorage();
                    this.render();
                }
            });
            wrap.appendChild(radio);
            wrap.appendChild(document.createTextNode(` ${opt.text}`));
            group.appendChild(wrap);
        }
        row.appendChild(group);
        return row;
    }

    _renderStartSubstrateRow() {
        const row = document.createElement('div');
        row.className = 'procgen-pipeline-field';
        const label = document.createElement('label');
        label.textContent = 'Start substrate';
        label.title = "Substrate for the start region. 'Auto' uses the active picker (quotas or mix).";
        row.appendChild(label);

        const select = document.createElement('select');
        const autoOpt = document.createElement('option');
        autoOpt.value = 'auto';
        autoOpt.textContent = 'Auto';
        select.appendChild(autoOpt);
        for (const id of Object.keys(this._activeSubstrateDict())) {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = id;
            select.appendChild(opt);
        }
        // Normalize: a stored startSubstrate that's no longer in the
        // active dict (substrate removed since last load) would set
        // select.value to a non-existent option, rendering as blank.
        // Fall back to 'auto' and write it back so the params and the
        // UI stay in sync.
        const stored = this.params.startSubstrate ?? 'auto';
        const valid = stored === 'auto' || stored in this._activeSubstrateDict();
        if (!valid) this.params.startSubstrate = 'auto';
        select.value = valid ? stored : 'auto';
        select.addEventListener('change', () => {
            this.params.startSubstrate = select.value;
            this._saveToLocalStorage();
        });
        row.appendChild(select);
        return row;
    }

    /**
     * If `removedId` matches the current start-substrate selection,
     * reset to 'auto'. Called from the quota row's × button and from
     * the count-input "set to 0/empty" path. Without this, the select
     * value goes stale (the option no longer exists) and renders blank,
     * and arrangeShuffledSpiral throws
     * `startSubstrate '<id>' has no quota` at generate time.
     */
    _resetStartSubstrateIfRemoved(removedId) {
        if (this.params.startSubstrate === removedId) {
            this.params.startSubstrate = 'auto';
        }
    }

    /**
     * The currently-active substrate dictionary — quotas dict in
     * quotas mode (grid-growth only), otherwise the mix dict. The UI
     * mutates whichever this returns when the user clicks "add" or
     * edits a numeric input.
     */
    _activeSubstrateDict() {
        // Shuffled-spiral and sphere-growth always use fixed
        // per-substrate counts; the mix dict is meaningless there.
        // Grid-growth honors the mode toggle. Top-down (no toggle)
        // keeps the legacy mix dict.
        if (this.mode === 'shuffledSpiral' || this.mode === 'sphereGrowth') {
            return this.substrateQuotas;
        }
        if (this.mode === 'gridGrowth' && this.substrateMode === 'quotas') {
            return this.substrateQuotas;
        }
        return this.substrateMix;
    }

    // Completion-condition item for the emitted rules.json. Scenario
    // pool first (first item flagged is_victory with a positive
    // count); failing that, the first selected substrate that declares
    // a `victoryItem` on its registry entry (zone-based substrates
    // like bounce place their victory item from their own zone tables,
    // invisible to the scenario pool). Null when neither contributes —
    // buildRulesJson then keeps the scaffold's constant-true default.
    _resolveVictoryItemId() {
        const lib = this._mergedItemLib();
        const fromScenario = Object.entries(this.scenario.items)
            .find(([id, count]) => count > 0 && lib[id]?.is_victory)?.[0];
        if (fromScenario) return fromScenario;
        for (const [id, count] of Object.entries(this._activeSubstrateDict())) {
            if (!(Number(count) > 0)) continue;
            const victoryItem = substrateRegistry.get(id)?.victoryItem;
            if (victoryItem) return victoryItem;
        }
        return null;
    }

    /**
     * The shared item library plus any `libraryItems` declared by the
     * selected substrates (e.g. bounce's ability items — registry-
     * declared so the shared library submodule needn't carry them).
     * Used by the library picker, victory resolution, and as the
     * itemLib handed to the sphere grower / rules.json compiler.
     */
    _mergedItemLib() {
        const merged = { ...DEFAULT_ITEMS };
        const dict = this._activeSubstrateDict();
        for (const [id, count] of Object.entries(dict)) {
            if (!(Number(count) > 0)) continue;
            const extra = substrateRegistry.get(id)?.libraryItems;
            if (extra) Object.assign(merged, extra);
        }
        return merged;
    }

    /**
     * The base default params merged with every registered substrate's
     * declared `defaultProcgenParams` (e.g. bounce's fall behavior /
     * physics profile / braid layout). Substrates own their own param
     * defaults via the registry so the panel stays substrate-agnostic.
     */
    _defaultParams() {
        return defaultProcgenParams(DEFAULT_PARAMS);
    }

    /**
     * Substrate ids participating in a sphere-growth run: every
     * substrate with a positive quota, plus an explicit start
     * substrate. Drives the per-substrate pre-plan + regionParams hooks.
     */
    _activeSubstrateIds(quotas, startSub) {
        return activeSubstrateIds(quotas, startSub);
    }

    /**
     * Gather each active substrate's pre-plan contributions via its
     * optional `prepareSphereGrowth` hook: starting items, sphere-1
     * reservations (exclusiveSpheres), canonical-placement locks, item
     * pool removals (itemPoolDelta, applied in place to `itemPool`),
     * regionParams additions, and a UI note. Substrates without the
     * hook contribute nothing.
     */
    _collectSphereGrowthPrep({ activeIds, itemPool, quotas, startSubstrate, seed }) {
        return collectSphereGrowthPrep({
            activeIds, itemPool, quotas, startSubstrate, seed, params: this.params,
        });
    }

    /**
     * Merge each active substrate's `buildRegionParams` hook output into
     * one regionParams object. `mode` is 'sphere' | 'topDown'. `extra`
     * (e.g. the pre-plan hook's regionParams contribution) wins last.
     */
    _assembleRegionParams(activeIds, mode, extra = {}) {
        return assembleRegionParams({ activeIds, mode, params: this.params, extra });
    }

    _renderSubstrateLibraryRow(entry) {
        const row = document.createElement('div');
        row.className = 'procgen-pipeline-library-row procgen-pipeline-library-row-substrate';
        const name = document.createElement('span');
        name.className = 'procgen-pipeline-library-name';
        name.textContent = entry.id;
        row.appendChild(name);

        // Disabled-look when already in the active dict; clicking
        // again is a no-op rather than an increment, which would
        // conflict with the weight/quota semantics.
        const dict = this._activeSubstrateDict();
        const alreadySelected = Object.prototype.hasOwnProperty.call(dict, entry.id);
        if (alreadySelected) {
            row.classList.add('procgen-pipeline-library-row-disabled');
        } else {
            row.addEventListener('click', () => {
                dict[entry.id] = 1;
                this._saveToLocalStorage();
                this.render();
            });
        }
        return row;
    }

    _renderSubstrateSelectedRow(id, value) {
        const dict = this._activeSubstrateDict();
        const row = document.createElement('div');
        row.className = 'procgen-pipeline-selected-row';
        const name = document.createElement('span');
        name.className = 'procgen-pipeline-selected-name';
        name.textContent = id;
        row.appendChild(name);

        const input = document.createElement('input');
        input.type = 'number';
        input.min = 0;
        input.max = 999;
        input.step = 1;
        input.value = value;
        input.className = 'procgen-pipeline-count-input';
        input.addEventListener('change', () => {
            const v = parseInt(input.value, 10);
            if (Number.isFinite(v) && v > 0) {
                dict[id] = v;
            } else {
                delete dict[id];
                this._resetStartSubstrateIfRemoved(id);
            }
            this._saveToLocalStorage();
            this.render();
        });
        row.appendChild(input);

        const rm = document.createElement('button');
        rm.className = 'procgen-pipeline-btn-small';
        rm.textContent = '×';
        rm.title = `Remove ${id}`;
        rm.addEventListener('click', () => {
            delete dict[id];
            this._resetStartSubstrateIfRemoved(id);
            this._saveToLocalStorage();
            this.render();
        });
        row.appendChild(rm);
        return row;
    }

    _renderLibrarySubsection() {
        const grid = document.createElement('div');
        grid.className = 'procgen-pipeline-scenario-grid';

        // Left: library (click to add). Entries are grouped by which
        // selected substrates declare each entry's `feature`. See
        // NewDocs/plans/procedural-generation/library-feature-filtering.md
        // for the design.
        const left = document.createElement('div');
        left.className = 'procgen-pipeline-scenario-library';
        const leftHeader = document.createElement('div');
        leftHeader.className = 'procgen-pipeline-scenario-subheader';
        leftHeader.textContent = 'Library (click to add)';
        left.appendChild(leftHeader);

        // Toggle for the "Unsupported" group. Visible always so the
        // user can find it; flipping it re-renders.
        const toggleRow = document.createElement('label');
        toggleRow.className = 'procgen-pipeline-library-toggle';
        const toggleInput = document.createElement('input');
        toggleInput.type = 'checkbox';
        toggleInput.checked = this.showUnsupportedLibrary;
        toggleInput.addEventListener('change', () => {
            this.showUnsupportedLibrary = toggleInput.checked;
            this._saveViewToLocalStorage();
            this.render();
        });
        toggleRow.appendChild(toggleInput);
        const toggleLabel = document.createElement('span');
        toggleLabel.textContent = 'Show unsupported by selected substrates';
        toggleRow.appendChild(toggleLabel);
        left.appendChild(toggleRow);

        const allEntries = [
            ...Object.entries(this._mergedItemLib()).map(([id, def]) => ({ id, def, kind: 'item' })),
            ...Object.entries(DEFAULT_OBSTACLES).map(([id, def]) => ({ id, def, kind: 'obstacle' })),
        ];
        const activeDict = this._activeSubstrateDict();
        const selectedEntries = Object.keys(activeDict)
            .filter((id) => activeDict[id] > 0)
            .sort()
            .map((id) => substrateRegistry.get(id))
            .filter(Boolean);
        const groups = groupLibraryByFeature(allEntries, selectedEntries);

        const renderGroup = (label, entries) => {
            if (entries.length === 0) return;
            const h = document.createElement('div');
            h.className = 'procgen-pipeline-library-group-header';
            h.textContent = label;
            left.appendChild(h);
            for (const { id, def, kind } of entries) {
                left.appendChild(this._renderLibraryRow(id, def, kind));
            }
        };

        renderGroup('Common', groups.common);
        for (const sub of groups.substrateSpecific) {
            renderGroup(sub.label, sub.entries);
        }
        if (this.showUnsupportedLibrary) {
            renderGroup('Unsupported by selected substrates', groups.unsupported);
        }

        // Right: selected (with counts).
        const right = document.createElement('div');
        right.className = 'procgen-pipeline-scenario-selected';
        const rightHeader = document.createElement('div');
        rightHeader.className = 'procgen-pipeline-scenario-subheader';
        rightHeader.textContent = 'Scenario (counts)';
        right.appendChild(rightHeader);
        for (const [id, count] of Object.entries(this.scenario.items)) {
            right.appendChild(this._renderSelectedRow(id, count, 'item'));
        }
        for (const [id, count] of Object.entries(this.scenario.obstacles)) {
            right.appendChild(this._renderSelectedRow(id, count, 'obstacle'));
        }
        if (Object.keys(this.scenario.items).length === 0
            && Object.keys(this.scenario.obstacles).length === 0) {
            const empty = document.createElement('div');
            empty.className = 'procgen-pipeline-scenario-empty';
            empty.textContent = '(no items/obstacles selected)';
            right.appendChild(empty);
        }

        grid.appendChild(left);
        grid.appendChild(right);
        return grid;
    }

    _renderLibraryRow(id, def, kind) {
        const row = document.createElement('div');
        row.className = `procgen-pipeline-library-row procgen-pipeline-library-row-${kind}`;
        if (def.color) {
            const swatch = document.createElement('span');
            swatch.className = 'procgen-pipeline-swatch';
            swatch.style.background = def.color;
            row.appendChild(swatch);
        }
        const name = document.createElement('span');
        name.className = 'procgen-pipeline-library-name';
        name.textContent = `${def.name ?? id} (${kind})`;
        row.appendChild(name);
        row.addEventListener('click', () => {
            const bucket = kind === 'item' ? this.scenario.items : this.scenario.obstacles;
            bucket[id] = (bucket[id] || 0) + 1;
            this._saveToLocalStorage();
            this.render();
        });
        return row;
    }

    _renderSelectedRow(id, count, kind) {
        const row = document.createElement('div');
        row.className = 'procgen-pipeline-selected-row';
        const name = document.createElement('span');
        name.className = 'procgen-pipeline-selected-name';
        name.textContent = `${id} (${kind})`;
        row.appendChild(name);

        const input = document.createElement('input');
        input.type = 'number';
        input.min = 0;
        input.max = 999;
        input.value = count;
        input.className = 'procgen-pipeline-count-input';
        input.addEventListener('change', () => {
            const v = parseInt(input.value, 10);
            const bucket = kind === 'item' ? this.scenario.items : this.scenario.obstacles;
            if (Number.isFinite(v) && v > 0) bucket[id] = v;
            else delete bucket[id];
            this._saveToLocalStorage();
            this.render();
        });
        row.appendChild(input);

        const rm = document.createElement('button');
        rm.className = 'procgen-pipeline-btn-small';
        rm.textContent = '×';
        rm.addEventListener('click', () => {
            const bucket = kind === 'item' ? this.scenario.items : this.scenario.obstacles;
            delete bucket[id];
            this._saveToLocalStorage();
            this.render();
        });
        row.appendChild(rm);
        return row;
    }

    // --- Parameters ---

    _renderParams() {
        const section = document.createElement('div');
        section.className = 'procgen-pipeline-params';
        // Title supplied by the collapsible wrapper in render().

        const grid = document.createElement('div');
        grid.className = 'procgen-pipeline-grid';

        // Grid dims are user-controlled in grid-growth / top-down,
        // but shuffled-spiral and sphere-growth auto-size the grid —
        // hide the inputs in those modes so the user isn't led to
        // think they take effect.
        const showGridDims = this.mode !== 'shuffledSpiral'
            && this.mode !== 'sphereGrowth';
        const fields = [
            { key: 'seed',              label: 'Seed',             min: 0 },
            ...(showGridDims ? [
                { key: 'gridWidth',     label: 'Grid width',       min: 1, max: 10 },
                { key: 'gridHeight',    label: 'Grid height',      min: 1, max: 10 },
            ] : []),
            { key: 'regionWidth',       label: 'Region width',     min: 2, max: 40 },
            { key: 'regionHeight',      label: 'Region height',    min: 2, max: 40 },
            { key: 'maxItemsPerRegion', label: 'Max items/region', min: 0, max: 10 },
            ...(this.mode === 'sphereGrowth' ? [
                { key: 'sphereCount',   label: 'Spheres',          min: 1, max: 20 },
                { key: 'fillerCount',   label: 'Filler regions',   min: 0, max: 50 },
                { key: 'revisitPercent', label: 'Revisit %',       min: 0, max: 100 },
                {
                    key: 'spheresPerBatch', label: 'Spheres/batch', min: 0, max: 20,
                    nullable: true, placeholder: 'all',
                    title: 'How many spheres to grow per batch. "all" (default) is '
                        + 'the byte-identical step-major build; a smaller value grows '
                        + 'sphere-major (interleaving topology + regions per batch) and '
                        + 'intentionally produces a different world.',
                },
            ] : []),
        ];

        for (const f of fields) {
            const row = document.createElement('div');
            row.className = 'procgen-pipeline-field';
            const label = document.createElement('label');
            label.textContent = f.label;
            const input = document.createElement('input');
            input.type = 'number';
            input.value = this.params[f.key] ?? '';
            if (f.min !== undefined) input.min = f.min;
            if (f.max !== undefined) input.max = f.max;
            if (f.placeholder) input.placeholder = f.placeholder;
            if (f.title) { input.title = f.title; label.title = f.title; }
            input.addEventListener('change', () => {
                // Nullable fields collapse to null (shown as the placeholder)
                // both on an empty box AND when the spinner steps down to 0 —
                // so "Spheres/batch" toggles 1 ⇄ all from the up/down arrows.
                if (f.nullable && (input.value === '' || parseInt(input.value, 10) <= 0)) {
                    this.params[f.key] = null;
                    input.value = '';
                } else {
                    const v = parseInt(input.value, 10);
                    if (Number.isFinite(v)) this.params[f.key] = v;
                }
                this._saveToLocalStorage();
            });
            row.appendChild(label);
            row.appendChild(input);
            grid.appendChild(row);
        }
        section.appendChild(grid);

        // Region XP effect dropdown. The selected mode is stamped on
        // every loop_costs.regions[name].xpEffect when loop mode is on;
        // costDataManager exposes it at runtime via getRegionXpEffect.
        // No effect if loop mode is off — the field is still written
        // but no mana deduction happens.
        const xpEffectRow = document.createElement('div');
        xpEffectRow.className = 'procgen-pipeline-field';
        const xpEffectLabel = document.createElement('label');
        xpEffectLabel.textContent = 'Region XP effect';
        xpEffectLabel.title = "Per-region XP discount mode applied to mana costs. 'Speed' / 'Both' are reserved for v2.";
        const xpEffectSelect = document.createElement('select');
        for (const opt of REGION_XP_EFFECT_OPTIONS) {
            const optEl = document.createElement('option');
            optEl.value = opt.value;
            optEl.textContent = opt.label;
            if (opt.disabled) optEl.disabled = true;
            xpEffectSelect.appendChild(optEl);
        }
        xpEffectSelect.value = this.params.regionXpEffect ?? 'cost';
        xpEffectSelect.addEventListener('change', () => {
            this.params.regionXpEffect = xpEffectSelect.value;
            this._saveToLocalStorage();
        });
        xpEffectRow.appendChild(xpEffectLabel);
        xpEffectRow.appendChild(xpEffectSelect);
        section.appendChild(xpEffectRow);

        // Stop-on-pool-empty toggle. When on, growMaze ends the
        // moment the item pool is exhausted; when off (default),
        // growth continues with empty item plans. Most useful in
        // quota mode, where the user wants exact region counts.
        if (this.mode === 'gridGrowth') {
            const stopRow = document.createElement('div');
            stopRow.className = 'procgen-pipeline-field';
            const stopLabel = document.createElement('label');
            stopLabel.textContent = 'Stop when item pool empty';
            stopLabel.title = 'End grid-growth as soon as the item pool runs out. Off → continue with empty item plans.';
            const stopInput = document.createElement('input');
            stopInput.type = 'checkbox';
            stopInput.checked = !!this.params.stopOnPoolEmpty;
            stopInput.addEventListener('change', () => {
                this.params.stopOnPoolEmpty = !!stopInput.checked;
                this._saveToLocalStorage();
            });
            stopRow.appendChild(stopLabel);
            stopRow.appendChild(stopInput);
            section.appendChild(stopRow);

            // Asymmetric-exit reconciliation mode. Cross-branch
            // stitching can leave one region with an exit to its
            // neighbor but no reciprocal. 'Add' inserts a back-exit
            // on the neighbor; 'Remove' drops the one-way forward
            // exit instead.
            const asymRow = document.createElement('div');
            asymRow.className = 'procgen-pipeline-field';
            const asymLabel = document.createElement('label');
            asymLabel.textContent = 'Asymmetric exits';
            asymLabel.title = 'How to reconcile one-way exits created by cross-branch stitching.';
            const asymSelect = document.createElement('select');
            for (const opt of [
                { value: 'add', text: 'Add reciprocal back-exit' },
                { value: 'remove', text: 'Remove one-way forward exit' },
            ]) {
                const o = document.createElement('option');
                o.value = opt.value;
                o.textContent = opt.text;
                asymSelect.appendChild(o);
            }
            asymSelect.value = this.params.asymmetricExits ?? 'add';
            asymSelect.addEventListener('change', () => {
                this.params.asymmetricExits = asymSelect.value;
                this._saveToLocalStorage();
            });
            asymRow.appendChild(asymLabel);
            asymRow.appendChild(asymSelect);
            section.appendChild(asymRow);
        }

        // Loop-mode toggle. Renders below the numeric grid. When on,
        // every generated rules.json carries loop_costs + manaEnabled
        // sidecar fields, so the maze/textAdventure substrates deduct
        // mana on movement at runtime.
        const loopModeRow = document.createElement('div');
        loopModeRow.className = 'procgen-pipeline-field';
        const loopModeLabel = document.createElement('label');
        loopModeLabel.textContent = 'Enable loop mode';
        loopModeLabel.title = 'Embed loop_costs in rules.json and turn on per-region mana deduction';
        const loopModeInput = document.createElement('input');
        loopModeInput.type = 'checkbox';
        loopModeInput.checked = !!this.params.enableLoopMode;
        loopModeInput.addEventListener('change', () => {
            this.params.enableLoopMode = !!loopModeInput.checked;
            this._saveToLocalStorage();
        });
        loopModeRow.appendChild(loopModeLabel);
        loopModeRow.appendChild(loopModeInput);
        section.appendChild(loopModeRow);

        // Per-substrate parameter subsections — one per selected
        // substrate that declares panel parameters (maze: hazards;
        // bounce: fall behavior). Common parameters stay above; with
        // nothing selected the engine defaults to maze, so its
        // subsection shows then too.
        section.appendChild(this._renderSubstrateParamSections());

        const btnRow = document.createElement('div');
        btnRow.className = 'procgen-pipeline-btn-row';
        const saveBtn = this._btn('Save Params', () => this._saveToLocalStorage({ showFeedback: true }));
        const loadBtn = this._btn('Load Params', () => { this._loadFromLocalStorage(); this.render(); });
        const resetBtn = this._btn('Reset Defaults', () => {
            this.params = this._defaultParams();
            this.scenario = {
                items: { ...DEFAULT_SCENARIO.items },
                obstacles: { ...DEFAULT_SCENARIO.obstacles },
            };
            this._saveToLocalStorage();
            this.render();
        });
        btnRow.appendChild(saveBtn);
        btnRow.appendChild(loadBtn);
        btnRow.appendChild(resetBtn);
        section.appendChild(btnRow);
        return section;
    }

    // --- Actions + stats ---

    _renderActions() {
        const section = document.createElement('div');
        section.className = 'procgen-pipeline-actions';
        const sphere = this.mode === 'sphereGrowth';
        const topDown = this.mode === 'topDown';
        const spiral = this.mode === 'shuffledSpiral';
        const completed = this._stepState?.completed ?? -1;
        const tdCompleted = this._tdState?.completed ?? -1;
        const spiralCompleted = this._spiralState?.completed ?? -1;

        // Step indicator (stepped modes): the step chips take the full first
        // row; the Run buttons sit on their own row below.
        if (sphere || topDown || spiral) {
            const ind = this._renderStepIndicator();
            ind.style.flexBasis = '100%';
            section.appendChild(ind);
        }

        // Primary button: "Generate" in single-shot modes; "Run all"
        // (run the sphere pipeline to completion from wherever it is) in
        // sphere mode.
        const gen = document.createElement('button');
        gen.className = 'procgen-pipeline-btn procgen-pipeline-btn-primary';
        gen.textContent = this.isGenerating
            ? 'Working…'
            : (sphere
                ? (completed >= 0 && completed < SPHERE_LAST_STEP ? 'Run all (finish)' : 'Run all')
                : (topDown && tdCompleted >= 0 && tdCompleted < TOPDOWN_LAST_STEP
                    ? 'Run all (finish)'
                    : (spiral && spiralCompleted >= 0 && spiralCompleted < SPIRAL_LAST_STEP
                        ? 'Run all (finish)' : 'Generate')));
        gen.disabled = this.isGenerating;
        gen.addEventListener('click', () => this._runGeneration());

        if (sphere) {
            // Sphere mode: a dedicated button row below the indicators. The next
            // step follows nextSphereStep (it loops 2a→3 per batch in sphere-
            // major mode), so the label can revisit 2a Allocate for the next
            // sphere before 4 Compile. "◀ Previous sphere" drops the most recent
            // sphere so it can be re-grown / edited.
            const btnRow = document.createElement('div');
            btnRow.className = 'procgen-pipeline-btn-row';
            btnRow.style.flexBasis = '100%';

            // Enabled only once at least one sphere has actually been BUILT (its
            // regions are on the grid) — there's a previous sphere to return to.
            const hasBuiltSphere = (this._stepState?.batchStart ?? 0) >= 1
                && !!this._stepState?.grow?.grid;
            const prevBtn = this._btn('◀ Previous sphere', () => this._stepBackSphere());
            prevBtn.disabled = this.isGenerating || !hasBuiltSphere;
            prevBtn.title = hasBuiltSphere
                ? 'Drop the most recently built sphere so you can re-grow or edit it'
                : 'No completed sphere to step back to yet';
            btnRow.appendChild(prevBtn);

            btnRow.appendChild(gen);

            const nextStep = this._stepState ? nextSphereStep(this._stepState) : 'plan';
            const nextIdx = nextStep ? SPHERE_STEPS.indexOf(nextStep) : -1;
            const nextBtn = document.createElement('button');
            nextBtn.className = 'procgen-pipeline-btn';
            nextBtn.textContent = nextIdx >= 0
                ? SPHERE_STEP_RUN_LABELS[nextIdx] : 'Pipeline complete';
            nextBtn.disabled = this.isGenerating || nextIdx < 0;
            nextBtn.addEventListener('click', () => this._runSphereStepNext());
            btnRow.appendChild(nextBtn);

            if (this._stepState) {
                btnRow.appendChild(this._btn('Reset', () => this._resetSphereSteps()));
                btnRow.appendChild(this._btn('Export envelope', () => this._exportEnvelope()));
            }
            // Load a saved / CLI-produced envelope OR a finalized sphere-growth
            // rules.json (e.g. from the APWorld Editor — reconstructed into an
            // append-ready envelope), and auto-resume from the first step whose
            // output is missing (no manual step selection).
            const envInput = document.createElement('input');
            envInput.type = 'file';
            envInput.accept = '.json,application/json';
            envInput.className = 'procgen-pipeline-envelope-input';
            envInput.style.display = 'none';
            envInput.addEventListener('change', async () => {
                const file = envInput.files?.[0];
                if (!file) return;
                const text = await file.text();
                this._loadEnvelopeFile(text, file.name);
            });
            const loadBtn = this._btn('Load envelope / rules.json', () => envInput.click());
            loadBtn.title = 'Load a saved envelope, or a finalized sphere-growth '
                + 'rules.json to reconstruct and grow further (procedural substrates only)';
            btnRow.appendChild(loadBtn);
            btnRow.appendChild(envInput);
            section.appendChild(btnRow);

            // Append-sphere affordance — only on a COMPLETE pipeline. Grows one
            // more sphere: the goal is relocated into a new final sphere with the
            // entered items (a goal-only final sphere is reverted; see
            // appendSphere). Same engine path as `sphere-step append`.
            if (this._stepState?.completed === SPHERE_LAST_STEP && this._stepState?.compile) {
                const appendRow = document.createElement('div');
                appendRow.className = 'procgen-pipeline-btn-row';
                appendRow.style.flexBasis = '100%';
                const lbl = document.createElement('span');
                lbl.textContent = 'Append sphere — new items:';
                lbl.style.cssText = 'font-size:12px;color:#aaa;align-self:center;';
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'procgen-pipeline-append-items';
                input.placeholder = 'gem, orb  (comma-separated; optional)';
                input.value = this._appendItemsDraft ?? '';
                input.style.cssText = 'flex:1;min-width:140px;background:#1e1e1e;'
                    + 'border:1px solid #555;border-radius:3px;color:#ccc;font-size:12px;padding:3px 6px;';
                input.addEventListener('input', (e) => { this._appendItemsDraft = e.target.value; });
                input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this._appendSphere(); });
                const appendBtn = this._btn('Append sphere', () => this._appendSphere());
                appendBtn.disabled = this.isGenerating;
                appendRow.append(lbl, input, appendBtn);
                section.appendChild(appendRow);
            }
        } else if (topDown) {
            // Top-down mode: a Run-next button row beside the primary (Generate /
            // Run all), mirroring sphere mode over the four top-down steps.
            const btnRow = document.createElement('div');
            btnRow.className = 'procgen-pipeline-btn-row';
            btnRow.style.flexBasis = '100%';
            btnRow.appendChild(gen);

            const nextStep = this._tdState ? nextTopDownStep(this._tdState) : 'layout';
            const nextIdx = nextStep ? TOPDOWN_STEPS.indexOf(nextStep) : -1;
            const nextBtn = document.createElement('button');
            nextBtn.className = 'procgen-pipeline-btn';
            nextBtn.textContent = nextIdx >= 0
                ? TOPDOWN_STEP_RUN_LABELS[nextIdx] : 'Pipeline complete';
            nextBtn.disabled = this.isGenerating || nextIdx < 0;
            nextBtn.addEventListener('click', () => this._runTopDownStepNext());
            btnRow.appendChild(nextBtn);

            if (this._tdState) {
                btnRow.appendChild(this._btn('Reset', () => this._resetTDSteps()));
            }
            section.appendChild(btnRow);
        } else if (spiral) {
            // Shuffled-spiral mode: a Run-next button row beside the primary
            // (Generate / Run all), mirroring top-down over the four spiral steps.
            const btnRow = document.createElement('div');
            btnRow.className = 'procgen-pipeline-btn-row';
            btnRow.style.flexBasis = '100%';
            btnRow.appendChild(gen);

            const nextStep = this._spiralState ? nextSpiralStep(this._spiralState) : 'arrange';
            const nextIdx = nextStep ? SPIRAL_STEPS.indexOf(nextStep) : -1;
            const nextBtn = document.createElement('button');
            nextBtn.className = 'procgen-pipeline-btn';
            nextBtn.textContent = nextIdx >= 0
                ? SPIRAL_STEP_RUN_LABELS[nextIdx] : 'Pipeline complete';
            nextBtn.disabled = this.isGenerating || nextIdx < 0;
            nextBtn.addEventListener('click', () => this._runSpiralStepNext());
            btnRow.appendChild(nextBtn);

            if (this._spiralState) {
                btnRow.appendChild(this._btn('Reset', () => this._resetSpiralSteps()));
            }
            section.appendChild(btnRow);
        } else {
            section.appendChild(gen);
        }

        // Live progress indicator (stepped modes): full-width row below
        // the button, rewritten per progress event by direct DOM
        // mutation while the async generation drain yields between
        // regions and generate-and-test attempts.
        if (this.isGenerating) {
            const prog = document.createElement('div');
            prog.className = 'procgen-pipeline-progress';
            this._progressEl = prog;
            section.appendChild(prog);
            this._updateProgressEl();
        } else {
            this._progressEl = null;
        }

        // Post-generation export actions, shown next to Generate once
        // a result is available. Hidden until then to keep the panel
        // uncluttered before there's anything to export.
        if (this.result) {
            const json = stringifyRulesJson(this.result.rulesJson);
            const seedName = this.result.rulesJson?.seed_name || String(this.params.seed);
            const filename = `AP_${seedName}_rules.json`;

            const loadBtn = this._btn('Load into frontend', (e) => {
                e.preventDefault();
                this._loadIntoFrontend(this.result.rulesJson, loadBtn);
            });
            const editBtn = this._btn('Edit in APWorld Editor', (e) => {
                e.preventDefault();
                this._editInApworldEditor(this.result.rulesJson, editBtn);
            });
            editBtn.title = 'Load this world into the APWorld Editor and open that panel';
            const downloadBtn = this._btn('Download rules.json', (e) => {
                e.preventDefault();
                this._downloadText(json, filename);
            });
            const copyBtn = this._btn('Copy JSON', (e) => {
                e.preventDefault();
                this._copyToClipboard(json, copyBtn);
            });
            section.appendChild(loadBtn);
            section.appendChild(editBtn);
            section.appendChild(downloadBtn);
            section.appendChild(copyBtn);
        }

        if (this.message) {
            const msg = document.createElement('span');
            msg.className = 'procgen-pipeline-message';
            msg.textContent = this.message;
            section.appendChild(msg);
        }
        if (this.warning) {
            const warn = document.createElement('div');
            warn.className = 'procgen-pipeline-warning';
            warn.textContent = this.warning;
            section.appendChild(warn);
        }
        return section;
    }

    // The step chips above the stepped-mode buttons (sphere: 1 → 2a → … → 4;
    // top-down: 1 Layout → 2 Realise → 3 Finalize → 4 Compile). Inline styles
    // so it renders without depending on panel CSS.
    _renderStepIndicator() {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-bottom:6px;font-size:12px;';
        const topDown = this.mode === 'topDown';
        const spiral = this.mode === 'shuffledSpiral';
        const labels = topDown ? TOPDOWN_STEP_LABELS
            : spiral ? SPIRAL_STEP_LABELS : SPHERE_STEP_LABELS;
        const completed = (topDown ? this._tdState?.completed
            : spiral ? this._spiralState?.completed
                : this._stepState?.completed) ?? -1;
        labels.forEach((label, i) => {
            const chip = document.createElement('span');
            const done = i <= completed;
            const next = i === completed + 1;
            chip.textContent = label;
            chip.style.cssText = 'padding:2px 8px;border-radius:10px;'
                + (done ? 'background:#2a5a35;color:#cfe9d6;'
                    : next ? 'background:#3a3a1a;color:#e8e0b0;border:1px solid #888;'
                        : 'background:#2a2a2a;color:#888;');
            wrap.appendChild(chip);
            if (i < labels.length - 1) {
                const arrow = document.createElement('span');
                arrow.textContent = '→';
                arrow.style.cssText = 'color:#666;';
                wrap.appendChild(arrow);
            }
        });

        // Sphere-major batch progress: in batch < all mode the 2a→3 chips
        // loop per batch, so surface which sphere(s) the loop is on. batchStart
        // counts the spheres whose regions are already on the grid.
        const st = this._stepState;
        if (st?.plan) {
            const total = st.plan.spheres.length;
            const batch = resolveSpheresPerBatch(st.config?.spheresPerBatch, total);
            if (batch < total) {
                const built = st.grow?.grid ? (st.batchStart ?? 0) : 0;
                const tag = document.createElement('span');
                tag.style.cssText = 'padding:2px 8px;border-radius:10px;'
                    + 'background:#1d3a4a;color:#bfe2f0;margin-left:8px;';
                tag.textContent = built >= total
                    ? `sphere-major (batch ${batch}): all ${total} spheres built`
                    : `sphere-major (batch ${batch}): ${built}/${total} spheres built`;
                wrap.appendChild(tag);
            }
        }
        return wrap;
    }

    // Content of the "Sphere pipeline" section: the editable plan, then
    // read-only feedback for each completed step.
    _renderSphereSteps() {
        const wrap = document.createElement('div');
        const st = this._stepState;
        if (!st) return wrap;
        wrap.appendChild(this._renderStepBlock('1 Plan — edit, then run the next step',
            this._renderPlanEditor()));
        if (st.completed >= 1 && st.allocation) {
            wrap.appendChild(this._renderStepBlock('2a Allocate — region & filler counts per wave',
                this._renderAllocateEditor(st.allocation)));
        }
        if (st.completed >= 2 && st.nodes) {
            wrap.appendChild(this._renderStepBlock('2b Topology — substrate / parent / gate per region',
                this._renderTopologyEditor(st.nodes)));
        }
        if (st.completed >= 3 && st.tree) {
            wrap.appendChild(this._renderStepBlock('2c Item placement — move items between regions',
                this._renderItemsEditor(st.tree)));
        }
        if (st.completed >= 4 && st.grow) {
            wrap.appendChild(this._renderStepBlock('3 Build regions — edit / re-roll a region',
                this._renderRegionsEditor(st.grow)));
        }
        if (st.completed >= 5 && st.compile) {
            wrap.appendChild(this._renderStepBlock('4 Compile',
                this._renderCompileFeedback(st.compile)));
        }
        return wrap;
    }

    _renderStepBlock(title, contentEl) {
        const block = document.createElement('div');
        block.style.cssText = 'margin-bottom:10px;';
        const h = document.createElement('div');
        h.className = 'procgen-pipeline-scenario-subheader';
        h.textContent = title;
        block.appendChild(h);
        block.appendChild(contentEl);
        return block;
    }

    // The plan editor: a vertical list grouped by sphere (sphere 0 =
    // starting items), each item with ▲/▼ to move it one sphere. No
    // drag-and-drop. Warn-but-allow: flag empty spheres, Victory not
    // last, and a normally-starting item being gated.
    _renderPlanEditor() {
        const wrap = document.createElement('div');
        const st = this._stepState;
        const { draft } = st;
        const n = draft.spheres.length;
        const lastIdx = n - 1;
        const victoryId = st.cfg.victoryItemId;

        const warnings = [];
        for (let i = 1; i < n; i++) {
            if (draft.spheres[i].length === 0) {
                warnings.push(`Sphere ${i} is empty — growth will reject it.`);
            }
        }
        if (victoryId && !draft.spheres[lastIdx].includes(victoryId)) {
            warnings.push(`Victory (${victoryId}) is not in the last sphere.`);
        }
        for (const it of st.prep.startingItems) {
            const loc = draft.spheres.findIndex((s) => s.includes(it));
            if (loc > 0) {
                warnings.push(`"${it}" is normally a starting item; gating it may fail to grow.`);
            }
        }

        draft.spheres.forEach((items, sphereIdx) => {
            const group = document.createElement('div');
            group.style.cssText = 'margin-bottom:6px;';
            const header = document.createElement('div');
            header.className = 'procgen-pipeline-scenario-subheader';
            header.textContent = sphereIdx === 0
                ? 'Starting items (sphere 0)'
                : `Sphere ${sphereIdx}${sphereIdx === lastIdx ? ' (last)' : ''}`;
            group.appendChild(header);
            if (items.length === 0) {
                const empty = document.createElement('div');
                empty.style.cssText = 'opacity:0.6;font-style:italic;padding:2px 6px;';
                empty.textContent = sphereIdx === 0 ? '(none)' : '(empty)';
                group.appendChild(empty);
            }
            items.forEach((item, itemIdx) => {
                group.appendChild(
                    this._renderPlanItemRow(sphereIdx, itemIdx, item, lastIdx, victoryId));
            });
            wrap.appendChild(group);
        });

        const ctrl = document.createElement('div');
        ctrl.style.cssText = 'margin:6px 0;display:flex;gap:6px;';
        ctrl.appendChild(this._btn('+ sphere', () => {
            st.draft.spheres.push([]);
            this._onSpherePlanEdited();
        }));
        const minusBtn = this._btn('− sphere', () => {
            if (st.draft.spheres.length <= 2) return;
            const removed = st.draft.spheres.pop();
            st.draft.spheres[st.draft.spheres.length - 1].push(...removed);
            this._onSpherePlanEdited();
        });
        minusBtn.disabled = draft.spheres.length <= 2;
        ctrl.appendChild(minusBtn);
        wrap.appendChild(ctrl);

        if (warnings.length) {
            const w = document.createElement('div');
            w.className = 'procgen-pipeline-warning';
            w.textContent = warnings.join(' ');
            wrap.appendChild(w);
        }
        return wrap;
    }

    _renderPlanItemRow(sphereIdx, itemIdx, item, lastIdx, victoryId) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:1px 6px;';
        const name = document.createElement('span');
        name.style.cssText = 'flex:1;';
        name.textContent = item + (item === victoryId ? ' ★' : '');
        row.appendChild(name);
        const up = this._btn('▲', () => this._movePlanItem(sphereIdx, itemIdx, -1));
        up.title = 'Move up one sphere';
        up.disabled = sphereIdx === 0;
        row.appendChild(up);
        const down = this._btn('▼', () => this._movePlanItem(sphereIdx, itemIdx, +1));
        down.title = 'Move down one sphere';
        down.disabled = sphereIdx === lastIdx;
        row.appendChild(down);
        return row;
    }

    _movePlanItem(sphereIdx, itemIdx, dir) {
        const st = this._stepState;
        const target = sphereIdx + dir;
        if (target < 0 || target >= st.draft.spheres.length) return;
        const [item] = st.draft.spheres[sphereIdx].splice(itemIdx, 1);
        st.draft.spheres[target].push(item);
        this._onSpherePlanEdited();
    }

    // 2a Allocate editor — region count + filler count per wave, each with
    // +/− controls (free; warn-but-allow). Editing rebuilds fillerWaves from
    // the aggregate so 2b consumes the edited counts.
    _renderAllocateEditor(allocation) {
        const wrap = document.createElement('div');
        const st = this._stepState;
        const { regionsPerWave = [], fillersPerWave = [], fillerWaves = [] } = allocation;
        const spheres = st.plan?.spheres ?? [];
        const maxPer = st.cfg?.maxItemsPerRegion ?? 1;

        const totalRegions = regionsPerWave.reduce((a, b) => a + b, 0);
        const summary = document.createElement('div');
        summary.textContent = `${totalRegions} hosting region(s) + ${fillerWaves.length} filler(s)`;
        wrap.appendChild(summary);

        const warnings = [];
        regionsPerWave.forEach((rc, w) => {
            const itemCount = spheres[w]?.items.length ?? 0;
            const fc = fillersPerWave[w] ?? 0;
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:1px 6px;';
            const label = document.createElement('span');
            label.style.cssText = 'flex:1;';
            label.textContent = `wave ${w} (${itemCount} item${itemCount === 1 ? '' : 's'}): `
                + `${rc} region(s), ${fc} filler(s)`;
            row.appendChild(label);
            const minusR = this._btn('−rgn', () => this._adjustAllocRegions(w, -1));
            minusR.disabled = rc <= 0;
            row.appendChild(minusR);
            row.appendChild(this._btn('+rgn', () => this._adjustAllocRegions(w, +1)));
            const minusF = this._btn('−fill', () => this._adjustAllocFillers(w, -1));
            minusF.disabled = fc <= 0;
            row.appendChild(minusF);
            row.appendChild(this._btn('+fill', () => this._adjustAllocFillers(w, +1)));
            wrap.appendChild(row);

            if (itemCount > 0 && rc === 0) {
                warnings.push(`Wave ${w} has ${itemCount} item(s) but 0 regions — can't host them.`);
            } else if (rc * maxPer < itemCount) {
                warnings.push(`Wave ${w}: ${itemCount} items but only ${rc}×${maxPer} `
                    + 'region capacity — regions will overflow.');
            }
        });
        if (fillerWaves.length > totalRegions) {
            warnings.push(`${fillerWaves.length} fillers for ${totalRegions} hosting `
                + 'region(s) — unusually many.');
        }

        if (warnings.length) {
            const w = document.createElement('div');
            w.className = 'procgen-pipeline-warning';
            w.textContent = warnings.join(' ');
            wrap.appendChild(w);
        }
        return wrap;
    }

    _adjustAllocRegions(wave, dir) {
        const a = this._stepState?.allocation;
        if (!a) return;
        a.regionsPerWave[wave] = Math.max(0, (a.regionsPerWave[wave] ?? 0) + dir);
        this._invalidateFrom(1);
    }

    _adjustAllocFillers(wave, dir) {
        const a = this._stepState?.allocation;
        if (!a) return;
        a.fillersPerWave[wave] = Math.max(0, (a.fillersPerWave[wave] ?? 0) + dir);
        // Rebuild fillerWaves (draw order) from the edited aggregate, in wave
        // order — 2b consumes fillerWaves, so the edited counts take effect.
        a.fillerWaves = [];
        a.fillersPerWave.forEach((c, w) => {
            for (let i = 0; i < c; i++) a.fillerWaves.push(w);
        });
        this._invalidateFrom(1);
    }

    // 2b Topology editor — per region: substrate / parent / gate dropdowns
    // (free; warn-but-allow). Reparent targets are earlier-index nodes only
    // (preserving realisation order so 3 doesn't crash); cross-wave parents,
    // off-vocabulary gates, etc. are allowed but flagged. Edits recompute the
    // derived bookkeeping via rebuildSphereTopology and surface its warnings.
    _renderTopologyEditor(nodes) {
        const wrap = document.createElement('div');
        const st = this._stepState;
        const subOpts = Object.keys(this._activeSubstrateDict());
        const planItems = [...new Set((st.plan?.spheres ?? []).flatMap((s) => s.items))];
        const sphereTag = this._itemSphereTag();

        const subs = {};
        for (const nd of nodes) subs[nd.substrate] = (subs[nd.substrate] ?? 0) + 1;
        const fillers = nodes.filter((nd) => nd.isFiller).length;
        const summary = document.createElement('div');
        summary.textContent = `${nodes.length} regions (${fillers} filler) · `
            + Object.entries(subs).map(([s, c]) => `${s}×${c}`).join(', ');
        wrap.appendChild(summary);

        // View toggle: tree (indented directory tree) vs flat (index order).
        wrap.appendChild(this._renderTopologyViewToggle());

        // Build the parent→children map. parent < index always holds, so the
        // graph is a single tree rooted at the parent==null node. Each node
        // carries its inline controls either way.
        const children = nodes.map(() => []);
        let root = null;
        nodes.forEach((nd) => {
            if (nd.parent == null) { if (root == null) root = nd.index; }
            else if (nodes[nd.parent]) children[nd.parent].push(nd.index);
        });
        if (this._topologyView === 'tree' && root != null) {
            const ctx = { nodes, children, subOpts, planItems, sphereTag, container: wrap };
            this._renderTopoTreeNode(root, '', true, true, ctx);
        } else {
            // Flat: numerical index order (also the no-root fallback).
            nodes.forEach((nd) => wrap.appendChild(
                this._renderTopologyRow(nd, nodes, subOpts, planItems, sphereTag, '')));
        }

        const warns = st.topologyWarnings ?? [];
        if (warns.length) {
            const w = document.createElement('div');
            w.className = 'procgen-pipeline-warning';
            w.textContent = warns.join(' ');
            wrap.appendChild(w);
        }
        return wrap;
    }

    // Tree / flat view radio toggle for the 2b topology editor.
    _renderTopologyViewToggle() {
        const row = document.createElement('div');
        row.style.cssText = 'margin:2px 6px 4px;font-size:11px;';
        for (const opt of [
            { value: 'tree', text: 'Tree view' },
            { value: 'flat', text: 'Flat (index order)' },
        ]) {
            const wrap = document.createElement('label');
            wrap.style.marginRight = '10px';
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'procgen-pipeline-topology-view';
            radio.value = opt.value;
            radio.checked = this._topologyView === opt.value;
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    this._topologyView = opt.value;
                    this.render();
                }
            });
            wrap.appendChild(radio);
            wrap.appendChild(document.createTextNode(` ${opt.text}`));
            row.appendChild(wrap);
        }
        return row;
    }

    // Recurse the topology tree, drawing directory-style branch glyphs. Each
    // node renders as one control row prefixed by its tree connector; updates
    // live because the whole editor re-renders on every edit.
    _renderTopoTreeNode(idx, ancestorPrefix, isLast, isRoot, ctx) {
        const { nodes, children, subOpts, planItems, sphereTag, container } = ctx;
        const connector = isRoot ? '' : (isLast ? '└─ ' : '├─ ');
        container.appendChild(
            this._renderTopologyRow(nodes[idx], nodes, subOpts, planItems, sphereTag,
                ancestorPrefix + connector));
        const childPrefix = ancestorPrefix + (isRoot ? '' : (isLast ? '   ' : '│  '));
        const kids = children[idx];
        kids.forEach((childIdx, i) => {
            this._renderTopoTreeNode(childIdx, childPrefix, i === kids.length - 1, false, ctx);
        });
    }

    _renderTopologyRow(node, nodes, subOpts, planItems, sphereTag = () => '', treePrefix = '') {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:4px;padding:1px 6px;'
            + 'font-size:11px;flex-wrap:nowrap;';
        const label = document.createElement('span');
        // Monospace + pre so the tree glyphs and indentation align.
        label.style.cssText = 'font-family:monospace;white-space:pre;';
        label.textContent = `${treePrefix}#${node.index} w${node.wave}${node.isFiller ? 'f' : ''}`
            + `${node.parent == null ? '' : `/${node.side ?? '?'}`}`;
        row.appendChild(label);

        // Substrate dropdown.
        const subSel = document.createElement('select');
        subSel.title = 'Substrate for this region';
        for (const id of subOpts) {
            const opt = document.createElement('option');
            opt.value = id; opt.textContent = id;
            if (id === node.substrate) opt.selected = true;
            subSel.appendChild(opt);
        }
        // A substrate not in the active dict (shouldn't happen) still shows.
        if (!subOpts.includes(node.substrate)) {
            const opt = document.createElement('option');
            opt.value = node.substrate; opt.textContent = node.substrate; opt.selected = true;
            subSel.appendChild(opt);
        }
        subSel.addEventListener('change', () => {
            node.substrate = subSel.value;
            this._applyTopologyEdit();
        });
        row.appendChild(subSel);

        // Parent dropdown (root is fixed; others pick an earlier-index node).
        if (node.parent == null) {
            const rootTag = document.createElement('span');
            rootTag.textContent = 'root';
            rootTag.style.cssText = 'opacity:0.7;';
            row.appendChild(rootTag);
        } else {
            const parSel = document.createElement('select');
            parSel.title = 'Parent region (earlier regions only)';
            for (let i = 0; i < node.index; i++) {
                const opt = document.createElement('option');
                opt.value = String(i);
                opt.textContent = `↰ #${i} w${nodes[i].wave}`;
                if (i === node.parent) opt.selected = true;
                parSel.appendChild(opt);
            }
            parSel.addEventListener('change', () => {
                node.parent = Number(parSel.value);
                this._applyTopologyEdit();
            });
            row.appendChild(parSel);
        }

        // Gate dropdown (— = ungated; or any plan item — warn if off-wave).
        const gateSel = document.createElement('select');
        gateSel.title = 'Entry gate item';
        const cur = (node.gate ?? [])[0] ?? '';
        const noneOpt = document.createElement('option');
        noneOpt.value = ''; noneOpt.textContent = 'gate —';
        if (!cur) noneOpt.selected = true;
        gateSel.appendChild(noneOpt);
        const items = cur && !planItems.includes(cur) ? [...planItems, cur] : planItems;
        for (const it of items) {
            const opt = document.createElement('option');
            opt.value = it; opt.textContent = `gate ${it}${sphereTag(it)}`;
            if (it === cur) opt.selected = true;
            gateSel.appendChild(opt);
        }
        gateSel.addEventListener('change', () => {
            node.gate = gateSel.value ? [gateSel.value] : [];
            this._applyTopologyEdit();
        });
        row.appendChild(gateSel);
        return row;
    }

    // Apply a 2b structural edit: recompute the tree's derived bookkeeping
    // (sides / childGates / gateCounts) deterministically, stash the advisory
    // warnings, and invalidate 2c..4 (the edited nodes re-flow through them).
    _applyTopologyEdit() {
        const st = this._stepState;
        const { warnings } = rebuildSphereTopology(st.plan, st.nodes, {
            regionParams: st.growConfig?.regionParams ?? {},
        });
        st.topologyWarnings = warnings;
        this._invalidateFrom(2);
    }

    // item → " (S2)" / " (S2,S3)" sphere label from the current plan, for the
    // 2b gate dropdown and 2c item rows. An item can span spheres (count gates).
    _itemSphereTag() {
        const itemSpheres = new Map();
        (this._stepState?.plan?.spheres ?? []).forEach((s) => {
            for (const it of s.items) {
                if (!itemSpheres.has(it)) itemSpheres.set(it, new Set());
                itemSpheres.get(it).add(s.sphere);
            }
        });
        return (item) => {
            const set = itemSpheres.get(item);
            return set ? ` (${[...set].sort((a, b) => a - b).map((n) => `S${n}`).join(',')})` : '';
        };
    }

    // 2c Item placement editor — which items live in which region, with a
    // per-item dropdown to move it to another region (free; warn-but-allow).
    _renderItemsEditor(tree) {
        const wrap = document.createElement('div');
        const st = this._stepState;
        const nodes = tree.nodes ?? [];
        const maxPer = st.cfg?.maxItemsPerRegion ?? Infinity;
        // Home wave per item name (from the plan) for cross-wave warnings: a
        // wave-w node hosts plan.spheres[w] items. Duplicate names (count
        // gates) map to their first sphere — advisory only.
        const homeWave = new Map();
        (st.plan?.spheres ?? []).forEach((s, w) => {
            for (const it of s.items) if (!homeWave.has(it)) homeWave.set(it, w);
        });
        const sphereTag = this._itemSphereTag();

        const placed = nodes.reduce((a, nd) => a + (nd.items?.length ?? 0), 0);
        const summary = document.createElement('div');
        summary.textContent = `${placed} item(s) placed across ${nodes.length} region(s)`;
        wrap.appendChild(summary);

        const warnings = [];
        nodes.forEach((nd) => {
            if ((nd.items?.length ?? 0) === 0) return; // only regions holding items
            if (nd.items.length > maxPer) {
                warnings.push(`#${nd.index} holds ${nd.items.length} > ${maxPer} `
                    + 'items/region (geometry may fail to realise).');
            }
            const group = document.createElement('div');
            group.style.cssText = 'margin-bottom:4px;';
            const header = document.createElement('div');
            header.className = 'procgen-pipeline-scenario-subheader';
            header.textContent = `#${nd.index} w${nd.wave} ${nd.substrate}`
                + `${nd.isFiller ? ' (filler)' : ''} — ${nd.items.length} item(s)`;
            group.appendChild(header);
            nd.items.forEach((it, itemIdx) => {
                const wrongWave = homeWave.has(it.item) && homeWave.get(it.item) !== nd.wave;
                if (wrongWave) {
                    warnings.push(`"${it.item}" sits in wave ${nd.wave} but belongs to `
                        + `wave ${homeWave.get(it.item)} — the oracle will mismatch.`);
                }
                group.appendChild(
                    this._renderItemMoveRow(nd, itemIdx, nodes, wrongWave, sphereTag));
            });
            wrap.appendChild(group);
        });

        if (warnings.length) {
            const w = document.createElement('div');
            w.className = 'procgen-pipeline-warning';
            w.textContent = warnings.join(' ');
            wrap.appendChild(w);
        }
        return wrap;
    }

    _renderItemMoveRow(node, itemIdx, nodes, wrongWave, sphereTag = () => '') {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:1px 6px;';
        const it = node.items[itemIdx];
        const name = document.createElement('span');
        name.style.cssText = 'flex:1;' + (wrongWave ? 'color:#d8a000;' : '');
        name.textContent = it.item + sphereTag(it.item) + (wrongWave ? ' ⚠' : '');
        row.appendChild(name);
        const sel = document.createElement('select');
        sel.title = 'Move this item to another region';
        nodes.forEach((target) => {
            const opt = document.createElement('option');
            opt.value = String(target.index);
            opt.textContent = `→ #${target.index} w${target.wave}`;
            if (target.index === node.index) opt.selected = true;
            sel.appendChild(opt);
        });
        sel.addEventListener('change', () => {
            this._moveTreeItem(node.index, itemIdx, Number(sel.value));
        });
        row.appendChild(sel);
        return row;
    }

    // Move a placed item from one region to another, then re-id every
    // region's items by position (loc_N) so ids stay canonical (matching
    // placeSphereTreeItems). Invalidates 3/4 (the edited tree feeds 3).
    _moveTreeItem(fromNodeIdx, itemIdx, toNodeIdx) {
        const st = this._stepState;
        if (fromNodeIdx === toNodeIdx) { this.render(); return; }
        const nodes = st.tree?.nodes ?? st.nodes ?? [];
        const from = nodes[fromNodeIdx];
        const to = nodes[toNodeIdx];
        if (!from || !to) return;
        const [it] = from.items.splice(itemIdx, 1);
        if (!it) return;
        to.items.push({ id: it.id, item: it.item });
        for (const nd of nodes) nd.items.forEach((x, i) => { x.id = `loc_${i}`; });
        this._invalidateFrom(3);
    }

    _renderRegionsFeedback(stats, seconds) {
        const wrap = document.createElement('div');
        const parts = [`regions built ${stats.regionsBuilt}`];
        if (stats.teleportersPlaced != null) parts.push(`teleporters ${stats.teleportersPlaced}`);
        if (stats.quotaFallbacks) parts.push(`quota fallbacks ${stats.quotaFallbacks}`);
        if (stats.stopReason) parts.push(`stop: ${stats.stopReason}`);
        if (seconds) parts.push(`${seconds.toFixed(1)}s`);
        wrap.textContent = `${parts.join(' · ')} (full grid below)`;
        return wrap;
    }

    // 3 Build regions editor — launcher: the stats line, then one row per
    // realised region (`#i wN`) with a substrate dropdown (manual per-region
    // override, any sphere-capable substrate — re-runs 3), [Edit ▸] (opens the
    // substrate-appropriate per-region editor) and [Re-roll 🎲] (regenerates
    // that one region's interior on a bumped seed, keeping its exits/
    // locations/rules fixed). Edit/Re-roll write back into st.grow.grid and
    // invalidate 4 only (geometry changes don't touch the logical tree); the
    // substrate override invalidates 3 (a full re-realise). The composite grid
    // (rendered below after 4) is also click-to-select; see _renderGrid.
    _renderRegionsEditor(grow) {
        const wrap = document.createElement('div');
        wrap.appendChild(this._renderRegionsFeedback(grow.stats, this._stepState?.seconds));

        const nodes = this._stepState?.tree?.nodes ?? [];
        const grid = grow.grid;
        nodes.forEach((nd) => {
            const region = grid?.getRegion?.(nd.cell);
            if (!region) return;
            wrap.appendChild(this._renderRegionEditRow(nd, region));
        });
        if (nodes.length === 0) {
            const hint = document.createElement('div');
            hint.className = 'procgen-pipeline-hint';
            hint.textContent = '(no tree nodes — re-run from 2 to populate the region list)';
            wrap.appendChild(hint);
        }
        return wrap;
    }

    _renderRegionEditRow(node, region) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:1px 6px;';
        const label = document.createElement('span');
        label.style.cssText = 'flex:1;';
        const itemCount = node.items?.length ?? 0;
        label.textContent = `#${node.index} w${node.wave}`
            + `${node.isFiller ? ' (filler)' : ''}`
            + `${itemCount ? ` — ${itemCount} item(s)` : ''}`;
        row.appendChild(label);

        // Per-region substrate override. Unlike the 2b topology dropdown (scoped
        // to the quota mix), this offers ANY sphere-capable substrate so a single
        // region can use one that isn't in the quotas. Changing it re-runs 3.
        const subSel = document.createElement('select');
        subSel.className = 'procgen-pipeline-region-substrate';
        subSel.dataset.index = String(node.index);
        subSel.title = 'Substrate for this region (manual override — not limited by the quota mix)';
        const subOpts = this._sphereCapableSubstrates();
        const list = subOpts.includes(node.substrate) ? subOpts : [...subOpts, node.substrate];
        for (const id of list) {
            const opt = document.createElement('option');
            opt.value = id; opt.textContent = id;
            if (id === node.substrate) opt.selected = true;
            subSel.appendChild(opt);
        }
        subSel.addEventListener('change', () => this._changeRegionSubstrate(node, subSel.value));
        row.appendChild(subSel);

        const edit = this._btn('Edit ▸', () => this._editRegion(region, node));
        edit.title = 'Open the per-region geometry editor';
        row.appendChild(edit);

        const reroll = this._btn('Re-roll 🎲', () => this._reRollRegion(region, node));
        reroll.title = "Regenerate this region's interior on a new seed (keeps exits/locations)";
        row.appendChild(reroll);

        // F5 — capture this region into the working library (substrates with a
        // captureLibraryEntry hook only; the working library exports from the
        // Region libraries section).
        if (typeof substrateRegistry.get(region?.substrate)?.captureLibraryEntry === 'function') {
            const save = this._btn('Save to library ▸', () => this._captureRegionToLibrary(region));
            save.title = 'Serialize this region into the working library (Region libraries section)';
            row.appendChild(save);
        }
        return row;
    }

    // Registered substrates sphere growth can realise: procedural
    // (generateRegionCore) or spec-targeted zone (generateZoneForSpecs[Gen]). NOT
    // limited to the quota mix, so a per-region override can pick any usable
    // substrate. Excludes zone-count-only (jta) and opaque (flash) substrates,
    // which the grow loop rejects.
    _sphereCapableSubstrates() {
        return substrateRegistry.getAll()
            .filter((s) => typeof s.generateRegionCore === 'function'
                || typeof s.generateZoneForSpecs === 'function'
                || typeof s.generateZoneForSpecsGen === 'function')
            .map((s) => s.id);
    }

    // 3 per-region substrate override. The substrate lives on the tree node
    // (st.tree.nodes === st.nodes) and doesn't affect topology/items, so re-run
    // 3 Build (+ 4) only — keeping the tree + rng snapshot (_invalidateFrom(3)).
    // A FULL 3 re-run (not an in-place swap) is what a substrate change needs: it
    // re-realises every region and re-runs the whole-grid stitch/wall pass once at
    // the end, so a to/from-maze change — whose exit tile positions feed adjacency
    // stitching — stays consistent (the reason maze isn't safe to re-roll alone).
    _changeRegionSubstrate(node, value) {
        if (!node || value === node.substrate) return;
        node.substrate = value;
        // _invalidateFrom clears this.message, so set it AFTER and re-render.
        this._invalidateFrom(3);
        this.message = `Region #${node.index} substrate → ${value}. `
            + 'Re-run 3 Build regions to apply.';
        this.render();
    }

    // Look up the tree node backing a grid region (by region_id), so a launch
    // from the composite grid (which only has the region) can recover the node
    // needed to rebuild the editor contract / re-roll specs.
    _nodeForRegion(region) {
        const nodes = this._stepState?.tree?.nodes ?? [];
        return nodes.find((nd) => nd.region_id === region?.region_id) ?? null;
    }

    // Edit ▸ — route by region.substrate via the regionEditors registry, with a
    // graceful fallback when no editor exists for that substrate yet.
    _editRegion(region, node = null) {
        const open = getRegionEditor(region?.substrate);
        if (!open) {
            this.message = `No region editor for "${region?.substrate}" yet.`;
            this.warning = '';
            this.render();
            return;
        }
        const nd = node ?? this._nodeForRegion(region);
        const contract = this._buildRegionContract(region, nd);
        open({
            region,
            contract,
            onSave: (editedRegion) => this._onRegionEdited(region, editedRegion, nd),
        });
    }

    // Reconstruct the realiser contract for a region from its node + the tree:
    // the exit/location specs the realiser used, so the editor can re-emit rules
    // from a hand-edited level and stay consistent with the logical tree.
    // Substrates with a region editor get the full contract via the engine's
    // generic buildRegionContract dispatcher (which calls the substrate's
    // buildRegionContract hook); other substrates fall back to the payload-only
    // shape.
    _buildRegionContract(region, node) {
        const payload = region?.playable_payload ?? {};
        const params = payload.params ?? {};
        const base = {
            sidePortals: params.sidePortals ?? {},
            physicsProfile: params.physics?.profile ?? 'experimental',
            node: node ?? null,
        };
        const st = this._stepState;
        // Items the player is expected to hold when this region first becomes
        // accessible: everything placed in EARLIER spheres (strict `w < node.wave`
        // — items at this region's own wave are gated behind reaching it, so
        // they're not yet held). Computed independently of the substrate contract
        // below so it survives even if buildRegionContract throws. See §5 of
        // NewDocs/plans/procedural-generation/sphere-growth-apworld-integration.md.
        if (node && st?.plan) {
            base.expectedItems = (st.plan.spheres ?? [])
                .slice(0, node.wave ?? 0)
                .flatMap((s) => s.items ?? []);
        }
        if (getRegionEditor(region?.substrate) && node && st?.tree && st?.grow?.grid) {
            try {
                Object.assign(base, buildRegionContract(
                    region.substrate, node, st.tree, st.grow.grid,
                    st.growConfig.regionSize, st.growConfig.regionParams ?? {},
                ));
                // The raw bounce params seed the editor's generation-settings
                // section; the world item pool feeds its per-pickup item picker.
                base.regionParams = st.growConfig.regionParams ?? {};
                base.itemPool = Object.keys(this.scenario?.items ?? {});
            } catch (err) {
                base.contractError = err.message;
            }
        }
        return base;
    }

    // Re-roll 🎲 — regenerate ONE region's interior on a bumped seed, keeping
    // its entrances/exits/locations/rules fixed (so neighbours + the oracle
    // don't desync). Bounce (zone) only; the engine helper rejects maze with a
    // clear message. Invalidates 4 (the user re-runs Compile; the oracle is the
    // backstop).
    _reRollRegion(region, node = null) {
        const st = this._stepState;
        const grid = st?.grow?.grid;
        const tree = st?.tree;
        const nd = node ?? this._nodeForRegion(region);
        if (!grid || !tree || !nd) {
            this.message = 'Re-roll unavailable — re-run from 3 first.';
            this.warning = '';
            this.render();
            return;
        }
        const count = (this._rerollCounts ??= new Map());
        const n = (count.get(nd.region_id) ?? 0) + 1;
        count.set(nd.region_id, n);
        const seed = ((st.cfg.seed * 7919) ^ this._hashStr(nd.region_id)) + n * 104729 | 0;
        try {
            reRollSphereRegion(grid, nd, tree, {
                seed,
                regionSize: st.growConfig.regionSize,
                regionParams: st.growConfig.regionParams,
                assumeBidirectional: st.growConfig.growthParams?.assumeBidirectional ?? true,
            });
            // _invalidateFrom clears this.message, so set it AFTER and re-render.
            this._invalidateFrom(4);
            this.message = `Re-rolled "${nd.region_id}" (seed ${seed}). `
                + 'Re-run 4 Compile to recheck the oracle.';
            this.render();
        } catch (err) {
            this.message = `Re-roll failed: ${err.message}`;
            this.warning = '';
            this.render();
        }
    }

    _hashStr(s) {
        let h = 0;
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
        return h;
    }

    // Write-back from an editor save (pipeline mode): splice the edited region
    // into the live grid and invalidate 4 only (the user re-runs Compile; the
    // oracle is the backstop). Leaves the logical tree untouched.
    _onRegionEdited(origRegion, editedRegion, node) {
        const st = this._stepState;
        const grid = st?.grow?.grid;
        if (!grid || !editedRegion) return;
        const cell = node?.cell ?? this._nodeForRegion(origRegion)?.cell;
        if (!cell) return;
        grid.replaceRegion(cell, editedRegion);
        // _invalidateFrom clears this.message, so set it AFTER and re-render.
        this._invalidateFrom(4);
        this.message = `Saved edits to "${editedRegion.region_id ?? origRegion.region_id}". `
            + 'Re-run 4 Compile to recheck the oracle.';
        this.render();
    }

    // Hit-test a click on the composite grid canvas → the region at that cell
    // (or null outside the grid). Maps client px → canvas px (CSS may scale the
    // canvas), then to grid cell using the same TILE_PX × regionSize layout
    // _drawGrid paints with.
    _gridRegionAt(canvas, grid, regionSize, evt) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        const cx = (evt.clientX - rect.left) * (canvas.width / rect.width);
        const cy = (evt.clientY - rect.top) * (canvas.height / rect.height);
        const gx = Math.floor(cx / (regionSize.width * TILE_PX));
        const gy = Math.floor(cy / (regionSize.height * TILE_PX));
        if (gx < 0 || gy < 0 || gx >= grid.width || gy >= grid.height) return null;
        return grid.getRegion({ gx, gy });
    }

    _renderCompileFeedback(compile) {
        const wrap = document.createElement('div');
        const { rulesJson, oracleErrors } = compile;
        const ok = oracleErrors.length === 0;
        const oracle = document.createElement('div');
        oracle.textContent = ok
            ? '✓ oracle: plan realised exactly'
            : `✗ oracle mismatch: ${oracleErrors[0]}`;
        oracle.style.cssText = ok ? 'color:#3aa85a;' : 'color:#d04040;';
        wrap.appendChild(oracle);
        const regionCount = Object.keys(rulesJson.regions ?? {}).length;
        const hasLog = Array.isArray(rulesJson.sphere_log) && rulesJson.sphere_log.length > 0;
        const counts = document.createElement('div');
        counts.textContent = `${regionCount} regions · sphere_log ${hasLog ? 'embedded' : 'absent'}`
            + ' · full rules.json in Compiled output below';
        wrap.appendChild(counts);
        return wrap;
    }

    _renderStats() {
        const section = document.createElement('div');
        section.className = 'procgen-pipeline-stats';
        if (!this.result) return section;
        const { stats, poolRemaining, fromLoadedPreset } = this.result;
        const parts = [];
        if (fromLoadedPreset) {
            parts.push(`loaded preset · regions ${stats.regionsBuilt}`);
        } else {
            parts.push(`regions ${stats.regionsBuilt}`);
            parts.push(`skipped ${stats.regionsSkipped}`);
        }
        if (stats.stopReason) parts.push(`stop: ${stats.stopReason}`);
        if (poolRemaining) {
            parts.push(
                `pool rem: items=${this._sumCounts(poolRemaining.items)} obs=${this._sumCounts(poolRemaining.obstacles)}`,
            );
        }
        if (stats.teleportersPlaced) {
            parts.push(`teleporters ${stats.teleportersPlaced}`);
        }
        section.textContent = parts.join(' · ');
        return section;
    }

    _sumCounts(d) {
        return Object.values(d).reduce((a, b) => a + b, 0);
    }

    // --- Grid canvas ---

    _renderGrid() {
        const section = document.createElement('div');
        section.className = 'procgen-pipeline-canvas-wrap';
        // Prefer the live stepped grid (st.grow.grid) in sphere mode: it exists
        // from 3 onward and SURVIVES the _invalidateFrom(4) that layout edits
        // trigger, so the map stays put while editing. Fall back to this.result
        // (other modes / loaded presets / post-4 compiled view).
        const st = this._stepState;
        const td = this._tdState;
        let grid; let regionSize;
        if (this.mode === 'sphereGrowth' && st?.grow?.grid) {
            grid = st.grow.grid;
            regionSize = st.growConfig?.regionSize ?? this.result?.regionSize;
        } else if (this.mode === 'topDown' && td?.layout?.grid) {
            // Live stepped grid: visible from 1 Layout onward (stubs fill in as 2
            // realises), before 4 Compile sets this.result.
            grid = td.layout.grid;
            regionSize = td.regionSize ?? this.result?.regionSize;
        } else if (this.mode === 'shuffledSpiral' && this._spiralState?.regions?.grid) {
            // Live stepped grid: visible from 3 Regions onward, before 4 Compile
            // sets this.result. The pool/regionSize aren't on the envelope, so
            // fall back to the current params for the cell size. Display-only:
            // spiral regions are structural (not hand-edited), so no interactive
            // Move/Edit this pass (matches the old one-shot spiral map).
            grid = this._spiralState.regions.grid;
            regionSize = this.result?.regionSize
                ?? { width: this.params.regionWidth, height: this.params.regionHeight };
        } else if (this.result) {
            ({ grid, regionSize } = this.result);
        }
        if (!grid || !regionSize) {
            const hint = document.createElement('div');
            hint.className = 'procgen-pipeline-hint';
            hint.textContent = 'Click Generate to run the pipeline.';
            section.appendChild(hint);
            return section;
        }
        // Interactive map editing: sphere mode (full editor) and top-down once
        // the grid is FINALIZED (completed≥2). Editing the finalized grid lets a
        // Move re-stitch via relayoutSphereGrid and re-run 4 only — the grid is
        // already self-consistent, and 4 Compile reads only the grid (never the
        // now-stale cellsByName), so no 3 re-run is needed. Top-down offers only
        // the layout modes (Move Region / Move Exits); per-region Edit is phase 6.
        const interactive = (this.mode === 'sphereGrowth' && this._stepState?.tree)
            || (this.mode === 'topDown' && (this._tdState?.completed ?? -1) >= 2);
        // Both modes now offer the full editor set (top-down Edit Region routes to
        // _editRegionTD; Move Region / Move Exits to _applyGridEditTD).
        const modes = [['edit', 'Edit Region'], ['moveRegion', 'Move Region'], ['moveExit', 'Move Exits']];
        if (interactive && !modes.some(([v]) => v === this._mapMode)) {
            this._mapMode = modes[0][0];
        }
        if (interactive) section.appendChild(this._renderMapModeRadio(modes));

        const canvas = document.createElement('canvas');
        canvas.className = 'procgen-pipeline-canvas';
        canvas.width = grid.width * regionSize.width * TILE_PX;
        canvas.height = grid.height * regionSize.height * TILE_PX;
        // Grid geometry as data-attrs so the in-app verify can map a cell index
        // to a canvas click without re-deriving TILE_PX.
        canvas.dataset.gridW = String(grid.width);
        canvas.dataset.gridH = String(grid.height);
        canvas.dataset.cellW = String(regionSize.width * TILE_PX);
        canvas.dataset.cellH = String(regionSize.height * TILE_PX);
        this._drawGrid(canvas, grid, regionSize);
        if (interactive) {
            canvas.style.cursor = 'pointer';
            canvas.title = {
                edit: 'Click a region to edit it',
                moveRegion: 'Click a region, then a cell to move it there (or another region to swap)',
                moveExit: 'Click an exit/entrance square, then a side to move it there (or another to swap)',
            }[this._mapMode];
            canvas.addEventListener('click', (e) => this._onMapClick(canvas, grid, regionSize, e));
        }
        section.appendChild(canvas);
        return section;
    }

    // Radio above the composite map selecting what a click does. `modes` is a
    // list of [value, label] pairs (sphere offers Edit/Move Region/Move Exits;
    // top-down offers only the two Move modes — per-region Edit is phase 6).
    _renderMapModeRadio(modes = [
        ['edit', 'Edit Region'],
        ['moveRegion', 'Move Region'],
        ['moveExit', 'Move Exits'],
    ]) {
        const row = document.createElement('div');
        row.className = 'procgen-pipeline-map-modes';
        row.style.cssText = 'display:flex;gap:12px;margin:4px 0;font-size:12px;';
        for (const [value, label] of modes) {
            const lab = document.createElement('label');
            lab.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer;';
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'procgen-pipeline-map-mode';
            radio.value = value;
            radio.checked = this._mapMode === value;
            radio.addEventListener('change', () => {
                this._mapMode = value;
                this._mapSel = null; // a mode switch cancels any pending selection
                this.message = '';
                this.render();
            });
            lab.appendChild(radio);
            lab.appendChild(document.createTextNode(label));
            row.appendChild(lab);
        }
        return row;
    }

    // Grid cell {gx,gy} under a canvas click (or null outside the grid).
    _cellCoordsAt(canvas, grid, regionSize, evt) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        const cx = (evt.clientX - rect.left) * (canvas.width / rect.width);
        const cy = (evt.clientY - rect.top) * (canvas.height / rect.height);
        const gx = Math.floor(cx / (regionSize.width * TILE_PX));
        const gy = Math.floor(cy / (regionSize.height * TILE_PX));
        if (gx < 0 || gy < 0 || gx >= grid.width || gy >= grid.height) return null;
        return { gx, gy };
    }

    _onMapClick(canvas, grid, regionSize, evt) {
        if (this._mapMode === 'edit') {
            const region = this._gridRegionAt(canvas, grid, regionSize, evt);
            if (region) {
                if (this.mode === 'topDown') this._editRegionTD(region);
                else this._editRegion(region);
            }
            return;
        }
        const cell = this._cellCoordsAt(canvas, grid, regionSize, evt);
        if (!cell) return;
        if (this._mapMode === 'moveRegion') this._mapClickMoveRegion(grid, cell);
        else if (this._mapMode === 'moveExit') this._mapClickMoveExit(canvas, grid, regionSize, evt, cell);
    }

    // Move Region: first click selects a region; second click moves it to an
    // empty cell, or swaps it with the region already there.
    _mapClickMoveRegion(grid, cell) {
        const here = grid.getRegion(cell);
        if (!this._mapSel) {
            if (!here) { this.message = 'Move Region: click a region first.'; this.render(); return; }
            this._mapSel = { cell };
            this.message = `Move Region: selected ${here.region_id} — click a destination `
                + 'cell (or another region to swap).';
            this.render();
            return;
        }
        const from = this._mapSel.cell;
        this._mapSel = null;
        if (from.gx === cell.gx && from.gy === cell.gy) {
            this.message = 'Move Region: cancelled.';
            this.render();
            return;
        }
        this._applyGridEdit(
            (g) => (here ? swapSphereRegions(g, from, cell) : moveSphereRegion(g, from, cell)),
            here ? 'Swapped the two regions.' : 'Moved the region.',
        );
    }

    // Canvas-backing pixel under a click (null if the canvas isn't laid out).
    _canvasPx(canvas, evt) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        return {
            cx: (evt.clientX - rect.left) * (canvas.width / rect.width),
            cy: (evt.clientY - rect.top) * (canvas.height / rect.height),
        };
    }

    // The exit whose green square contains the within-cell pixel (wx, wy), or null.
    _exitAtPx(region, regionSize, wx, wy) {
        const placed = resolveExitTilePositions(getRegionExits(region) ?? [], regionSize);
        const tx = Math.floor(wx / TILE_PX);
        const ty = Math.floor(wy / TILE_PX);
        for (const p of placed) {
            if (p?.exit && p.x === tx && p.y === ty) return p.exit;
        }
        return null;
    }

    // Nearest region side (N/S/E/W) to a within-cell pixel.
    _nearestSide(wx, wy, regionSize) {
        const cellW = regionSize.width * TILE_PX;
        const cellH = regionSize.height * TILE_PX;
        const d = { W: wx, E: cellW - wx, N: wy, S: cellH - wy };
        return Object.keys(d).reduce((a, b) => (d[b] < d[a] ? b : a));
    }

    // Move Exits: first click selects an exit/entrance green square; second
    // click (a side of the same region) moves it to that side, or swaps it with
    // the exit already there. Zone (bounce) regions only.
    _mapClickMoveExit(canvas, grid, regionSize, evt, cell) {
        const px = this._canvasPx(canvas, evt);
        if (!px) return;
        const cellW = regionSize.width * TILE_PX;
        const cellH = regionSize.height * TILE_PX;
        const wx = px.cx - cell.gx * cellW;
        const wy = px.cy - cell.gy * cellH;

        if (!this._mapSel || this._mapSel.kind !== 'exit') {
            const region = grid.getRegion(cell);
            if (!region) return;
            if (!region.playable_payload?.params?.sidePortals) {
                this.message = 'Move Exits: bounce/zone regions only (this region has no side portals).';
                this.render();
                return;
            }
            const exit = this._exitAtPx(region, regionSize, wx, wy);
            if (!exit) {
                this.message = 'Move Exits: click an exit/entrance square first.';
                this.render();
                return;
            }
            this._mapSel = { kind: 'exit', cell, exitId: exit.exit_id, side: exit.side };
            this.message = `Move Exits: selected ${exit.exit_id} (side ${exit.side}) — `
                + 'click a side of this region (or another exit to swap).';
            this.render();
            return;
        }

        const sel = this._mapSel;
        this._mapSel = null;
        if (cell.gx !== sel.cell.gx || cell.gy !== sel.cell.gy) {
            this.message = 'Move Exits: second click must be on the same region — cancelled.';
            this.render();
            return;
        }
        const newSide = this._nearestSide(wx, wy, regionSize);
        if (newSide === sel.side) {
            this.message = 'Move Exits: same side — cancelled.';
            this.render();
            return;
        }
        const region = grid.getRegion(cell);
        const exits = getRegionExits(region);
        const list = exits instanceof Map ? [...exits.values()] : (exits ?? []);
        const occupant = list.find((e) => e.exit_id !== sel.exitId && e.side === newSide);
        this._applyGridEdit(
            (g) => (occupant
                ? swapSphereExitSides(g, cell, sel.exitId, occupant.exit_id, regionSize)
                : moveSphereExitSide(g, cell, sel.exitId, newSide, regionSize)),
            occupant
                ? `Swapped exits ${sel.exitId} ↔ ${occupant.exit_id}.`
                : `Moved exit ${sel.exitId} to side ${newSide}.`,
        );
    }

    // Run a grid-layout edit, then keep st.grow.startCell pointing at the start
    // region (a move/swap may relocate it — the oracle reads from startCell),
    // invalidate 4, and re-render. _invalidateFrom clears this.message, so the
    // confirmation is set AFTER it.
    _applyGridEdit(fn, okMsg) {
        if (this.mode === 'topDown') { this._applyGridEditTD(fn, okMsg); return; }
        const st = this._stepState;
        const grid = st?.grow?.grid;
        if (!grid) return;
        const startId = grid.getRegion(st.grow.startCell)?.region_id;
        try {
            fn(grid);
            if (startId) {
                const sr = grid.allRegions().find((r) => r.region_id === startId);
                if (sr) st.grow.startCell = sr.cell;
            }
            this._invalidateFrom(4);
            this.message = `${okMsg} Re-run 4 Compile to recheck the oracle.`;
            this.render();
        } catch (err) {
            this.message = `Edit failed: ${err.message}`;
            this.render();
        }
    }

    // Top-down layout edit. Operates on the FINALIZED grid (st.finalize.grid ===
    // st.layout.grid), which the move helper re-stitches via relayoutSphereGrid
    // (rebuilding teleporters + re-deriving forward targets), then invalidates 4
    // ONLY (_invalidateFromTD(2) → completed=2, compile dropped, finalize kept).
    // We deliberately do NOT re-run 3: finalizeTopDown reads the now-stale
    // cellsByName and would double-apply back-exits, whereas 4 Compile reads only
    // the grid. The start region may relocate on a move/swap, so re-point
    // finalize.startCell at it (buildRulesJson reads from startCell).
    _applyGridEditTD(fn, okMsg) {
        const st = this._tdState;
        const grid = st?.finalize?.grid ?? st?.layout?.grid;
        if (!grid) return;
        const startCell = st.finalize?.startCell ?? st.layout?.startCell;
        const startId = startCell ? grid.getRegion(startCell)?.region_id : null;
        try {
            fn(grid);
            if (startId && st.finalize) {
                const sr = grid.allRegions().find((r) => r.region_id === startId);
                if (sr) st.finalize.startCell = sr.cell;
            }
            this._invalidateFromTD(2);
            this.message = `${okMsg} Re-run 4 Compile to recompile.`;
            this.render();
        } catch (err) {
            this.message = `Edit failed: ${err.message}`;
            this.render();
        }
    }

    _drawGrid(canvas, grid, regionSize) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = COLORS.emptyCell;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let gy = 0; gy < grid.height; gy++) {
            for (let gx = 0; gx < grid.width; gx++) {
                const region = grid.getRegion({ gx, gy });
                const offX = gx * regionSize.width * TILE_PX;
                const offY = gy * regionSize.height * TILE_PX;
                if (!region) {
                    ctx.strokeStyle = COLORS.cellBorder;
                    ctx.lineWidth = 1;
                    ctx.strokeRect(offX + 0.5, offY + 0.5,
                        regionSize.width * TILE_PX - 1, regionSize.height * TILE_PX - 1);
                    continue;
                }
                this._drawRegion(ctx, region, offX, offY, regionSize);
            }
        }

        // Cell borders so regions are visually distinct.
        ctx.strokeStyle = COLORS.cellBorder;
        ctx.lineWidth = 1;
        for (let gx = 0; gx <= grid.width; gx++) {
            ctx.beginPath();
            ctx.moveTo(gx * regionSize.width * TILE_PX + 0.5, 0);
            ctx.lineTo(gx * regionSize.width * TILE_PX + 0.5, canvas.height);
            ctx.stroke();
        }
        for (let gy = 0; gy <= grid.height; gy++) {
            ctx.beginPath();
            ctx.moveTo(0, gy * regionSize.height * TILE_PX + 0.5);
            ctx.lineTo(canvas.width, gy * regionSize.height * TILE_PX + 0.5);
            ctx.stroke();
        }

        this._drawConnections(ctx, grid, regionSize);

        // Highlight the pending selection: the whole cell (Move Region) or the
        // selected exit's green square (Move Exits).
        const sel = this._mapSel;
        const cw = regionSize.width * TILE_PX;
        const ch = regionSize.height * TILE_PX;
        if (sel?.kind === 'exit') {
            const region = grid.getRegion(sel.cell);
            const placed = region
                ? resolveExitTilePositions(getRegionExits(region) ?? [], regionSize)
                : [];
            const hit = placed.find((p) => p?.exit?.exit_id === sel.exitId);
            if (hit) {
                ctx.strokeStyle = '#ffd24a';
                ctx.lineWidth = 3;
                ctx.strokeRect(
                    sel.cell.gx * cw + hit.x * TILE_PX - 1.5,
                    sel.cell.gy * ch + hit.y * TILE_PX - 1.5,
                    TILE_PX + 3, TILE_PX + 3,
                );
            }
        } else if (sel && this._mapMode === 'moveRegion') {
            const { gx, gy } = sel.cell;
            ctx.strokeStyle = '#ffd24a';
            ctx.lineWidth = 3;
            ctx.strokeRect(gx * cw + 1.5, gy * ch + 1.5, cw - 3, ch - 3);
        }
    }

    // Thin yellow lines linking each exit's green square to its paired
    // entrance's green square (the reciprocal exit in the target region, found
    // via targetExitId). Usually the two sit adjacent so the line is tiny, but
    // for teleporter links (regions placed apart) it shows the connection. Drawn
    // last so the lines sit on top of the cells.
    _drawConnections(ctx, grid, regionSize) {
        const cellW = regionSize.width * TILE_PX;
        const cellH = regionSize.height * TILE_PX;
        // Global green-square center for every (region_id, exit_id).
        const centers = new Map();
        for (const region of grid.allRegions()) {
            const cell = region.cell;
            if (!cell) continue;
            const placed = resolveExitTilePositions(getRegionExits(region) ?? [], regionSize);
            for (const p of placed) {
                if (!p?.exit?.exit_id) continue;
                centers.set(`${region.region_id} ${p.exit.exit_id}`, {
                    px: cell.gx * cellW + (p.x + 0.5) * TILE_PX,
                    py: cell.gy * cellH + (p.y + 0.5) * TILE_PX,
                });
            }
        }
        ctx.strokeStyle = '#e6c84a';
        ctx.lineWidth = 3;
        const drawn = new Set();
        for (const region of grid.allRegions()) {
            const exits = getRegionExits(region);
            const list = Array.isArray(exits) ? exits : [...(exits?.values?.() ?? [])];
            for (const exit of list) {
                if (!exit?.targetRegion || !exit?.targetExitId) continue;
                const fromKey = `${region.region_id} ${exit.exit_id}`;
                const toKey = `${exit.targetRegion} ${exit.targetExitId}`;
                const pairKey = fromKey < toKey ? `${fromKey}|${toKey}` : `${toKey}|${fromKey}`;
                if (drawn.has(pairKey)) continue;
                drawn.add(pairKey);
                const a = centers.get(fromKey);
                const b = centers.get(toKey);
                if (!a || !b) continue;
                ctx.beginPath();
                ctx.moveTo(a.px, a.py);
                ctx.lineTo(b.px, b.py);
                ctx.stroke();
            }
        }
    }

    _drawRegion(ctx, region, offX, offY, regionSize) {
        const hint = region?.render_hint ?? region?.substrate ?? 'maze';
        const payload = region?.playable_payload;
        // Stub region: placed in 1 Layout (top-down) but not yet realised in 2,
        // so it has no playable_payload. Draw a labelled placeholder instead of
        // dispatching to a substrate drawer (which assumes a payload).
        if (!payload) {
            this._drawStubRegion(ctx, region, offX, offY, regionSize);
            return;
        }
        if (hint === 'text_adventure') {
            this._drawTextAdventureRegion(ctx, region, offX, offY, regionSize);
        } else if (hint === 'maze') {
            this._drawMazeRegion(ctx, payload, offX, offY);
        } else {
            this._drawGenericRegion(ctx, region, offX, offY, regionSize);
        }
    }

    // A region placed but not yet realised (top-down 1 Layout → 2 Realise).
    // Muted fill + the region_id so the live grid is viewable mid-pipeline.
    _drawStubRegion(ctx, region, offX, offY, regionSize) {
        const w = regionSize.width * TILE_PX;
        const h = regionSize.height * TILE_PX;
        ctx.fillStyle = COLORS.emptyCell;
        ctx.fillRect(offX, offY, w, h);
        ctx.strokeStyle = COLORS.cellBorder;
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 1;
        ctx.strokeRect(offX + 1.5, offY + 1.5, w - 3, h - 3);
        ctx.setLineDash([]);
        ctx.fillStyle = '#888';
        ctx.font = '10px monospace';
        ctx.fillText(String(region?.region_id ?? '?').slice(0, 12), offX + 4, offY + 14);
    }

    _drawMazeRegion(ctx, world, offX, offY) {
        const obsLib = world.obstacleLib ?? DEFAULT_OBSTACLES;
        const itemLib = world.itemLib ?? DEFAULT_ITEMS;
        // Composite view doesn't have a player inventory — gates
        // always render closed here. (The maze panel's playable view
        // is the right place to see them open as the player picks up
        // keys.)
        const inventory = new Set();

        // Tile base layer
        for (let y = 0; y < world.height; y++) {
            for (let x = 0; x < world.width; x++) {
                const tile = getTile(world, x, y);
                ctx.fillStyle = tile === TILE_WALL ? COLORS.wall : COLORS.floor;
                ctx.fillRect(offX + x * TILE_PX, offY + y * TILE_PX, TILE_PX, TILE_PX);
            }
        }

        // Quick lookup from tile coords to the exit at that position.
        const exitAt = new Map();
        for (const e of world.exits.values()) {
            exitAt.set(`${e.x},${e.y}`, e);
        }

        // §5 rendering pass — same shape as mazeRoomUI._drawWorld.
        for (let y = 0; y < world.height; y++) {
            for (let x = 0; x < world.width; x++) {
                const key = `${x},${y}`;
                const obstacleId = world.obstacles.get(key);
                const obstacle = obstacleId ? obsLib[obstacleId] : null;
                const isLogicGate = obstacle?.clear_set_type === 'rule';
                const gateClosed = isLogicGate
                    && !isObstacleCleared(obstacleId, inventory, obsLib);
                const exit = exitAt.get(key);
                const isExit = !!exit;
                const isEntrance = (x === world.entrance.x && y === world.entrance.y);
                const itemId = world.items.get(key);

                if (isExit) {
                    ctx.fillStyle = (isLogicGate && gateClosed) ? COLORS.exitBlocked : COLORS.exit;
                    ctx.fillRect(offX + x * TILE_PX, offY + y * TILE_PX, TILE_PX, TILE_PX);
                }
                if (obstacle && !isLogicGate) {
                    const color = obstacle.color ?? '#b84040';
                    ctx.fillStyle = color;
                    ctx.fillRect(offX + x * TILE_PX + 2, offY + y * TILE_PX + 2, TILE_PX - 4, TILE_PX - 4);
                }
                if (itemId) {
                    const hints = getItemRenderHints(itemId, itemLib);
                    const cx = offX + x * TILE_PX + TILE_PX / 2;
                    const cy = offY + y * TILE_PX + TILE_PX / 2;
                    ctx.fillStyle = hints.color;
                    ctx.beginPath();
                    ctx.arc(cx, cy, TILE_PX * 0.3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    if (hints.label) {
                        ctx.save();
                        ctx.fillStyle = '#000';
                        ctx.font = `bold ${Math.floor(TILE_PX * 0.55)}px sans-serif`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(hints.label, cx, cy);
                        ctx.restore();
                    }
                    if (isLogicGate && gateClosed) {
                        ctx.strokeStyle = COLORS.locationBlocked;
                        ctx.lineWidth = 2;
                        ctx.strokeRect(offX + x * TILE_PX + 1, offY + y * TILE_PX + 1, TILE_PX - 2, TILE_PX - 2);
                    }
                }
                if (isEntrance && !isExit) {
                    ctx.strokeStyle = COLORS.entrance;
                    ctx.lineWidth = 2;
                    ctx.strokeRect(offX + x * TILE_PX + 1, offY + y * TILE_PX + 1, TILE_PX - 2, TILE_PX - 2);
                }
            }
        }
    }

    _drawTextAdventureRegion(ctx, region, offX, offY, regionSize) {
        const payload = region?.playable_payload ?? {};
        const cellW = regionSize.width * TILE_PX;
        const cellH = regionSize.height * TILE_PX;
        const obsLib = payload.obstacleLib ?? DEFAULT_OBSTACLES;
        const inventory = new Set();

        ctx.fillStyle = COLORS.textAdventureBg;
        ctx.fillRect(offX, offY, cellW, cellH);

        const placedExits = resolveExitTilePositions(payload.exits, regionSize);
        for (const { x, y } of placedExits) {
            const obstacleId = payload.obstacles?.get?.(`${x},${y}`);
            const obstacle = obstacleId ? obsLib[obstacleId] : null;
            const isLogicGate = obstacle?.clear_set_type === 'rule';
            const gateClosed = isLogicGate
                && !isObstacleCleared(obstacleId, inventory, obsLib);
            ctx.fillStyle = gateClosed ? COLORS.exitBlocked : COLORS.exit;
            ctx.fillRect(offX + x * TILE_PX, offY + y * TILE_PX, TILE_PX, TILE_PX);
        }

        if (payload.entrance && Number.isFinite(payload.entrance.x) && Number.isFinite(payload.entrance.y)) {
            const ex = payload.entrance.x;
            const ey = payload.entrance.y;
            const onExit = placedExits.some(({ x, y }) => x === ex && y === ey);
            if (!onExit) {
                ctx.strokeStyle = COLORS.entrance;
                ctx.lineWidth = 2;
                ctx.strokeRect(offX + ex * TILE_PX + 1, offY + ey * TILE_PX + 1, TILE_PX - 2, TILE_PX - 2);
            }
        }

        // Items live in two parallel Maps keyed by "x,y": payload.items
        // (Map → itemId) and payload.itemLocationNames (Map → AP name).
        // Skip items whose location name didn't make it through serialization.
        const locationNames = [];
        const lockedLocations = new Set();
        const items = payload.items;
        const itemLocationNames = payload.itemLocationNames;
        if (items && typeof items.entries === 'function') {
            for (const [posKey] of items) {
                const locationName = itemLocationNames?.get?.(posKey);
                if (!locationName) continue;
                locationNames.push(locationName);
                const obstacleId = payload.obstacles?.get?.(posKey);
                const obstacle = obstacleId ? obsLib[obstacleId] : null;
                const isLogicGate = obstacle?.clear_set_type === 'rule';
                const gateClosed = isLogicGate
                    && !isObstacleCleared(obstacleId, inventory, obsLib);
                if (gateClosed) lockedLocations.add(locationName);
            }
        }

        const padX = 6;
        const padY = 6;
        const headerSize = 11;
        const lineSize = 10;
        const lineGap = 2;
        let textY = offY + padY;

        ctx.save();
        ctx.fillStyle = COLORS.textAdventureFg;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        ctx.font = `bold ${headerSize}px sans-serif`;
        const heading = region?.region_id ?? region?.name ?? '(region)';
        const headingLine = fitTextToWidth(ctx, heading, cellW - padX * 2);
        if (headingLine && textY + headerSize <= offY + cellH - padY) {
            ctx.fillText(headingLine, offX + padX, textY);
            textY += headerSize + lineGap;
        }

        ctx.font = `${lineSize}px sans-serif`;
        const summary = `${locationNames.length} location${locationNames.length === 1 ? '' : 's'}`;
        if (textY + lineSize <= offY + cellH - padY) {
            ctx.fillText(summary, offX + padX, textY);
            textY += lineSize + lineGap;
        }

        const maxY = offY + cellH - padY;
        let truncated = 0;
        for (let i = 0; i < locationNames.length; i++) {
            const name = locationNames[i];
            const remaining = locationNames.length - i;
            if (textY + lineSize > maxY) {
                truncated = remaining;
                break;
            }
            // Last visible slot may need to host a "+N more" instead.
            const isLastSlot = textY + lineSize * 2 + lineGap > maxY;
            if (isLastSlot && remaining > 1) {
                ctx.fillStyle = COLORS.textAdventureFgDim;
                ctx.fillText(`+${remaining} more`, offX + padX, textY);
                truncated = 0;
                textY += lineSize + lineGap;
                break;
            }
            const prefix = lockedLocations.has(name) ? '\u{1F512} ' : '• ';
            ctx.fillStyle = lockedLocations.has(name) ? COLORS.locationBlocked : COLORS.textAdventureFg;
            ctx.fillText(fitTextToWidth(ctx, prefix + name, cellW - padX * 2), offX + padX, textY);
            textY += lineSize + lineGap;
        }
        if (truncated > 0) {
            ctx.fillStyle = COLORS.textAdventureFgDim;
            ctx.fillText(`+${truncated} more`, offX + padX, textY);
        }
        ctx.restore();
    }

    _drawGenericRegion(ctx, region, offX, offY, regionSize) {
        const cellW = regionSize.width * TILE_PX;
        const cellH = regionSize.height * TILE_PX;
        ctx.fillStyle = COLORS.genericBg;
        ctx.fillRect(offX, offY, cellW, cellH);

        const exits = getRegionExits(region) ?? [];
        const placedExits = resolveExitTilePositions(exits, regionSize);
        ctx.fillStyle = COLORS.exit;
        for (const { x, y } of placedExits) {
            ctx.fillRect(offX + x * TILE_PX, offY + y * TILE_PX, TILE_PX, TILE_PX);
        }

        ctx.save();
        ctx.fillStyle = COLORS.textAdventureFg;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = region?.substrate ?? region?.render_hint ?? '?';
        // Zone-based substrates carry a numeric index in
        // playable_payload (currently just JtA's jtaZone). Surface it
        // here so the shuffled-spiral preview shows zone ordering at
        // a glance; procedural substrates render unchanged.
        const zoneIdx = region?.playable_payload?.jtaZone;
        const hasZone = typeof zoneIdx === 'number';
        const cx = offX + cellW / 2;
        if (hasZone) {
            ctx.font = `bold ${Math.max(14, Math.floor(cellH * 0.25))}px sans-serif`;
            ctx.fillText(`Zone ${zoneIdx}`, cx, offY + cellH / 2 - 6);
            ctx.font = '10px sans-serif';
            ctx.fillText(`(${label})`, cx, offY + cellH / 2 + 12);
        } else {
            ctx.font = '10px sans-serif';
            ctx.fillText(`(${label})`, cx, offY + cellH / 2);
        }
        ctx.restore();
    }

    // --- rules.json export ---

    _renderCompiled() {
        const container = document.createElement('div');
        container.className = 'procgen-pipeline-rules-container';
        if (!this.result) { container.style.display = 'none'; return container; }

        const details = document.createElement('details');
        details.className = 'procgen-pipeline-rules';
        const summary = document.createElement('summary');
        summary.textContent = 'rules.json (with preset_sidecars)';
        details.appendChild(summary);

        // Export buttons (Load / Download / Copy) live next to Generate
        // in _renderActions; this section is just the JSON preview now.
        const json = stringifyRulesJson(this.result.rulesJson);
        const pre = document.createElement('pre');
        pre.className = 'procgen-pipeline-rules-json';
        pre.textContent = json;
        details.appendChild(pre);

        container.appendChild(details);
        return container;
    }

    _downloadText(text, filename) {
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Revoke after a tick so the download has a chance to start.
        setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    // Publish the generated rules.json into the app — the editor's Apply flow
    // (same event name + payload shape). Returns false if no eventBus. The full
    // rulesJson is published as-is, so procgen_metadata (sphere_tree/sphere_plan)
    // rides along and the editor preserves it (see §2.1).
    _publishRulesToFrontend(rulesJson) {
        const eventBus = this.apis?.eventBus;
        if (!eventBus || typeof eventBus.publish !== 'function') return false;
        eventBus.publish('files:jsonLoaded', {
            jsonData: rulesJson,
            selectedPlayerId: '1',
            sourceName: 'procgenPipeline',
        });
        return true;
    }

    _loadIntoFrontend(rulesJson, button) {
        const restore = () => { button.textContent = 'Load into frontend'; };
        if (!this._publishRulesToFrontend(rulesJson)) {
            button.textContent = 'No eventBus';
            setTimeout(restore, 1500);
            return;
        }
        button.textContent = 'Loaded';
        setTimeout(restore, 1200);
    }

    // §2.2 handoff: hand the generated world straight to the APWorld Editor and
    // bring it forward. We deliberately do NOT use the global files:jsonLoaded
    // here: a full app load triggers the substrate panels to self-activate (on
    // their loadRegion) and steal focus from the editor. The dedicated
    // apworldEditor:loadRules channel routes the world to the editor only — it
    // adopts it immediately if open, or drains the stash on mount — so nothing
    // else moves. procgen_metadata rides along untouched (editor preserves it, §2.1).
    _editInApworldEditor(rulesJson, button) {
        const restore = () => { button.textContent = 'Edit in APWorld Editor'; };
        const eventBus = this.apis?.eventBus;
        if (!eventBus || typeof eventBus.publish !== 'function') {
            button.textContent = 'No eventBus';
            setTimeout(restore, 1500);
            return;
        }
        eventBus.publish('apworldEditor:loadRules', { jsonData: rulesJson });
        eventBus.publish('ui:activatePanel', { panelId: 'apworldEditorPanel' });
        button.textContent = 'Opened editor';
        setTimeout(restore, 1200);
    }

    _copyToClipboard(text, button) {
        const restore = () => { button.textContent = 'Copy JSON'; };
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => { button.textContent = 'Copied'; setTimeout(restore, 1200); })
                .catch(() => { button.textContent = 'Copy failed'; });
            return;
        }
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        try {
            document.execCommand('copy');
            button.textContent = 'Copied'; setTimeout(restore, 1200);
        } catch {
            button.textContent = 'Copy failed';
        }
        document.body.removeChild(ta);
    }

    // --- Run ---

    async _runGeneration() {
        if (this.isGenerating) return;
        if (this.mode === 'topDown' && !this.topDownSource) {
            this.message = 'Pick a source rules.json first.';
            this.render();
            return;
        }
        this.isGenerating = true;
        this.message = '';
        this.warning = '';
        // In the stepped modes the step runners own this.result (a "Run all"
        // that just finishes an in-progress pipeline must not wipe it);
        // other modes clear it up front.
        const midSphere = this.mode === 'sphereGrowth' && this._stepState;
        // Mid-pipeline = an incomplete top-down run we're finishing; a COMPLETE
        // (or absent) one means Generate re-generates, so clear its result.
        const midTopDown = this.mode === 'topDown' && this._tdState
            && nextTopDownStep(this._tdState) !== null;
        const midSpiral = this.mode === 'shuffledSpiral' && this._spiralState
            && nextSpiralStep(this._spiralState) !== null;
        if (!midSphere && !midTopDown && !midSpiral) this.result = null;
        this.render();

        try {
            if (this.mode === 'topDown') {
                // async: yields per region so the progress indicator repaints
                await this._runTopDownAll();
            } else if (this.mode === 'shuffledSpiral') {
                await this._runSpiralAll();
            } else if (this.mode === 'sphereGrowth') {
                // async: yields to the event loop between regions and
                // generate-and-test attempts so the progress indicator
                // below the Generate button can repaint
                await this._runSphereGrowth();
            } else {
                this._runGridGrowth();
            }
        } catch (e) {
            this.message = `ERROR: ${e.message}`;
        }

        this.isGenerating = false;
        this._progressState = null;
        this.render();
    }

    /**
     * Live progress for sphere-mode generation: tracks the event
     * stream from growSpheresAsync and rewrites the indicator element
     * below the Generate button (direct DOM mutation — a full render
     * per event would be churn). Also accumulates light per-step
     * timings, logged to the console when generation completes.
     */
    _onGenerationProgress(ev) {
        const s = this._progressState;
        if (!s) return;
        const now = performance.now();
        if (s.lastEvent) {
            s.timings.push({
                step: s.lastEvent.type === 'region'
                    ? `region ${s.lastEvent.region_id} (${s.lastEvent.substrate})`
                    : s.lastEvent.type,
                ms: Math.round(now - s.lastAt),
            });
        }
        s.lastEvent = ev;
        s.lastAt = now;
        if (ev.type === 'plan') {
            s.totalRegions = ev.regions;
            s.totalSpheres = ev.spheres;
        } else if (ev.type === 'region') {
            s.region = ev;
            s.attempt = null;
            s.doneRegions = ev.index;
        } else if (ev.type === 'attempt') {
            s.attempt = ev;
        } else if (ev.type === 'regionDone') {
            s.doneRegions = ev.index + 1;
            s.region = null;
            s.attempt = null;
        } else if (ev.type === 'phase') {
            s.phase = ev.name;
            s.region = null;
            s.attempt = null;
        }
        this._updateProgressEl();
    }

    _updateProgressEl() {
        if (!this._progressEl || !this._progressState) return;
        const s = this._progressState;
        const lines = [];
        if (s.region) {
            const r = s.region;
            const attempt = s.attempt
                ? ` · attempt ${s.attempt.attempt}/${s.attempt.attempts}` : '';
            // sphere is sphere-mode-only; top-down regions carry no wave.
            const sphereBit = r.sphere != null ? `, sphere ${r.sphere}` : '';
            lines.push(`Building region ${r.index + 1}/${s.totalRegions} — `
                + `${r.region_id} (${r.substrate}${sphereBit}, `
                + `${r.placements} placement${r.placements === 1 ? '' : 's'})${attempt}`);
            let spheresBit = '';
            if (r.sphere != null && s.totalSpheres) {
                const spheresLeft = Math.max(0, s.totalSpheres - r.sphere);
                spheresBit = `${spheresLeft} sphere${spheresLeft === 1 ? '' : 's'} · `;
            }
            const regionsLeft = s.totalRegions - r.index;
            lines.push(`Remaining: ${spheresBit}`
                + `${regionsLeft} region${regionsLeft === 1 ? '' : 's'} · `
                + `${r.placements} placement${r.placements === 1 ? '' : 's'} in current region`);
        } else if (s.phase) {
            lines.push(`Finalizing: ${s.phase} · ${s.doneRegions}/${s.totalRegions} regions built`);
        } else if (s.totalRegions) {
            lines.push(s.totalSpheres
                ? `Planned: ${s.totalSpheres} spheres, ${s.totalRegions} regions`
                : `Planned: ${s.totalRegions} regions`);
        } else {
            lines.push('Planning…');
        }
        lines.push(`Elapsed: ${((performance.now() - s.startedAt) / 1000).toFixed(1)}s`);
        this._progressEl.textContent = lines.join('\n');
    }

    _runGridGrowth() {
        const { seed, gridWidth, gridHeight, regionWidth, regionHeight,
            maxItemsPerRegion, maxRegions, startSubstrate,
            stopOnPoolEmpty, asymmetricExits } = this.params;
        const useQuotas = this.substrateMode === 'quotas';
        const quotas = useQuotas ? this._effectiveSubstrateQuotas() : null;
        const mix = !useQuotas ? this._effectiveSubstrateMix() : null;
        const { grid, pool, stats, startCell } = growMaze({
            gridDims: { width: gridWidth, height: gridHeight },
            regionSize: { width: regionWidth, height: regionHeight },
            itemPool: { ...this.scenario.items },
            obstaclePool: { ...this.scenario.obstacles },
            seed,
            regionParams: {},
            growthParams: {
                maxItemsPerRegion,
                maxRegions: maxRegions ?? null,
                stopOnPoolEmpty: !!stopOnPoolEmpty,
                asymmetricExits: asymmetricExits === 'remove' ? 'remove' : 'add',
                ...(quotas ? { substrateQuotas: quotas } : {}),
                ...(mix ? { substrateMix: mix } : {}),
                ...(startSubstrate && startSubstrate !== 'auto'
                    ? { startSubstrate } : {}),
            },
            hazardOpts: this._effectiveHazardOpts(),
        });
        // Auto-completion-condition item — scenario is_victory item or
        // a selected substrate's declared victoryItem (see
        // _resolveVictoryItemId). Opt-out: drop all such items.
        const victoryItemId = this._resolveVictoryItemId();
        const rulesJson = buildRulesJson(grid, {
            startCell, seed,
            enableLoopMode: !!this.params.enableLoopMode,
            regionXpEffect: this.params.regionXpEffect ?? 'cost',
            completionConditionItem: victoryItemId,
            procgenMetadata: {
                driver: 'grid-growth',
                stop_reason: stats.stopReason,
            },
        });
        this.result = {
            grid,
            regionSize: { width: regionWidth, height: regionHeight },
            stats,
            poolRemaining: pool.snapshot(),
            rulesJson,
        };
    }

    // ── Shuffled spiral as a 4-step pipeline ────────────────────────
    // ① Arrange → ② Content (no-op today) → ③ Regions → ④ Compile. Each step
    // can run on its own ("Run next step") or the lot at once ("Run all" =
    // _runSpiralAll). The steps delegate to spiralSteps.js — the same shared
    // runner the headless `spiral-step` CLI uses — so the stepped panel output
    // is byte-identical to the monolithic arrangeShuffledSpiral + buildRulesJson.
    // State lives on this._spiralState (null until ① runs); see _renderSpiralSteps.

    // Build a fresh spiral envelope from the panel's current params + scenario.
    // The { config, compileIn } pair is EXACTLY what the old one-shot fed
    // arrangeShuffledSpiral + buildRulesJson (regionParams:{} — no substrate
    // config yet; JtA's dataset config lands on ② content in Part 3), so
    // byte-identity holds.
    _buildSpiralEnvelope() {
        const { seed, regionWidth, regionHeight, maxItemsPerRegion,
            startSubstrate } = this.params;
        // Merge substrate quotas with the selected region-library content sources
        // (each contributes a `library:<id>` quota + its libraryDoc on
        // substrateConfig). Libraries are held RESOLVED in this.regionLibraries,
        // so this is synchronous — the async re-fetch happens once, at load /
        // preset-apply, into that list.
        const { substrateQuotas, substrateConfig } = buildLibrarySpiralConfig(
            this.regionLibraries,
            { substrateQuotas: this._effectiveSubstrateQuotas() ?? {}, substrateConfig: {} },
        );
        if (Object.keys(substrateQuotas).length === 0) {
            throw new Error('shuffled-spiral requires at least one substrate '
                + 'with a positive quota (set Substrate allocation to Quotas) '
                + 'or a selected region library');
        }
        const config = {
            regionSize: { width: regionWidth, height: regionHeight },
            itemPool: { ...this.scenario.items },
            obstaclePool: { ...this.scenario.obstacles },
            seed,
            regionParams: {},
            growthParams: {
                substrateQuotas,
                maxItemsPerRegion,
                ...(startSubstrate && startSubstrate !== 'auto'
                    ? { startSubstrate } : {}),
                ...(Object.keys(substrateConfig).length
                    ? { substrateConfig } : {}),
            },
            hazardOpts: this._effectiveHazardOpts(),
        };
        const compileIn = {
            seed,
            enableLoopMode: !!this.params.enableLoopMode,
            regionXpEffect: this.params.regionXpEffect ?? 'cost',
            completionConditionItem: this._resolveVictoryItemId(),
        };
        return newSpiralEnvelope({ config, compileIn });
    }

    // --- spiral step runners (delegate to spiralSteps) ---
    // Spiral's step runners are synchronous (no per-region streaming like
    // sphere/top-down), so — unlike those modes — the handlers need no
    // _progressState / onProgress wiring. arrange/content/regions/compile run
    // instantly.

    async _stepSpiralArrange() {
        await runSpiralStep('arrange', this._spiralState);
    }

    // ② Content — a no-op for every current substrate (byte-identical). No
    // editing surface; _renderSpiralSteps shows a "no content substrate" note.
    async _stepSpiralContent() {
        await runSpiralStep('content', this._spiralState);
    }

    async _stepSpiralRegions() {
        await runSpiralStep('regions', this._spiralState);
    }

    // ④ Compile — the panel owns the this.result it shows. poolRemaining:null
    // (matches top-down; the pool is kept off the envelope, so the "pool
    // remaining" stat is dropped in stepped mode — the stats renderer branches
    // cleanly on null).
    async _stepSpiralCompile() {
        const st = this._spiralState;
        await runSpiralStep('compile', st);
        this.result = {
            grid: st.regions.grid,
            regionSize: {
                width: this.params.regionWidth, height: this.params.regionHeight,
            },
            stats: st.regions.stats,
            poolRemaining: null,
            rulesJson: st.compile.rulesJson,
        };
    }

    // Advance one spiral step (button: Run next step). Starts the pipeline
    // (① Arrange) when none is running, then follows nextSpiralStep.
    _advanceSpiralStep() {
        if (!this._spiralState) { this._spiralState = this._buildSpiralEnvelope(); }
        const byName = {
            arrange: () => this._stepSpiralArrange(),
            content: () => this._stepSpiralContent(),
            regions: () => this._stepSpiralRegions(),
            compile: () => this._stepSpiralCompile(),
        };
        const step = nextSpiralStep(this._spiralState);
        return step ? byName[step]?.() : undefined;
    }

    // "Run all" — run from the current point to completion (driven by
    // _runGeneration, which owns isGenerating + the surrounding render).
    async _runSpiralAll() {
        // Fresh run when there's no pipeline OR the previous one is complete
        // (Generate re-generates); otherwise continue the in-progress one.
        if (!this._spiralState || nextSpiralStep(this._spiralState) === null) {
            this._spiralState = this._buildSpiralEnvelope();
        }
        while (nextSpiralStep(this._spiralState)) {
            // eslint-disable-next-line no-await-in-loop
            await this._advanceSpiralStep();
        }
    }

    // "Run next step" button — its own guard + render (the Generate path in
    // _runGeneration wraps "Run all").
    async _runSpiralStepNext() {
        if (this.isGenerating) return;
        this.isGenerating = true;
        this.render();
        try {
            await this._advanceSpiralStep();
        } catch (e) {
            this.message = `ERROR: ${e.message}`;
        }
        this.isGenerating = false;
        this.render();
    }

    // "Reset" button — drop the spiral pipeline so ① re-runs from current params.
    _resetSpiralSteps() {
        this._spiralState = null;
        this.result = null;
        this.message = '';
        this.warning = '';
        this.render();
    }

    // Content of the "Spiral pipeline" section: read-only feedback per completed
    // step (② Content is a no-op note — no editing surface this pass).
    _renderSpiralSteps() {
        const wrap = document.createElement('div');
        const st = this._spiralState;
        if (!st) return wrap;
        if (st.completed >= 0 && st.arrange) {
            wrap.appendChild(this._renderStepBlock('1 Arrange — spiral placement plan',
                this._renderSpiralArrangeFeedback(st.arrange)));
        }
        if (st.completed >= 1) {
            wrap.appendChild(this._renderStepBlock('2 Content — per-zone dataset',
                this._renderSpiralContentFeedback()));
        }
        if (st.completed >= 2 && st.regions) {
            wrap.appendChild(this._renderStepBlock('3 Regions — spiral-walk region synthesis',
                this._renderSpiralRegionsFeedback(st.regions)));
        }
        if (st.completed >= 3 && st.compile) {
            wrap.appendChild(this._renderStepBlock('4 Compile',
                this._renderSpiralCompileFeedback(st.compile)));
        }
        return wrap;
    }

    _renderSpiralArrangeFeedback(arrange) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'font-size:12px;color:#bbb;';
        const seq = arrange.sequence ?? [];
        const counts = {};
        for (const s of seq) counts[s] = (counts[s] ?? 0) + 1;
        const bySub = Object.entries(counts).map(([s, n]) => `${n} ${s}`).join(', ') || 'none';
        const dims = arrange.gridDims;
        wrap.textContent = `Planned ${seq.length} region${seq.length === 1 ? '' : 's'} `
            + `from center: ${bySub}${dims ? ` · grid ${dims.width}×${dims.height}` : ''}`;
        return wrap;
    }

    _renderSpiralContentFeedback() {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'font-size:12px;color:#999;';
        wrap.textContent = 'No content substrate — nothing to synthesise (no-op).';
        return wrap;
    }

    _renderSpiralRegionsFeedback(regions) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'font-size:12px;color:#bbb;';
        const stats = regions.stats ?? {};
        const counts = stats.substrateCounts ?? {};
        const bySub = Object.entries(counts).map(([s, n]) => `${n} ${s}`).join(', ') || 'none';
        wrap.textContent = `Realised ${stats.regionsBuilt ?? 0} region(s): ${bySub} · `
            + `stop: ${stats.stopReason}`;
        return wrap;
    }

    _renderSpiralCompileFeedback(compile) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'font-size:12px;color:#bbb;';
        const rj = compile.rulesJson;
        const regionCount = Object.keys(rj.regions?.['1'] ?? {}).length;
        wrap.textContent = `driver ${rj.procgen_metadata?.driver} · ${regionCount} regions`;
        return wrap;
    }

    // ── Sphere growth as a 4-step pipeline ──────────────────────────
    // Plan 1 → Build tree 2 → Build regions 3 → Compile 4. Each step
    // can run on its own ("Run next step") or the lot can run at once
    // ("Run all" = _runSphereGrowth). Step 1 yields an EDITABLE plan
    // (sphere 0 = starting items); editing it marks 2–4 stale. State
    // lives on this._stepState (null until 1 runs); see _renderSphereSteps.

    // The shared, frozen-at-1 config every step reads (so a later param
    // tweak doesn't silently change a pipeline mid-run — Reset/re-Plan
    // to pick up new params).
    _buildSphereConfig() {
        const { seed, regionWidth, regionHeight, maxItemsPerRegion,
            sphereCount, fillerCount, revisitPercent, spheresPerBatch,
            startSubstrate } = this.params;
        const startSub = (startSubstrate && startSubstrate !== 'auto') ? startSubstrate : null;
        const quotas = this._effectiveSubstrateQuotas();
        return {
            seed,
            regionWidth, regionHeight,
            maxItemsPerRegion,
            sphereCount: sphereCount ?? 3,
            fillerCount: fillerCount ?? 0,
            revisitPercent: revisitPercent ?? 25,
            spheresPerBatch: spheresPerBatch ?? null,
            startSub,
            quotas,
            activeIds: this._activeSubstrateIds(quotas, startSub),
            itemLib: this._mergedItemLib(),
            itemPool: { ...this.scenario.items },
            victoryItemId: this._resolveVictoryItemId(),
            enableLoopMode: !!this.params.enableLoopMode,
            regionXpEffect: this.params.regionXpEffect ?? 'cost',
            hazardOpts: this._effectiveHazardOpts(),
        };
    }

    // Step 1 — pre-plan contributions, then delegate the planSpheres + draft
    // build to the shared runner (runStep). The cfg / prep collection stays
    // here (substrate hooks are bound to this panel); everything from the
    // resolved `config` onward is the runner's, so the panel and the headless
    // CLI share ONE implementation of the pipeline wiring.
    async _stepPlan() {
        const cfg = this._buildSphereConfig();
        const itemPool = { ...cfg.itemPool };
        // Each active substrate may grant starting items, reserve
        // sphere-1 pickups, lock placements, remove pool items, or add
        // regionParams BEFORE planning (bounce's free arrow — the hook
        // mutates itemPool via its delta). The driver stays agnostic.
        const prep = this._collectSphereGrowthPrep({
            activeIds: cfg.activeIds, itemPool, quotas: cfg.quotas,
            startSubstrate: cfg.startSub, seed: cfg.seed,
        });
        this._stepState = {
            completed: -1, cfg, prep,
            // The resolved, flat config the runner consumes (built from cfg +
            // prep; itemPool is POST-prep). regionParams is assembled now so
            // it's stable across edits.
            config: this._configFromCfgPrep(cfg, prep, itemPool),
            poolSize: Object.keys(itemPool).length,
            // Pipeline outputs (filled by the runner step-by-step). growConfig
            // is panel-only — derived from config+plan for the 3-editing
            // features (re-roll / region editor / composite map).
            draft: null, plan: null, startingItems: null, growConfig: null,
            opts: null, allocation: null, rng: null,
            nodes: null, substrateCounts: null, quotaFallbacks: null,
            topologyWarnings: [],
            tree: null, grow: null, compile: null, seconds: 0,
        };
        this.result = null;
        this.message = '';
        this.warning = '';
        await runStep('plan', this._stepState); // builds draft, completed = 0
    }

    // cfg + prep → the runner's flat resolved config. `itemPool` is the
    // POST-prep pool the plan is built from (prep may have removed items).
    _configFromCfgPrep(cfg, prep, itemPool) {
        return {
            seed: cfg.seed,
            regionSize: { width: cfg.regionWidth, height: cfg.regionHeight },
            itemLib: cfg.itemLib,
            regionParams: this._assembleRegionParams(cfg.activeIds, 'sphere', prep.regionParams),
            hazardOpts: cfg.hazardOpts,
            maxItemsPerRegion: cfg.maxItemsPerRegion,
            fillerCount: cfg.fillerCount,
            revisitRatio: cfg.revisitPercent / 100,
            substrateQuotas: cfg.quotas ?? null,
            startSubstrate: cfg.startSub ?? null,
            sphereCount: cfg.sphereCount,
            spheresPerBatch: cfg.spheresPerBatch ?? null,
            victoryItem: cfg.victoryItemId ?? null,
            exclusiveSpheres: prep.exclusiveSpheres ?? {},
            startingItems: prep.startingItems ?? [],
            lockedCanonicalItems: prep.lockedCanonicalItems ?? [],
            enableLoopMode: cfg.enableLoopMode,
            regionXpEffect: cfg.regionXpEffect ?? 'cost',
            itemPool,
        };
    }

    // Step 2a — Allocate (delegated). Also populates the panel-only
    // growConfig the 3-editing features read, off the same shared assembly.
    async _stepAllocate() {
        const st = this._stepState;
        await runStep('allocate', st);
        st.growConfig = growConfigFrom(st.config, st.plan);
    }

    // Step 2b — Topology (delegated).
    async _stepTopology() {
        const st = this._stepState;
        await runStep('topology', st);
        // Unedited wireSphereTree output is coherent by construction; only
        // 2b edits introduce warnings (see _applyTopologyEdit).
        st.topologyWarnings = [];
    }

    // Step 2c — Item placement (delegated).
    async _stepItems() {
        await runStep('items', this._stepState);
    }

    // Step 3 — Build regions (delegated). The panel owns the progress UI +
    // elapsed timing; the runner owns the grow (it clones the post-2b rng so
    // st.rng stays at the post-topology position — see sphereSteps.js).
    async _stepRegions() {
        const st = this._stepState;
        this._progressState = {
            startedAt: performance.now(), totalRegions: 0, totalSpheres: 0,
            doneRegions: 0, region: null, attempt: null, phase: null,
            timings: [], lastEvent: null, lastAt: 0,
        };
        this._updateProgressEl();
        await runStep('regions', st, { onProgress: (ev) => this._onGenerationProgress(ev) });
        if (this._progressState) {
            st.seconds = (performance.now() - this._progressState.startedAt) / 1000;
        }
    }

    // Step 4 — Compile (delegated). The panel owns the result message /
    // warning / this.result it shows; the runner owns buildRulesJson + oracle.
    async _stepCompile() {
        const st = this._stepState;
        const cfg = st.cfg;
        await runStep('compile', st);
        const { grid, stats } = st.grow;
        const { rulesJson, oracleErrors } = st.compile;

        const elapsedNote = st.seconds ? ` (${st.seconds.toFixed(1)}s)` : '';
        this.message = oracleErrors.length > 0
            ? `SPHERE ORACLE MISMATCH: ${oracleErrors[0]}`
            : `Sphere plan realised${elapsedNote}: ${st.plan.spheres
                .map((s) => `S${s.sphere}=[${s.items.join(', ')}]`).join('  ')}`
                + (st.prep.note ? ` — ${st.prep.note}` : '');
        if (stats.quotaFallbacks > 0) {
            this.warning = `WARNING: substrate quotas exhausted — ${stats.quotaFallbacks} `
                + `region(s) fell back to 'maze' (the plan needs ${stats.regionsBuilt} `
                + 'regions). Raise the quotas for a pure-substrate world.';
        }
        this.result = {
            grid,
            regionSize: { width: cfg.regionWidth, height: cfg.regionHeight },
            stats,
            poolRemaining: null,
            rulesJson,
            spherePlan: st.plan,
        };
    }

    // Advance one step (button: Run next step). Starts the pipeline (1)
    // when none is running, then follows nextSphereStep — which loops the
    // middle four phases per batch (sphere-major) and falls through to 4 after
    // the last batch. batch = all collapses to the linear six steps.
    _advanceSphereStep() {
        if (!this._stepState) { return this._stepPlan(); }
        const byName = {
            plan: () => this._stepPlan(),
            allocate: () => this._stepAllocate(),
            topology: () => this._stepTopology(),
            items: () => this._stepItems(),
            regions: () => this._stepRegions(),
            compile: () => this._stepCompile(),
        };
        const step = nextSphereStep(this._stepState);
        return step ? byName[step]?.() : undefined;
    }

    // "Run all" — run from the current point to completion. nextSphereStep
    // returns null only once 4 is done, so the loop drives every batch (the
    // per-batch loop-back advances batchStart monotonically → it terminates).
    async _runSphereGrowth() {
        if (!this._stepState) await this._stepPlan();
        while (nextSphereStep(this._stepState)) {
            // eslint-disable-next-line no-await-in-loop
            await this._advanceSphereStep();
        }
    }

    // "Run next step" button — its own guard + render (the Generate path
    // in _runGeneration wraps "Run all").
    async _runSphereStepNext() {
        if (this.isGenerating) return;
        this.isGenerating = true;
        this.render();
        try {
            await this._advanceSphereStep();
        } catch (e) {
            this.message = `ERROR: ${e.message}`;
        }
        this.isGenerating = false;
        this._progressState = null;
        this.render();
    }

    // "Reset" button — drop the pipeline so 1 re-plans from current params.
    _resetSphereSteps() {
        this._stepState = null;
        this.result = null;
        this.message = '';
        this.warning = '';
        this._progressState = null;
        this.render();
    }

    // "◀ Previous sphere" button — drop the MOST RECENTLY built sphere (its
    // regions + nodes) and rewind the cursor so the step buttons re-offer it.
    // Uses the shared truncateSphereWorld (nodes are wave-ordered, so the dropped
    // set is a contiguous suffix). Re-running forward regrows that sphere — a
    // fresh variation, since the rng has advanced (sphere-major / append diverge
    // by design); or edit the plan/topology first, then re-run.
    _stepBackSphere() {
        const st = this._stepState;
        const built = st?.batchStart ?? 0;
        if (!st || built < 1 || !st.grow?.grid) return;
        const target = built - 1; // keep waves [0, target); drop wave `target`+
        truncateSphereWorld(st, target);
        st.batchStart = target;
        st.completed = 1; // allocate done → next step rebuilds 2b for `target`
        st.compile = null;
        st.seconds = 0;
        this.result = null;
        this.warning = '';
        this.message = `Stepped back: dropped sphere ${target + 1} — re-run the steps `
            + 'to rebuild it (or edit the plan first).';
        this.render();
    }

    // "Append sphere" button (complete pipeline only) — grow one more sphere onto
    // the finished world via the shared appendSphere: relocate the goal into a new
    // final sphere with the entered items, grow that wave, recompile. Mirrors the
    // `sphere-step append` CLI; diverges from a fresh run by design (oracle holds).
    async _appendSphere() {
        if (this.isGenerating || !this._stepState?.compile) return;
        const raw = (this._appendItemsDraft ?? '').trim();
        const items = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];
        this.isGenerating = true;
        this._progressState = {
            startedAt: performance.now(), totalRegions: 0, totalSpheres: 0,
            doneRegions: 0, region: null, attempt: null, phase: null,
            timings: [], lastEvent: null, lastAt: 0,
        };
        this.message = '';
        this.warning = '';
        this.render();
        try {
            const st = this._stepState;
            await appendSphere(st, { items }, {
                onProgress: (ev) => this._onGenerationProgress(ev),
            });
            const { grid, stats } = st.grow;
            const { rulesJson, oracleErrors } = st.compile;
            this.message = oracleErrors.length > 0
                ? `SPHERE ORACLE MISMATCH: ${oracleErrors[0]}`
                : `Appended sphere: ${st.plan.spheres
                    .map((s) => `S${s.sphere}=[${s.items.join(', ')}]`).join('  ')}`;
            this.result = {
                grid,
                regionSize: { width: st.cfg.regionWidth, height: st.cfg.regionHeight },
                stats,
                poolRemaining: null,
                rulesJson,
                spherePlan: st.plan,
            };
            this._appendItemsDraft = '';
        } catch (e) {
            this.message = `ERROR: ${e.message}`;
        }
        this.isGenerating = false;
        this._progressState = null;
        this.render();
    }

    // Editing the OUTPUT of step `stepIdx` invalidates every later step:
    // roll `completed` back to stepIdx and drop the outputs each later step
    // produced (keeping stepIdx's own — the user edited it). Field groups are
    // keyed by the step that produces them. 2b's rng (regionsRng) is its own
    // output, so it's dropped with the topology group; 2b re-derives the FIRST
    // batch's rng from seed, so an allocation-only edit re-runs correctly. The
    // plan editor calls _onSpherePlanEdited (= _invalidateFrom(0)); the 2a/2b/2c
    // editors call with 1/2/3.
    _invalidateFrom(stepIdx) {
        const st = this._stepState;
        if (st && st.completed > stepIdx) {
            st.completed = stepIdx;
            if (stepIdx < 1) {
                st.plan = st.startingItems = st.growConfig = st.opts = null;
                st.allocation = st.rng = null;
            }
            if (stepIdx < 2) {
                st.nodes = st.substrateCounts = st.quotaFallbacks = null;
                st.topologyWarnings = [];
                st.regionsRng = null;
            }
            if (stepIdx < 3) st.tree = null;
            if (stepIdx < 4) {
                // Regions re-runs from batch 0: drop the grown grid AND reset
                // the sphere-major loop cursor (else a re-run takes the
                // batch > 0 path expecting a carried grid that's now gone).
                st.grow = null;
                st.seconds = 0;
                st.batchStart = 0;
                st.placed = null;
            }
            if (stepIdx < 5) st.compile = null;
            this.result = null;
            this.message = '';
            this.warning = '';
        }
        this.render();
    }

    // An edit to the plan draft invalidates everything downstream of 1.
    _onSpherePlanEdited() {
        this._invalidateFrom(0);
    }

    // Top-down analog of _invalidateFrom: roll the TD pipeline back to stepIdx,
    // dropping the outputs each LATER step produced (keeping stepIdx's own — the
    // user edited it). Fields are keyed by the step that produces them:
    // 1 layout/rng, 2 realise (+seconds), 3 finalize, 4 compile. A substrate
    // edit at 1 calls _invalidateFromTD(0): layout is kept, 2..4 are dropped, the
    // user re-runs. Each region is sub-seed-decoupled (layout.subSeedByRegion), so
    // re-running 2 reproduces every UNedited region and only the edited one changes.
    _invalidateFromTD(stepIdx) {
        const st = this._tdState;
        if (st && st.completed > stepIdx) {
            st.completed = stepIdx;
            if (stepIdx < 0) { st.layout = null; st.rng = null; }
            if (stepIdx < 1) { st.realise = null; st.seconds = 0; }
            if (stepIdx < 2) st.finalize = null;
            if (stepIdx < 3) st.compile = null;
            this.result = null;
            this.message = '';
            this.warning = '';
        }
        this.render();
    }

    // --- Envelope interop (export / load & resume) ---
    //
    // The panel's _stepState and the sphereSteps runner envelope are the same
    // pipeline state in two shapes: _stepState splits config into UI-flavored
    // cfg + substrate-hook prep; the runner uses one flat resolved `config`.
    // These two adapters bridge them so the panel can export the envelope the
    // headless `sphere-step` CLI reads, and load one back to resume. The grid
    // / rng / node-Sets cross the boundary via the runner's (de)serialisers.

    // _stepState → runner envelope (plain JSON, ready to download / hand to
    // the CLI). Returns null when no pipeline has been started. _stepState IS
    // the envelope now (it carries `config`; rng is already a {s} snapshot) —
    // pick the canonical envelope fields and serialise (grid / node-Sets).
    _envelopeFromStepState() {
        const st = this._stepState;
        if (!st || !st.config) return null;
        const env = {
            config: st.config,
            completed: st.completed,
            draft: st.draft ?? null,
            plan: st.plan ?? null,
            startingItems: st.startingItems ?? null,
            opts: st.opts ?? null,
            allocation: st.allocation ?? null,
            rng: st.rng ?? null, // already { s } (set by the runner)
            regionsRng: st.regionsRng ?? null, // post-2b rng for 3 re-runs
            nodes: st.nodes ?? null,
            substrateCounts: st.substrateCounts ?? null,
            quotaFallbacks: st.quotaFallbacks ?? null,
            tree: st.tree ?? null,
            grow: st.grow ?? null,
            compile: st.compile ?? null,
            // Cross-batch (sphere-major) loop state — see sphereSteps.js.
            placed: st.placed ?? null,
            prevCount: st.prevCount ?? 0,
            batchStart: st.batchStart ?? 0,
            totalNodes: st.totalNodes ?? null,
            dims: st.dims ?? null,
            startCell: st.startCell ?? null,
        };
        return serializeEnvelope(env);
    }

    // Sync the visible param / scenario controls to a loaded envelope's
    // config so the panel stays self-consistent with what's loaded. The
    // scenario pool is best-effort (the envelope carries the post-prep pool;
    // a substrate that removed an item at plan time — e.g. a bounce arrow —
    // won't reappear in the pool, but it shows in the loaded draft).
    _syncParamsFromConfig(config) {
        this.mode = 'sphereGrowth';
        this.params.seed = config.seed;
        this.params.regionWidth = config.regionSize.width;
        this.params.regionHeight = config.regionSize.height;
        this.params.maxItemsPerRegion = config.maxItemsPerRegion;
        this.params.sphereCount = config.sphereCount;
        this.params.fillerCount = config.fillerCount;
        this.params.revisitPercent = Math.round((config.revisitRatio ?? 0.25) * 100);
        this.params.startSubstrate = config.startSubstrate ?? 'auto';
        this.params.enableLoopMode = !!config.enableLoopMode;
        this.params.regionXpEffect = config.regionXpEffect ?? 'cost';
        if (config.substrateQuotas) this.substrateQuotas = { ...config.substrateQuotas };
        if (config.itemPool) this.scenario.items = { ...config.itemPool };
        this._saveToLocalStorage();
    }

    // Loaded envelope (deserialised: live Grid, {s} rng, Set node usedSides)
    // → _stepState, auto-detecting the resume point from data presence.
    //
    // Accepts two shapes (§2.3):
    //   • a serialized envelope (has a `config` block) — deserialised verbatim;
    //   • a finalized sphere-growth rules.json (has `procgen_metadata`, no
    //     `config`) — reconstructed into an append-ready envelope via
    //     rebuildEnvelopeFromRulesJson. This is what the APWorld Editor emits,
    //     so an edited world can be grown further without a saved envelope.
    //     Procedural substrates only; a zone substrate (bounce) throws with a
    //     clear message (no path extractor — append from a saved envelope).
    _applyImportedEnvelope(rawJson) {
        const { env, fromRulesJson: isRulesJson } = importSphereEnvelope(
            rawJson, { itemLib: DEFAULT_ITEMS, obstacleLib: DEFAULT_OBSTACLES });
        const config = env.config;
        if (!config || !config.regionSize) {
            throw new Error(isRulesJson
                ? 'could not reconstruct an envelope from this rules.json'
                : 'not a sphere-growth envelope (no config block)');
        }
        const completed = detectCompleted(env);
        this._syncParamsFromConfig(config);

        const cfg = {
            seed: config.seed,
            regionWidth: config.regionSize.width,
            regionHeight: config.regionSize.height,
            maxItemsPerRegion: config.maxItemsPerRegion,
            sphereCount: config.sphereCount,
            fillerCount: config.fillerCount,
            revisitPercent: Math.round((config.revisitRatio ?? 0.25) * 100),
            startSub: config.startSubstrate ?? null,
            quotas: config.substrateQuotas ?? null,
            activeIds: this._activeSubstrateIds(config.substrateQuotas, config.startSubstrate),
            itemLib: config.itemLib,
            itemPool: config.itemPool,
            victoryItemId: config.victoryItem ?? null,
            enableLoopMode: !!config.enableLoopMode,
            regionXpEffect: config.regionXpEffect ?? 'cost',
            hazardOpts: config.hazardOpts ?? null,
        };
        const prep = {
            startingItems: config.startingItems ?? [],
            lockedCanonicalItems: config.lockedCanonicalItems ?? [],
            exclusiveSpheres: config.exclusiveSpheres ?? {},
            regionParams: config.regionParams ?? {},
            note: '',
        };
        // The panel-only growConfig the 3-editing features read — derived
        // from the shared assembly so it can't drift from the runner's.
        const growConfig = env.plan ? growConfigFrom(config, env.plan) : null;

        this._stepState = {
            completed,
            cfg, prep, config,
            draft: env.draft ?? { spheres: [[]] },
            poolSize: Object.keys(config.itemPool ?? {}).length,
            plan: env.plan ?? null,
            startingItems: env.startingItems ?? prep.startingItems,
            growConfig,
            opts: env.opts ?? null,
            allocation: env.allocation ?? null,
            rng: env.rng ?? null, // already { s } (deserialised verbatim)
            regionsRng: env.regionsRng ?? null,
            nodes: env.nodes ?? null,
            substrateCounts: env.substrateCounts ?? null,
            quotaFallbacks: env.quotaFallbacks ?? null,
            topologyWarnings: [],
            tree: env.tree ?? null,
            grow: env.grow ?? null,
            compile: env.compile ?? null,
            // Cross-batch loop state (deserialised verbatim; placed is a Set).
            placed: env.placed ?? null,
            prevCount: env.prevCount ?? 0,
            batchStart: env.batchStart ?? 0,
            totalNodes: env.totalNodes ?? null,
            dims: env.dims ?? null,
            startCell: env.startCell ?? null,
            seconds: 0,
        };
        // A complete envelope lights up the post-gen export buttons + views.
        this.result = (env.grow?.grid && env.compile?.rulesJson) ? {
            grid: env.grow.grid,
            regionSize: { width: cfg.regionWidth, height: cfg.regionHeight },
            stats: env.grow.stats,
            poolRemaining: null,
            rulesJson: env.compile.rulesJson,
            spherePlan: env.plan,
        } : null;

        const next = completed + 1;
        const srcLabel = isRulesJson ? 'Reconstructed from rules.json' : 'Loaded envelope';
        this.message = next >= SPHERE_STEPS.length
            ? `${srcLabel} — all 6 steps present (pipeline complete).`
            : `${srcLabel} — ${completed + 1}/6 steps present; resume from `
                + `${SPHERE_STEPS[next]} (next step).`;
        this.warning = '';
        this.render();
    }

    _exportEnvelope() {
        const env = this._envelopeFromStepState();
        if (!env) {
            this.message = 'Nothing to export yet — run step 1 (Plan) first.';
            this.render();
            return;
        }
        const step = (this._stepState.completed ?? -1) + 1;
        this._downloadText(JSON.stringify(env, null, 2),
            `sphere-envelope-seed${this.params.seed}-step${step}.json`);
    }

    _loadEnvelopeFile(text, name) {
        try {
            this._applyImportedEnvelope(JSON.parse(text));
        } catch (e) {
            this.message = `ERROR loading ${name || 'file'}: ${e.message}`;
            this.render();
        }
    }

    // Build a fresh top-down envelope from the panel's current source + params.
    // The shared buildTopDownEnvelope (topDownSteps.js) owns the preamble (grant
    // each in-mix substrate's ability items as free starting items, pack the
    // engine opts + compile inputs); the panel just resolves the UI-state inputs
    // (mix, regionParams via the substrate hooks, hazardOpts, sphere log).
    _buildTDEnvelope() {
        const { seed, gridWidth, gridHeight, regionWidth, regionHeight } = this.params;
        const mix = this._effectiveSubstrateMix();
        const { entries: sphereLog } = this._resolveTopDownSphereLog();
        const activeIds = Object.entries(mix ?? {})
            .filter(([, w]) => Number(w) > 0).map(([id]) => id);
        return buildTopDownEnvelope({
            source: this.topDownSource,
            seed,
            gridDims: { width: gridWidth, height: gridHeight },
            regionSizeBase: { width: regionWidth, height: regionHeight },
            substrateMix: mix,
            regionParams: this._assembleRegionParams(activeIds, 'topDown'),
            hazardOpts: this._effectiveHazardOpts(),
            sphereLog,
            enableLoopMode: !!this.params.enableLoopMode,
            regionXpEffect: this.params.regionXpEffect ?? 'cost',
        });
    }

    // --- top-down step runners (delegate to topDownSteps) ---

    // 1 Layout (delegated). No progress (BFS is instant).
    async _stepTDLayout() {
        await runTopDownStep('layout', this._tdState);
    }

    // 2 Realise (delegated). The panel owns the progress indicator + elapsed
    // timing; the runner owns the per-region realisation + setTimeout(0) yield.
    async _stepTDRealise() {
        const st = this._tdState;
        this._progressState = {
            startedAt: performance.now(), totalRegions: 0, totalSpheres: 0,
            doneRegions: 0, region: null, attempt: null, phase: null,
            timings: [], lastEvent: null, lastAt: 0,
        };
        this._updateProgressEl();
        await runTopDownStep('realise', st, { onProgress: (ev) => this._onGenerationProgress(ev) });
        if (this._progressState) {
            st.seconds = (performance.now() - this._progressState.startedAt) / 1000;
        }
    }

    // 3 Finalize (delegated).
    async _stepTDFinalize() {
        await runTopDownStep('finalize', this._tdState,
            { onProgress: (ev) => this._onGenerationProgress(ev) });
    }

    // 4 Compile (delegated). The panel owns the result message / this.result it
    // shows; the runner owns buildRulesJson + the sphere-log attribution.
    async _stepTDCompile() {
        const st = this._tdState;
        await runTopDownStep('compile', st,
            { onProgress: (ev) => this._onGenerationProgress(ev) });
        const { rulesJson, enriched, attributionWarnings } = st.compile;
        if (enriched && attributionWarnings?.length) {
            this.message = `${this.message ? `${this.message} · ` : ''}`
                + `sphere-log attribution: ${attributionWarnings.length} warning(s) — `
                + `${attributionWarnings.slice(0, 3).join('; ')}`
                + `${attributionWarnings.length > 3 ? ' …' : ''}`;
        }
        this.result = {
            grid: st.finalize.grid,
            regionSize: st.regionSize,
            stats: st.finalize.stats,
            // No pool in top-down mode — keep the field present so the stats
            // renderer can branch cleanly.
            poolRemaining: null,
            rulesJson,
        };
    }

    // Advance one top-down step (button: Run next step). Starts the pipeline
    // (1 Layout) when none is running, then follows nextTopDownStep.
    _advanceTDStep() {
        if (!this._tdState) { this._tdState = this._buildTDEnvelope(); }
        const byName = {
            layout: () => this._stepTDLayout(),
            realise: () => this._stepTDRealise(),
            finalize: () => this._stepTDFinalize(),
            compile: () => this._stepTDCompile(),
        };
        const step = nextTopDownStep(this._tdState);
        return step ? byName[step]?.() : undefined;
    }

    // "Run all" — run from the current point to completion (driven by
    // _runGeneration, which owns isGenerating + the surrounding render).
    async _runTopDownAll() {
        // Fresh run when there's no pipeline OR the previous one is complete
        // (Generate re-generates); otherwise continue the in-progress one.
        if (!this._tdState || nextTopDownStep(this._tdState) === null) {
            this._tdState = this._buildTDEnvelope();
        }
        while (nextTopDownStep(this._tdState)) {
            // eslint-disable-next-line no-await-in-loop
            await this._advanceTDStep();
        }
    }

    // "Run next step" button — its own guard + render (the Generate path in
    // _runGeneration wraps "Run all").
    async _runTopDownStepNext() {
        if (this.isGenerating) return;
        if (!this.topDownSource) {
            this.message = 'Pick a source rules.json first.';
            this.render();
            return;
        }
        this.isGenerating = true;
        this.render();
        try {
            await this._advanceTDStep();
        } catch (e) {
            this.message = `ERROR: ${e.message}`;
        }
        this.isGenerating = false;
        this._progressState = null;
        this.render();
    }

    // "Reset" button — drop the top-down pipeline so 1 re-runs from current params.
    _resetTDSteps() {
        this._tdState = null;
        this.result = null;
        this.message = '';
        this.warning = '';
        this._progressState = null;
        this.render();
    }

    // Content of the "Top-down pipeline" section: read-only feedback per
    // completed step (Phase 2 — editing surfaces land in later phases).
    _renderTopDownSteps() {
        const wrap = document.createElement('div');
        const st = this._tdState;
        if (!st) return wrap;
        if (st.completed >= 0 && st.layout) {
            wrap.appendChild(this._renderStepBlock('1 Layout — region placement & substrate',
                this._renderTDLayoutEditor(st.layout)));
        }
        if (st.completed >= 1 && st.realise) {
            wrap.appendChild(this._renderStepBlock('2 Realise — substrate geometry per region',
                this._renderTDRealiseEditor(st)));
        }
        if (st.completed >= 2 && st.finalize) {
            wrap.appendChild(this._renderStepBlock('3 Finalize — teleporters, back-exits, entrances',
                this._renderTDFinalizeFeedback(st.finalize)));
        }
        if (st.completed >= 3 && st.compile) {
            wrap.appendChild(this._renderStepBlock('4 Compile',
                this._renderTDCompileFeedback(st.compile)));
        }
        return wrap;
    }

    // 1 Layout block: the placement summary plus a per-region substrate editor.
    // Editing a region's substrate writes layout.substrateByRegion[name] and
    // invalidates 2..4 (the user re-runs to re-realise — only that region changes,
    // since regions are sub-seed-decoupled). Mirrors the sphere 2b substrate
    // dropdown idiom (_renderTopologyRow).
    _renderTDLayoutEditor(layout) {
        const wrap = document.createElement('div');
        wrap.appendChild(this._renderTDLayoutFeedback(layout));
        wrap.appendChild(this._renderTDSubstrateEditor(layout));
        return wrap;
    }

    _renderTDSubstrateEditor(layout) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'margin-top:6px;';
        const subOpts = Object.keys(this._activeSubstrateDict());
        const heading = document.createElement('div');
        heading.style.cssText = 'font-size:11px;color:#999;margin:0 6px 3px;';
        heading.textContent = 'Substrate per region (an edit invalidates 2..4 — re-run to apply):';
        wrap.appendChild(heading);
        for (const { name } of layout.placementOrder ?? []) {
            // Menu / source-less regions are skipped in 1 (no substrate resolved),
            // so only show rows for regions that actually realise.
            if (!(name in (layout.substrateByRegion ?? {}))) continue;
            wrap.appendChild(this._renderTDSubstrateRow(layout, name, subOpts));
        }
        return wrap;
    }

    _renderTDSubstrateRow(layout, name, subOpts) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:1px 6px;font-size:11px;';
        const label = document.createElement('span');
        label.style.cssText = 'font-family:monospace;flex:1;min-width:0;overflow:hidden;'
            + 'text-overflow:ellipsis;white-space:nowrap;';
        label.textContent = name;
        label.title = name;
        row.appendChild(label);

        const cur = layout.substrateByRegion[name];
        const sel = document.createElement('select');
        sel.className = 'procgen-pipeline-td-substrate';
        sel.dataset.region = name;
        sel.title = `Substrate for ${name}`;
        // A current substrate not in the active mix (shouldn't happen) still shows.
        const opts = subOpts.includes(cur) ? subOpts : [...subOpts, cur];
        for (const id of opts) {
            const opt = document.createElement('option');
            opt.value = id; opt.textContent = id;
            if (id === cur) opt.selected = true;
            sel.appendChild(opt);
        }
        sel.addEventListener('change', () => {
            layout.substrateByRegion[name] = sel.value;
            this._invalidateFromTD(0);
        });
        row.appendChild(sel);
        return row;
    }

    _renderTDLayoutFeedback(layout) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'font-size:12px;color:#bbb;';
        const placed = layout.placementOrder?.length ?? 0;
        const teleEdges = layout.teleporterEdges?.length ?? 0;
        wrap.textContent = `Placed ${placed} region${placed === 1 ? '' : 's'} from `
            + `${layout.actualStartName} · ${teleEdges} teleporter edge${teleEdges === 1 ? '' : 's'} `
            + `· grid cell ${layout.uniformSize.width}×${layout.uniformSize.height}`;
        return wrap;
    }

    // 2 Realise block: the substrate-mix summary plus a per-region row carrying
    // [Edit ▸] (per-region geometry editor; bounce only) and [Re-roll 🎲]
    // (re-realise on a bumped sub-seed). The composite grid below is also
    // click-to-select in Edit Region mode (see _renderGrid / _onMapClick).
    _renderTDRealiseEditor(st) {
        const wrap = document.createElement('div');
        wrap.appendChild(this._renderTDRealiseFeedback(st));
        const grid = st.realise?.grid ?? st.layout?.grid;
        const cellsByName = st.layout?.cellsByName;
        for (const { name } of st.layout?.placementOrder ?? []) {
            const cell = cellsByName?.get?.(name);
            const region = cell ? grid?.getRegion?.(cell) : null;
            if (!region) continue;
            wrap.appendChild(this._renderTDRegionRow(name, region));
        }
        return wrap;
    }

    _renderTDRegionRow(name, region) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:1px 6px;font-size:11px;';
        const label = document.createElement('span');
        label.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        label.textContent = `${name} — ${region.substrate}`;
        label.title = name;
        row.appendChild(label);

        const canEdit = !!getRegionEditor(region.substrate);
        const edit = this._btn('Edit ▸', () => this._editRegionTD(region, name));
        edit.title = canEdit
            ? 'Open the per-region geometry editor'
            : `No region editor for "${region.substrate}" yet`;
        edit.disabled = !canEdit;
        if (!canEdit) edit.style.opacity = '0.5';
        row.appendChild(edit);

        const reroll = this._btn('Re-roll 🎲', () => this._reRollRegionTD(name));
        reroll.title = "Re-realise this region's geometry on a new sub-seed (keeps exits/locations)";
        row.appendChild(reroll);
        return row;
    }

    // Re-roll 🎲 (top-down) — bump this region's realisation sub-seed and re-run
    // from 2 Realise. The 1b decoupling means only this region (and its BFS
    // descendants, whose entrances re-align to its moved exit tiles) changes;
    // siblings / ancestors / other branches stay byte-identical. Works for maze
    // AND bounce: 2 re-realises the whole grid and 3 re-stitches, so the
    // exit-tile-adjacency concern that makes sphere's re-roll bounce-only doesn't
    // apply here.
    _reRollRegionTD(name) {
        const layout = this._tdState?.layout;
        if (!layout?.subSeedByRegion || !(name in layout.subSeedByRegion)) {
            this.message = 'Re-roll unavailable — run 1 Layout first.';
            this.warning = '';
            this.render();
            return;
        }
        const counts = (this._tdRerollCounts ??= new Map());
        const n = (counts.get(name) ?? 0) + 1;
        counts.set(name, n);
        layout.subSeedByRegion[name] = (layout.subSeedByRegion[name]
            ^ (0x9e3779b9 + n * 0x55555555)) >>> 0;
        // _invalidateFromTD clears this.message, so set it AFTER it.
        this._invalidateFromTD(0);
        this.message = `Re-rolled "${name}" (sub-seed bump #${n}). `
            + 'Re-run from 2 Realise to apply — only this region + its descendants change.';
        this.render();
    }

    // Edit ▸ (top-down) — open the per-region geometry editor for a bounce/zone
    // region. The contract is built from the read-only source via the engine's
    // buildTopDownRegionContract (the sphere _editRegion is node/tree-shaped).
    // onSave splices the edited region into the grid and re-runs 3..4 (the
    // back-exit/stitch/entrance passes read the realised exits; 3 is idempotent).
    _editRegionTD(region, name = null) {
        const open = getRegionEditor(region?.substrate);
        if (!open) {
            this.message = `No region editor for "${region?.substrate}" yet.`;
            this.warning = '';
            this.render();
            return;
        }
        const st = this._tdState;
        const layout = st?.layout;
        const regionId = name ?? region?.region_id;
        if (!layout || !regionId) {
            this.message = 'Edit unavailable — run 2 Realise first.';
            this.warning = '';
            this.render();
            return;
        }
        const regionParams = st.opts?.regionParams ?? {};
        let contract;
        try {
            contract = buildTopDownRegionContract(layout, regionId, { regionParams });
        } catch (err) {
            this.message = `Edit failed: ${err.message}`;
            this.warning = '';
            this.render();
            return;
        }
        // The editor's generation-settings + item picker (sphere _buildRegionContract
        // attaches these too): bounce params, the source's item pool, and the
        // items the player is assumed to hold (top-down: the granted starting set).
        contract.regionParams = regionParams;
        contract.itemPool = Object.keys(
            st.compileIn?.sourceItemDefs ?? st.source?.items?.['1'] ?? {},
        );
        contract.expectedItems = [...(st.compileIn?.startingItems ?? [])];
        open({
            region,
            contract,
            onSave: (editedRegion) => this._onRegionEditedTD(regionId, editedRegion),
        });
    }

    // Write-back from a top-down region editor save: splice the edited region into
    // the live grid and re-run 3..4 (_invalidateFromTD(1) → keep 2, drop 34). The
    // edited region carries fresh forward exits with no back-exit; 3 re-adds the
    // back-exit (guarded against duplication) and re-stitches.
    _onRegionEditedTD(regionId, editedRegion) {
        const layout = this._tdState?.layout;
        const grid = layout?.grid;
        const cell = layout?.cellsByName?.get?.(regionId);
        if (!grid || !cell || !editedRegion) return;
        grid.replaceRegion(cell, editedRegion);
        // _invalidateFromTD clears this.message, so set it AFTER it.
        this._invalidateFromTD(1);
        this.message = `Saved edits to "${regionId}". Re-run from 3 Finalize to apply.`;
        this.render();
    }

    _renderTDRealiseFeedback(st) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'font-size:12px;color:#bbb;';
        const counts = {};
        for (const r of st.realise.grid.allRegions()) {
            counts[r.substrate] = (counts[r.substrate] ?? 0) + 1;
        }
        const bySub = Object.entries(counts).map(([s, n]) => `${n} ${s}`).join(', ') || 'none';
        const secs = st.seconds ? ` · ${st.seconds.toFixed(1)}s` : '';
        wrap.textContent = `Realised ${st.layout.stats.regionsBuilt} region(s): ${bySub}${secs}`;
        return wrap;
    }

    _renderTDFinalizeFeedback(finalize) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'font-size:12px;color:#bbb;';
        const tele = finalize.stats.teleportersPlaced ?? 0;
        const sphered = finalize.sphereTree ? ' · sphere metadata attributed' : '';
        wrap.textContent = `${tele} teleporter${tele === 1 ? '' : 's'} placed · `
            + `stop: ${finalize.stats.stopReason}${sphered}`;
        return wrap;
    }

    _renderTDCompileFeedback(compile) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'font-size:12px;color:#bbb;';
        const rj = compile.rulesJson;
        const regionCount = Object.keys(rj.regions?.['1'] ?? {}).length;
        const hasLog = Array.isArray(rj.sphere_log) && rj.sphere_log.length > 0;
        wrap.textContent = `driver ${rj.procgen_metadata?.driver} · ${regionCount} regions · `
            + `sphere_log ${hasLog ? 'embedded' : 'absent'} · full rules.json in Compiled output below`;
        return wrap;
    }

    // Auto-size the grid to fit the source rules.json's region count.
    // Top-down places one grid cell per non-Menu region (plus extra
    // for teleporter targets that can't fit adjacent), so a square
    // grid sized to ceil(sqrt(N * 1.5)) gives BFS room to lay out
    // without immediately falling back to teleporters. Floor at the
    // panel's defaults so a small source doesn't shrink the grid.
    _applyGridDimsFromSource(rulesJson) {
        const regions = rulesJson?.regions?.['1'] ?? {};
        const count = Object.keys(regions).length;
        if (count === 0) return;
        const dim = Math.max(
            DEFAULT_PARAMS.gridWidth,
            Math.ceil(Math.sqrt(count * 1.5)),
        );
        this.params.gridWidth = dim;
        this.params.gridHeight = dim;
    }

    // --- helpers ---

    _btn(label, onClick) {
        const b = document.createElement('button');
        b.className = 'procgen-pipeline-btn';
        b.textContent = label;
        b.addEventListener('click', onClick);
        return b;
    }

    /**
     * Returns the effective substrate mix to pass to the engine, or
     * null when the user hasn't selected any substrates. Null means
     * "use the engine's default" — both growMaze and
     * topDownFromRulesJson fall back to 'maze' in that case, matching
     * pre-mixed-substrate behaviour.
     *
     * Also filters out zero / negative weights, which the input
     * field's change handler already removes from the map; the filter
     * here is a belt-and-suspenders guard for stale localStorage.
     */
    _effectiveSubstrateMix() {
        const positive = Object.entries(this.substrateMix).filter(([, w]) => w > 0);
        if (positive.length === 0) return null;
        return Object.fromEntries(positive);
    }

    /**
     * Same filtering / null-on-empty contract as
     * _effectiveSubstrateMix, but for the per-substrate region quotas.
     * Used only in grid-growth quotas mode.
     */
    _effectiveSubstrateQuotas() {
        const positive = Object.entries(this.substrateQuotas).filter(([, q]) => q > 0);
        if (positive.length === 0) return null;
        return Object.fromEntries(positive);
    }

    /**
     * Build the hazardOpts payload for growMaze / topDownFromRulesJson
     * from the panel's UI state. Returns null when hazards are
     * disabled — both engine entries treat null as "no hazards."
     */
    _effectiveHazardOpts() {
        if (!this.params.enableHazards) return null;
        const count = Math.max(0, Math.floor(this.params.hazardCount ?? 0));
        if (count === 0) return null;
        return {
            enabled: true,
            count,
            maxConsecutiveFails: Math.max(1, Math.floor(this.params.hazardMaxConsecutiveFails ?? 10)),
            wallOverlapAllowed: !!this.params.hazardWallOverlapAllowed,
        };
    }

    /**
     * Sub-fields rendered when enableHazards is on. Three controls:
     * count per region, max consecutive placement failures before
     * stopping, and wall-overlap toggle. Collected inside a single
     * container so the parent renderer can show/hide them as a unit.
     */
    _renderHazardSubFields() {
        const wrap = document.createElement('div');
        wrap.className = 'procgen-pipeline-hazard-fields';

        const countRow = document.createElement('div');
        countRow.className = 'procgen-pipeline-field';
        const countLabel = document.createElement('label');
        countLabel.textContent = 'Hazards per region';
        countLabel.title = 'Target hazard count for each region (0 disables)';
        const countInput = document.createElement('input');
        countInput.type = 'number';
        countInput.min = '0';
        countInput.step = '1';
        countInput.value = String(this.params.hazardCount ?? 0);
        countInput.addEventListener('change', () => {
            const v = Math.max(0, Math.floor(Number(countInput.value) || 0));
            this.params.hazardCount = v;
            this._saveToLocalStorage();
        });
        countRow.appendChild(countLabel);
        countRow.appendChild(countInput);
        wrap.appendChild(countRow);

        const failRow = document.createElement('div');
        failRow.className = 'procgen-pipeline-field';
        const failLabel = document.createElement('label');
        failLabel.textContent = 'Max consecutive fails';
        failLabel.title = 'Stop early after this many failed placement attempts in a row';
        const failInput = document.createElement('input');
        failInput.type = 'number';
        failInput.min = '1';
        failInput.step = '1';
        failInput.value = String(this.params.hazardMaxConsecutiveFails ?? 10);
        failInput.addEventListener('change', () => {
            const v = Math.max(1, Math.floor(Number(failInput.value) || 1));
            this.params.hazardMaxConsecutiveFails = v;
            this._saveToLocalStorage();
        });
        failRow.appendChild(failLabel);
        failRow.appendChild(failInput);
        wrap.appendChild(failRow);

        const overlapRow = document.createElement('div');
        overlapRow.className = 'procgen-pipeline-field';
        const overlapLabel = document.createElement('label');
        overlapLabel.textContent = 'Allow wall overlap';
        overlapLabel.title = 'Hazard paths may include wall tiles (still must contain ≥1 floor tile)';
        const overlapInput = document.createElement('input');
        overlapInput.type = 'checkbox';
        overlapInput.checked = !!this.params.hazardWallOverlapAllowed;
        overlapInput.addEventListener('change', () => {
            this.params.hazardWallOverlapAllowed = !!overlapInput.checked;
            this._saveToLocalStorage();
        });
        overlapRow.appendChild(overlapLabel);
        overlapRow.appendChild(overlapInput);
        wrap.appendChild(overlapRow);

        return wrap;
    }

    /**
     * Per-substrate parameter subsections inside Parameters. Each
     * substrate renders its own controls via the registry
     * `renderProcgenParams` hook (bounce — bounceProcgenParams.js);
     * maze's panel-owned params stay local for now. Substrates without
     * either render nothing. Empty selection falls back to maze —
     * matching the engine's substrate default.
     */
    _renderSubstrateParamSections() {
        const wrap = document.createElement('div');
        const localRenderers = {
            maze: () => this._renderMazeParams(),
        };
        const dict = this._activeSubstrateDict();
        let ids = Object.keys(dict).filter((id) => Number(dict[id]) > 0).sort();
        if (ids.length === 0) ids = ['maze'];
        for (const id of ids) {
            const hook = substrateRegistry.get(id)?.renderProcgenParams;
            let node = null;
            if (typeof hook === 'function') {
                node = hook({ params: this.params, onChange: () => this._saveToLocalStorage() });
            } else if (localRenderers[id]) {
                node = localRenderers[id]();
            }
            if (!node) continue;
            const header = document.createElement('div');
            header.className = 'procgen-pipeline-scenario-subheader';
            header.textContent = `${id} parameters`;
            wrap.appendChild(header);
            wrap.appendChild(node);
        }
        return wrap;
    }

    _renderMazeParams() {
        const wrap = document.createElement('div');
        // Hazard authoring (maze content modules Phase 2e). When
        // enabled, a follow-up group shows count + max-fails +
        // wall-overlap inputs. Toggle triggers re-render so the
        // sub-fields appear / disappear in place.
        const hazardRow = document.createElement('div');
        hazardRow.className = 'procgen-pipeline-field';
        const hazardLabel = document.createElement('label');
        hazardLabel.textContent = 'Enable hazards';
        hazardLabel.title = 'Procgen places hazards (2/3/5-tile linear paths or 4/8-tile loops) on every region';
        const hazardInput = document.createElement('input');
        hazardInput.type = 'checkbox';
        hazardInput.checked = !!this.params.enableHazards;
        hazardInput.addEventListener('change', () => {
            this.params.enableHazards = !!hazardInput.checked;
            this._saveToLocalStorage();
            this.render();
        });
        hazardRow.appendChild(hazardLabel);
        hazardRow.appendChild(hazardInput);
        wrap.appendChild(hazardRow);

        if (this.params.enableHazards) {
            wrap.appendChild(this._renderHazardSubFields());
        }
        return wrap;
    }

    /**
     * Persist panel state to localStorage. Called silently from every
     * change handler so a page refresh preserves the user's setup.
     * Pass `showFeedback: true` to also flash a 'Saved.' message and
     * re-render — the explicit Save Params button uses that mode;
     * per-keystroke handlers don't, to avoid render churn.
     *
     * Every save is an edit gesture, so it flips the preset drop-down
     * back to "Custom" — except saves issued BY a preset apply/save,
     * which pass `fromPreset: true` to keep their selection.
     */
    _saveToLocalStorage({ showFeedback = false, fromPreset = false } = {}) {
        if (!fromPreset) {
            this.activePresetId = null;
            // Change handlers save without re-rendering (render churn),
            // so flip the drop-down to Custom surgically.
            const sel = this.rootElement?.querySelector('.procgen-pipeline-preset-select');
            if (sel && sel.value !== '') sel.value = '';
        }
        try {
            const libraries = this._serializedLibraries();
            localStorage.setItem(LS_KEY, JSON.stringify({
                params: this.params,
                scenario: this.scenario,
                substrateMix: this.substrateMix,
                substrateQuotas: this.substrateQuotas,
                substrateMode: this.substrateMode,
                mode: this.mode,
                activePresetId: this.activePresetId,
                // Region-library selection (hybrid persistence). Omitted when
                // empty so bundles that never touch libraries stay unchanged.
                ...(libraries.length ? { libraries } : {}),
            }));
            if (showFeedback) {
                this.message = 'Saved.';
                this.render();
            }
        } catch (e) {
            this.message = `ERROR: ${e.message}`;
            this.render();
        }
    }

    _loadFromLocalStorage() {
        try {
            const s = localStorage.getItem(LS_KEY);
            if (!s) return;
            const parsed = JSON.parse(s);
            // The persisted bundle has the same shape as a preset's
            // state, so restore shares the preset normalisation path:
            // params merged over defaults, quota/mix dicts filtered to
            // registered substrates, mode/substrateMode validated.
            const next = applyPresetState(parsed, {
                defaults: this._defaultParams(),
                hasSubstrate: (id) => substrateRegistry.has(id),
                current: this,
            });
            this.params = next.params;
            this.scenario = next.scenario;
            this.substrateMix = next.substrateMix;
            this.substrateQuotas = next.substrateQuotas;
            this.substrateMode = next.substrateMode;
            this.mode = next.mode;
            this._setPersistedLibraries(next.libraries);
            // Keep the preset selection across refreshes — but only if
            // the id still resolves (the preset may have been deleted).
            this.activePresetId = getPresetById(
                parsed.activePresetId, this.userPresets,
            ) ? parsed.activePresetId : null;
        } catch (e) {
            // ignore
        }
    }

    _loadViewFromLocalStorage() {
        try {
            const s = localStorage.getItem(LS_VIEW_KEY);
            if (!s) return;
            const parsed = JSON.parse(s);
            if (typeof parsed.showUnsupportedLibrary === 'boolean') {
                this.showUnsupportedLibrary = parsed.showUnsupportedLibrary;
            }
            if (Array.isArray(parsed.collapsedSections)) {
                this.collapsedSections = new Set(parsed.collapsedSections);
            }
        } catch (e) {
            // ignore
        }
    }

    _saveViewToLocalStorage() {
        try {
            localStorage.setItem(LS_VIEW_KEY, JSON.stringify({
                showUnsupportedLibrary: this.showUnsupportedLibrary,
                collapsedSections: Array.from(this.collapsedSections),
            }));
        } catch (e) {
            // ignore
        }
    }

    // ── Region-library persistence (F3, hybrid) ─────────────────────
    // The panel's live model is this.regionLibraries (resolved docs). Persistence
    // uses the hybrid serialize/resolve helpers in regionLibraryLoader. See the
    // _pendingLibraryRefs comment in the constructor for the async-window handling.

    // The persisted `libraries` array. Before an in-flight resolve lands,
    // _pendingLibraryRefs holds the untouched refs so a save round-trips them
    // rather than clobbering with an empty regionLibraries; otherwise serialize
    // the live working docs.
    _serializedLibraries() {
        if (this._pendingLibraryRefs) return this._pendingLibraryRefs;
        return serializeLibrarySelection(this.regionLibraries);
    }

    // App-relative base for served-library fetches, mirroring presetUI's
    // './presets/…' (the app is served from /frontend/, so './' resolves against
    // the document URL to /frontend/region-libraries/…).
    _libraryBasePath() {
        return './';
    }

    // Adopt a persisted `libraries` array from a load/preset-apply: stash the raw
    // refs, blank the working list, and (if non-empty) kick the async resolve.
    _setPersistedLibraries(refs) {
        const arr = Array.isArray(refs) ? refs : [];
        this._pendingLibraryRefs = arr.length ? arr : null;
        this.regionLibraries = [];
        if (arr.length) this._resolveRegionLibraries(arr);
    }

    // Re-fetch served refs + revalidate inline ad-hoc docs into resolved working
    // entries. A newer _setPersistedLibraries (different refs identity) supersedes
    // an in-flight resolve. Drift/missing surfaces on the panel warning line.
    async _resolveRegionLibraries(refs) {
        try {
            const { resolved, errors, warnings } = await resolveLibrarySelection(refs, {
                fetchImpl: window.fetch.bind(window),
                basePath: this._libraryBasePath(),
            });
            if (this._pendingLibraryRefs !== refs) return; // superseded
            this.regionLibraries = resolved;
            this._pendingLibraryRefs = null;
            const notes = [...errors, ...warnings];
            if (notes.length) this.warning = `Region libraries: ${notes.join(' · ')}`;
            this.render();
        } catch (e) {
            if (this._pendingLibraryRefs === refs) this._pendingLibraryRefs = null;
            this.warning = `Region libraries: ${e.message}`;
            this.render();
        }
    }

    _loadWorkingLibraryFromLocalStorage() {
        try {
            const s = localStorage.getItem(LS_WORKING_LIBRARY_KEY);
            if (!s) return;
            const parsed = JSON.parse(s);
            if (parsed && Array.isArray(parsed.entries)) {
                this.workingLibrary = { entries: parsed.entries };
            }
        } catch (e) {
            // ignore
        }
    }

    _saveWorkingLibraryToLocalStorage() {
        try {
            localStorage.setItem(LS_WORKING_LIBRARY_KEY, JSON.stringify(this.workingLibrary));
        } catch (e) {
            // ignore
        }
    }
}
