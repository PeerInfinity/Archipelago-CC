/**
 * apworldEditor/slotInitialise — **A BARE SLOT'S PROCGEN DATA, BUILT IN PLACE**
 * (APWORLD SUBSTRATE CHANGE R7; plan §19, ⚖ user 2026-09-26: *"Let's go with
 * those recommendations"*).
 *
 * A classic AP document carries no `preset_sidecars` entries for its slot: the
 * hub's Map has nothing to draw, a region has no block, and `set-region-sidecar`
 * never creates. *Initialise procgen data* lays the slot's regions on a grid and
 * realises every one under ONE substrate (⚖ #4) — the engine's own top-down
 * stages, in order, on the CURRENT document:
 *
 *   ① `layoutTopDown`   — BFS from the start onto a fresh grid (Menu stripped,
 *                          exactly as the pipeline strips it; R8: every Menu
 *                          exit's target a root — the Menu is the HUB),
 *   ② `realiseTopDownGen` — one `{type: 'region', index, total}` per region (the
 *                          progress the form ticks), names KEPT
 *                          (`useSourceLocationName`), rules the document's,
 *   ③ `finalizeTopDown` — teleporters, the synthetic RETURN exits when asked,
 *                          reverse links, entrances,
 *   ④ `buildPresetSidecars` — the slot's entries, through `serializeRegionEntry`.
 *
 * ⛓⛓ The pipeline's hand-off runs the same four and then `buildRulesJson` — a
 * NEW document. This writes the slot into the one the reader holds and leaves
 * `regions[p]` alone, EXCEPT for the return exits (⚖ #1, default ON): the
 * payloads then carry an exit back to each region's BFS parent that the
 * document's regions block lacks, and the pipeline's compile writes exactly that
 * exit into the block (`compileRegionGraph` → `makeExit`), with the paired
 * FORWARD exit's rule (`buildRulesJson`'s bidirectional post-pass: *"the same
 * gate guards both directions"*). `returnExitsOf` answers the same exits, so the
 * op adds them visibly and one Undo takes them back.
 *
 * ⛓⛓ S1 — the realiser is handed the target's library items FREE (the
 * pipeline's `grantedLibraryItems`, imported), so the RESULT carries them
 * (`grantedItems`, `grantedDefs`) and the op DECLARES them: a def each in
 * `items[p]` and the names in `starting_items[p]` — the lines the pipeline's
 * compile writes for the same grants.
 *
 * ⛓ The regions the layout cannot place (no incoming exit; no free cell; …) are NAMED with a `why` DERIVED from the graph (⚖ #2) and the rest
 * are built — never a refusal of the whole initialise.
 *
 * ⛔ The op (`initialise-procgen-layout`, `rulesDocOps.js`) is the authority:
 * every refusal SENTENCE lives there; this module answers FACTS. ⛔ No
 * substrate is named here — the default is the engine's `DEFAULT_SUBSTRATE_ID`.
 */

import {
    DEFAULT_SUBSTRATE_ID, buildPresetSidecars, computeSourceCounts, finalizeTopDown, getRegionExits, layoutTopDown,
    realiseTopDownGen, resolveTopDownStart,
} from '../procgenPipeline/procgenPipelineEngine.js';
import { assembleRegionParams, mergeSubstrateItemLib } from '../procgenPipeline/sphereConfigHooks.js';
import { effectiveHazardOpts, topDownGridSide } from '../procgenPipeline/presetRun.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { DEFAULT_ITEMS, DEFAULT_OBSTACLES } from '../shared/procgen/library.js';
import { makeTrueRule } from '../shared/rulesJsonBuilder.js';
import { createRng } from '../shared/rng.js';
import { regionsOf, startRegionsOf } from '../procgenCore/rulesGraph.js';
import { SUBSTRATE_CONFIGS_KEY, recordableConfigsFor } from '../procgenCore/substrateConfigRecord.js';
import { grantedLibraryItems } from '../procgenPipeline/topDownSteps.js';
import { INITIALISE_DRIVER } from './initialiseDriver.js';
import {
    REGENERATE_BASE_REGION_PARAMS, regionRealiserKind, regionSizeFor,
} from './regionRegenerate.js';

export { DEFAULT_SUBSTRATE_ID };

/** ⛓ The op's name, as data. */
export const INITIALISE_OP = 'initialise-procgen-layout';

/** ⛓ The `procgen_metadata.driver` an initialised slot records (its own module: the preset card reads it). */
export { INITIALISE_DRIVER };

/** ⛓ The return-exit choice (⚖ #1: `add` is the default, the pipeline's). */
export const BACK_EXITS = Object.freeze({ ADD: 'add', NONE: 'none' });

/** ⛓ The first seed the form offers. */
export const INITIALISE_FIRST_SEED = 1;

/**
 * ⛓⛓ **WHY A REGION GETS NO CELL**, derived from the graph (never typed per
 * fixture), in the order they are tested:
 *   · `NO_INCOMING` — no other region has an exit to it;
 *   · `NO_FREE_CELL` — a PLACED region leads to it, or the stripped Menu does
 *     (M2: every Menu exit's target is a ROOT the layout tries — R8, shape A),
 *     but the grid had no cell left;
 *   · `ONLY_FROM_UNPLACED` — it is reached only from regions that got no cell.
 *
 * ⛔ M2 RETIRED `ONLY_FROM_MENU` (*"reachable only from Menu"*). Until M1 the
 * layout rooted only the Menu's FIRST exit, so a region fed only by the others
 * was left out by rule. M1 made every Menu exit a root: `layoutTopDown` tries
 * each one and, when no cell is free, counts `stats.regionsSkipped` — a cell
 * shortage, which the auto side grows for. Measured (plan §27.0): 48 such
 * regions in 15 of the 146 bare slots at the auto side, every one placed at 2×
 * the side; the layout is total, so no document can reach the old why.
 */
export const UNPLACED_WHY = Object.freeze({
    NO_INCOMING: 'no incoming exit',
    NO_FREE_CELL: 'no free grid cell',
    ONLY_FROM_UNPLACED: 'reachable only from unplaced regions',
});

/** ⛓ Why a slot cannot be initialised — facts, not sentences (the op words them). */
export const INITIALISE_BLOCKERS = Object.freeze({
    NO_REGIONS: 'no-regions',
    HAS_ENTRIES: 'has-entries',
    NO_START: 'no-start',
    HAS_METADATA: 'has-metadata',
    // ⛓ M3 — more than one declared start: the layout takes one (it throws
    // `TOPDOWN_START_REFUSALS.multiStart`); the op refuses first, by name.
    MULTI_START: 'multi-start',
});

/** ⛓ The slot's sidecar entries (an object; `{}` when the slot has none). */
const entriesOf = (doc, player) => {
    const s = doc?.preset_sidecars?.[player];
    return s && typeof s === 'object' && !Array.isArray(s) ? s : {};
};

/**
 * ⛓ The declared start as the layout resolves it: a PURE hub (exits, no
 * locations — whatever it is called) hands the start to its first exit's
 * target, any other start is the start — the engine's own rule
 * (`resolveTopDownStart`), imported (R9; name-free since M3).
 */
function resolvedStart(regions, declared) {
    const r = resolveTopDownStart(regions, declared);
    return r ? { start: r.actualStart, menu: r.menuName } : { start: null, menu: null };
}

/**
 * ⛓⛓ **CAN THIS SLOT BE INITIALISED?** — the facts the door and the op read.
 *
 * @returns {{player: string, regions: number, entries: number, declaredStart: string|null,
 *   declaredStarts: string[], start: string|null,
 *   menu: string|null, bare: boolean, blocker: string|null}}
 *   `blocker` is one of `INITIALISE_BLOCKERS`, or null when the slot can be
 *   initialised. `bare` = the slot carries no sidecar entry (the door's test).
 */
export function initialiseFacts(doc, player) {
    const p = String(player);
    const regions = regionsOf(doc, p);
    const n = Object.keys(regions).length;
    const entries = Object.keys(entriesOf(doc, p)).length;
    // ⛓ M3 — the WHOLE list: the layout refuses more than one declared start.
    const declaredStarts = [...startRegionsOf(doc, p).default];
    const [declared = null] = declaredStarts;
    const { start, menu } = resolvedStart(regions, declared);
    let blocker = null;
    if (n === 0) blocker = INITIALISE_BLOCKERS.NO_REGIONS;
    else if (entries > 0) blocker = INITIALISE_BLOCKERS.HAS_ENTRIES;
    else if (declaredStarts.length > 1) blocker = INITIALISE_BLOCKERS.MULTI_START;
    else if (!start) blocker = INITIALISE_BLOCKERS.NO_START;
    else if (doc?.procgen_metadata !== undefined) blocker = INITIALISE_BLOCKERS.HAS_METADATA;
    return {
        player: p, regions: n, entries, declaredStart: declared, declaredStarts, start, menu, bare: entries === 0, blocker,
    };
}

/** ⛓ The grid side the auto rule STARTS from for a slot of `n` regions — the hand-off's rule (`topDownGridSide`). */
export function initialiseGridSide(n) {
    return topDownGridSide(n);
}

/**
 * ⛓ How far the auto rule may GROW the side, as a multiple of where it started.
 * Measured (R7): the hand-off's side leaves `no free grid cell` regions on the
 * big documents (`alttp_worldgen` 239 regions at 19×19: 6 of them, and 20 more
 * reachable only through those); one grown side fits them.
 */
export const INITIALISE_GRID_GROWTH_LIMIT = 2;

/**
 * ⛓⛓ **THE AUTO GRID SIDE** — `initialiseGridSide(n)`, then GROWN one at a
 * time while the layout (① only — milliseconds) leaves a region for want of a
 * cell (`UNPLACED_WHY.NO_FREE_CELL`), up to `INITIALISE_GRID_GROWTH_LIMIT` ×
 * the start. A region the layout cannot place for any OTHER reason is not a
 * size matter (plan §19: 235/238 at 22, 26 and 30 alike), so it stops nothing.
 * The layout draws on the seed, so the side does too.
 *
 * @returns {{side: number, start: number, grown: number}}
 */
export function autoGridSide(doc, player, { substrate, seed, backExits, bag } = {}) {
    const p = String(player);
    const start = initialiseGridSide(Object.keys(regionsOf(doc, p)).length);
    const cap = start * INITIALISE_GRID_GROWTH_LIMIT;
    let side = start;
    for (; side < cap; side += 1) {
        const plan = planInitialise(doc, p, { substrate, seed, backExits, bag, gridDims: { width: side, height: side } });
        if (!plan.ok || !plan.unplaced.some((u) => u.why === UNPLACED_WHY.NO_FREE_CELL)) break;
    }
    return { side, start, grown: side - start };
}

/** ⛓ The realiser targets, in registry order — the form's substrate list. */
export function initialiseTargets() {
    return substrateRegistry.getAll().filter((e) => regionRealiserKind(e) !== null).map((e) => e.id);
}

/**
 * ⛓ The generic bag keys the LAYOUT reads — the region size (`regionSizeBase`).
 * Every other bag key is a realiser knob (the target's own `defaultProcgenParams`).
 */
export const INITIALISE_SIZE_KEYS = Object.freeze({ width: 'regionWidth', height: 'regionHeight' });

/**
 * ⛓ The knobs a target is realised with — the R2 composition over the BAG (S2:
 * the form's; absent = the target's own `defaultProcgenParams`, the pre-S2
 * answer): `regionParams` through its `buildRegionParams` (top-down mode) over
 * top-down's `{maxIterations: 0}`, `hazardOpts` through `effectiveHazardOpts`.
 */
export function initialiseKnobs(substrate, bag) {
    const entry = substrateRegistry.get(substrate);
    if (bag === undefined) bag = { ...(entry?.defaultProcgenParams ?? {}) };
    return {
        regionParams: {
            ...REGENERATE_BASE_REGION_PARAMS,
            ...assembleRegionParams({ activeIds: [substrate], mode: 'topDown', params: bag }),
        },
        hazardOpts: effectiveHazardOpts(bag),
    };
}

const isDims = (d) => !!d && Number.isInteger(d.width) && Number.isInteger(d.height) && d.width >= 1 && d.height >= 1;

/**
 * ⛓ The region size the layout is handed: the bag's (S2 — the form's size
 * fields) when it carries both, else the slot's own (`regionSizeFor`).
 */
export function initialiseRegionSize(doc, player, bag) {
    const w = bag?.[INITIALISE_SIZE_KEYS.width];
    const h = bag?.[INITIALISE_SIZE_KEYS.height];
    if (Number.isInteger(w) && Number.isInteger(h)) return { width: w, height: h };
    const size = regionSizeFor(doc, player);
    return { width: size.width, height: size.height };
}

/** ⛓ The layout's options, one place for the plan and the build. */
function layoutOpts(doc, player, { substrate, gridDims, seed, backExits, bag }) {
    const regions = regionsOf(doc, player);
    const size = initialiseRegionSize(doc, player, bag);
    return {
        playerId: player,
        gridDims: { width: gridDims.width, height: gridDims.height },
        regionSizeBase: { width: size.width, height: size.height },
        seed,
        assumeBidirectional: backExits !== BACK_EXITS.NONE,
        substrateByRegion: Object.fromEntries(Object.keys(regions).map((n) => [n, substrate])),
    };
}

/**
 * ⛓⛓ **THE REGIONS THE LAYOUT LEFT OUT, EACH WITH ITS WHY** (`UNPLACED_WHY`),
 * in document order. The stripped Menu is not one of them: it is the layout's
 * HUB (R8), never a cell.
 *
 * ⛓ A region the stripped Menu's exits name (`menuFedOf`) is one the layout
 * TRIED as a root — so without a cell it is `NO_FREE_CELL`, exactly like a
 * region a placed one leads to. (The engine counts it in
 * `stats.regionsSkipped`; the population row holds the two together.)
 */
export function unplacedRegions(doc, player, layout) {
    const regions = regionsOf(doc, player);
    const placed = layout.cellsByName;
    const menuFed = menuFedOf(regions, layout.menuName);
    const incoming = new Map();
    for (const [from, r] of Object.entries(regions)) {
        for (const e of r?.exits ?? []) {
            const t = e?.connected_region;
            if (typeof t !== 'string' || t === from) continue;
            if (!incoming.has(t)) incoming.set(t, new Set());
            incoming.get(t).add(from);
        }
    }
    const out = [];
    for (const name of Object.keys(regions)) {
        if (placed.has(name) || name === layout.menuName) continue;
        const froms = [...(incoming.get(name) ?? [])];
        let why;
        if (froms.length === 0) why = UNPLACED_WHY.NO_INCOMING;
        else if (menuFed.has(name) || froms.some((f) => placed.has(f))) why = UNPLACED_WHY.NO_FREE_CELL;
        else why = UNPLACED_WHY.ONLY_FROM_UNPLACED;
        out.push({ region: name, why });
    }
    return out;
}

/**
 * ⛓ The regions the stripped Menu's exits name — every one a root the layout
 * tries (M1's `menuRoots` rule). Empty when the layout stripped no Menu (the
 * declared start is then a cell, and its exits' targets are ordinary children).
 */
function menuFedOf(regions, menuName) {
    const out = new Set();
    if (!menuName) return out;
    for (const e of regions[menuName]?.exits ?? []) {
        const t = e?.connected_region;
        if (typeof t === 'string' && t !== menuName && regions[t]) out.add(t);
    }
    return out;
}

/**
 * ⛓ The return exits ③ WILL insert, predicted off the layout: one per placed
 * non-start region whose document region has no exit named after its BFS parent
 * and none leading to it (`insertBackExit`'s `skipIfReverseExists`). A row
 * holds the prediction equal to what ③ inserted.
 */
function predictedReturnExits(layout) {
    let n = 0;
    for (const { name, parent } of layout.placementOrder) {
        if (!parent) continue;
        const exits = layout.sourceRegions[name]?.exits ?? [];
        if (exits.some((e) => e?.name === parent.name || e?.connected_region === parent.name)) continue;
        n += 1;
    }
    return n;
}

/**
 * ⛓ Normalise the caller's arguments: the default substrate, the auto grid (`autoGridSide`),
 * the first seed, return exits ON. (Refusals are the op's.)
 */
function normalise(doc, player, { substrate, gridDims, seed, backExits, bag } = {}) {
    const p = String(player);
    const sub = substrate ?? DEFAULT_SUBSTRATE_ID;
    const s = seed ?? INITIALISE_FIRST_SEED;
    const side = gridDims ? null : autoGridSide(doc, p, { substrate: sub, seed: s, backExits, bag }).side;
    return {
        player: p,
        substrate: sub,
        gridDims: gridDims ?? { width: side, height: side },
        seed: s,
        backExits: backExits ?? BACK_EXITS.ADD,
        // ⛓ S2 — the form's settings bag; absent = the target's defaults and the slot's size.
        ...(bag !== undefined ? { bag } : {}),
    };
}

/**
 * ⛓⛓ **WHAT GENERATE WOULD DO, FROM THE LAYOUT ALONE** (fast: ① only) — the
 * preview the form re-plans on every change.
 *
 * @returns {{ok: true, placed: number, total: number, unplaced: Array<{region, why}>,
 *   returnExits: number, teleporters: number, gridDims: {width, height}, menu: string|null,
 *   start: string, menuExits: number, menuRoots: Array<{name, exit_id}>} | {ok: false, threw: string}}
 */
export function planInitialise(doc, player, opts = {}) {
    const a = normalise(doc, player, opts);
    let layout;
    try {
        layout = layoutTopDown(doc, layoutOpts(doc, a.player, a), createRng(a.seed));
    } catch (e) {
        return { ok: false, threw: String(e?.message ?? e) };
    }
    return {
        ok: true,
        placed: layout.placementOrder.length,
        total: layout.stats.regionsTotal,
        unplaced: unplacedRegions(doc, a.player, layout),
        returnExits: a.backExits === BACK_EXITS.NONE ? 0 : predictedReturnExits(layout),
        teleporters: layout.teleporterEdges.length,
        gridDims: { ...a.gridDims },
        menu: layout.menuName,
        start: layout.actualStartName,
        // ⛓ M2 — the hub (R8): how many regions the stripped Menu's exits name,
        // and the roots the layout gave a cell (`layout.menuRoots` — a Menu
        // target left without one is absent there and `NO_FREE_CELL` above).
        menuExits: menuFedOf(regionsOf(doc, a.player), layout.menuName).size,
        menuRoots: layout.menuRoots.map((r) => ({ ...r })),
    };
}

/**
 * ⛓⛓ **THE RETURN EXITS ③ INSERTED, AS DOCUMENT EXITS** — per placed region in
 * BFS order, every payload exit flagged `isBackExit`: `{region, exit: {name,
 * connected_region, access_rule}}`, the rule the paired forward exit's in the
 * DOCUMENT (the pipeline's bidirectional post-pass), else `True_`.
 */
export function returnExitsOf(doc, player, layout) {
    const regions = regionsOf(doc, player);
    const out = [];
    for (const { name, cell } of layout.placementOrder) {
        const exits = getRegionExits(layout.grid.getRegion(cell));
        if (!exits) continue;
        for (const x of exits.values()) {
            if (!x?.isBackExit) continue;
            const fwd = (regions[x.targetRegion]?.exits ?? []).find((e) => e?.name === x.targetExitId);
            out.push({
                region: name,
                exit: {
                    name: x.exit_id,
                    connected_region: x.targetRegion,
                    access_rule: fwd?.access_rule ? JSON.parse(JSON.stringify(fwd.access_rule)) : makeTrueRule(),
                },
            });
        }
    }
    return out;
}

/** ⛓ The item ids the slot already uses — a granted def never takes one. */
export function itemIdsOf(doc, player) {
    return new Set(Object.values(doc?.items?.[player] ?? {}).map((d) => d?.id).filter(Number.isInteger));
}

/** ⛓ The extent of the cells, as `buildRulesJson` records `grid_dims`. */
function cellExtent(entries) {
    let w = 0;
    let h = 0;
    for (const e of Object.values(entries)) {
        const c = e?.grid_cell;
        if (!c) continue;
        w = Math.max(w, c.gx + 1);
        h = Math.max(h, c.gy + 1);
    }
    return { width: w, height: h };
}

/**
 * ⛓ The top-level blocks the realised substrate asks the document to carry
 * (`rulesJsonBlocks`, the compile's rule): `{key: value}`, possibly empty.
 */
export function substrateBlocksFor(substrate) {
    try {
        return substrateRegistry.get(substrate)?.rulesJsonBlocks?.() ?? {};
    } catch {
        return {};
    }
}

/**
 * ⛓⛓⛓ **INITIALISE THE SLOT** — the four stages, then the RESULT the op lands
 * inline: `{ok: true, entries, procgen_metadata, returnExits, blocks, unplaced,
 * stats: {placed, total, teleporters, returnExits}, gridDims, freeItems,
 * grantedItems, grantedDefs, ms}` (S1: the grants the realiser was handed free,
 * which the op DECLARES) or
 * `{ok: false, why, region?}` (the realiser threw — its message verbatim, and the
 * region it was building). The caller (the op) has refused every input it can
 * name; this answers what the engine did.
 *
 * @param {{doc, player, substrate?, gridDims?, seed?, backExits?, bag?, onProgress?, now?}} args
 */
export function initialiseSlot(args) {
    const { doc, onProgress = null, now = () => (globalThis.performance?.now?.() ?? Date.now()) } = args;
    const t0 = now();
    const a = normalise(doc, args.player, args);
    // ⛓ S1 — the pipeline's grant rule (`grantedLibraryItems`): the realiser is
    //   handed `startingItems` FREE, so the op must DECLARE the grants it built
    //   with (defs in `items[p]`, names in `starting_items[p]`).
    const grant = grantedLibraryItems(doc, a.player, [a.substrate], { avoidIds: itemIdsOf(doc, a.player) });
    const freeItems = grant.startingItems;
    const { regionParams, hazardOpts } = initialiseKnobs(a.substrate, a.bag);
    let layout;
    let building = null;
    try {
        layout = layoutTopDown(doc, layoutOpts(doc, a.player, a), createRng(a.seed));
        const gen = realiseTopDownGen(layout, {
            itemLib: mergeSubstrateItemLib(DEFAULT_ITEMS, [a.substrate]),
            obstacleLib: DEFAULT_OBSTACLES,
            regionParams,
            hazardOpts,
            consumableTileOpts: null,
            freeItems,
        });
        for (let r = gen.next(); !r.done; r = gen.next()) {
            building = r.value?.region_id ?? building;
            onProgress?.(r.value);
        }
        building = null;
        finalizeTopDown(layout);
    } catch (e) {
        return { ok: false, why: String(e?.message ?? e), ...(building ? { region: building } : {}) };
    }
    const sidecars = buildPresetSidecars(layout.grid, {
        playerId: a.player,
        baseObstacleLib: DEFAULT_OBSTACLES,
        baseItemLib: mergeSubstrateItemLib(DEFAULT_ITEMS, [a.substrate]),
        manaEnabled: false,
    });
    const entries = sidecars[a.player];
    const returnExits = a.backExits === BACK_EXITS.NONE ? [] : returnExitsOf(doc, a.player, layout);
    const realised = [...new Set(Object.values(entries).map((e) => e.substrate))];
    const configs = recordableConfigsFor(realised, (id) => substrateRegistry.get(id));
    const procgenMetadata = {
        driver: INITIALISE_DRIVER,
        player: a.player,
        source_game: doc?.game_name ?? null,
        source_counts: computeSourceCounts(doc, a.player),
        stop_reason: layout.stats.stopReason,
        region_count: Object.keys(entries).length,
        grid_dims: cellExtent(entries),
        ...(configs ? { [SUBSTRATE_CONFIGS_KEY]: configs } : {}),
    };
    return {
        ok: true,
        entries,
        procgen_metadata: procgenMetadata,
        returnExits,
        blocks: substrateBlocksFor(a.substrate),
        unplaced: unplacedRegions(doc, a.player, layout),
        stats: {
            placed: Object.keys(entries).length,
            total: layout.stats.regionsTotal,
            teleporters: layout.stats.teleportersPlaced,
            returnExits: returnExits.length,
        },
        gridDims: { ...a.gridDims },
        freeItems,
        grantedItems: grant.grantedItems,
        grantedDefs: grant.defs,
        ms: now() - t0,
    };
}

/**
 * ⛓ The op a landed initialise records (the cheap-to-refold class, §9.3's rule):
 * the worker's RESULT inline, and how it came to be — S2: the settings BAG it
 * was built under, when the caller gave one (R2's precedent; a replay reads the
 * result, never the bag).
 */
export function initialiseOpFor({ player, substrate, gridDims, seed, backExits, bag }, res) {
    return {
        op: INITIALISE_OP,
        player: String(player),
        result: {
            entries: res.entries,
            procgen_metadata: res.procgen_metadata,
            returnExits: res.returnExits,
            grantedItems: res.grantedItems,
            grantedDefs: res.grantedDefs,
            ...(res.blocks && Object.keys(res.blocks).length ? { blocks: res.blocks } : {}),
            stats: res.stats,
        },
        provenance: {
            substrate,
            gridDims: { ...gridDims },
            seed,
            backExits,
            ms: Math.round(res.ms ?? 0),
            unplaced: res.unplaced,
            ...(bag !== undefined ? { bag: JSON.parse(JSON.stringify(bag)) } : {}),
        },
    };
}
