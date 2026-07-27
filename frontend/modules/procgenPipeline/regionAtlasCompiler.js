// Region-atlas → vanilla rules.json compiler — projection 1 of the three the
// atlas feeds (CC/docs/plans/region-atlas-plan.md, Phase 3).
//
// Takes an authored region atlas (the single source of truth: regions, boundary
// exits, per-region sub-region subgraphs, locations with their vanilla items,
// and the game's own vanilla layout) and emits the AP rules.json the frontend
// loads — the real game's map expressed as an ordinary AP region graph.
//
// GRAPH ONLY (ruled 2026-07-27). The compiler emits NO `preset_sidecars`:
// play-time walking runs the REAL game with the engine teleporting the player
// to an entrance spawn tile, which is projection 3 (Phase 4). A rules.json from
// here has regions, exits, locations and items and nothing substrate-shaped.
//
// The projection, concretely:
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

const endpointKey = (regionId, exitId) => `${regionId}/${exitId}`;

/** The AP region names a single atlas region projects into, in declared order. */
export function apRegionNamesFor(region) {
    const subs = region.subgraph?.sub_regions;
    return Array.isArray(subs) && subs.length > 0
        ? subs.map((s) => apRegionName(region.region_id, s))
        : [apRegionName(region.region_id)];
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
    for (const region of atlasRegions) {
        for (const ie of region.subgraph?.internal_exits ?? []) {
            const from = apRegionName(region.region_id, ie.from);
            const to = apRegionName(region.region_id, ie.to);
            addExit(from, to, ie.access_rule);
            // rules.json exits are strictly one-way ({name, connected_region,
            // access_rule}) — a bidirectional internal exit is two of them.
            if (ie.bidirectional === true) addExit(to, from, ie.access_rule);
        }
    }

    // --- boundary exits, wired by the vanilla layout ---------------------
    const exitIndex = new Map();
    for (const region of atlasRegions) {
        for (const exit of region.exits ?? []) {
            exitIndex.set(endpointKey(region.region_id, exit.exit_id), { region, exit });
        }
    }
    const wired = new Set();
    const connections = atlas.vanilla_layout?.connections ?? [];
    for (const conn of connections) {
        const a = exitIndex.get(endpointKey(conn.from?.[0], conn.from?.[1]));
        const b = exitIndex.get(endpointKey(conn.to?.[0], conn.to?.[1]));
        if (!a || !b) continue; // unresolvable endpoints are validator errors
        wired.add(endpointKey(a.region.region_id, a.exit.exit_id));
        wired.add(endpointKey(b.region.region_id, b.exit.exit_id));
        const aName = apRegionNameForBinding(a.region, a.exit.sub_region);
        const bName = apRegionNameForBinding(b.region, b.exit.sub_region);
        addExit(aName, bName, a.exit.access_rule);
        addExit(bName, aName, b.exit.access_rule);
    }

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
    // Provenance: which atlas this graph came from. atlas_id ends in the
    // content hash, so a restamped atlas visibly invalidates a stale preset.
    rules.region_atlas = {
        atlas_id: atlas.atlas_id,
        game: atlas.game,
        ...(atlas.tile_space?.map_document ? { map_document: atlas.tile_space.map_document } : {}),
    };

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
    return lines;
}
