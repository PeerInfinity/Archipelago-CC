import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js';
import { getModuleEventBus } from './index.js';
import { DEFAULT_PLAYER_ID } from '../shared/playerIdUtils.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';

const DEV_INDEX_PATH = './presets/preset_files.json';
const LIVE_INDEX_PATH = './presets/preset_files.live.json';

// Toolbar state — persisted to localStorage so the user's filters
// survive a panel close/reopen. See NewDocs/plans/presets-panel-
// overhaul.md §"Search / sort / filter".
const TOOLBAR_LS_KEY = 'presetUI_toolbar';
// View preferences for the detail view (chart toggle, etc.).
// Separate from the toolbar so a chart-toggle render doesn't churn
// the toolbar persistence.
const VIEW_LS_KEY = 'presetUI_view';
const DEFAULT_VIEW_STATE = Object.freeze({
    showSphereLog: false,
});
const DEFAULT_TOOLBAR_STATE = Object.freeze({
    query: '',
    // 'index' = preserve the order entries appear in preset_files.json
    // (the file's hand-authored / generator-emitted order). Default
    // because the user curates the index intentionally.
    sortKey: 'index',
    filters: {
        testStatus: 'any',     // any | passing | failing | unknown
        worldType: 'any',      // any | original | worldgen | vanilla | multiworld
        hasSphereLog: 'either',// either | yes | no
        hasProcgenData: 'either',
    },
});

// All custom CSS for the preset panel. Injected once into <head> by
// _ensureStylesInjected (called from every render path). Originally
// this lived inline in renderGamesList's HTML, but the detail view's
// container.innerHTML = ... wiped the <style> child every time the
// user clicked into a preset, which left the detail view rendered
// with browser defaults. The bug surfaced when the sphere-log chart's
// flex layout broke without its CSS.
const PRESET_STYLES_ID = 'presetUI-styles';
const PRESET_STYLES = `
.presets-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    align-items: center;
    margin: 8px 0 12px;
    padding: 8px 12px;
    background-color: rgba(0, 0, 0, 0.15);
    border-radius: 6px;
    font-size: 0.9em;
    color: #ccc;
}
.presets-toolbar label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}
.presets-toolbar-search {
    flex: 1 1 200px;
    min-width: 160px;
    padding: 4px 8px;
    background-color: rgba(0, 0, 0, 0.3);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
}
.presets-toolbar select {
    padding: 3px 6px;
    background-color: rgba(0, 0, 0, 0.3);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
}
.presets-container {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 16px;
}
.game-row {
    background-color: rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    padding: 16px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
}
.game-name {
    margin: 0;
    color: #ddd;
    min-width: 200px;
    flex-shrink: 0;
}
.game-row-header {
    background-color: rgba(0, 0, 0, 0.3);
    border-bottom: 2px solid rgba(255, 255, 255, 0.2);
    padding: 8px 16px;
    font-weight: 600;
    color: #aaa;
    font-size: 0.85em;
    flex-wrap: nowrap;
}
.game-name-header {
    min-width: 200px;
    flex-shrink: 0;
}
.game-presets-header {
    flex: 1;
    text-align: center;
}
.test-headers {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
}
.test-header {
    width: 24px;
    text-align: center;
    cursor: help;
}
.test-badges-container {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
    margin-left: auto;
}
.test-badge-mini {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    cursor: help;
}
.test-badge-mini.test-badge-passed {
    background-color: rgba(76, 175, 80, 0.2);
    border: 1px solid rgba(76, 175, 80, 0.5);
    color: #a5d6a7;
}
.test-badge-mini.test-badge-failed {
    background-color: rgba(244, 67, 54, 0.2);
    border: 1px solid rgba(244, 67, 54, 0.5);
    color: #ef9a9a;
}
.test-badge-mini.test-badge-unknown {
    background-color: rgba(158, 158, 158, 0.2);
    border: 1px solid rgba(158, 158, 158, 0.5);
    color: #bdbdbd;
}
.test-icon-mini {
    font-size: 0.9em;
}
.game-presets {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    flex: 1 1 auto;
    align-items: center;
}
.preset-button {
    background-color: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: white;
    cursor: pointer;
    padding: 10px 15px;
    text-align: center;
    transition: background-color 0.2s;
}
.preset-button:hover {
    background-color: rgba(0, 0, 0, 0.5);
}
.preset-info {
    background-color: rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
}
.preset-files {
    margin-top: 16px;
}
.file-links-container {
    background-color: #111;
    border-radius: 6px;
    padding: 12px;
    margin-top: 10px;
    border: 1px solid #333;
}
.preset-file-link {
    display: block;
    margin: 8px 0;
    color: #4da6ff;
    text-decoration: underline;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
}
.preset-file-link:hover {
    color: #80c3ff;
    background-color: #222;
}
.back-button {
    background-color: #444;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    margin-bottom: 16px;
}
.back-button:hover {
    background-color: #555;
}
.preset-detail-header {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    margin-bottom: 16px;
}
.preset-detail-header .back-button {
    margin-bottom: 0;
}
.preset-detail-nav {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}
.preset-nav-btn {
    background-color: #333;
    color: #ddd;
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 6px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9em;
}
.preset-nav-btn:hover:not([disabled]) {
    background-color: #444;
    color: white;
}
.preset-nav-btn[disabled] {
    opacity: 0.4;
    cursor: not-allowed;
}
.preset-sphere-section {
    margin-top: 16px;
    padding: 12px;
    background-color: rgba(0, 0, 0, 0.1);
    border-radius: 6px;
}
.preset-sphere-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.95em;
    color: #ccc;
    cursor: pointer;
    user-select: none;
}
.preset-sphere-chart {
    margin-top: 8px;
    max-height: 320px;
    overflow-y: auto;
    font-family: 'Consolas', monospace;
}
.preset-sphere-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 0;
    font-size: 0.85em;
    color: #ddd;
}
.preset-sphere-row.preset-sphere-header {
    color: #888;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 4px;
    margin-bottom: 4px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.4px;
}
.preset-sphere-cell-num {
    width: 60px;
    text-align: right;
    flex-shrink: 0;
}
.preset-sphere-cell-count {
    width: 50px;
    text-align: right;
    flex-shrink: 0;
    color: #aaa;
}
.preset-sphere-cell-bar {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    display: flex;
    gap: 2px;
    white-space: nowrap;
}
.preset-sphere-tile {
    display: inline-block;
    width: 10px;
    height: 14px;
    background-color: #4da6ff;
    border-radius: 1px;
    flex-shrink: 0;
}
.preset-sphere-tile-enriched {
    cursor: pointer;
}
.preset-sphere-tile-enriched:hover {
    outline: 1px solid #fff;
    outline-offset: 1px;
}
.preset-sphere-tile-completed {
    background-color: #6abf6a;
}
.preset-sphere-tile-current {
    background-color: #ffb84d;
}
.preset-sphere-tile-future {
    background-color: #4da6ff;
}
.preset-sphere-empty {
    color: #888;
    font-style: italic;
    padding: 6px 0;
    font-size: 0.9em;
}
.preset-procgen-section {
    margin-top: 16px;
}
.preset-procgen-section:empty {
    margin-top: 0;
}
.preset-procgen-title {
    margin: 8px 0 4px;
    color: #ddd;
    padding: 8px 12px;
    background-color: rgba(80, 130, 180, 0.2);
    border-left: 3px solid rgba(80, 130, 180, 0.6);
    border-radius: 4px;
}
.preset-procgen-subtitle {
    margin: 12px 0 6px;
    color: #ccc;
    font-size: 0.95em;
}
.preset-procgen-summary {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 4px 16px;
    padding: 8px 12px;
    background-color: rgba(0, 0, 0, 0.1);
    border-radius: 4px;
    font-size: 0.9em;
    color: #ccc;
}
.preset-procgen-summary strong {
    color: #aaa;
    margin-right: 4px;
    font-weight: 500;
}
.preset-procgen-stop-ok {
    color: #a5d6a7;
}
.preset-procgen-stop-warn {
    color: #ffcc80;
}
.preset-procgen-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85em;
    margin-top: 4px;
}
.preset-procgen-table th,
.preset-procgen-table td {
    text-align: left;
    padding: 4px 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.preset-procgen-table th {
    color: #888;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.85em;
    letter-spacing: 0.4px;
    background-color: rgba(0, 0, 0, 0.2);
}
.preset-procgen-table tr:hover td {
    background-color: rgba(255, 255, 255, 0.03);
}
.error-message {
    background-color: rgba(244, 67, 54, 0.1);
    border-left: 3px solid #f44336;
    padding: 16px;
    border-radius: 4px;
    margin-top: 16px;
}
.success-message {
    background-color: rgba(76, 175, 80, 0.1);
    border-left: 3px solid #4CAF50;
    padding: 8px 16px;
    border-radius: 4px;
    margin: 8px 0;
}
.multiworld-seeds {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
}
.multiworld-seed-block {
    background-color: rgba(0, 0, 0, 0.2);
    padding: 10px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
}
.seed-number {
    font-weight: bold;
    color: #ccc;
    margin-bottom: 8px;
    display: block;
}
.seed-players {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.player-info {
    display: flex;
    align-items: center;
    gap: 8px;
}
.preset-player-button {
    background-color: rgba(50, 100, 150, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    color: white;
    cursor: pointer;
    padding: 5px 10px;
    text-align: center;
    transition: background-color 0.2s;
    min-width: 40px;
}
.preset-player-button:hover {
    background-color: rgba(70, 120, 170, 0.9);
}
.player-details {
    font-size: 0.9em;
    color: #bbb;
}
.multiworld-container {
    background-color: rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
}
.placement-badge {
    display: inline-block;
    font-size: 0.65em;
    font-weight: 700;
    padding: 1px 4px;
    border-radius: 3px;
    margin-left: 6px;
    vertical-align: middle;
    line-height: 1;
}
.placement-vanilla {
    background-color: rgba(156, 39, 176, 0.3);
    border: 1px solid rgba(156, 39, 176, 0.6);
    color: #ce93d8;
}
`;

/**
 * Filter the presets index by the toolbar's query and filter
 * settings, then sort the surviving entries by the toolbar's sort
 * key. Pure for testability — no DOM, no localStorage.
 *
 * Input:
 *   presets — the full preset_files.json object (gameDirectory → gameData).
 *   toolbarState — { query, sortKey, filters }.
 *
 * Output:
 *   Array of [gameDirectory, gameData] tuples in render order. The
 *   'metadata' top-level key is dropped automatically.
 *
 * The downstream renderer groups these by gameData.name (so directories
 * sharing a display name appear under one row); filtering and sorting
 * happen pre-grouping.
 */
export function filterAndSortPresets(presets, toolbarState = DEFAULT_TOOLBAR_STATE) {
    if (!presets) return [];
    const state = { ...DEFAULT_TOOLBAR_STATE, ...toolbarState,
        filters: { ...DEFAULT_TOOLBAR_STATE.filters, ...(toolbarState?.filters ?? {}) } };
    const entries = Object.entries(presets).filter(([k]) => k !== 'metadata');
    const filtered = entries.filter((e) =>
        entryMatchesQuery(e, state.query) && entryMatchesFilters(e, state.filters));
    return filtered.slice().sort((a, b) => comparePresetEntries(a, b, state.sortKey));
}

function entryMatchesQuery(entry, query) {
    if (!query) return true;
    const [gameDirectory, gameData] = entry;
    const q = query.toLowerCase();
    const name = (gameData?.name ?? '').toLowerCase();
    const dir = (gameDirectory ?? '').toLowerCase();
    return name.includes(q) || dir.includes(q);
}

function folderHasSphereLog(folder) {
    return (folder?.files ?? []).some((f) => f.endsWith('_sphere_log.jsonl'));
}

function entryMatchesFilters(entry, filters) {
    const [gameDirectory, gameData] = entry;
    const folders = Object.values(gameData?.folders ?? {});

    // Test status — based on the gameData.test_results map.
    if (filters.testStatus !== 'any') {
        const tr = gameData?.test_results;
        const results = tr ? Object.values(tr).filter(Boolean) : [];
        const anyPassed = results.some((r) => r.passed === true);
        const anyFailed = results.some((r) => r.passed === false);
        if (filters.testStatus === 'passing' && !anyPassed) return false;
        if (filters.testStatus === 'failing' && !anyFailed) return false;
        if (filters.testStatus === 'unknown' && (anyPassed || anyFailed)) return false;
    }

    // World type — directory suffix-based, except 'multiworld' which
    // is the literal directory name. 'original' = no suffix.
    if (filters.worldType !== 'any') {
        const dir = gameDirectory ?? '';
        const isWorldgen = dir.includes('_worldgen');
        const isVanilla = dir.includes('_vanilla');
        const isMultiworld = dir === 'multiworld';
        if (filters.worldType === 'worldgen' && !isWorldgen) return false;
        if (filters.worldType === 'vanilla' && !isVanilla) return false;
        if (filters.worldType === 'multiworld' && !isMultiworld) return false;
        if (filters.worldType === 'original'
            && (isWorldgen || isVanilla || isMultiworld)) return false;
    }

    // Has sphere log — at least one folder has a *_sphere_log.jsonl file.
    if (filters.hasSphereLog !== 'either') {
        const has = folders.some(folderHasSphereLog);
        if (filters.hasSphereLog === 'yes' && !has) return false;
        if (filters.hasSphereLog === 'no' && has) return false;
    }

    // Has procgen data — at least one folder has has_procgen_data === true.
    if (filters.hasProcgenData !== 'either') {
        const has = folders.some((f) => f?.has_procgen_data === true);
        if (filters.hasProcgenData === 'yes' && !has) return false;
        if (filters.hasProcgenData === 'no' && has) return false;
    }

    return true;
}

function seedCount(data) {
    return Object.keys(data?.folders ?? {}).length;
}

function testPassCount(data) {
    const tr = data?.test_results;
    if (!tr) return 0;
    return Object.values(tr).filter((r) => r?.passed === true).length;
}

/**
 * Compute procgen-specific stats for a loaded rules.json. Pure for
 * testability. Returns null when the rules.json carries no procgen
 * data (i.e. no preset_sidecars), signalling the renderer to skip
 * the entire procgen section.
 *
 * Output shape:
 *   {
 *     driver,           // 'top-down' | 'grid-growth' | null (older outputs)
 *     sourceGame,       // top-down only
 *     sourceCounts,     // top-down only — { regions, locations, exits, logic_gates }
 *     stopReason,
 *     gridDims,         // { width, height } or null
 *     regionCount,
 *     substrateCounts,  // { [substrateId]: count }
 *     regions,          // [{ name, substrate, exits, locations, width, height, density }]
 *     totalLogicGates,  // count of clear_set_type='rule' obstacles
 *     outputCounts,     // { regions, locations, exits, logic_gates }
 *   }
 *
 * Per-region "exits" excludes back-exits and teleporters (those don't
 * represent additional connections from the source's perspective —
 * they're inverse-direction pairs / cross-grid jumps). Locations are
 * counted as items that carry an AP-canonical locationName.
 *
 * See NewDocs/plans/presets-panel-overhaul.md §"Procgen-specific
 * stats".
 */
export function computeProcgenStats(rulesData, playerId = '1') {
    if (!rulesData?.preset_sidecars) return null;
    const sidecars = rulesData.preset_sidecars[playerId];
    if (!sidecars || Object.keys(sidecars).length === 0) return null;

    const meta = rulesData.procgen_metadata ?? {};
    const substrateCounts = {};
    const regions = [];
    let totalLogicGates = 0;

    for (const [name, entry] of Object.entries(sidecars)) {
        const substrate = entry?.substrate ?? 'unknown';
        substrateCounts[substrate] = (substrateCounts[substrate] ?? 0) + 1;

        const pp = entry?.playable_payload ?? {};
        const exitList = Array.isArray(pp.exits) ? pp.exits : [];
        const exits = exitList.filter((e) => !e?.isBackExit && !e?.isTeleporter).length;
        const itemList = Array.isArray(pp.items) ? pp.items : [];
        const locations = itemList.filter((i) => i?.locationName).length;
        const width = Number.isFinite(pp.width) ? pp.width : 0;
        const height = Number.isFinite(pp.height) ? pp.height : 0;
        const area = width * height;
        const density = area > 0 ? (exits + locations) / area : 0;
        regions.push({ name, substrate, exits, locations, width, height, density });

        const obstacleLib = pp.obstacleLib ?? {};
        for (const def of Object.values(obstacleLib)) {
            if (def?.clear_set_type === 'rule') totalLogicGates += 1;
        }
    }

    return {
        driver: meta.driver ?? null,
        sourceGame: meta.source_game ?? null,
        sourceCounts: meta.source_counts ?? null,
        stopReason: meta.stop_reason ?? null,
        gridDims: meta.grid_dims ?? null,
        regionCount: regions.length,
        substrateCounts,
        regions,
        totalLogicGates,
        outputCounts: {
            regions: regions.length,
            locations: regions.reduce((s, r) => s + r.locations, 0),
            exits: regions.reduce((s, r) => s + r.exits, 0),
            logic_gates: totalLogicGates,
        },
    };
}

/**
 * Parse a sphere log JSONL file's contents and return an ordered array
 * of `{ integerSphere, fractionalCount, sphereIndices }` entries, one
 * per integer sphere that appeared. Pure for testability.
 *
 * Each input line is JSON; one line is metadata, the rest are
 * state_update lines with a `sphere_index` string of shape `"<int>"`
 * or `"<int>.<sub>"`. Lines with malformed or missing sphere_index
 * are silently skipped.
 *
 * Output is sorted ascending by integerSphere. Integer spheres with
 * zero count are NOT emitted (the chart skips empty rows rather than
 * leaving gaps).
 *
 * `sphereIndices` is the sequence of raw sphere_index strings that
 * fell into this integer bucket, in JSONL order. Used to address
 * individual fractional cells in the chart for tooltip / click
 * targeting.
 *
 * See NewDocs/plans/presets-panel-overhaul.md §"Sphere log shape
 * chart" for the rendering contract this feeds.
 */
export function parseSphereLogShape(jsonlText) {
    if (!jsonlText) return [];
    const indicesByInt = new Map();
    for (const rawLine of jsonlText.split('\n')) {
        const line = rawLine.trim();
        if (!line) continue;
        let parsed;
        try { parsed = JSON.parse(line); } catch (e) { continue; }
        if (parsed?.type !== 'state_update') continue;
        const sphereIndex = parsed.sphere_index;
        if (typeof sphereIndex !== 'string') continue;
        const intPart = sphereIndex.split('.')[0];
        const intSphere = Number.parseInt(intPart, 10);
        if (!Number.isFinite(intSphere)) continue;
        if (!indicesByInt.has(intSphere)) indicesByInt.set(intSphere, []);
        indicesByInt.get(intSphere).push(sphereIndex);
    }
    return [...indicesByInt.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([integerSphere, sphereIndices]) => ({
            integerSphere,
            fractionalCount: sphereIndices.length,
            sphereIndices,
        }));
}

/**
 * Build a per-fractional-sphere enrichment map from sphereState's
 * sphere data. Pure for testability.
 *
 * Input: an array of sphere entries as returned by
 * sphereState.getSphereData() — each `{ sphereIndex, integerSphere,
 * fractionalSphere, locations, ... }`.
 *
 * Output: a Map keyed by sphereIndex string ('0.1' etc.) with values
 * { sphereIndex, locations: string[], status: 'completed' | 'current'
 * | 'future' | 'unknown' }.
 *
 * `currentSphere` is sphereState's current sphere (`{ integerSphere,
 * fractionalSphere }`). When provided, every entry's status is
 * computed by comparing index ordering to the current. `checkedLocations`
 * is the player's checked-locations Set; sphere is "completed" when
 * all its locations are checked. When neither is supplied, status is
 * 'unknown'.
 *
 * Used by the presetUI sphere log chart to build tooltip + click
 * data after sphereState publishes dataLoaded.
 */
export function buildSphereEnrichment(sphereData, opts = {}) {
    const map = new Map();
    if (!Array.isArray(sphereData)) return map;
    const { currentSphere = null, checkedLocations = null } = opts;
    const cur = currentSphere
        ? [currentSphere.integerSphere ?? 0, currentSphere.fractionalSphere ?? 0]
        : null;
    for (const sphere of sphereData) {
        const sphereIndex = sphere?.sphereIndex;
        if (typeof sphereIndex !== 'string') continue;
        const locations = Array.isArray(sphere.locations) ? sphere.locations : [];
        let status = 'unknown';
        if (cur) {
            const here = [sphere.integerSphere ?? 0, sphere.fractionalSphere ?? 0];
            const cmp = here[0] !== cur[0] ? here[0] - cur[0] : here[1] - cur[1];
            if (cmp < 0) status = 'completed';
            else if (cmp === 0) status = 'current';
            else status = 'future';
        }
        // Refine "completed" when we have checked-location truth: all
        // locations checked → completed; some unchecked → demote.
        if (checkedLocations && locations.length > 0) {
            const allChecked = locations.every((loc) => checkedLocations.has(loc));
            if (status === 'completed' && !allChecked) status = 'current';
            else if (status === 'current' && allChecked) status = 'completed';
        }
        map.set(sphereIndex, { sphereIndex, locations, status });
    }
    return map;
}

/**
 * Compute next/previous navigation targets for the detail view, based
 * on the games-list's current ordering. Pure for testability.
 *
 * Inputs:
 *   tuples — Array of { gameDirectory, seedName, playerId } in the
 *     order produced by the most recent renderGamesList call.
 *   presets — The full preset_files.json (used to look up display names).
 *   selected — { gameDirectory, seedName, playerId } identifying the
 *     currently-loaded preset.
 *
 * Returns { prevGame, prevSeed, nextSeed, nextGame } where each value
 * is either null or a tuple-with-label `{ gameDirectory, seedName,
 * playerId, label }`. label is the display name of the target game,
 * used in button tooltips.
 *
 * Game-level nav (prevGame/nextGame) jumps to the FIRST tuple of the
 * adjacent display-name group. Seed-level nav (prevSeed/nextSeed)
 * stays within the same gameDirectory.
 *
 * See NewDocs/plans/presets-panel-overhaul.md §"Next / previous
 * buttons".
 */
export function computeDetailNav(tuples, presets, selected) {
    const result = { prevGame: null, prevSeed: null, nextSeed: null, nextGame: null };
    if (!Array.isArray(tuples) || tuples.length === 0 || !selected) return result;

    const gameNameOf = (gameDirectory) => presets?.[gameDirectory]?.name ?? gameDirectory;
    const tagged = tuples.map((t) => ({ ...t, label: gameNameOf(t.gameDirectory) }));

    const idx = tagged.findIndex((t) =>
        t.gameDirectory === selected.gameDirectory
        && t.seedName === selected.seedName
        && (t.playerId ?? null) === (selected.playerId ?? null));
    if (idx === -1) return result;
    const current = tagged[idx];

    // Seed-level nav: previous/next tuple within the same gameDirectory.
    for (let i = idx - 1; i >= 0; i -= 1) {
        if (tagged[i].gameDirectory === current.gameDirectory) {
            result.prevSeed = tagged[i];
            break;
        }
        // Different gameDirectory — but could be the same display name
        // (e.g. alttp vs alttp_vanilla). Stop; "prev seed" is per
        // gameDirectory, not per display name.
        break;
    }
    for (let i = idx + 1; i < tagged.length; i += 1) {
        if (tagged[i].gameDirectory === current.gameDirectory) {
            result.nextSeed = tagged[i];
            break;
        }
        break;
    }

    // Game-level nav: previous/next display-name group's first tuple.
    // Display-name groups can span multiple gameDirectories; we walk
    // back to the start of the current group, then one step before
    // that is the LAST tuple of the previous group, and the first
    // tuple in that group is what we want.
    const groupStart = (i) => {
        let j = i;
        while (j > 0 && tagged[j - 1].label === tagged[j].label) j -= 1;
        return j;
    };
    const groupEnd = (i) => {
        let j = i;
        while (j + 1 < tagged.length && tagged[j + 1].label === tagged[j].label) j += 1;
        return j;
    };
    const myStart = groupStart(idx);
    if (myStart > 0) {
        const prevGroupEnd = myStart - 1;
        result.prevGame = tagged[groupStart(prevGroupEnd)];
    }
    const myEnd = groupEnd(idx);
    if (myEnd + 1 < tagged.length) {
        result.nextGame = tagged[myEnd + 1];
    }

    return result;
}

function comparePresetEntries(a, b, sortKey) {
    const [, aData] = a;
    const [, bData] = b;
    switch (sortKey) {
        case 'name':
            return (aData?.name ?? '').localeCompare(bData?.name ?? '');
        case 'seedCount':
            // Most seeds first; tiebreaker: name A→Z.
            return seedCount(bData) - seedCount(aData)
                || (aData?.name ?? '').localeCompare(bData?.name ?? '');
        case 'testPassCount':
            // Most passing tests first; tiebreaker: name A→Z.
            return testPassCount(bData) - testPassCount(aData)
                || (aData?.name ?? '').localeCompare(bData?.name ?? '');
        case 'index':
        default:
            // Preserve Object.entries insertion order. Array.prototype.sort
            // is stable in modern JS, so returning 0 keeps the input
            // ordering intact.
            return 0;
    }
}

/**
 * Decide which preset index file to load. Pure for testability.
 *
 * Selection order:
 *   1. ?index=live / ?index=dev URL override wins.
 *   2. github.io hostname → live index.
 *   3. Anything else (localhost, file://, intranet) → dev index.
 *
 * Returns { path, isLive } where `path` is the URL to fetch and
 * `isLive` reflects what the caller is *trying* to load (so a 404
 * fallback can decide whether to retry with the dev index).
 *
 * See NewDocs/plans/presets-panel-overhaul.md §"Dev vs live preset
 * indexes".
 */
export function selectIndexFile({ hostname = '', search = '' } = {}) {
    const params = new URLSearchParams(search);
    const override = params.get('index');
    if (override === 'live') return { path: LIVE_INDEX_PATH, isLive: true };
    if (override === 'dev') return { path: DEV_INDEX_PATH, isLive: false };
    const isLive = (hostname || '').includes('github.io');
    return {
        path: isLive ? LIVE_INDEX_PATH : DEV_INDEX_PATH,
        isLive,
    };
}

// Helper function for logging with fallback
function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('presetUI', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[presetUI] ${message}`, ...data);
  }
}

export class PresetUI {
  constructor(container, componentState) {
    this.container = container;
    this.componentState = componentState;
    Object.defineProperty(this, 'eventBus', { get: () => getModuleEventBus(), configurable: true });

    this.presets = null;
    this.currentPlayer = null;
    this.initialized = false;
    this.presetsListContainer = null;
    this.rootElement = null;
    this.toolbarState = this._loadToolbarState();
    this.viewState = this._loadViewState();
    // Cache for the most-recently parsed sphere log so toggling the
    // chart off/on within the same detail view doesn't refetch.
    // Cleared whenever loadPreset runs.
    this._sphereLogCache = null;
    // Enrichment for the current chart, sourced from sphereState
    // after the preset finishes loading. Shape:
    //   { cacheKey: 'gameDirectory/seedName',
    //     enrichment: Map<sphereIndex, { locations, status }> }
    // Cleared on loadPreset; rebuilt on sphereState:dataLoaded when
    // the loaded preset matches this.currentGameDirectory/SeedName.
    this._sphereEnrichment = null;
    // Most recent ordered list of (gameDirectory, seedName, playerId)
    // tuples produced by the games list. Populated each time
    // renderGamesList runs; consumed by the next/previous nav in the
    // detail view to walk the list in the user's current sort order.
    this._currentOrderedTuples = [];

    // Create and append root element immediately in constructor to have a target for GL
    this.getRootElement();
    if (this.rootElement) {
      this.container.element.appendChild(this.rootElement);
    } else {
      log('error', '[PresetUI] Root element not created in constructor!');
    }

    // Defer the rest of initialization (fetching data, rendering)
    const readyHandler = (eventPayload) => {
      log('info',
        '[PresetUI] Received app:readyForUiDataLoad. Initializing presets.'
      );
      this.initialize();
      this.eventBus.unsubscribe('app:readyForUiDataLoad', readyHandler);
    };
    this.eventBus.subscribe('app:readyForUiDataLoad', readyHandler);

    // Sphere log enrichment subscription. When the user loads a
    // preset (sphereState auto-loads its sphere log from the file
    // path), sphereState fires sphereState:dataLoaded; we hydrate
    // the chart's per-cell tooltip + click data from sphereState.
    this._sphereDataLoadedHandler = () => this._refreshSphereEnrichment();
    this.eventBus.subscribe('sphereState:dataLoaded', this._sphereDataLoadedHandler);
    this.eventBus.subscribe('sphereState:currentSphereChanged', this._sphereDataLoadedHandler);

    this.container.on('destroy', () => {
      this.onPanelDestroy();
    });
  }

  getRootElement() {
    if (!this.rootElement) {
      this.rootElement = document.createElement('div');
      this.rootElement.id = 'presets-panel';
      this.rootElement.classList.add('panel-container');
      this.rootElement.style.height = '100%';
      this.rootElement.style.overflowY = 'auto';
      this.rootElement.innerHTML =
        '<div id="presets-list">Loading presets...</div>';
      this.presetsListContainer =
        this.rootElement.querySelector('#presets-list');
    }
    return this.rootElement;
  }

  initialize(/* container removed, uses rootElement */) {
    this.getRootElement();

    if (!this.presetsListContainer) {
      log('error',
        'PresetUI: Could not find #presets-list container during initialization.'
      );
      this.initialized = false;
      return false;
    }

    this.initialized = false;

    try {
      // Use cache: 'reload' to validate with server (allows 304 Not Modified)
      // Use cache: 'no-store' when ?nocache=1 is in URL (completely bypasses cache for testing)
      const noCache = new URLSearchParams(window.location.search).has('nocache');
      const cacheOpts = { cache: noCache ? 'no-store' : 'reload' };
      const { path: indexPath, isLive } = selectIndexFile({
        hostname: window.location.hostname,
        search: window.location.search,
      });
      log('info', `[PresetUI] Loading preset index: ${indexPath}`);

      const fetchAndApply = (path) => fetch(path, cacheOpts)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        });

      fetchAndApply(indexPath)
        .catch((error) => {
          // Live index missing on a github.io host (or wherever the
          // live index was selected) → fall back to dev with a
          // warning. The dev index ships in the static build either
          // way, so this is a benign fallback for first-time setups
          // before a live index is hand-curated.
          if (isLive && indexPath !== DEV_INDEX_PATH) {
            log('warn',
              `[PresetUI] Live preset index ${indexPath} unavailable (${error.message}); falling back to dev index.`
            );
            return fetchAndApply(DEV_INDEX_PATH);
          }
          throw error;
        })
        .then((data) => {
          this.presets = data;
          this.renderGamesList();
          this.initialized = true;
          log('info', '[PresetUI] Initialized successfully.');
        })
        .catch((error) => {
          log('warn', 'Presets data not available (this is OK if presets directory is empty):', error.message);
          this.presets = {};
          this.renderGamesList();
          this.initialized = true;
        });

      return true;
    } catch (error) {
      log('error', 'Error setting up presets data loading:', error);
      if (this.presetsListContainer) {
        this.presetsListContainer.innerHTML = `
          <div class="error-message">
            <h3>Error Initializing Presets</h3>
            <p>${error.message}</p>
          </div>
        `;
      }
      this.initialized = false;
      return false;
    }
  }

  onPanelDestroy() {
    log('info', '[PresetUI] Panel destroyed. Cleaning up if necessary.');
    this.initialized = false;
    this.presets = null;
    if (this.presetsListContainer) {
      this.presetsListContainer.innerHTML = '';
    }
    if (this._sphereDataLoadedHandler) {
      this.eventBus.unsubscribe('sphereState:dataLoaded', this._sphereDataLoadedHandler);
      this.eventBus.unsubscribe('sphereState:currentSphereChanged', this._sphereDataLoadedHandler);
      this._sphereDataLoadedHandler = null;
    }
  }

  renderGamesList() {
    const container = this.presetsListContainer;
    if (!container) {
      log('error', 'Presets list container not found for renderGamesList');
      return;
    }

    if (!this.presets) {
      container.innerHTML = '<p>Loading preset list...</p>';
      log('warn', 'renderGamesList called before presets data was loaded.');
      return;
    }

    // Create a header + toolbar
    let html = `
      <div class="preset-header">
        <h3>Select a Game Preset</h3>
        <input type="file" id="json-file-input" accept=".json,.archipelago" style="display: none;" />
        <button id="load-json-button" class="button" style="margin-left: 10px;">Load File</button>
      </div>
      ${this._renderToolbarHtml()}
      <div class="presets-container">
        <div class="game-row game-row-header">
          <div class="game-name-header">Game</div>
          <div class="game-presets-header">Seeds</div>
          <div class="test-headers">
            <span class="test-header" title="Minimal Spoiler Test">MS</span>
            <span class="test-header" title="Full Spoiler Test">FS</span>
            <span class="test-header" title="Multi-client Test">MC</span>
            <span class="test-header" title="Multi-world Test">MW</span>
            <span class="test-header" title="Spoiler Fuzz Test">SF</span>
          </div>
        </div>
    `;

    // Apply toolbar filter + sort to (gameDirectory, gameData) entries
    // before grouping by display name. Renders only what the user
    // asked to see.
    const orderedEntries = filterAndSortPresets(this.presets, this.toolbarState);

    // Group filtered preset directories by display name so that variants
    // sharing the same game name (e.g. "alttp" and "alttp_vanilla", both
    // named "A Link to the Past") appear as a single row. Seeds from
    // vanilla directories get a V badge. Each group tracks:
    // primaryGameData (for test results), seeds[], hasMultiworld.
    // The Map preserves insertion order, so the first group's entry in
    // the sorted entry list determines its render position.
    const nameGroups = new Map();

    orderedEntries.forEach(([gameDirectory, gameData]) => {
      const name = gameData.name;
      if (!nameGroups.has(name)) {
        nameGroups.set(name, { primaryGameData: gameData, seeds: [], hasMultiworld: false });
      }
      const group = nameGroups.get(name);

      if (gameDirectory === 'multiworld') {
        group.hasMultiworld = true;
        group.primaryGameData = gameData;
      } else {
        // Prefer the directory that has test_results for the test badge.
        if (gameData.test_results) {
          group.primaryGameData = gameData;
        }
      }

      Object.entries(gameData.folders || {}).forEach(([seedName, folderData]) => {
        group.seeds.push({ gameDirectory, seedName, folderData });
      });
    });

    // Capture an ordered list of clickable tuples in the same order
    // they're about to be rendered. Consumed by the detail view's
    // next/previous nav. Multiworld seeds expand to one tuple per
    // player; standard seeds expand to one tuple with playerId=null.
    this._currentOrderedTuples = [];
    nameGroups.forEach((group) => {
      group.seeds.forEach(({ gameDirectory, seedName, folderData }) => {
        if (gameDirectory === 'multiworld' && Array.isArray(folderData.games)) {
          for (const playerGame of folderData.games) {
            this._currentOrderedTuples.push({
              gameDirectory, seedName, playerId: String(playerGame.player),
            });
          }
        } else {
          this._currentOrderedTuples.push({ gameDirectory, seedName, playerId: null });
        }
      });
    });

    // Render each name group as one game-row
    nameGroups.forEach((group, name) => {
      const { primaryGameData, seeds, hasMultiworld } = group;

      html += `<div class="game-row">`;

      if (hasMultiworld) {
        // Multiworld: game-name is a direct child of game-row (closed immediately after)
        html += `<h4 class="game-name">${this.escapeHtml(name)}</h4>`;
        html += `</div>`; // Close the inline game-row
        html += `<div class="multiworld-container">`;
        html += `<div class="multiworld-seeds">`;
        seeds.forEach(({ gameDirectory, seedName, folderData }) => {
          html += `<div class="multiworld-seed-block">`;
          html += `<span class="seed-number">Seed: ${this.escapeHtml(
            folderData.seed
          )}</span>`;
          html += `<div class="seed-players">`;
          folderData.games.forEach((playerGame) => {
            html += `
              <div class="player-info">
                <button class="preset-player-button"
                        data-game-directory="${this.escapeHtml(gameDirectory)}"
                        data-seed-name="${this.escapeHtml(seedName)}"
                        data-player="${this.escapeHtml(playerGame.player)}"
                        title="Load Player ${this.escapeHtml(
                          playerGame.player
                        )} (${this.escapeHtml(playerGame.name)})">
                  P${this.escapeHtml(playerGame.player)}
                </button>
                <span class="player-details">${this.escapeHtml(
                  playerGame.name
                )} (${this.escapeHtml(playerGame.game)})</span>
              </div>
            `;
          });
          html += `</div></div>`; // Close seed-players and multiworld-seed-block
        });
        html += `</div>`; // Close multiworld-seeds
        html += `</div>`; // Close multiworld-container
        // Don't add the closing </div> here since we already closed the game-row
      } else {
        // Flat layout: game-name first (top-left), seed buttons flow naturally,
        // test badges last with margin-left:auto (bottom-right)
        html += `<h4 class="game-name">${this.escapeHtml(name)}</h4>`;
        seeds.forEach(({ gameDirectory, seedName, folderData }) => {
          const isVanilla = !!folderData.is_vanilla;
          const vanillaBadge = isVanilla
            ? `<span class="placement-badge placement-vanilla" title="Vanilla placement">V</span>`
            : '';
          html += `
            <button class="preset-button"
                    data-game-directory="${this.escapeHtml(gameDirectory)}"
                    data-seed-name="${this.escapeHtml(seedName)}"
                    title="${this.escapeHtml(
                      folderData.label || `Seed ${folderData.seed}${isVanilla ? ' (vanilla)' : ''}`
                    )}">
              ${this.escapeHtml(folderData.label || folderData.seed)}${vanillaBadge}
            </button>
          `;
        });
        html += this.renderTestResultBadge(primaryGameData);
      }

      if (!hasMultiworld) {
        html += `</div>`; // Close game-row
      }
    });

    // Close the container
    html += '</div>';

    // Styles are injected once into <head> via _ensureStylesInjected
    // (called from every render path). Originally these lived inside
    // this template literal, but the detail-view's container.innerHTML
    // = ... wiped the <style> child every time the user clicked into
    // a preset, leaving the detail view rendered with browser defaults.
    this._ensureStylesInjected();

    // Set the HTML content
    container.innerHTML = html;

    // Add event listener for the new Load JSON File button
    const loadJsonButton = container.querySelector('#load-json-button');
    const jsonFileInput = container.querySelector('#json-file-input');

    if (loadJsonButton && jsonFileInput) {
      loadJsonButton.addEventListener('click', () => {
        jsonFileInput.click(); // Trigger file input when button is clicked
      });

      jsonFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
          // Check if file is an .archipelago file (zip format)
          if (file.name.endsWith('.archipelago')) {
            this.loadArchipelagoFile(file);
          } else {
            // Regular JSON file handling
            const reader = new FileReader();
            reader.onload = (e) => {
              try {
                const jsonData = JSON.parse(e.target.result);
                this.displayLoadedJsonFileDetails(jsonData, file.name);
              } catch (err) {
                log('error', 'Error parsing JSON file:', err);
                this.eventBus.publish('ui:notification', {
                  type: 'error',
                  message: `Error parsing ${file.name}: ${err.message}`,
                });
              }
            };
            reader.onerror = (err) => {
              log('error', 'Error reading file:', err);
              this.eventBus.publish('ui:notification', {
                type: 'error',
                message: `Error reading ${file.name}.`,
              });
            };
            reader.readAsText(file);
          }
        }
      });
    }

    // Toolbar event handlers
    this._attachToolbarHandlers(container);

    // Add event listeners to the preset buttons (both standard and player)
    const buttons = container.querySelectorAll(
      '.preset-button, .preset-player-button'
    );
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        // Save scroll position so we can restore it when navigating back
        this._savedScrollTop = this.presetsListContainer ? this.presetsListContainer.scrollTop : 0;

        const gameDirectory = button.getAttribute('data-game-directory');
        const seedName = button.getAttribute('data-seed-name');
        const playerId = button.getAttribute('data-player'); // Will be null for standard buttons

        if (playerId) {
          log('info',
            `Loading preset ${seedName} from game ${gameDirectory} for player ${playerId}`
          );
          this.currentGameDirectory = gameDirectory;
          this.currentSeedName = seedName;
          this.currentPlayer = playerId; // Store current player
          this.loadPreset(gameDirectory, seedName, playerId);
        } else {
          log('info', `Loading preset ${seedName} from game ${gameDirectory}`);
          this.currentGameDirectory = gameDirectory;
          this.currentSeedName = seedName;
          this.currentPlayer = null; // Clear current player
          this.loadPreset(gameDirectory, seedName); // No player ID for standard presets
        }
      });
    });

    // Restore scroll position if returning from a preset detail view
    if (this._savedScrollTop && this.presetsListContainer) {
      requestAnimationFrame(() => {
        this.presetsListContainer.scrollTop = this._savedScrollTop;
      });
    }
  }

  displayLoadedJsonFileDetails(jsonData, fileName) {
    log('info',
      `Displaying details for manually loaded JSON file: ${fileName}`,
      jsonData
    );
    const container = this.presetsListContainer;
    if (!container) return;
    this._ensureStylesInjected();

    // For now, this is a placeholder. We will implement the details view in the next step.
    // It should be similar to loadPreset but adapt for a local file.
    let html = `
      <button class="back-button" id="back-to-presets">← Back to Games</button>
      <div class="preset-info">
        <h3>Loaded: ${this.escapeHtml(fileName)}</h3>
        <p>This file was loaded manually from your computer.</p>
        <div id="preset-status"></div>
        <pre style="max-height: 300px; overflow: auto; background: #111; padding: 10px; border-radius: 4px;">${this.escapeHtml(
          JSON.stringify(jsonData, null, 2)
        )}</pre>
      </div>
    `;
    container.innerHTML = html;

    const backButton = container.querySelector('#back-to-presets');
    if (backButton) {
      backButton.addEventListener('click', () => {
        this.renderGamesList();
      });
    }

    // TODO: Determine playerId and call loadRulesFile (or similar logic)
    // For now, let's assume player 1 for simplicity if it's a rules file.
    if (
      fileName.endsWith('_rules.json') ||
      confirm(
        'Is this a rules.json file for a game? Defaulting to Player 1 if so.'
      )
    ) {
      // This is a rough way to check, ideally jsonData structure would be validated.
      const playerId = DEFAULT_PLAYER_ID; // Default or determine from JSON if possible (e.g., if not multiworld)
      // We need a way to call the core logic of loadRulesFile without assuming a preset structure.
      // This might involve refactoring parts of loadRulesFile or creating a new shared method.
      log('info', 
        `Attempting to process ${fileName} as rules file for Player ${playerId}`
      );
      // Directly call the processing logic, adapting from loadRulesFile
      this.processManuallyLoadedRules(jsonData, fileName, playerId);
    }
  }

  async processManuallyLoadedRules(rulesData, fileName, playerId = DEFAULT_PLAYER_ID) {
    log('info', 
      `Processing manually loaded rules: ${fileName} for player ${playerId}`
    );
    try {
      if (this.componentState) {
        this.componentState.currentRules = rulesData;
        this.componentState.currentGameName = rulesData.game_name || 'unknown_game'; // Try to get game name from JSON
        this.componentState.currentPlayerId = playerId;
      } else {
        log('warn', 
          '[PresetUI] processManuallyLoadedRules: this.componentState is undefined.'
        );
      }

      log('info', 
        `Manually loaded rules processed for ${
          rulesData.game || 'unknown_game'
        }, player ${playerId}. Publishing files:jsonLoaded.`
      );
      this.eventBus.publish('files:jsonLoaded', {
        jsonData: rulesData,
        selectedPlayerId: playerId,
        sourceName: `userLoaded:${fileName}` // Prefix to indicate manually loaded file
      });

      this.eventBus.publish('ui:notification', {
        type: 'success',
        message: `Loaded ${fileName} for Player ${playerId}`,
      });

      const statusElement = document.getElementById('preset-status');
      if (statusElement) {
        statusElement.innerHTML = `
          <div class="success-message">
            <p>✓ ${this.escapeHtml(
              fileName
            )} loaded and processed successfully!</p>
            <p>Game systems should update shortly based on this data.</p>
          </div>
        `;
      }

      this.eventBus.publish('rules:loaded', {});
    } catch (error) {
      log('error', 'Error processing manually loaded rules file:', error);
      const statusElement = document.getElementById('preset-status');
      if (statusElement) {
        statusElement.innerHTML = `
          <div class="error-message">
            <p>Error processing ${this.escapeHtml(fileName)}: ${
          error.message
        }</p>
          </div>
        `;
      }
    }
  }

  /**
   * Loads JSZip library dynamically if not already loaded
   * @returns {Promise<JSZip>} The JSZip constructor
   */
  async loadJSZip() {
    if (window.JSZip) {
      return window.JSZip;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = './libs/jszip/jszip.min.js';
      script.onload = () => {
        if (window.JSZip) {
          log('info', 'JSZip library loaded successfully');
          resolve(window.JSZip);
        } else {
          reject(new Error('JSZip failed to initialize'));
        }
      };
      script.onerror = () => {
        reject(new Error('Failed to load JSZip library'));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Load and extract rules.json from an .archipelago file (zip format)
   * @param {File} file - The .archipelago file to process
   */
  async loadArchipelagoFile(file) {
    log('info', `Loading .archipelago file: ${file.name}`);

    try {
      // Load JSZip library
      const JSZip = await this.loadJSZip();

      // Read the file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Load the zip content
      const zip = await JSZip.loadAsync(arrayBuffer);

      // Find the rules.json file in the archive
      // It could be at the root or in a subdirectory, and may have different naming patterns
      let rulesFile = null;
      let rulesFileName = null;

      // Search for files ending with _rules.json or rules.json
      for (const [filename, zipEntry] of Object.entries(zip.files)) {
        if (!zipEntry.dir && (filename.endsWith('_rules.json') || filename === 'rules.json')) {
          rulesFile = zipEntry;
          rulesFileName = filename;
          log('info', `Found rules file in archive: ${filename}`);
          break;
        }
      }

      if (!rulesFile) {
        // If no rules file found, list the contents for debugging
        const fileList = Object.keys(zip.files).filter(f => !zip.files[f].dir);
        log('warn', 'No rules.json file found in archive. Contents:', fileList);
        throw new Error(`No rules.json file found in ${file.name}. Archive contains: ${fileList.join(', ')}`);
      }

      // Extract the rules.json content
      const rulesContent = await rulesFile.async('string');
      const jsonData = JSON.parse(rulesContent);

      log('info', `Successfully extracted ${rulesFileName} from ${file.name}`);

      // Process the extracted rules.json using existing method
      this.displayLoadedJsonFileDetails(jsonData, `${file.name} → ${rulesFileName}`);

    } catch (err) {
      log('error', 'Error loading .archipelago file:', err);
      this.eventBus.publish('ui:notification', {
        type: 'error',
        message: `Error loading ${file.name}: ${err.message}`,
      });
    }
  }

  loadPreset(gameDirectory, seedName, playerId = null) {
    this.currentGameDirectory = gameDirectory;
    this.currentSeedName = seedName;
    this.currentPlayer = playerId;

    // Drop any cached sphere log shape and enrichment from the
    // previous preset. Enrichment will rebuild when sphereState
    // finishes loading the new preset's sphere log.
    this._sphereLogCache = null;
    this._sphereEnrichment = null;

    const container = this.presetsListContainer;
    if (!container) return;
    this._ensureStylesInjected();

    try {
      const gameData = this.presets[gameDirectory];
      const folderData = gameData.folders[seedName];

      // Build the HTML for the preset details
      let headerTitle = `${this.escapeHtml(gameData.name)} - Preset`;
      if (playerId && gameDirectory === 'multiworld') {
        const playerInfo = folderData.games.find((p) => p.player == playerId);
        if (playerInfo) {
          headerTitle = `Multiworld Seed ${this.escapeHtml(
            folderData.seed
          )} - Player ${playerId} (${this.escapeHtml(playerInfo.name)})`;
        } else {
          headerTitle = `Multiworld Seed ${this.escapeHtml(
            folderData.seed
          )} - Player ${playerId}`;
        }
      } else {
        headerTitle = `${this.escapeHtml(
          gameData.name
        )} - Seed ${this.escapeHtml(folderData.seed)}`;
      }

      const nav = this._computeDetailNav(gameDirectory, seedName, playerId);
      const navButton = (id, label, disabled, title) => {
        const dis = disabled ? ' disabled' : '';
        return `<button class="preset-nav-btn" id="${id}" title="${this.escapeHtml(title)}"${dis}>${this.escapeHtml(label)}</button>`;
      };

      let html = `
        <div class="preset-detail-header">
          <button class="back-button" id="back-to-presets">← Back to Games</button>
          <div class="preset-detail-nav">
            ${navButton('nav-prev-game', '‹ Prev game', !nav.prevGame, nav.prevGame ? `Prev game: ${nav.prevGame.label}` : 'No previous game')}
            ${navButton('nav-prev-seed', '‹ Prev seed', !nav.prevSeed, nav.prevSeed ? `Prev seed in ${nav.prevSeed.label}` : 'No previous seed in this game')}
            ${navButton('nav-next-seed', 'Next seed ›', !nav.nextSeed, nav.nextSeed ? `Next seed in ${nav.nextSeed.label}` : 'No next seed in this game')}
            ${navButton('nav-next-game', 'Next game ›', !nav.nextGame, nav.nextGame ? `Next game: ${nav.nextGame.label}` : 'No next game')}
          </div>
        </div>
        <div class="preset-info">
          <h3>${headerTitle}</h3>
          <p>${this.escapeHtml(folderData.description || 'Multiworld Seed')}</p>
          <div class="preset-files">
            <h4>Files:</h4>
            <div class="file-links-container" style="background-color: #111 !important; border: 1px solid #333; border-radius: 6px; padding: 12px; margin-top: 10px;">
      `;

      // Add links for each file
      folderData.files.forEach((file) => {
        const filePath = `./presets/${gameDirectory}/${seedName}/${file}`;
        html += `
          <a class="preset-file-link" href="${filePath}" target="_blank" data-file="${file}">${file}</a><br/>
        `;
      });

      html += `</div>`;

      html += `
          </div>
          <div id="preset-status"></div>
        </div>
        <div class="preset-sphere-section">
          <label class="preset-sphere-toggle">
            <input type="checkbox" id="sphere-log-toggle"${this.viewState.showSphereLog ? ' checked' : ''} />
            Show sphere log shape
          </label>
          <div id="sphere-log-chart" class="preset-sphere-chart"></div>
        </div>
        <div id="preset-procgen-stats" class="preset-procgen-section"></div>
      `;

      // Set the HTML content
      container.innerHTML = html;

      // Add event listener for the back button
      const backButton = container.querySelector('#back-to-presets');
      if (backButton) {
        backButton.addEventListener('click', () => {
          this.renderGamesList();
        });
      }

      // Wire next/previous nav buttons
      const wireNav = (id, target) => {
        const btn = container.querySelector(`#${id}`);
        if (btn && target) {
          btn.addEventListener('click', () => {
            this.loadPreset(target.gameDirectory, target.seedName, target.playerId);
          });
        }
      };
      wireNav('nav-prev-game', nav.prevGame);
      wireNav('nav-prev-seed', nav.prevSeed);
      wireNav('nav-next-seed', nav.nextSeed);
      wireNav('nav-next-game', nav.nextGame);

      // Sphere log toggle + lazy-render
      const toggle = container.querySelector('#sphere-log-toggle');
      const chartHost = container.querySelector('#sphere-log-chart');
      const renderChartIfOn = () => {
        if (!this.viewState.showSphereLog || !chartHost) return;
        this._renderSphereLogChart(chartHost, gameDirectory, seedName);
      };
      if (toggle) {
        toggle.addEventListener('change', () => {
          this.viewState.showSphereLog = toggle.checked;
          this._saveViewState();
          if (chartHost) chartHost.innerHTML = '';
          renderChartIfOn();
        });
      }
      renderChartIfOn();

      // Add event listeners for the file links
      const fileLinks = container.querySelectorAll('.preset-file-link');
      fileLinks.forEach((link) => {
        link.addEventListener('click', (e) => {
          const file = link.getAttribute('data-file');

          // If this is a rules.json file, load it into the game
          if (file.endsWith('_rules.json')) {
            e.preventDefault(); // Prevent opening in a new tab
            this.loadRulesFile(gameDirectory, seedName, file, playerId);
          }
        });
      });

      // Automatically load the rules.json file for this preset/player
      let rulesFile = null;
      if (playerId && gameDirectory === 'multiworld') {
        rulesFile = folderData.files.find((file) =>
          file.endsWith(`_P${playerId}_rules.json`)
        );
        if (!rulesFile) {
          // Fallback to default rules.json if player-specific not found
          rulesFile = folderData.files.find((file) =>
            file.endsWith('_rules.json')
          );
          if (rulesFile) {
            log('warn', 
              `Player-specific rules file not found for P${playerId}, falling back to default rules.json`
            );
          }
        }
      } else {
        // Find standard rules file for single player presets
        rulesFile = folderData.files.find((file) =>
          file.endsWith('_rules.json')
        );
      }

      if (rulesFile) {
        // Determine the correct player ID
        let effectivePlayerId = '1'; // Default safety fallback

        if (playerId) {
          // If playerId was passed (multiworld), use it directly
          effectivePlayerId = playerId;
        } else if (folderData.games && folderData.games.length > 0) {
          // If it's a standard preset, get the player ID from the first entry in the games array
          // Ensure it's converted to a string if stateManager expects strings
          effectivePlayerId = folderData.games[0].player.toString();
        } else {
          // Log a warning if we can't find the player ID even for a standard preset
          log('warn', 
            `Could not determine player ID for preset ${folderId}, defaulting to '1'.`
          );
        }

        this.loadRulesFile(gameDirectory, seedName, rulesFile, effectivePlayerId);
      } else {
        log('warn', 
          'No suitable rules.json file found for automatic loading.'
        );
        const statusElement = document.getElementById('preset-status');
        if (statusElement) {
          statusElement.innerHTML = `
            <div class="error-message">
              <p>Could not find a rules file to automatically load.</p>
            </div>
          `;
        }
      }
    } catch (error) {
      log('error', 'Error displaying preset:', error);
      const container = this.presetsListContainer;
      if (container) {
        container.innerHTML = `
          <div class="error-message">
            <h3>Error Loading Preset</h3>
            <p>${error.message}</p>
            <button id="back-to-presets" class="back-button">Back to Games</button>
          </div>
        `;

        // Add event listener for the back button
        const backButton = container.querySelector('#back-to-presets');
        if (backButton) {
          backButton.addEventListener('click', () => {
            this.renderGamesList();
          });
        }
      }
    }
  }

  async loadRulesFile(gameDirectory, seedName, rulesFile, playerId = DEFAULT_PLAYER_ID) {
    const fullPath = `./presets/${gameDirectory}/${seedName}/${rulesFile}`;
    log('info', `Loading rules file: ${fullPath}`);
    try {
      const response = await fetch(fullPath);
      if (!response.ok) {
        throw new Error(
          `Failed to load rules file ${fullPath}: ${response.status} ${response.statusText}`
        );
      }
      const rulesData = await response.json();

      // Ensure componentState exists before trying to set properties on it
      if (this.componentState) {
        this.componentState.currentRules = rulesData;
        this.componentState.currentGameDirectory = gameDirectory;
        this.componentState.currentPlayerId = playerId; // Store the determined player ID
      } else {
        // If componentState is not available, these assignments would fail.
        // Log a warning, as this might indicate an issue with panel state management.
        log('warn', 
          '[PresetUI] loadRulesFile: this.componentState is undefined. Cannot store currentRules, currentGameDirectory, or currentPlayerId. This might be normal if the panel was just created and no state has been saved yet, or it could indicate an issue with GoldenLayout state persistence for this component.'
        );
        // As a fallback, we can store these on the instance if needed for immediate use,
        // but they won't be persisted by GoldenLayout.
        // this.currentRules_fallback = rulesData;
        // this.currentGameDirectory_fallback = gameDirectory;
        // this.currentPlayerId_fallback = playerId;
      }

      log('info',
        `Rules loaded for ${gameDirectory}, player ${playerId}. Publishing files:jsonLoaded.`
      );
      this.eventBus.publish('files:jsonLoaded', {
        jsonData: rulesData,
        selectedPlayerId: playerId,
        sourceName: fullPath
      });

      // Render procgen-specific stats if the rules.json carries them.
      // Hidden entirely otherwise (the helper returns null for non-
      // procgen presets).
      const procgenHost = this.presetsListContainer?.querySelector('#preset-procgen-stats');
      if (procgenHost) {
        this._renderProcgenStats(procgenHost, rulesData, playerId);
      }

      // Publish success notification
      this.eventBus.publish('ui:notification', {
        type: 'success',
        message: `Loaded ${rulesFile} for Player ${playerId}`,
      });

      // Temporarily comment out direct calls to stateManager, as the new flow
      // via files:jsonLoaded -> proxy.loadRules -> worker.loadRules (which calls loadFromJSON & initializeInventory)
      // should handle this.

      // const startingItems = rulesData.starting_inventory || [];
      // stateManager.initializeInventory(
      //   startingItems,
      //   rulesData.progression_mapping[playerId],
      //   rulesData.items[playerId]
      // );

      // stateManager.loadFromJSON(rulesData, playerId);

      // --- Explicitly Initialize InventoryUI ---
      // This is likely redundant if InventoryUI handles its own re-initialization
      // based on stateManager:rulesLoaded or stateManager:ready events.
      // const playerItems = rulesData.items[playerId];
      // const groups = rulesData.item_groups
      //   ? rulesData.item_groups[playerId]
      //   : {}; // Handle missing item_groups
      // if (playerItems && this.gameUI.inventoryUI) {
      //   this.gameUI.inventoryUI.initialize(playerItems, groups || {}); // Pass empty object if groups are null/undefined
      // } else {
      //   log('warn', 
      //     '[PresetUI] Could not initialize InventoryUI - playerItems missing or this.gameUI.inventoryUI instance not found.'
      //   );
      // }
      // --- End InventoryUI Init ---

      // Explicitly compute reachability after loading new state and initializing inventory UI
      // This should now be handled internally by the StateManager worker after processing new rules.
      // stateManager.computeReachableRegions();

      // Count game elements for display
      let regionCount = 0;
      let locationCount = 0;
      let exitCount = 0;
      let itemCount = 0;
      
      // Count regions, their exits, and locations (data is organized by player ID)
      if (rulesData.regions) {
        // Iterate through each player's regions
        for (const playerRegions of Object.values(rulesData.regions)) {
          if (typeof playerRegions === 'object') {
            regionCount += Object.keys(playerRegions).length;
            // Count exits and locations within each region
            for (const region of Object.values(playerRegions)) {
              if (region.exits && Array.isArray(region.exits)) {
                exitCount += region.exits.length;
              }
              if (region.locations && Array.isArray(region.locations)) {
                locationCount += region.locations.length;
              }
            }
          }
        }
      }
      
      // Count items (organized by player ID)
      if (rulesData.items) {
        for (const playerItems of Object.values(rulesData.items)) {
          if (typeof playerItems === 'object') {
            itemCount += Object.keys(playerItems).length;
          }
        }
      }
      
      // Count progressive items if they exist (also organized by player ID)
      if (rulesData.progressive_items) {
        for (const playerProgItems of Object.values(rulesData.progressive_items)) {
          if (typeof playerProgItems === 'object') {
            itemCount += Object.keys(playerProgItems).length;
          }
        }
      }

      // Display success message with counts
      const statusElement = document.getElementById('preset-status');
      if (statusElement) {
        statusElement.innerHTML = `
          <div class="success-message">
            <p>✓ Preset rules loaded successfully!</p>
            <p style="margin: 8px 0; font-size: 0.9em; color: #a0a0a0;">
              Loaded: ${regionCount} regions, ${locationCount} locations, ${exitCount} exits, ${itemCount} items
            </p>
            <p>You can now go to the Locations or Regions view to explore the game.</p>
          </div>
        `;
      }

      // Trigger rules:loaded event to enable offline play
      this.eventBus.publish('rules:loaded', {});

      // Re-enable control buttons if needed (though rules:loaded might handle this elsewhere)
      // This is likely a remnant of an older architecture and this.gameUI is not defined here.
      // Control button states should be managed by their respective modules.
      // this.gameUI._enableControlButtons();
    } catch (error) {
      log('error', 'Error loading rules file:', error);
      const statusElement = document.getElementById('preset-status');
      if (statusElement) {
        statusElement.innerHTML = `
          <div class="error-message">
            <p>Error loading rules file: ${error.message}</p>
          </div>
        `;
      }
    }
  }

  renderTestResultBadge(gameData) {
    const testResults = gameData.test_results;

    // Define the five test types with their labels and full names for tooltips
    const testTypes = [
      { key: 'minimal_spoiler', fullName: 'Minimal Spoiler Test' },
      { key: 'full_spoiler', fullName: 'Full Spoiler Test' },
      { key: 'multiclient', fullName: 'Multi-client Test' },
      { key: 'multiworld', fullName: 'Multi-world Test' },
      { key: 'spoiler_fuzz', fullName: 'Spoiler Fuzz Test' },
    ];

    // Build badges for each test type
    const badges = testTypes.map(testType => {
      const result = testResults ? testResults[testType.key] : null;
      return this.renderSingleTestBadge(result, testType.fullName);
    }).join('');

    return `<div class="test-badges-container">${badges}</div>`;
  }

  renderSingleTestBadge(result, fullName) {
    let icon = '❓';
    let badgeClass = 'test-badge-unknown';
    let tooltipContent = `${fullName}: No data`;

    if (result) {
      if (result.passed) {
        icon = '✅';
        badgeClass = 'test-badge-passed';
        tooltipContent = `${fullName}: Passed`;
      } else {
        icon = '❌';
        badgeClass = 'test-badge-failed';
        tooltipContent = `${fullName}: Failed`;
      }

      // Add seed/player count info to tooltip if available
      if (result.total_seeds !== undefined && result.total_seeds > 1) {
        tooltipContent += `\nSeeds: ${result.seeds_passed}/${result.total_seeds} passed`;
        if (result.first_failure_seed) {
          tooltipContent += `\nFirst failure: Seed ${result.first_failure_seed}`;
        }
      }
      if (result.first_failure_player) {
        tooltipContent += `\nFirst failure: Player ${result.first_failure_player}`;
      }
      if (result.total_locations !== undefined) {
        tooltipContent += `\nLocations: ${result.locations_checked}/${result.total_locations} checked`;
      }
      // Add fuzz test run info to tooltip if available
      if (result.total_runs !== undefined) {
        tooltipContent += `\nRuns: ${result.runs_passed}/${result.total_runs} passed`;
        if (result.runs_failed > 0 && result.failure_types) {
          tooltipContent += `\nFailures: ${result.failure_types}`;
        }
      }
    }

    return `
      <div class="test-badge-mini ${badgeClass}" title="${this.escapeHtml(tooltipContent)}">
        <span class="test-icon-mini">${icon}</span>
      </div>
    `;
  }

  _renderProcgenStats(host, rulesData, playerId) {
    const stats = computeProcgenStats(rulesData, playerId);
    if (!stats) {
      host.innerHTML = '';
      return;
    }
    const driverLabel = (() => {
      if (stats.driver === 'top-down') {
        return stats.sourceGame
          ? `Top-down (${this.escapeHtml(stats.sourceGame)})`
          : 'Top-down';
      }
      if (stats.driver === 'grid-growth') return 'Grid-growth';
      // procgen_metadata absent (older procgen output) — preset_sidecars
      // is present but we don't know the driver. Label honestly.
      return 'Procgen (driver unknown)';
    })();

    const stopReasonClass = stats.stopReason === 'all_placed'
      ? 'preset-procgen-stop-ok'
      : stats.stopReason
        ? 'preset-procgen-stop-warn'
        : '';
    const stopReasonText = stats.stopReason
      ? `${this.escapeHtml(stats.stopReason)}${stats.stopReason === 'all_placed' ? ' ✓' : ' ⚠'}`
      : '(unknown)';

    const substrateBreakdown = Object.entries(stats.substrateCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => `${this.escapeHtml(id)} (${count})`)
      .join(' · ');

    const gridDimsLabel = stats.gridDims
      ? `${stats.gridDims.width}×${stats.gridDims.height}, ${stats.regionCount} of ${stats.gridDims.width * stats.gridDims.height} cells occupied`
      : `${stats.regionCount} regions`;

    const gateDensity = stats.regionCount > 0
      ? (stats.totalLogicGates / stats.regionCount).toFixed(2)
      : '0.00';

    let html = `
      <h4 class="preset-procgen-title">Procgen</h4>
      <div class="preset-procgen-summary">
        <div><strong>Driver:</strong> ${driverLabel}</div>
        <div><strong>Substrates:</strong> ${substrateBreakdown}</div>
        <div><strong>Stop reason:</strong> <span class="${stopReasonClass}">${stopReasonText}</span></div>
        <div><strong>Grid:</strong> ${this.escapeHtml(gridDimsLabel)}</div>
        <div><strong>Logic gates:</strong> ${stats.totalLogicGates} (${gateDensity} per region)</div>
      </div>
    `;

    // Source preservation — top-down only. Compares procgen_metadata's
    // source_counts against the output we just computed.
    if (stats.sourceCounts) {
      const row = (label, sourceVal, outVal) => {
        const ok = sourceVal === outVal;
        const mark = ok ? '✓' : '✗';
        const cls = ok ? 'preset-procgen-stop-ok' : 'preset-procgen-stop-warn';
        return `<div><strong>${this.escapeHtml(label)}:</strong> ${outVal}/${sourceVal} <span class="${cls}">${mark}</span></div>`;
      };
      html += `
        <h5 class="preset-procgen-subtitle">Source preservation</h5>
        <div class="preset-procgen-summary">
          ${row('Locations', stats.sourceCounts.locations, stats.outputCounts.locations)}
          ${row('Exits', stats.sourceCounts.exits, stats.outputCounts.exits)}
          ${row('Logic gates', stats.sourceCounts.logic_gates, stats.outputCounts.logic_gates)}
          ${row('Regions', stats.sourceCounts.regions, stats.outputCounts.regions)}
        </div>
      `;
    }

    // Per-region table — sorted by density descending so outliers
    // surface at the top. (The plan calls out region-size formula
    // tuning as the next task; high-density rows are the rows where
    // the formula picked too-small a size.)
    const regionsSorted = stats.regions.slice().sort((a, b) => b.density - a.density);
    let tableBody = '';
    for (const r of regionsSorted) {
      tableBody += `
        <tr>
          <td>${this.escapeHtml(r.name)}</td>
          <td>${this.escapeHtml(r.substrate)}</td>
          <td>${r.exits}</td>
          <td>${r.locations}</td>
          <td>${r.width}×${r.height}</td>
          <td>${r.density.toFixed(3)}</td>
        </tr>
      `;
    }
    html += `
      <h5 class="preset-procgen-subtitle">Per-region</h5>
      <table class="preset-procgen-table">
        <thead>
          <tr>
            <th>Region</th><th>Substrate</th><th>Exits</th>
            <th>Locations</th><th>Grid w×h</th><th>Density</th>
          </tr>
        </thead>
        <tbody>${tableBody}</tbody>
      </table>
    `;

    host.innerHTML = html;
  }

  _formatSphereTooltip(enriched) {
    // Multi-line title attribute. Most browsers render "\n" as a
    // line break in title tooltips. Renderer expects sphereIndex,
    // status (current|completed|future|unknown), and locations[].
    const header = enriched.status && enriched.status !== 'unknown'
      ? `Sphere ${enriched.sphereIndex} (${enriched.status})`
      : `Sphere ${enriched.sphereIndex}`;
    const lines = [header];
    if (enriched.locations.length === 0) {
      lines.push('No locations in this sphere');
    } else {
      lines.push(`${enriched.locations.length} location${enriched.locations.length === 1 ? '' : 's'}:`);
      for (const loc of enriched.locations) lines.push(`  • ${loc}`);
    }
    return lines.join('\n');
  }

  _refreshSphereEnrichment() {
    // Only meaningful when the detail view is open and showing a
    // chart for some preset. Enrichment is keyed to that preset so
    // a stale dataLoaded for a different preset is ignored.
    const gameDirectory = this.currentGameDirectory;
    const seedName = this.currentSeedName;
    if (!gameDirectory || !seedName) return;
    const cacheKey = `${gameDirectory}/${seedName}`;

    let sphereData = null;
    let currentSphere = null;
    let checkedLocations = null;
    try {
      const getSphereData = centralRegistry.getPublicFunction('sphereState', 'getSphereData');
      const getCurrentSphere = centralRegistry.getPublicFunction('sphereState', 'getCurrentSphere');
      const getCheckedLocations = centralRegistry.getPublicFunction('sphereState', 'getCheckedLocations');
      sphereData = getSphereData?.();
      currentSphere = getCurrentSphere?.();
      const checkedArr = getCheckedLocations?.();
      if (Array.isArray(checkedArr)) checkedLocations = new Set(checkedArr);
    } catch (e) {
      log('warn', 'Failed to read sphereState:', e?.message);
      return;
    }
    if (!Array.isArray(sphereData) || sphereData.length === 0) return;

    this._sphereEnrichment = {
      cacheKey,
      enrichment: buildSphereEnrichment(sphereData, { currentSphere, checkedLocations }),
    };

    // Re-render the chart if it's currently visible.
    if (this.viewState.showSphereLog) {
      const host = this.presetsListContainer?.querySelector('#sphere-log-chart');
      if (host) this._renderSphereLogChart(host, gameDirectory, seedName);
    }
  }

  _renderSphereLogChart(host, gameDirectory, seedName) {
    if (!host) return;
    const cacheKey = `${gameDirectory}/${seedName}`;
    const renderShape = (shape) => {
      if (!shape || shape.length === 0) {
        host.innerHTML = '<div class="preset-sphere-empty">No spheres recorded.</div>';
        return;
      }
      // Enrichment is per-preset; ignore stale enrichment from a
      // previously-displayed preset.
      const enrichment = (this._sphereEnrichment?.cacheKey === cacheKey)
        ? this._sphereEnrichment.enrichment
        : null;

      const cellHtml = (sphereIndex) => {
        const enriched = enrichment?.get(sphereIndex);
        const classes = ['preset-sphere-tile'];
        let titleAttr = '';
        if (enriched) {
          classes.push('preset-sphere-tile-enriched');
          if (enriched.status) classes.push(`preset-sphere-tile-${enriched.status}`);
          titleAttr = ` title="${this.escapeHtml(this._formatSphereTooltip(enriched))}"`;
        }
        const idx = this.escapeHtml(sphereIndex);
        return `<span class="${classes.join(' ')}" data-sphere-index="${idx}"${titleAttr}></span>`;
      };

      let inner = `
        <div class="preset-sphere-row preset-sphere-header">
          <span class="preset-sphere-cell-num">Sphere</span>
          <span class="preset-sphere-cell-count">Frac.</span>
          <span class="preset-sphere-cell-bar">Bar</span>
        </div>
      `;
      for (const { integerSphere, fractionalCount, sphereIndices } of shape) {
        let cells = '';
        for (let i = 0; i < fractionalCount; i += 1) {
          // Fall back to the integer label if the parser produced
          // no per-cell sphere indices (older callers, or malformed
          // input). The fallback is a graceful degradation: the cell
          // still has data-sphere-index, just at integer granularity.
          const sphereIndex = sphereIndices?.[i] ?? String(integerSphere);
          cells += cellHtml(sphereIndex);
        }
        inner += `
          <div class="preset-sphere-row">
            <span class="preset-sphere-cell-num">${integerSphere}</span>
            <span class="preset-sphere-cell-count">${fractionalCount}</span>
            <span class="preset-sphere-cell-bar">${cells}</span>
          </div>
        `;
      }
      host.innerHTML = inner;

      // Wire click handlers on enriched cells. Click activates the
      // spoiler-checklist panel first (so its DOM is laid out and
      // visible) and then publishes scrollToSphere — the checklist
      // wraps the scroll in requestAnimationFrame so the activation
      // pass has time to complete.
      if (enrichment) {
        for (const cell of host.querySelectorAll('.preset-sphere-tile-enriched')) {
          cell.addEventListener('click', () => {
            const sphereIndex = cell.dataset.sphereIndex;
            if (!sphereIndex) return;
            this.eventBus.publish('ui:activatePanel', { panelId: 'spoilerChecklistPanel' });
            this.eventBus.publish('spoilerChecklist:scrollToSphere', { sphereIndex });
          });
        }
      }
    };

    if (this._sphereLogCache?.cacheKey === cacheKey) {
      renderShape(this._sphereLogCache.shape);
      return;
    }

    const gameData = this.presets?.[gameDirectory];
    const folderData = gameData?.folders?.[seedName];
    const sphereFile = (folderData?.files ?? []).find((f) => f.endsWith('_sphere_log.jsonl'));
    if (!sphereFile) {
      host.innerHTML = '<div class="preset-sphere-empty">No sphere log available.</div>';
      return;
    }
    host.innerHTML = '<div class="preset-sphere-empty">Loading sphere log…</div>';
    const filePath = `./presets/${gameDirectory}/${seedName}/${sphereFile}`;
    fetch(filePath, { cache: 'reload' })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then((text) => {
        const shape = parseSphereLogShape(text);
        this._sphereLogCache = { cacheKey, shape };
        // Re-check the toggle state in case the user toggled off
        // before the fetch resolved.
        if (this.viewState.showSphereLog) renderShape(shape);
      })
      .catch((err) => {
        log('warn', `Sphere log fetch failed for ${filePath}:`, err.message);
        host.innerHTML = '<div class="preset-sphere-empty">Sphere log could not be loaded.</div>';
      });
  }

  _loadViewState() {
    try {
      const raw = localStorage.getItem(VIEW_LS_KEY);
      if (!raw) return { ...DEFAULT_VIEW_STATE };
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_VIEW_STATE, ...parsed };
    } catch (e) {
      return { ...DEFAULT_VIEW_STATE };
    }
  }

  _saveViewState() {
    try {
      localStorage.setItem(VIEW_LS_KEY, JSON.stringify(this.viewState));
    } catch (e) {
      // ignore
    }
  }

  _computeDetailNav(gameDirectory, seedName, playerId) {
    return computeDetailNav(this._currentOrderedTuples, this.presets, {
      gameDirectory, seedName, playerId,
    });
  }

  _ensureStylesInjected() {
    // Idempotent: if a previous panel instance (or earlier render of
    // this one) injected the stylesheet, leave it alone.
    if (typeof document === 'undefined') return;
    if (document.getElementById(PRESET_STYLES_ID)) return;
    const style = document.createElement('style');
    style.id = PRESET_STYLES_ID;
    style.textContent = PRESET_STYLES;
    document.head.appendChild(style);
  }

  _renderToolbarHtml() {
    const t = this.toolbarState;
    const opt = (value, label, current) => {
      const sel = value === current ? ' selected' : '';
      return `<option value="${this.escapeHtml(value)}"${sel}>${this.escapeHtml(label)}</option>`;
    };
    return `
      <div class="presets-toolbar">
        <input type="text" class="presets-toolbar-search"
               placeholder="Search games…"
               value="${this.escapeHtml(t.query || '')}" />
        <label>Sort:
          <select class="presets-toolbar-sort">
            ${opt('index', 'Index order', t.sortKey)}
            ${opt('name', 'Name (A→Z)', t.sortKey)}
            ${opt('seedCount', '# of seeds', t.sortKey)}
            ${opt('testPassCount', 'Test pass count', t.sortKey)}
          </select>
        </label>
        <label>Tests:
          <select class="presets-toolbar-tests">
            ${opt('any', 'Any', t.filters.testStatus)}
            ${opt('passing', 'Passing', t.filters.testStatus)}
            ${opt('failing', 'Failing', t.filters.testStatus)}
            ${opt('unknown', 'Unknown', t.filters.testStatus)}
          </select>
        </label>
        <label>World:
          <select class="presets-toolbar-world">
            ${opt('any', 'Any', t.filters.worldType)}
            ${opt('original', 'Original', t.filters.worldType)}
            ${opt('worldgen', 'Worldgen', t.filters.worldType)}
            ${opt('vanilla', 'Vanilla', t.filters.worldType)}
            ${opt('multiworld', 'Multiworld', t.filters.worldType)}
          </select>
        </label>
        <label>Sphere log:
          <select class="presets-toolbar-sphere">
            ${opt('either', 'Either', t.filters.hasSphereLog)}
            ${opt('yes', 'Yes', t.filters.hasSphereLog)}
            ${opt('no', 'No', t.filters.hasSphereLog)}
          </select>
        </label>
        <label>Procgen:
          <select class="presets-toolbar-procgen">
            ${opt('either', 'Either', t.filters.hasProcgenData)}
            ${opt('yes', 'Yes', t.filters.hasProcgenData)}
            ${opt('no', 'No', t.filters.hasProcgenData)}
          </select>
        </label>
      </div>
    `;
  }

  _attachToolbarHandlers(container) {
    const search = container.querySelector('.presets-toolbar-search');
    const sortSel = container.querySelector('.presets-toolbar-sort');
    const testsSel = container.querySelector('.presets-toolbar-tests');
    const worldSel = container.querySelector('.presets-toolbar-world');
    const sphereSel = container.querySelector('.presets-toolbar-sphere');
    const procgenSel = container.querySelector('.presets-toolbar-procgen');
    if (!search) return; // No toolbar rendered (defensive — shouldn't happen).

    const apply = (mutator) => {
      mutator(this.toolbarState);
      this._saveToolbarState();
      this.renderGamesList();
      // Re-focus the search input after re-render so typing flows
      // uninterrupted. Caret position is preserved by the value
      // round-trip through render.
      const next = this.presetsListContainer?.querySelector('.presets-toolbar-search');
      if (next && document.activeElement !== next) {
        next.focus();
        next.setSelectionRange(next.value.length, next.value.length);
      }
    };

    search.addEventListener('input', () => apply((s) => { s.query = search.value; }));
    sortSel.addEventListener('change', () => apply((s) => { s.sortKey = sortSel.value; }));
    testsSel.addEventListener('change', () => apply((s) => { s.filters.testStatus = testsSel.value; }));
    worldSel.addEventListener('change', () => apply((s) => { s.filters.worldType = worldSel.value; }));
    sphereSel.addEventListener('change', () => apply((s) => { s.filters.hasSphereLog = sphereSel.value; }));
    procgenSel.addEventListener('change', () => apply((s) => { s.filters.hasProcgenData = procgenSel.value; }));
  }

  _loadToolbarState() {
    try {
      const raw = localStorage.getItem(TOOLBAR_LS_KEY);
      if (!raw) return { ...DEFAULT_TOOLBAR_STATE,
        filters: { ...DEFAULT_TOOLBAR_STATE.filters } };
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_TOOLBAR_STATE,
        ...parsed,
        filters: { ...DEFAULT_TOOLBAR_STATE.filters, ...(parsed?.filters ?? {}) },
      };
    } catch (e) {
      return { ...DEFAULT_TOOLBAR_STATE,
        filters: { ...DEFAULT_TOOLBAR_STATE.filters } };
    }
  }

  _saveToolbarState() {
    try {
      localStorage.setItem(TOOLBAR_LS_KEY, JSON.stringify(this.toolbarState));
    } catch (e) {
      // ignore — quota exceeded or storage disabled
    }
  }

  escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return unsafe
      .toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Add default export
export default PresetUI;
