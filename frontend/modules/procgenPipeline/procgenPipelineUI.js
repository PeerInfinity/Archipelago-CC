/**
 * procgenPipeline UI — two-section library picker, pipeline
 * parameters, a Generate button, a composited grid canvas, and a
 * collapsible compiled-rules JSON block.
 */

import { setPanelInstance, getModuleApis } from './index.js';
import eventBus from '../../app/core/eventBus.js';
import {
    growMaze,
    arrangeShuffledSpiral,
    buildRulesJson,
    stringifyRulesJson,
    topDownFromRulesJson,
    computeSourceCounts,
    Grid,
} from './procgenPipelineEngine.js';
import {
    TILE_WALL, getTile, getObstacle, getItem,
} from '../mazeRoom/mazeRoomEngine.js';
import {
    DEFAULT_ITEMS, DEFAULT_OBSTACLES,
    isObstacleCleared, getItemRenderHints,
} from '../shared/procgen/library.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';

const LS_KEY = 'procgenPipeline_params';
// View preferences (toggle states etc.) live under a separate key so
// they don't churn the saved scenario state on every render.
const LS_VIEW_KEY = 'procgenPipeline_view';
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
    items: { victory: 1, key_red: 2 },
    obstacles: { door_red: 2 },
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

export class ProcgenPipelineUI {
    static moduleApis = null;
    static setModuleApis(apis) { ProcgenPipelineUI.moduleApis = apis; }

    constructor(container, componentState) {
        this.container = container;
        this.params = { ...DEFAULT_PARAMS };
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
        // 'gridGrowth' (default) builds a fresh world from a scenario
        // pool. 'topDown' realises an existing rules.json as maze
        // regions on a grid.
        this.mode = 'gridGrowth';
        // Top-down's source rules.json (raw object) and a friendly
        // label used in the panel UI. null until the user picks a file
        // or copies in the currently-loaded rules.json.
        this.topDownSource = null;
        this.topDownSourceLabel = '';
        // Cache of the latest rules.json the frontend has loaded —
        // populated via stateManager:rawJsonDataLoaded. Lets the user
        // re-feed whatever's currently active without a file picker.
        this.loadedRulesJson = null;
        this.loadedRulesJsonLabel = '';
        this.result = null;
        this.isGenerating = false;
        this.message = '';

        this.rootElement = document.createElement('div');
        this.rootElement.className = 'procgen-pipeline-panel';
        setPanelInstance(this);
        this._loadFromLocalStorage();
        this._loadViewFromLocalStorage();
        // Subscribe through the raw eventBus so the panel sees raw-
        // json-loaded events even when constructed before the module's
        // initialize() has wired up apis. Same workaround the maze
        // panel uses (procgen-player.md "Substrate adapter contract:
        // addendum from the smoke test").
        const handler = (data) => {
            if (!data?.rawJsonData) return;
            this.loadedRulesJson = data.rawJsonData;
            this.loadedRulesJsonLabel = data.source || data.selectedPlayerInfo?.playerName || 'currently loaded';
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
        this.render();
    }

    get apis() { return ProcgenPipelineUI.moduleApis || getModuleApis(); }

    getRootElement() { return this.rootElement; }
    destroy() {
        if (this._unsubRawJsonLoaded) { this._unsubRawJsonLoaded(); this._unsubRawJsonLoaded = null; }
        setPanelInstance(null);
    }
    onPanelShow() { this.render(); }
    onPanelResize() {}

    render() {
        this.rootElement.innerHTML = '';
        // Mode toggle and the Generate-button row stay unwrapped — they
        // anchor the panel and shouldn't be foldable. Everything else
        // is wrapped in an accordion section so users can hide
        // sections they aren't actively using. Per-section state lives
        // in this.collapsedSections.
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

        // Quick path: use whatever rules.json the frontend currently
        // has loaded (via Presets panel or ?game= URL). Disabled
        // until a stateManager:rawJsonDataLoaded event has populated
        // our cache.
        const useLoadedBtn = this._btn('Use currently-loaded rules.json', () => {
            if (!this.loadedRulesJson) return;
            this.topDownSource = this.loadedRulesJson;
            this.topDownSourceLabel = `loaded (${this.loadedRulesJsonLabel})`;
            this._applyGridDimsFromSource(this.loadedRulesJson);
            this.message = `Using currently-loaded rules.json`;
            this.render();
        });
        if (!this.loadedRulesJson) {
            useLoadedBtn.disabled = true;
            useLoadedBtn.title = 'Load any preset (Presets panel) or open a ?game= URL first.';
        }
        row.appendChild(useLoadedBtn);

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
                this.result = null;
                this.message = '';
                this.render();
            });
            row.appendChild(clearBtn);
        }

        section.appendChild(row);
        return section;
    }

    // --- Scenario pool picker ---

    _renderScenarioPicker() {
        const section = document.createElement('div');
        section.className = 'procgen-pipeline-scenario';
        // Title supplied by the collapsible wrapper in render().

        // Top: Substrates (always visible — every mode needs them).
        section.appendChild(this._renderSubstratesSubsection());

        // Bottom: Library + Counts. Shown for the two modes that
        // build regions from a scenario pool. Top-down's items come
        // from its source rules.json, not the pool, so it skips.
        if (this.mode === 'gridGrowth' || this.mode === 'shuffledSpiral') {
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

        // Start-substrate dropdown — applies to both pool-building
        // modes. 'auto' delegates to pickSubstrate (weighted-by-mix
        // or weighted-by-remaining-quota) in grid-growth, and lets
        // the shuffle choose in shuffled-spiral.
        if (this.mode === 'gridGrowth' || this.mode === 'shuffledSpiral') {
            wrap.appendChild(this._renderStartSubstrateRow());
        }

        return wrap;
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
        // Shuffled-spiral always uses fixed per-substrate counts; the
        // mix dict is meaningless there. Grid-growth honors the mode
        // toggle. Top-down (no toggle) keeps the legacy mix dict.
        if (this.mode === 'shuffledSpiral') return this.substrateQuotas;
        if (this.mode === 'gridGrowth' && this.substrateMode === 'quotas') {
            return this.substrateQuotas;
        }
        return this.substrateMix;
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
            ...Object.entries(DEFAULT_ITEMS).map(([id, def]) => ({ id, def, kind: 'item' })),
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
        // but shuffled-spiral auto-sizes the grid from the quotas
        // sum — hide the inputs in that mode so the user isn't led
        // to think they take effect.
        const showGridDims = this.mode !== 'shuffledSpiral';
        const fields = [
            { key: 'seed',              label: 'Seed',             min: 0 },
            ...(showGridDims ? [
                { key: 'gridWidth',     label: 'Grid width',       min: 1, max: 10 },
                { key: 'gridHeight',    label: 'Grid height',      min: 1, max: 10 },
            ] : []),
            { key: 'regionWidth',       label: 'Region width',     min: 2, max: 40 },
            { key: 'regionHeight',      label: 'Region height',    min: 2, max: 40 },
            { key: 'maxItemsPerRegion', label: 'Max items/region', min: 0, max: 10 },
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
            input.addEventListener('change', () => {
                if (input.value === '' && f.nullable) {
                    this.params[f.key] = null;
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

        // Hazard authoring (maze content modules Phase 2e). Same row
        // pattern as the loop-mode toggle. When enabled, a follow-up
        // group shows count + max-fails + wall-overlap inputs. Toggle
        // triggers re-render so the sub-fields appear / disappear in
        // place.
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
        section.appendChild(hazardRow);

        if (this.params.enableHazards) {
            section.appendChild(this._renderHazardSubFields());
        }

        const btnRow = document.createElement('div');
        btnRow.className = 'procgen-pipeline-btn-row';
        const saveBtn = this._btn('Save Params', () => this._saveToLocalStorage({ showFeedback: true }));
        const loadBtn = this._btn('Load Params', () => { this._loadFromLocalStorage(); this.render(); });
        const resetBtn = this._btn('Reset Defaults', () => {
            this.params = { ...DEFAULT_PARAMS };
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
        const gen = document.createElement('button');
        gen.className = 'procgen-pipeline-btn procgen-pipeline-btn-primary';
        gen.textContent = this.isGenerating ? 'Generating…' : 'Generate';
        gen.disabled = this.isGenerating;
        gen.addEventListener('click', () => this._runGeneration());
        section.appendChild(gen);

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
            const downloadBtn = this._btn('Download rules.json', (e) => {
                e.preventDefault();
                this._downloadText(json, filename);
            });
            const copyBtn = this._btn('Copy JSON', (e) => {
                e.preventDefault();
                this._copyToClipboard(json, copyBtn);
            });
            section.appendChild(loadBtn);
            section.appendChild(downloadBtn);
            section.appendChild(copyBtn);
        }

        if (this.message) {
            const msg = document.createElement('span');
            msg.className = 'procgen-pipeline-message';
            msg.textContent = this.message;
            section.appendChild(msg);
        }
        return section;
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
        if (!this.result) {
            const hint = document.createElement('div');
            hint.className = 'procgen-pipeline-hint';
            hint.textContent = 'Click Generate to run the pipeline.';
            section.appendChild(hint);
            return section;
        }
        const { grid, regionSize } = this.result;
        const canvas = document.createElement('canvas');
        canvas.className = 'procgen-pipeline-canvas';
        canvas.width = grid.width * regionSize.width * TILE_PX;
        canvas.height = grid.height * regionSize.height * TILE_PX;
        this._drawGrid(canvas, grid, regionSize);
        section.appendChild(canvas);
        return section;
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
    }

    _drawRegion(ctx, region, offX, offY, regionSize) {
        const hint = region?.render_hint ?? region?.substrate ?? 'maze';
        const payload = region?.playable_payload;
        if (hint === 'text_adventure') {
            this._drawTextAdventureRegion(ctx, region, offX, offY, regionSize);
        } else if (hint === 'maze') {
            this._drawMazeRegion(ctx, payload, offX, offY);
        } else {
            this._drawGenericRegion(ctx, region, offX, offY, regionSize);
        }
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

        const exits = region?.playable_payload?.exits ?? [];
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

    _loadIntoFrontend(rulesJson, button) {
        const restore = () => { button.textContent = 'Load into frontend'; };
        const eventBus = this.apis?.eventBus;
        if (!eventBus || typeof eventBus.publish !== 'function') {
            button.textContent = 'No eventBus';
            setTimeout(restore, 1500);
            return;
        }
        // Matches the editor's Apply flow — same event name, same payload shape.
        eventBus.publish('files:jsonLoaded', {
            jsonData: rulesJson,
            selectedPlayerId: '1',
            sourceName: 'procgenPipeline',
        });
        button.textContent = 'Loaded';
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

    _runGeneration() {
        if (this.isGenerating) return;
        if (this.mode === 'topDown' && !this.topDownSource) {
            this.message = 'Pick a source rules.json first.';
            this.render();
            return;
        }
        this.isGenerating = true;
        this.message = '';
        this.result = null;
        this.render();

        try {
            if (this.mode === 'topDown') {
                this._runTopDown();
            } else if (this.mode === 'shuffledSpiral') {
                this._runShuffledSpiral();
            } else {
                this._runGridGrowth();
            }
        } catch (e) {
            this.message = `ERROR: ${e.message}`;
        }

        this.isGenerating = false;
        this.render();
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
        // First scenario item whose lib def is `is_victory: true` with
        // a positive count becomes the auto-completion-condition item.
        // Opt-out: drop all such items from the scenario's item pool.
        const victoryItemId = Object.entries(this.scenario.items)
            .find(([id, count]) => count > 0 && DEFAULT_ITEMS[id]?.is_victory)?.[0]
            ?? null;
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

    _runShuffledSpiral() {
        const { seed, regionWidth, regionHeight, maxItemsPerRegion,
            startSubstrate } = this.params;
        const quotas = this._effectiveSubstrateQuotas();
        if (!quotas) {
            throw new Error('shuffled-spiral requires at least one substrate '
                + 'with a positive quota (set Substrate allocation to Quotas)');
        }
        const { grid, pool, stats, startCell } = arrangeShuffledSpiral({
            regionSize: { width: regionWidth, height: regionHeight },
            itemPool: { ...this.scenario.items },
            obstaclePool: { ...this.scenario.obstacles },
            seed,
            regionParams: {},
            growthParams: {
                substrateQuotas: quotas,
                maxItemsPerRegion,
                ...(startSubstrate && startSubstrate !== 'auto'
                    ? { startSubstrate } : {}),
            },
            hazardOpts: this._effectiveHazardOpts(),
        });
        const victoryItemId = Object.entries(this.scenario.items)
            .find(([id, count]) => count > 0 && DEFAULT_ITEMS[id]?.is_victory)?.[0]
            ?? null;
        const rulesJson = buildRulesJson(grid, {
            startCell, seed,
            enableLoopMode: !!this.params.enableLoopMode,
            regionXpEffect: this.params.regionXpEffect ?? 'cost',
            completionConditionItem: victoryItemId,
            procgenMetadata: {
                driver: 'shuffled-spiral',
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

    _runTopDown() {
        const { seed, gridWidth, gridHeight, regionWidth, regionHeight } = this.params;
        const mix = this._effectiveSubstrateMix();
        const { grid, stats, startCell } = topDownFromRulesJson(this.topDownSource, {
            gridDims: { width: gridWidth, height: gridHeight },
            regionSizeBase: { width: regionWidth, height: regionHeight },
            seed,
            ...(mix ? { substrateMix: mix } : {}),
            hazardOpts: this._effectiveHazardOpts(),
        });
        const rulesJson = buildRulesJson(grid, {
            startCell, seed,
            enableLoopMode: !!this.params.enableLoopMode,
            regionXpEffect: this.params.regionXpEffect ?? 'cost',
            assumeBidirectional: this.topDownSource.assume_bidirectional_exits !== false,
            startingItems: this.topDownSource?.starting_items?.['1'] ?? [],
            sourceItems: this.topDownSource?.items?.['1'] ?? null,
            procgenMetadata: {
                driver: 'top-down',
                source_game: this.topDownSource?.game_name ?? null,
                source_counts: computeSourceCounts(this.topDownSource, '1'),
                stop_reason: stats.stopReason,
            },
        });
        this.result = {
            grid,
            regionSize: { width: regionWidth, height: regionHeight },
            stats,
            // No pool in top-down mode — keep the field present so the
            // stats renderer can branch cleanly.
            poolRemaining: null,
            rulesJson,
        };
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
     * Persist panel state to localStorage. Called silently from every
     * change handler so a page refresh preserves the user's setup.
     * Pass `showFeedback: true` to also flash a 'Saved.' message and
     * re-render — the explicit Save Params button uses that mode;
     * per-keystroke handlers don't, to avoid render churn.
     */
    _saveToLocalStorage({ showFeedback = false } = {}) {
        try {
            localStorage.setItem(LS_KEY, JSON.stringify({
                params: this.params,
                scenario: this.scenario,
                substrateMix: this.substrateMix,
                substrateQuotas: this.substrateQuotas,
                substrateMode: this.substrateMode,
                mode: this.mode,
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
            if (parsed.params) this.params = { ...DEFAULT_PARAMS, ...parsed.params };
            if (parsed.scenario) {
                this.scenario = {
                    items: { ...(parsed.scenario.items ?? {}) },
                    obstacles: { ...(parsed.scenario.obstacles ?? {}) },
                };
            }
            // Drop entries for substrates that aren't currently
            // registered (e.g. saved before a substrate module was
            // removed). Same filter for mix and quotas dicts.
            const filterDict = (raw) => {
                const out = {};
                if (raw && typeof raw === 'object') {
                    for (const [id, v] of Object.entries(raw)) {
                        if (substrateRegistry.has(id) && v > 0) out[id] = v;
                    }
                }
                return out;
            };
            this.substrateMix = filterDict(parsed.substrateMix);
            this.substrateQuotas = filterDict(parsed.substrateQuotas);
            if (parsed.substrateMode === 'quotas' || parsed.substrateMode === 'mix') {
                this.substrateMode = parsed.substrateMode;
            }
            if (parsed.mode === 'gridGrowth' || parsed.mode === 'topDown'
                    || parsed.mode === 'shuffledSpiral') {
                this.mode = parsed.mode;
            }
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
}
