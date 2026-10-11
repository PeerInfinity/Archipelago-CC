/**
 * presetRun — a preset (or the panel's persisted bundle) → the RUN a pipeline
 * mode's runner consumes, and that run driven headless to a compiled rules.json.
 *
 * ⛓ PROCGEN PIPELINE PRESETS P0 — **THE OP IS THE AUTHORITY, THE WIDGET A
 * COURTESY.** The Procgen Pipeline panel used to assemble each mode's config
 * inside its own methods (`_buildSphereConfig` + `_configFromCfgPrep`,
 * `_buildSpiralEnvelope`, `_buildTDEnvelope`, `_runGridGrowth`), reading `this`.
 * Nothing but a browser could therefore ask "does this preset generate?". The
 * assembly lives HERE now as pure functions of a panel-shaped state
 * (`{ mode, params, scenario, substrateQuotas, substrateMix, substrateMode }`);
 * the panel's methods are one-line callers over `this`, and the headless row
 * (`presetDefs.generate.slow.test.js`) calls the SAME functions — so the world a
 * preset generates in the panel and the world the row asserts on come out of
 * one implementation.
 *
 * ⛔ No DOM, no `window`, no `localStorage`, no `fetch` in here. Region
 * libraries arrive RESOLVED (`resolvedLibraries`, the panel's
 * `this.regionLibraries` shape: `[{ library, count, source, file? }]`); the
 * panel resolves served packs by fetch, the row from disk. A top-down SOURCE
 * arrives as a parsed rules.json; the panel owns picking it.
 *
 * ⛓ The registry: the functions here read `substrateRegistry` (the shared
 * singleton) exactly as the panel did — as do `sphereConfigHooks.js` and every
 * step runner they feed. There is one registry per page / process, and a run
 * assembled against a different one would not be the run the runners realise,
 * so no registry parameter is offered.
 */

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { DEFAULT_ITEMS } from '../shared/procgen/library.js';
import { CONCEPTS, itemRowsOf, markConceptRow } from '../procgenCore/concepts.js';
import { GENERATION_COST, generationCostOf } from '../procgenCore/substratePredicates.js';
import {
    defaultProcgenParams, activeSubstrateIds, pricingParamsOf,
    collectSphereGrowthPrep, assembleRegionParams, assembleLibraryRegionParams,
} from './sphereConfigHooks.js';
import { buildLibrarySpiralConfig } from './regionLibraryLoader.js';
import { applyPresetState, VALID_MODES, TOPDOWN_GRID_KEYS } from './presetDefs.js';
import { growMazeAsync, buildRulesJson } from './procgenPipelineEngine.js';
import { newEnvelope as newSphereEnvelope, runToStep as runSphereToStep } from './sphereSteps.js';
import { newSpiralEnvelope, runSpiralToStep } from './spiralSteps.js';
import { buildTopDownEnvelope, runTopDownToStep } from './topDownSteps.js';

export const DEFAULT_PARAMS = {
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
    // ⛓ CONCEPT LIBRARY T1 — the world's concept list: the concept ids
    // (`procgenCore/concepts.js` `CONCEPTS`) a substrate may realise a planned
    // gate as (`procgenPipeline/conceptSelection.js`). EMPTY by default, and an
    // empty list spends no draw and places no concept, so every world that
    // names none is byte-identical to one built before the knob existed.
    // Reaches each region's `placeFromRules` as `params.concepts`
    // (`sphereConfigHooks.assembleRegionParams`).
    concepts: [],
    // Substrate-specific params (e.g. bounce's fall behavior / physics
    // profile / braid layout, the maze's hazards and its library's connection
    // strictness) are
    // NOT here — each substrate declares its own defaults via the registry
    // `defaultProcgenParams` hook, merged in by panelDefaultParams(). See
    // bounceProcgenParams.js, mazeProcgenParams.js.
};

/**
 * ⛓ The top-down hand-off's grid rule: a square side of ⌈√(N × this)⌉ for a
 * source of N regions, floored at `DEFAULT_PARAMS.gridWidth` — room for the BFS
 * to lay every region out without falling back to teleporters at once. ONE rule,
 * shared by the pipeline panel's `_applyGridDimsFromSource` and the APWorld
 * Editor's *Initialise procgen data* (APWORLD SUBSTRATE CHANGE R7).
 */
export const TOPDOWN_GRID_AREA_FACTOR = 1.5;

/** ⛓ The square grid side the top-down hand-off gives a source of `regionCount` regions. */
export function topDownGridSide(regionCount) {
    return Math.max(DEFAULT_PARAMS.gridWidth, Math.ceil(Math.sqrt(regionCount * TOPDOWN_GRID_AREA_FACTOR)));
}

// ⛓ TOPDOWN_GRID_KEYS lives in presetDefs.js (its capture omits them; F1) and
// is re-exported here, beside the rules that read it.
export { TOPDOWN_GRID_KEYS };

/**
 * ⛓ The panel's grid inputs' `max` in TOP-DOWN mode. The engine refuses only a
 * side below 1 (`Grid: invalid dimensions`), so this is a cost bound, and it
 * is MEASURED (C2 W0, 2026-09-30, headless, load ~2): twice the derived side
 * of the largest committed source — `pokemon_rb`, 445 regions → 26 — laid out
 * all_placed in 1.4 s at 52×52 (maze : text adventure 2 : 1; 1.2 s at 26×26).
 */
export const TOPDOWN_GRID_INPUT_MAX = 52;

/**
 * ⛓ The panel's grid inputs' `max` in GRID GROWTH mode — the pre-C2 cap for
 * both modes, kept for grid growth only: its grower fills cells until the
 * frontier is empty, and its cost at a larger grid has not been measured.
 */
export const GRID_GROWTH_INPUT_MAX = 10;

/**
 * ⛓ The grid a top-down run gives `rulesJson` — `topDownGridSide` over the
 * regions it names for `playerId` (the slot the panel's routes realise,
 * `HANDOFF_REALISED_SLOT`), as `{ width, height }`; null when it names none
 * (there is nothing to size for, and the caller keeps what it has).
 */
export function gridDimsForSource(rulesJson, { playerId = '1' } = {}) {
    const count = Object.keys(rulesJson?.regions?.[playerId] ?? {}).length;
    if (count === 0) return null;
    const side = topDownGridSide(count);
    return { width: side, height: side };
}

/**
 * ⛓ The grid keys a preset/persisted bundle PINS: those its (sparse) `params`
 * carries. A shipped top-down preset pins none (`{ seed: 3 }`), so its grid
 * follows the source; a bundle that carries `gridWidth` keeps that width
 * whatever the source — the author's explicit pin wins, by design.
 * A USER preset saved in top-down mode carries (so pins) only the axes the
 * user hand-edited (`capturePresetState`'s `handEditedGridKeys`, F1).
 */
export function pinnedGridKeys(bundleParams) {
    return Object.values(TOPDOWN_GRID_KEYS)
        .filter((key) => bundleParams?.[key] !== undefined);
}

/**
 * ⛓⛓ **THE ONE TOP-DOWN SIZING RULE, APPLIED.** `params` with every grid key
 * NOT in `pinned` set from `gridDimsForSource(rulesJson)`; `params` itself
 * (unchanged, same object) when the source names no regions. Called where a
 * state meets a source: `buildRunFromState` (headless — the every-preset row,
 * the box gate's oracle), the panel's `_applyPreset` and its source adoption
 * (`_applyGridDimsFromSource`). `buildTopDownRun` does NOT call it: it reads
 * the grid verbatim, because the panel hands it the grid inputs' values.
 *
 * Measured (C2 W0, 2026-09-30): before this rule reached the preset apply, a
 * shipped top-down preset laid APCalc's 81 regions on the 3×3 default and
 * stopped `partial_layout` with 9 built; at the derived 12×12 all 81 place.
 */
export function sourceSizedParams(params, rulesJson, { pinned = [] } = {}) {
    const dims = gridDimsForSource(rulesJson);
    if (!dims) return params;
    const out = { ...params };
    for (const [axis, key] of Object.entries(TOPDOWN_GRID_KEYS)) {
        if (!pinned.includes(key)) out[key] = dims[axis];
    }
    return out;
}

/**
 * The base default params merged with every registered substrate's declared
 * `defaultProcgenParams` — the `defaults` a sparse preset is merged over.
 */
export function panelDefaultParams() {
    return defaultProcgenParams(DEFAULT_PARAMS);
}

// ── Helpers the four builders share (pure over a panel-shaped state) ──────

/** `{procgenParams}` for a compile input when an active substrate prices its regions, else `{}` (bulletml N5) */
function withPricingParams(activeIds, params) {
    const pp = pricingParamsOf(activeIds, params);
    return pp ? { procgenParams: pp } : {};
}

/** Positive entries of a quota/mix dict, or null when none — null means "use
 *  the engine's default" to every engine entry that takes one. */
function positiveOrNull(dict) {
    const positive = Object.entries(dict ?? {}).filter(([, v]) => v > 0);
    if (positive.length === 0) return null;
    return Object.fromEntries(positive);
}

/** The substrate mix to pass to the engine, or null when nothing is selected
 *  (zero / negative weights filtered — a guard for stale persisted state). */
export function effectiveSubstrateMix(substrateMix) {
    return positiveOrNull(substrateMix);
}

/** Same filtering / null-on-empty contract, for the per-substrate quotas. */
export function effectiveSubstrateQuotas(substrateQuotas) {
    return positiveOrNull(substrateQuotas);
}

/**
 * The hazardOpts payload for growMaze / topDownFromRulesJson / the step
 * runners. Null when hazards are disabled — every engine entry treats null as
 * "no hazards."
 */
export function effectiveHazardOpts(params) {
    if (!params.enableHazards) return null;
    const count = Math.max(0, Math.floor(params.hazardCount ?? 0));
    if (count === 0) return null;
    return {
        enabled: true,
        count,
        maxConsecutiveFails: Math.max(1, Math.floor(params.hazardMaxConsecutiveFails ?? 10)),
        wallOverlapAllowed: !!params.hazardWallOverlapAllowed,
    };
}

/**
 * The currently-active substrate dictionary — the quotas dict in the modes that
 * count regions (shuffled spiral, sphere growth, grid growth in quotas mode),
 * otherwise the mix dict (grid growth in mix mode, top-down). Returns the
 * state's OWN object: the panel mutates whichever this returns.
 */
export function activeSubstrateDict({ mode, substrateMode, substrateQuotas, substrateMix }) {
    if (mode === 'shuffledSpiral' || mode === 'sphereGrowth') return substrateQuotas;
    if (mode === 'gridGrowth' && substrateMode === 'quotas') return substrateQuotas;
    return substrateMix;
}

/**
 * The shared item library plus any `libraryItems` declared by the selected
 * substrates (registry-declared so the shared library needn't carry them).
 */
export function mergedItemLib(state) {
    const merged = { ...DEFAULT_ITEMS };
    for (const [id, count] of Object.entries(activeSubstrateDict(state))) {
        if (!(Number(count) > 0)) continue;
        const extra = substrateRegistry.get(id)?.libraryItems;
        if (extra) Object.assign(merged, extra);
    }
    // ⛓ CONCEPT LIBRARY T1 — an ITEM concept the world names joins its item
    // library as the table's rows (`itemRowsOf`: name, id, colour, symbol),
    // never over a row a library already declares. An empty list adds nothing.
    // ⛓ T0b — each added row is MARKED (`markConceptRow`: `concept: '<id>'`),
    // so the tile-grid serializer carries it into the payload and the item
    // picker groups it under the substrates that realise it.
    for (const cid of state.params?.concepts ?? []) {
        for (const row of itemRowsOf(CONCEPTS[cid])) {
            if (!(row.id in merged)) merged[row.id] = markConceptRow(row, cid);
        }
    }
    return merged;
}

/**
 * Completion-condition item for the emitted rules.json. Scenario pool first
 * (first item flagged is_victory with a positive count); failing that, the
 * first selected substrate that declares a `victoryItem` on its registry entry
 * (a zone substrate places its victory item from its own tables, invisible to
 * the scenario pool). Null when neither contributes — buildRulesJson then keeps
 * the scaffold's constant-true default.
 */
export function resolveVictoryItemId(state) {
    const lib = mergedItemLib(state);
    const fromScenario = Object.entries(state.scenario.items)
        .find(([id, count]) => count > 0 && lib[id]?.is_victory)?.[0];
    if (fromScenario) return fromScenario;
    for (const [id, count] of Object.entries(activeSubstrateDict(state))) {
        if (!(Number(count) > 0)) continue;
        const victoryItem = substrateRegistry.get(id)?.victoryItem;
        if (victoryItem) return victoryItem;
    }
    return null;
}

/**
 * Can a substrate host a sphere-growth library node? True when its registry
 * adapter provides the requirement-aware `instantiateLibraryEntryForSpecs` hook
 * — the exact predicate the engine's resolveSphereLibrarySources uses.
 */
export function substrateSphereCapable(name) {
    return typeof substrateRegistry.get(name)?.instantiateLibraryEntryForSpecs === 'function';
}

/** Does a resolved library document carry at least one sphere-capable entry? */
export function librarySphereCapable(library) {
    return (library?.entries ?? []).some((e) => substrateSphereCapable(e.substrate));
}

/**
 * The selected libraries usable as SPHERE content sources: the sphere-capable
 * subset. A pack with none would throw in resolveSphereLibrarySources, so it is
 * dropped here. [] when nothing sphere-capable is selected, so library-less
 * sphere worlds take no new code path (byte-inert).
 */
export function sphereRegionLibraries(resolvedLibraries) {
    return (resolvedLibraries ?? []).filter((w) => librarySphereCapable(w.library));
}

/**
 * The substrates the selected SPHERE libraries' entries realise, each once, in
 * the order they first appear. Their `buildLibraryRegionParams` /
 * `renderLibraryProcgenParams` hooks are the ones a library selection consults
 * (C1: this replaced a helper that asked for the maze by name).
 */
export function sphereLibrarySubstrateIds(resolvedLibraries) {
    const ids = new Set();
    for (const w of sphereRegionLibraries(resolvedLibraries)) {
        for (const e of w.library?.entries ?? []) {
            if (substrateSphereCapable(e.substrate)) ids.add(e.substrate);
        }
    }
    return [...ids];
}

// ── Sphere growth ──────────────────────────────────────────────────────────

/**
 * The frozen-at-① cfg every sphere step reads. Selected sphere-capable
 * libraries merge into the quotas as `library:<id>` content sources (each
 * carrying its libraryDoc on substrateConfig); with none, quotas stays the
 * exact effectiveSubstrateQuotas value (null when empty) and substrateConfig is
 * null, so a library-less world is byte-identical.
 */
export function buildSphereConfig(state, resolvedLibraries = []) {
    const { params } = state;
    const { seed, regionWidth, regionHeight, maxItemsPerRegion,
        sphereCount, fillerCount, revisitPercent, spheresPerBatch,
        startSubstrate } = params;
    const startSub = (startSubstrate && startSubstrate !== 'auto') ? startSubstrate : null;
    const baseQuotas = effectiveSubstrateQuotas(state.substrateQuotas);
    const sphereLibs = sphereRegionLibraries(resolvedLibraries);
    let quotas = baseQuotas;
    let substrateConfig = null;
    if (sphereLibs.length > 0) {
        const merged = buildLibrarySpiralConfig(
            sphereLibs, { substrateQuotas: baseQuotas ?? {}, substrateConfig: {} });
        quotas = merged.substrateQuotas;
        substrateConfig = merged.substrateConfig;
    }
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
        substrateConfig,
        activeIds: activeSubstrateIds(quotas, startSub),
        itemLib: mergedItemLib(state),
        itemPool: { ...state.scenario.items },
        victoryItemId: resolveVictoryItemId(state),
        enableLoopMode: !!params.enableLoopMode,
        regionXpEffect: params.regionXpEffect ?? 'cost',
        hazardOpts: effectiveHazardOpts(params),
    };
}

/**
 * cfg + prep → the sphere runner's flat resolved config. `itemPool` is the
 * POST-prep pool the plan is built from (prep may have removed items).
 */
export function sphereRunConfig(cfg, prep, itemPool, { params, resolvedLibraries = [] }) {
    // A selected library's substrates contribute the regionParams their library
    // entries read (the maze's connection strictness flags, region-library F6c)
    // — ONLY when such a library is selected, so a world without one takes no
    // new regionParams keys (byte-identical).
    const libraryParams = assembleLibraryRegionParams({
        substrateIds: sphereLibrarySubstrateIds(resolvedLibraries), mode: 'sphere', params,
    });
    const regionParamsExtra = Object.keys(libraryParams).length > 0
        ? { ...prep.regionParams, ...libraryParams }
        : prep.regionParams;
    return {
        seed: cfg.seed,
        regionSize: { width: cfg.regionWidth, height: cfg.regionHeight },
        itemLib: cfg.itemLib,
        regionParams: assembleRegionParams({
            activeIds: cfg.activeIds, mode: 'sphere', params, extra: regionParamsExtra,
        }),
        hazardOpts: cfg.hazardOpts,
        maxItemsPerRegion: cfg.maxItemsPerRegion,
        fillerCount: cfg.fillerCount,
        revisitRatio: cfg.revisitPercent / 100,
        substrateQuotas: cfg.quotas ?? null,
        // Region-library content sources (F6d) — present only when a
        // sphere-capable library is selected; growConfigFrom carries it into
        // growthParams.substrateConfig for resolveSphereLibrarySources.
        ...(cfg.substrateConfig ? { substrateConfig: cfg.substrateConfig } : {}),
        startSubstrate: cfg.startSub ?? null,
        sphereCount: cfg.sphereCount,
        spheresPerBatch: cfg.spheresPerBatch ?? null,
        victoryItem: cfg.victoryItemId ?? null,
        exclusiveSpheres: prep.exclusiveSpheres ?? {},
        startingItems: prep.startingItems ?? [],
        pinnedCanonicalItems: prep.pinnedCanonicalItems ?? [],
        enableLoopMode: cfg.enableLoopMode,
        regionXpEffect: cfg.regionXpEffect ?? 'cost',
        itemPool,
        // ⛓ bulletml N5: only when an active substrate prices its regions (bytes kept otherwise)
        ...withPricingParams(cfg.activeIds, params),
    };
}

/**
 * Sphere growth's whole ① input: the cfg, the substrates' pre-plan
 * contributions (`prepareSphereGrowth` hooks — each may grant starting items,
 * reserve sphere-1 pickups, lock placements, remove pool items or add
 * regionParams; the hook mutates `itemPool` via its delta), the POST-prep pool,
 * and the flat `config` the runner consumes (`newEnvelope(config)`).
 */
export function buildSphereRun(state, { resolvedLibraries = [] } = {}) {
    const cfg = buildSphereConfig(state, resolvedLibraries);
    const itemPool = { ...cfg.itemPool };
    const prep = collectSphereGrowthPrep({
        activeIds: cfg.activeIds, itemPool, quotas: cfg.quotas,
        startSubstrate: cfg.startSub, seed: cfg.seed, params: state.params,
    });
    const config = sphereRunConfig(cfg, prep, itemPool,
        { params: state.params, resolvedLibraries });
    return { cfg, prep, itemPool, config };
}

// ── Shuffled spiral ────────────────────────────────────────────────────────

/**
 * The `newSpiralEnvelope({ config, compileIn })` input. Substrate quotas merge
 * with the selected region-library content sources (each a `library:<id>`
 * quota + its libraryDoc on substrateConfig).
 */
export function buildSpiralRun(state, { resolvedLibraries = [] } = {}) {
    const { params } = state;
    const { seed, regionWidth, regionHeight, maxItemsPerRegion, startSubstrate } = params;
    const { substrateQuotas, substrateConfig } = buildLibrarySpiralConfig(
        resolvedLibraries ?? [],
        { substrateQuotas: effectiveSubstrateQuotas(state.substrateQuotas) ?? {}, substrateConfig: {} },
    );
    // ⛓ SEEDLING SWIM S2 D1: a quota substrate may turn a bag knob into its own
    //   `substrateConfig[id]` entry (`pipelineConfigFromParams`), which ①'s
    //   `applyPipelineConfig` installs. An entry answering null adds no key, so a
    //   world that sets no such knob keeps its bytes.
    for (const [id, count] of Object.entries(substrateQuotas)) {
        if (!(Number(count) > 0) || substrateConfig[id] !== undefined) continue;
        const own = substrateRegistry.get(id)?.pipelineConfigFromParams?.({ params });
        if (own) substrateConfig[id] = own;
    }
    if (Object.keys(substrateQuotas).length === 0) {
        throw new Error('shuffled-spiral requires at least one substrate '
            + 'with a positive quota (set Substrate allocation to Quotas) '
            + 'or a selected region library');
    }
    const config = {
        regionSize: { width: regionWidth, height: regionHeight },
        itemPool: { ...state.scenario.items },
        obstaclePool: { ...state.scenario.obstacles },
        seed,
        // ⛓ seedling generated G3: the in-quota substrates' `buildRegionParams`
        //   hooks, in the default ('sphere') mode, as sphere growth passes them —
        //   so a per-region knob reaches the core here too. Measured byte-inert for
        //   every digest, shipped preset and committed spiral preset (the hooks'
        //   defaults build what `{}` built).
        regionParams: assembleRegionParams({ activeIds: Object.keys(substrateQuotas), mode: 'sphere', params }),
        growthParams: {
            substrateQuotas,
            maxItemsPerRegion,
            ...(startSubstrate && startSubstrate !== 'auto'
                ? { startSubstrate } : {}),
            ...(Object.keys(substrateConfig).length
                ? { substrateConfig } : {}),
        },
        hazardOpts: effectiveHazardOpts(params),
    };
    const compileIn = {
        seed,
        enableLoopMode: !!params.enableLoopMode,
        regionXpEffect: params.regionXpEffect ?? 'cost',
        completionConditionItem: resolveVictoryItemId(state),
        // ⛓ bulletml N5: only when an in-quota substrate prices its regions (bytes kept otherwise)
        ...withPricingParams(Object.keys(substrateQuotas), params),
        // ⛓ tutorial-bugs: maze rooms play as zones — the payload's `arrival`
        //   (stamped only by a substrate that declares the field; absent = region).
        ...(params.mazeArrival === 'zone' ? { arrival: 'zone' } : {}),
    };
    return { config, compileIn };
}

// ── Top-down ───────────────────────────────────────────────────────────────

/**
 * The `buildTopDownEnvelope` input: the source rules.json plus the mix,
 * regionParams (the in-mix substrates' `buildRegionParams` hooks), hazardOpts
 * and sphere log. `sphereLog` null = the source's own embedded log, if any.
 * The grid is `state.params.gridWidth/gridHeight` VERBATIM (the panel passes
 * its grid inputs); sizing the grid to the source is `sourceSizedParams`'s job,
 * done before this is called (`buildRunFromState`, the panel's apply/adoption).
 */
export function buildTopDownRun(state, { topDownSource = null, sphereLog = null } = {}) {
    if (!topDownSource) {
        throw new Error('top-down needs a source rules.json to realise, and none was given');
    }
    const { params } = state;
    const { seed, gridWidth, gridHeight, regionWidth, regionHeight } = params;
    const mix = effectiveSubstrateMix(state.substrateMix);
    const activeIds = Object.entries(mix ?? {})
        .filter(([, w]) => Number(w) > 0).map(([id]) => id);
    return {
        source: topDownSource,
        seed,
        gridDims: { width: gridWidth, height: gridHeight },
        regionSizeBase: { width: regionWidth, height: regionHeight },
        substrateMix: mix,
        regionParams: assembleRegionParams({ activeIds, mode: 'topDown', params }),
        hazardOpts: effectiveHazardOpts(params),
        sphereLog,
        enableLoopMode: !!params.enableLoopMode,
        regionXpEffect: params.regionXpEffect ?? 'cost',
    };
}

// ── Grid growth ────────────────────────────────────────────────────────────

/**
 * Grid growth's `growMazeAsync` config (`grow`) and the `buildRulesJson` inputs
 * that do not depend on the grown grid (`compile`; the grower's startCell and
 * stop reason are added by compileGridRun).
 */
export function buildGridRun(state) {
    const { params } = state;
    const { seed, gridWidth, gridHeight, regionWidth, regionHeight,
        maxItemsPerRegion, maxRegions, startSubstrate,
        stopOnPoolEmpty, asymmetricExits } = params;
    const useQuotas = state.substrateMode === 'quotas';
    const quotas = useQuotas ? effectiveSubstrateQuotas(state.substrateQuotas) : null;
    const mix = !useQuotas ? effectiveSubstrateMix(state.substrateMix) : null;
    return {
        grow: {
            gridDims: { width: gridWidth, height: gridHeight },
            regionSize: { width: regionWidth, height: regionHeight },
            itemPool: { ...state.scenario.items },
            obstaclePool: { ...state.scenario.obstacles },
            seed,
            // ⛓ seedling generated G3 — the spiral's pass-through, for the grid.
            regionParams: assembleRegionParams({ activeIds: Object.keys(quotas ?? mix ?? {}), mode: 'sphere', params }),
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
            hazardOpts: effectiveHazardOpts(params),
        },
        compile: {
            seed,
            enableLoopMode: !!params.enableLoopMode,
            regionXpEffect: params.regionXpEffect ?? 'cost',
            completionConditionItem: resolveVictoryItemId(state),
        },
    };
}

/** A grown grid-growth world (growMazeAsync's result) → its rules.json. */
export function compileGridRun(run, { grid, stats, startCell }) {
    return buildRulesJson(grid, {
        startCell,
        ...run.compile,
        procgenMetadata: {
            driver: 'grid-growth',
            stop_reason: stats.stopReason,
        },
    });
}

// ── What a preset DEFINITION names, and what generating it costs ──────────

/**
 * ⛓ `GENERATION_COST` and the entry-level rule live in `procgenCore/
 * substratePredicates.js` (substrate chart S1), so the capability chart's
 * "Generates quickly" and the CI preset row read one declaration one way;
 * re-exported here for this module's importers.
 */
export { GENERATION_COST };

/**
 * A registered substrate's declared generation cost class. A value outside
 * GENERATION_COST is refused in words rather than read as either class.
 */
export function substrateGenerationCost(id) {
    return generationCostOf(substrateRegistry.get(id), id);
}

/**
 * Every substrate id a preset/persisted bundle NAMES, read off the definition
 * itself — its quota and mix keys with a positive value and an explicit start
 * substrate — BEFORE applyPresetState filters them against the registry. (A
 * library selection is not a substrate id and is not listed.) This is what a
 * guard must check: applyPresetState drops an unregistered id silently, and the
 * world then generates without it.
 */
export function presetSubstrateIds(bundle) {
    const ids = new Set();
    for (const dict of [bundle?.substrateQuotas, bundle?.substrateMix]) {
        for (const [id, v] of Object.entries(dict ?? {})) if (v > 0) ids.add(id);
    }
    const start = bundle?.params?.startSubstrate;
    if (start && start !== 'auto') ids.add(start);
    return [...ids];
}

/** The substrates a bundle names whose declared generation cost is HEAVY. */
export function heavySubstrateIds(bundle) {
    return presetSubstrateIds(bundle)
        .filter((id) => substrateGenerationCost(id) === GENERATION_COST.HEAVY);
}

// ── A preset → its run → its world ─────────────────────────────────────────

/**
 * A preset / persisted bundle → `{ mode, run }`. The bundle is normalised by
 * `applyPresetState` (sparse params merged over `defaults`, quota/mix entries
 * whose substrate is not registered dropped) — the same path the panel's apply
 * and its session restore take — and the mode's builder assembles the run:
 *
 *   sphereGrowth   → buildSphereRun   ({ cfg, prep, itemPool, config })
 *   shuffledSpiral → buildSpiralRun   ({ config, compileIn })
 *   topDown        → buildTopDownRun  (buildTopDownEnvelope's input), its grid
 *                    sized to `topDownSource` on every axis the bundle's
 *                    params do not pin (`sourceSizedParams`, `pinnedGridKeys`)
 *   gridGrowth     → buildGridRun     ({ grow, compile })
 *
 * `ctx.defaults` defaults to panelDefaultParams() (the registry must be
 * populated first). A bundle naming no valid mode is REFUSED — a headless run
 * has no "current mode" to fall back on.
 */
export function buildRunFromState(bundle, {
    defaults = panelDefaultParams(), resolvedLibraries = [],
    topDownSource = null, sphereLog = null,
} = {}) {
    if (!VALID_MODES.includes(bundle?.mode)) {
        throw new Error(`buildRunFromState: the bundle's mode ${JSON.stringify(bundle?.mode)} `
            + `is not one of ${VALID_MODES.join(', ')}, so there is no pipeline to assemble a run for`);
    }
    const state = applyPresetState(bundle, {
        defaults,
        hasSubstrate: (id) => substrateRegistry.has(id),
        current: {
            params: defaults,
            scenario: { items: {}, obstacles: {} },
            substrateMode: 'quotas',
            mode: bundle.mode,
            libraries: [],
        },
    });
    const { mode } = state;
    if (mode === 'sphereGrowth') return { mode, run: buildSphereRun(state, { resolvedLibraries }) };
    if (mode === 'shuffledSpiral') return { mode, run: buildSpiralRun(state, { resolvedLibraries }) };
    if (mode === 'topDown') {
        // The grid follows the source unless the bundle pins it — what the
        // panel's _applyPreset does with the same bundle over the same source.
        const params = sourceSizedParams(state.params, topDownSource,
            { pinned: pinnedGridKeys(bundle.params) });
        return { mode, run: buildTopDownRun({ ...state, params }, { topDownSource, sphereLog }) };
    }
    return { mode, run: buildGridRun(state) };
}

/**
 * Drive a `{ mode, run }` to its compiled rules.json through the mode's own
 * runner — the step modules' envelope + runToStep, grid growth through the
 * engine — exactly as the panel's Generate does. Returns
 * `{ rulesJson, stats, ms, oracleErrors }` (`oracleErrors` is sphere growth's
 * plan-vs-world oracle; null for the modes that have none).
 */
export async function runPresetHeadless({ mode, run }, { onProgress = null } = {}) {
    const t0 = Date.now();
    const opts = onProgress ? { onProgress } : {};
    let rulesJson;
    let stats;
    let oracleErrors = null;
    if (mode === 'sphereGrowth') {
        const env = await runSphereToStep(newSphereEnvelope(run.config), 'compile', opts);
        ({ rulesJson, oracleErrors } = env.compile);
        ({ stats } = env.grow);
    } else if (mode === 'shuffledSpiral') {
        const env = await runSpiralToStep(newSpiralEnvelope(run), 'compile', opts);
        ({ rulesJson } = env.compile);
        ({ stats } = env.regions);
    } else if (mode === 'topDown') {
        const env = await runTopDownToStep(buildTopDownEnvelope(run), 'compile', opts);
        ({ rulesJson } = env.compile);
        ({ stats } = env.finalize);
    } else if (mode === 'gridGrowth') {
        const grown = await growMazeAsync(run.grow, onProgress);
        rulesJson = compileGridRun(run, grown);
        ({ stats } = grown);
    } else {
        throw new Error(`runPresetHeadless: no runner for mode ${JSON.stringify(mode)}`);
    }
    return { rulesJson, stats, ms: Date.now() - t0, oracleErrors };
}
