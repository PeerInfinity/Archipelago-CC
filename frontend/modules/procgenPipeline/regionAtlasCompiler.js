// Region-atlas → vanilla rules.json compiler — projections 1 AND 3 of the three
// the atlas feeds (CC/docs/plans/region-atlas-plan.md, Phases 3 and 4).
//
// Takes an authored region atlas (the single source of truth: regions, boundary
// exits, per-region sub-region subgraphs, locations with their vanilla items,
// and the game's own vanilla layout) and emits the AP rules.json the frontend
// loads — the real game's map expressed as an ordinary AP region graph.
//
// Phase 3 was GRAPH ONLY. Phase 4 adds **projection 3** on top of the same
// compile: every region that names a real level (`map_ref`) also emits a
// `preset_sidecars` entry binding it to the `flash_seedling` substrate, so the
// real recompiled game plays inside the generated world — walking through one
// of the game's own level transitions crosses the AP region boundary, and
// arriving in a region teleports the player to the marked entrance spawn.
// A region with no `map_ref` has no physical binding and stays graph-only.
//
// Phase 5b adds a SECOND sidecar flavour of the same graph (`sidecarFlavor:
// 'maze'`, regionAtlasMazeProjection.js): the region's analyzed tile map
// projected into the maze substrate, so the geometry and its item gating are
// walkable with nothing but the committed repo — no wasm artifact. The two
// flavours are SEPARATE PRESETS and never merged: one sidecar per AP region per
// preset is the contract, and a preset carrying both would ask two substrates to
// own one region.
//
// The graph projection, concretely:
//
//   region without a subgraph   → one AP region, its bare `region_id`
//   region with a subgraph      → one AP region per sub-region, named by
//                                 apRegionName() (`<region_id>__<sub_region>`)
//   internal exit               → one AP exit, or two when `bidirectional`
//                                 (rules.json exits are strictly one-way)
//   vanilla_layout connection   → AP exits in BOTH directions; a boundary
//                                 crossing is walkable both ways in the
//                                 original game
//   unwired boundary exit       → OMITTED, and named in the report (the atlas
//                                 is grown incrementally; an unwired exit is a
//                                 map crossing not covered yet, not an error)
//   location                    → AP location in its (sub-)region, carrying its
//                                 `vanilla_item` as a placed item
//   vanilla_layout.start_region → `Menu` region with a single `GameStart` exit
//
// `access_rule` trees pass through verbatim — they are already Rule Builder
// JSON. A connection direction carries its SOURCE exit's rule: the exit you
// leave through is the frontier you have to get past. (A gate authored on the
// far side therefore does not apply to arrivals; when Phase 5's analyzer starts
// computing these mechanically, revisit whether a crossing wants both.)
//
// Deterministic: no timestamps, no clock, no Math.random. The same atlas
// compiles to the same bytes, which is what lets the committed preset carry a
// `--check` regeneration gate (scripts/procgen/region-atlas-compile.mjs).
//
// Headless-safe: no top-level await, no literal node: imports — this module is
// in the bundled browser graph (the marking tool's "Export rules.json" and
// "Edit in APWorld Editor" buttons compile through it).

import {
    makeRulesJsonScaffold,
    makeRegion,
    makeExit,
    makeLocation,
} from '../shared/rulesJsonBuilder.js';
import { validateRegionAtlas, apRegionName } from './regionAtlasValidator.js';
import {
    projectAtlasToMaze,
    formatMazeProjectionNotes,
    MAZE_SUBSTRATE,
} from './regionAtlasMazeProjection.js';

// AP id namespaces for compiled atlases. Deliberately clear of the per-game
// engine-binding namespace — frontend/modules/flashPanel/games/seedling.json
// carries its own `ap_id_offset` (20000000) for the ids the injected game
// speaks. Aligning the two is Phase 4's binding concern; until then these must
// simply not collide with it.
export const REGION_ATLAS_LOCATION_ID_BASE = 30000000;
export const REGION_ATLAS_ITEM_ID_BASE = 30000000;

// The AP region the projection hangs the start on. An atlas region named Menu
// would silently merge with it, so the compiler refuses instead.
export const MENU_REGION = 'Menu';
export const GAME_START_EXIT = 'GameStart';

// Projection 3. Per-game substrate ids are the standing ruling (2026-07-25),
// so an atlas binds to `flash_<game>` rather than the generic `flash` entry.
export const substrateIdFor = (game) => `flash_${String(game).toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;

// Which flashPanel game wiring boots a given atlas's game. This is ENGINE
// BINDING, not map semantics (decision 6) — the atlas holds neither, and the
// per-game config it points at (`games/<id>.json`) holds the teleport recipe,
// the item/location maps, and now the position signals the crossing detector
// reads. Games with no wiring here compile graph-only.
export const FLASH_PANEL_WIRING = Object.freeze({
    seedling: Object.freeze({ config: 'seedling.json', wasm: 'seedling_teleport_ap/game.html' }),
});

const endpointKey = (regionId, exitId) => `${regionId}/${exitId}`;

/** Tile coordinate -> game pixel. The atlas is tile-space; the engine is pixels. */
const toPixels = (tile, tileSize) => ({
    x: (tile?.[0] ?? 0) * tileSize,
    y: (tile?.[1] ?? 0) * tileSize,
});

/**
 * The (sub-)regions one atlas region binds to, paired with the sub_region name
 * whose exits and locations belong to each. A region without a subgraph is a
 * single implicit sub-region and its exits carry no `sub_region` at all
 * (validator-enforced both ways), so `sub` is undefined there.
 */
function apBindingsFor(region) {
    const subs = region.subgraph?.sub_regions;
    return Array.isArray(subs) && subs.length > 0
        ? subs.map((sub) => ({ sub, apName: apRegionName(region.region_id, sub) }))
        : [{ sub: undefined, apName: apRegionName(region.region_id) }];
}

/**
 * Build projection 3 — the play-time `preset_sidecars` block.
 *
 * One sidecar per AP region of every atlas region that names a level
 * (`map_ref`). The payload carries everything the host-side glue needs for BOTH
 * halves of a crossing, so it never has to re-read the atlas at play time:
 *
 *   arrival   — `level` + the arrival exit's own `entrance_tile`, which
 *               procgenPlayer resolves from the SOURCE exit's `targetExitId`
 *   crossing  — each exit's `target_level` + `target_spawn` (the destination
 *               entrance tile in pixels), so a reported level change resolves to
 *               the exit that goes there, tie-broken on the reported spawn
 *               coordinates when two exits of one region reach the same level
 *
 * `exitName` MUST equal the AP exit's `name`: the flash-family
 * `deserializeWorld` keys the exits Map on `exitName ?? exit_id`, and
 * procgenPlayer.handleRegionMove looks the crossing up by the AP exit name.
 *
 * Only WIRED exits appear. An unwired boundary exit has no destination in this
 * atlas at all — it is already omitted from the graph, and a payload entry for
 * it could only mis-resolve a crossing.
 */
function buildPresetSidecars(atlas, atlasRegions, wiredInfo, substrate) {
    const tileSize = atlas.tile_space?.tile_size ?? 1;
    const sidecars = {};
    const unbound = [];
    for (const region of atlasRegions) {
        if (!Number.isInteger(region.map_ref)) {
            unbound.push(region.region_id);
            continue;
        }
        for (const { sub, apName } of apBindingsFor(region)) {
            const exits = [];
            for (const exit of region.exits ?? []) {
                if (region.subgraph && exit.sub_region !== sub) continue;
                const info = wiredInfo.get(endpointKey(region.region_id, exit.exit_id));
                if (!info) continue; // unwired — omitted from the graph too
                exits.push({
                    exit_id: exit.exit_id,
                    kind: exit.kind,
                    ...(exit.side === undefined ? {} : { side: exit.side }),
                    exit_tiles: exit.exit_tiles,
                    entrance_tile: exit.entrance_tile,
                    entrance_spawn: toPixels(exit.entrance_tile, tileSize),
                    exitName: info.apExitName,
                    targetRegion: info.targetApRegion,
                    targetExitId: info.target.exit.exit_id,
                    target_level: Number.isInteger(info.target.region.map_ref)
                        ? info.target.region.map_ref : null,
                    target_spawn: Number.isInteger(info.target.region.map_ref)
                        ? toPixels(info.target.exit.entrance_tile, tileSize) : null,
                });
            }
            sidecars[apName] = {
                substrate,
                playable_payload: {
                    gameId: atlas.game,
                    atlas_ref: atlas.atlas_id,
                    atlas_region: region.region_id,
                    ...(sub === undefined ? {} : { atlas_sub_region: sub }),
                    level: region.map_ref,
                    tile_size: tileSize,
                    exits,
                },
            };
        }
    }
    return { sidecars, unbound };
}

/** The AP region names a single atlas region projects into, in declared order. */
export function apRegionNamesFor(region) {
    return apBindingsFor(region).map((b) => b.apName);
}

/**
 * The AP region an exit or location binds to. A region with a subgraph requires
 * a `sub_region` (validator-enforced); one without forbids it — so the binding
 * is unambiguous either way and never hand-concatenated.
 */
export function apRegionNameForBinding(region, subRegion) {
    return region.subgraph ? apRegionName(region.region_id, subRegion) : apRegionName(region.region_id);
}

function deriveIdentifiers(atlas, options) {
    const gameName = options.gameName ?? atlas.game;
    const gameDirectory = options.gameDirectory ?? String(gameName).toLowerCase().replace(/\s+/g, '');
    const worldClassName = options.worldClassName
        ?? `${String(gameName).replace(/[^A-Za-z0-9]+/g, ' ').trim().split(' ')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('')}World`;
    return { gameName, gameDirectory, worldClassName };
}

/**
 * Compile a region atlas into a rules.json object.
 *
 * @param {object} atlas the authored atlas document
 * @param {object} [options]
 * @param {object} [options.mapDoc] the map-source document named by
 *   tile_space.map_document, so validation resolves map_ref against real levels
 * @param {boolean} [options.allowInvalid] compile anyway when the atlas fails
 *   validation (the marking tool's export path offers this after a confirm);
 *   the errors are carried in the report either way
 * @param {string} [options.gameName] defaults to `atlas.game`
 * @param {string} [options.gameDirectory] defaults to gameName, lowercased
 * @param {string} [options.worldClassName] defaults to PascalCase(gameName)+World
 * @param {'flash'|'maze'} [options.sidecarFlavor] which projection-3 sidecars to
 *   emit (default 'flash' — the real game). 'maze' needs options.mazeProjection
 * @param {object} [options.mazeProjection] maze-flavour deps:
 *   { gridFor(region), conditionKey, resolveCondition } — all game-supplied
 * @param {number} [options.seed] rules.json generation_seed (default 1)
 * @param {string} [options.seedName] rules.json seed_name (default '')
 * @param {string} [options.playerName] player 1's name (default 'Player1')
 * @returns {{ rules: object, report: object }}
 */
export function compileRegionAtlas(atlas, options = {}) {
    const validation = validateRegionAtlas(
        atlas, options.mapDoc === undefined ? {} : { mapDoc: options.mapDoc },
    );
    if (!validation.ok && !options.allowInvalid) {
        throw new Error(
            `region atlas does not validate — refusing to compile:\n  ${validation.errors.join('\n  ')}`,
        );
    }

    const { gameName, gameDirectory, worldClassName } = deriveIdentifiers(atlas, options);
    const atlasRegions = Array.isArray(atlas.regions) ? atlas.regions : [];

    // --- AP regions ------------------------------------------------------
    const regions = {};
    const regionOrder = [];
    for (const region of atlasRegions) {
        for (const name of apRegionNamesFor(region)) {
            if (name === MENU_REGION) {
                throw new Error(
                    `atlas region "${region.region_id}" projects to "${MENU_REGION}", which the projection reserves for the start region`,
                );
            }
            if (regions[name]) throw new Error(`duplicate AP region name "${name}"`);
            regions[name] = makeRegion(name, [], []);
            regionOrder.push(name);
        }
    }

    // AP exit names are the entrance identity downstream, so they are kept
    // globally unique. The base reads as the edge it is; a collision (two
    // crossings between the same pair of AP regions) gets a deterministic
    // suffix rather than a silent overwrite.
    const usedExitNames = new Set();
    let exitCount = 0;
    const addExit = (fromName, toName, accessRule) => {
        const base = `${fromName} -> ${toName}`;
        let name = base;
        for (let i = 2; usedExitNames.has(name); i += 1) name = `${base} #${i}`;
        usedExitNames.add(name);
        regions[fromName].exits.push(makeExit(name, toName, accessRule ?? null));
        exitCount += 1;
        return name;
    };

    // --- internal exits (the sub-region subgraph) ------------------------
    //
    // What each DIRECTED internal crossing became, keyed `region|from|to`. The
    // maze projection reads it rather than re-deriving names: a crossing's maze
    // exit has to carry the AP exit name the graph actually minted, `#2` suffixes
    // and all, because that name is how procgenPlayer resolves the crossing.
    const internalInfo = new Map();
    for (const region of atlasRegions) {
        for (const ie of region.subgraph?.internal_exits ?? []) {
            const from = apRegionName(region.region_id, ie.from);
            const to = apRegionName(region.region_id, ie.to);
            const forward = addExit(from, to, ie.access_rule);
            const fkey = `${region.region_id}|${ie.from}|${ie.to}`;
            if (!internalInfo.has(fkey)) internalInfo.set(fkey, forward);
            // rules.json exits are strictly one-way ({name, connected_region,
            // access_rule}) — a bidirectional internal exit is two of them.
            if (ie.bidirectional === true) {
                const back = addExit(to, from, ie.access_rule);
                const bkey = `${region.region_id}|${ie.to}|${ie.from}`;
                if (!internalInfo.has(bkey)) internalInfo.set(bkey, back);
            }
        }
    }

    // --- boundary exits, wired by the vanilla layout ---------------------
    const exitIndex = new Map();
    for (const region of atlasRegions) {
        for (const exit of region.exits ?? []) {
            exitIndex.set(endpointKey(region.region_id, exit.exit_id), { region, exit });
        }
    }
    // What each wired boundary exit became, keyed by its atlas endpoint. This is
    // the graph projection's own record, and projection 3 reads it rather than
    // re-deriving names — the sidecar's `exitName` has to be the exit name the
    // graph actually carries, suffix collisions and all.
    const wiredInfo = new Map();
    const connections = atlas.vanilla_layout?.connections ?? [];
    for (const conn of connections) {
        const a = exitIndex.get(endpointKey(conn.from?.[0], conn.from?.[1]));
        const b = exitIndex.get(endpointKey(conn.to?.[0], conn.to?.[1]));
        if (!a || !b) continue; // unresolvable endpoints are validator errors
        const aName = apRegionNameForBinding(a.region, a.exit.sub_region);
        const bName = apRegionNameForBinding(b.region, b.exit.sub_region);
        // ⛓ R7 slice 4: `one_way`. A vanilla_layout connection is normally a
        // BOUNDARY CROSSING, walkable both ways in the original game — which is
        // true of a doorway and false of a transport. Seedling has exactly one
        // transition primitive and it is a one-way jump to a declared
        // destination point (`FP.world = new Game(level, x, y)`), so an atlas
        // that models transports rather than doorways must be able to say so;
        // pairing them would invent return edges the game does not have, and
        // AP's fill would route a collectible back through a pit.
        //
        // Both endpoints still count as WIRED — the arrival exit is a real,
        // deliberately-authored target, not a crossing nobody covered.
        const aExitName = addExit(aName, bName, a.exit.access_rule);
        wiredInfo.set(endpointKey(a.region.region_id, a.exit.exit_id),
            { apExitName: aExitName, targetApRegion: bName, target: b });
        if (conn.one_way === true) {
            wiredInfo.set(endpointKey(b.region.region_id, b.exit.exit_id),
                { apExitName: null, targetApRegion: null, target: a, arrivalOnly: true });
            continue;
        }
        const bExitName = addExit(bName, aName, b.exit.access_rule);
        wiredInfo.set(endpointKey(b.region.region_id, b.exit.exit_id),
            { apExitName: bExitName, targetApRegion: aName, target: a });
    }
    const wired = new Set(wiredInfo.keys());

    // Unwired boundary exits are map crossings this atlas does not cover yet.
    // They are omitted from the graph and NAMED here — never silently dropped.
    const unwiredExits = [];
    for (const region of atlasRegions) {
        for (const exit of region.exits ?? []) {
            if (wired.has(endpointKey(region.region_id, exit.exit_id))) continue;
            unwiredExits.push({
                region_id: region.region_id,
                exit_id: exit.exit_id,
                kind: exit.kind,
                ...(exit.side === undefined ? {} : { side: exit.side }),
            });
        }
    }

    // --- locations + the items placed on them ---------------------------
    const placements = [];
    for (const region of atlasRegions) {
        for (const loc of region.locations ?? []) placements.push({ region, loc });
    }
    // Ids: a stable base plus the index of the name in sorted order. Location
    // names are globally unique (validator-enforced), so this is a function of
    // the name set alone — no dependence on authoring order.
    const locationIdBase = options.locationIdBase ?? REGION_ATLAS_LOCATION_ID_BASE;
    const itemIdBase = options.itemIdBase ?? REGION_ATLAS_ITEM_ID_BASE;
    const locationIds = new Map(
        placements.map((p) => p.loc.name).sort().map((name, i) => [name, locationIdBase + i]),
    );
    const itemNames = [...new Set(
        placements.map((p) => p.loc.vanilla_item).filter((n) => typeof n === 'string' && n.length > 0),
    )].sort();
    const itemIds = new Map(itemNames.map((name, i) => [name, itemIdBase + i]));

    const itempoolCounts = {};
    let placedItems = 0;
    let unplacedLocations = 0;
    for (const { region, loc } of placements) {
        const target = apRegionNameForBinding(region, loc.sub_region);
        const entry = makeLocation(loc.name, locationIds.get(loc.name), loc.access_rule ?? null);
        if (typeof loc.vanilla_item === 'string' && loc.vanilla_item.length > 0) {
            // v1 simplification: every vanilla item classifies as progression.
            // Real classifications need per-game knowledge the atlas does not
            // hold (decision 6 keeps engine binding out of it).
            entry.item = {
                name: loc.vanilla_item, player: 1, advancement: true, type: 'progression',
            };
            itempoolCounts[loc.vanilla_item] = (itempoolCounts[loc.vanilla_item] ?? 0) + 1;
            placedItems += 1;
        } else {
            unplacedLocations += 1;
        }
        regions[target].locations.push(entry);
    }

    const items = {};
    for (const name of itemNames) {
        items[name] = {
            name,
            id: itemIds.get(name),
            groups: [],
            classification: 'progression',
            type: null,
            max_count: itempoolCounts[name] ?? 0,
        };
    }

    // --- the start wiring ------------------------------------------------
    //
    // Shape copied from frontend/presets/procgen_topdown/AP_1/AP_1_rules.json:
    // start_regions.default = ['Menu'], and Menu carries one True_ exit into the
    // real start region. procgenPlayerEngine.findStartRegion follows exactly
    // this (start_regions[player].default[0], then that region's first exit
    // whose connected_region is warehoused).
    const startRegionId = atlas.vanilla_layout?.start_region;
    const startRegion = atlasRegions.find((r) => r.region_id === startRegionId);
    const menuExits = [];
    let startApRegion = null;
    if (startRegion) {
        startApRegion = apRegionNameForBinding(startRegion, atlas.vanilla_layout?.start_sub_region);
        menuExits.push(makeExit(GAME_START_EXIT, startApRegion, null));
    }
    regions[MENU_REGION] = makeRegion(MENU_REGION, menuExits, []);

    // --- assemble ---------------------------------------------------------
    const rules = makeRulesJsonScaffold({
        gameName,
        gameDirectory,
        worldClassName,
        seed: options.seed ?? 1,
        seedName: options.seedName ?? '',
        playerName: options.playerName ?? 'Player1',
        startRegions: [MENU_REGION],
    });
    rules.regions = { 1: regions };
    rules.items = { 1: items };
    rules.itempool_counts = { 1: itempoolCounts };
    rules.world['1'].world_directory = gameDirectory;
    // ⛓ R7 slice 4: a real GOAL. The scaffold's default is `constant true`,
    // which is right for a partial atlas that is not a game yet and wrong for a
    // whole map: with a trivially-satisfied completion, AP's fill has nothing to
    // route toward and the sphere log stops being a collection ORDER. An atlas
    // that names its goal item gets it; everything else keeps the constant.
    if (options.completionItem) {
        rules.game_info['1'].completion_condition = {
            type: 'item_check', item: options.completionItem,
        };
    }
    // Whatever the generator wants to say about where this graph came from.
    // Stamped rather than derived, because only the generator knows its inputs.
    if (options.provenance) rules.provenance = options.provenance;
    // Provenance: which atlas this graph came from. atlas_id ends in the
    // content hash, so a restamped atlas visibly invalidates a stale preset.
    rules.region_atlas = {
        atlas_id: atlas.atlas_id,
        game: atlas.game,
        ...(atlas.tile_space?.map_document ? { map_document: atlas.tile_space.map_document } : {}),
    };

    // --- projection 3: play-time binding -----------------------------------
    //
    // Two flavours of the SAME graph, one preset each (never both in one file):
    //   'flash' (default) — the real recompiled game, needs its wasm artifact
    //   'maze'            — the analyzed tile map in the maze substrate, which
    //                       runs anywhere the repo does (Phase 5b)
    const mazeFlavor = options.sidecarFlavor === MAZE_SUBSTRATE;
    const substrate = options.substrateId ?? (mazeFlavor ? MAZE_SUBSTRATE : substrateIdFor(atlas.game));
    let mazeNotes = null;
    let sidecars;
    let unbound;
    if (mazeFlavor) {
        if (!options.mazeProjection?.gridFor) {
            throw new Error(
                'sidecarFlavor "maze" needs options.mazeProjection.{gridFor,conditionKey,resolveCondition} — '
                + 'the cell grid and the condition vocabulary are the GAME\'s, not the compiler\'s',
            );
        }
        const projected = projectAtlasToMaze(atlas, {
            ...options.mazeProjection,
            wiredExit: (regionId, exitId) => {
                const info = wiredInfo.get(endpointKey(regionId, exitId));
                if (info === undefined) return undefined;
                // The partner exit's own AP name — the edge coming BACK. The maze
                // keys its exits by AP exit name, so that is what an arrival is
                // resolved by there (the flash payload uses the atlas exit id,
                // which is what its own glue resolves against).
                const back = wiredInfo.get(
                    endpointKey(info.target.region.region_id, info.target.exit.exit_id),
                );
                return {
                    apExitName: info.apExitName,
                    targetApRegion: info.targetApRegion,
                    targetExitId: info.target.exit.exit_id,
                    returnApExitName: back?.apExitName ?? null,
                };
            },
            internalExitName: (regionId, from, to) => internalInfo.get(`${regionId}|${from}|${to}`),
        });
        sidecars = projected.sidecars;
        unbound = projected.regions_without_map_ref;
        mazeNotes = projected.notes;
    } else {
        ({ sidecars, unbound } = buildPresetSidecars(atlas, atlasRegions, wiredInfo, substrate));
    }
    const sidecarRegions = Object.keys(sidecars);
    if (sidecarRegions.length > 0) {
        // The flashPanel wiring boots the real game for this preset. It is the
        // same hand-added block the seed-1 seedling preset carries — except
        // here it is COMPILED, so a regeneration no longer drops it (the
        // rulesExporter precedent, and the trap the plan's decision 2 names).
        // The maze flavour deliberately carries NONE of it: nothing boots the
        // original engine there, and a stray flash_panel block would start it.
        if (!mazeFlavor) {
            const wiring = options.flashPanel ?? FLASH_PANEL_WIRING[atlas.game];
            if (wiring) rules.flash_panel = { ...wiring };
        }
        rules.preset_sidecars = { 1: sidecars };
    }

    const report = {
        atlas_id: atlas.atlas_id,
        game_name: gameName,
        game_directory: gameDirectory,
        ap_regions: regionOrder.length,
        ap_regions_incl_menu: regionOrder.length + 1,
        exits: exitCount + menuExits.length,
        connections: connections.length,
        locations: placements.length,
        placed_items: placedItems,
        locations_without_item: unplacedLocations,
        distinct_items: itemNames.length,
        unwired_exits: unwiredExits,
        start_region: startApRegion,
        substrate,
        sidecar_flavor: mazeFlavor ? MAZE_SUBSTRATE : 'flash',
        sidecar_regions: sidecarRegions,
        flash_panel: rules.flash_panel ?? null,
        // Maze flavour only: every approximation, carve and walled crossing the
        // projection took, so a fidelity fence is recorded rather than assumed.
        maze_notes: mazeNotes,
        // Atlas regions with no `map_ref`: graph-only, no physical binding, so
        // no sidecar. Named rather than counted for the same reason unwired
        // exits are — a silent omission reads as a fully-bound map.
        regions_without_map_ref: unbound,
        atlas_valid: validation.ok,
        atlas_errors: validation.errors,
        atlas_warnings: validation.warnings,
    };
    return { rules, report };
}

/** One-line-per-item human summary of a compile report, for CLIs and the panel. */
export function formatCompileReport(report) {
    const lines = [
        `atlas ${report.atlas_id} -> ${report.game_name}: `
        + `${report.ap_regions_incl_menu} AP regions (incl. Menu), ${report.exits} exits, `
        + `${report.locations} locations, ${report.placed_items} placed items `
        + `(${report.distinct_items} distinct)`,
    ];
    if (report.locations_without_item > 0) {
        lines.push(`${report.locations_without_item} location(s) have no vanilla_item — nothing placed there`);
    }
    if (report.unwired_exits.length > 0) {
        lines.push(`${report.unwired_exits.length} boundary exit(s) unwired by vanilla_layout — OMITTED from the graph:`);
        for (const e of report.unwired_exits) {
            lines.push(`  ${e.region_id}/${e.exit_id} (${e.kind}${e.side ? ` ${e.side}` : ''})`);
        }
    }
    if (report.sidecar_regions?.length > 0) {
        lines.push(`projection 3 (${report.sidecar_flavor ?? 'flash'}): ${report.sidecar_regions.length} region(s) bound to substrate `
            + `${report.substrate}${report.flash_panel ? ` (flash_panel: ${report.flash_panel.config})` : ''}`);
    } else {
        lines.push('projection 3: no region names a map_ref — graph-only, no preset_sidecars');
    }
    if (report.maze_notes?.length > 0) {
        lines.push(...formatMazeProjectionNotes(report.maze_notes));
    }
    if (report.regions_without_map_ref?.length > 0 && report.sidecar_regions?.length > 0) {
        lines.push(`${report.regions_without_map_ref.length} region(s) have no map_ref — no play-time binding: `
            + report.regions_without_map_ref.join(', '));
    }
    return lines;
}
