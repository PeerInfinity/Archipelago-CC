#!/usr/bin/env node
/**
 * Author the Seedling STARTER atlas (region-atlas plan, Phase 2, Deliverable 5):
 * the first real regions around the game start, which the user grows from here
 * with the marking-tool panel.
 *
 * Phase 5a added a fourth region and an ANALYSIS pass: after the geometry is
 * authored, every region goes through the reachability analyzer, so the
 * sub-region splits and the rules that cross them are computed from the tile map
 * rather than guessed. `--check` therefore gates the analysis too.
 *
 * It goes through the panel's own model — AtlasSession + the compact writer —
 * so what lands on disk is exactly what the panel's Save produces. (That
 * equality is not an assumption: verify-region-marking-tool.mjs drives the real
 * panel in a browser and asserts its download is byte-identical to this same
 * model's output for the same edits.) A script rather than a hand-typed JSON
 * because the geometry is DERIVED from the committed map extract — every exit
 * tile is a real `teleporter` / `stairsdown` / `stairsup` entity's position, so
 * the atlas cannot drift from the map it describes.
 *
 * Usage:
 *   node scripts/procgen/make-seedling-starter-atlas.mjs [--check]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const ATLAS_DIR = path.join(repoRoot, 'frontend/modules/flashPanel/atlases');
const MAP_FILE = path.join(ATLAS_DIR, 'seedling-map.json');
const OUT_FILE = path.join(ATLAS_DIR, 'seedling.json');

const { AtlasSession, createEmptyAtlas } = await import(pathToFileURL(
    path.join(repoRoot, 'frontend/modules/regionMarkingTool/atlasSession.js')));
const { validateRegionAtlas } = await import(pathToFileURL(
    path.join(repoRoot, 'frontend/modules/procgenPipeline/regionAtlasValidator.js')));
const { compactJsonFile } = await import(pathToFileURL(
    path.join(repoRoot, 'frontend/modules/procgenPipeline/compactJson.js')));
const { analyzeSeedlingRegion, applySeedlingRegionAnalysis } = await import(pathToFileURL(
    path.join(repoRoot, 'frontend/modules/flashPanel/seedlingAtlasAnalysis.js')));

const MAP = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
// The per-game engine binding, which is where the analyzer's engine-flag ->
// AP-item mapping comes from (plan decision 6 keeps it out of the atlas).
const GAME_CONFIG = JSON.parse(fs.readFileSync(
    path.join(repoRoot, 'frontend/modules/flashPanel/games/seedling.json'), 'utf8'));
const TILE = MAP.tile_size;
const levelOf = (id) => {
    const lvl = MAP.levels.find((l) => l.level === id);
    if (!lvl) throw new Error(`no level ${id} in the map extract`);
    return lvl;
};

/** Every level-to-level link in a level, as tiles. */
function links(levelId) {
    return levelOf(levelId).entities
        .filter((e) => ['teleporter', 'stairsdown', 'stairsup'].includes(e.type))
        .map((e) => ({
            type: e.type,
            to: Number(e.attrs.to),
            tile: [Math.floor(e.x / TILE), Math.floor(e.y / TILE)],
        }));
}

/** The tiles of every link in `levelId` that leads to `destination`. */
function linkTiles(levelId, destination) {
    const tiles = links(levelId).filter((l) => l.to === destination).map((l) => l.tile);
    if (tiles.length === 0) throw new Error(`level ${levelId} has no link to level ${destination}`);
    // Sort so a multi-tile span (the two-tile west crossing out of the start
    // room) comes out as a contiguous run in order.
    return tiles.sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
}

// ── The regions ────────────────────────────────────────────────────────
//
// Level 0 is where the game starts (Main.as: `new Game(0, 80, 128)`), and the
// two rooms it opens directly onto are the house (86) and the Owl's Nest
// entrance (2, the Dungeon 1 stairwell). Phase 5a added the room below that
// stairwell (3), which is where the analyzer has a real item-gated crossing to
// find. Kept small so this is a seed to grow, not a half-finished map:
// everything in it is real.
//
// `kind` is forced to teleporter on the doors, because deriving it from
// geometry would be true but misleading: the house door sits on its room's
// south wall, yet its destination is a spot in the middle of the overworld, not
// a grid neighbour — which is exactly what plan decision 3 makes teleporters
// for. The overworld's own map-edge crossings ARE grid boundaries and stay
// edge exits, with their side derived.
const REGIONS = [
    {
        region_id: 'overworld_start',
        name: 'Overworld — Start',
        level: 0,
        notes: 'The room the game starts in. Its split is analyzer-computed: the water, the '
            + 'waterfall and the breakable rocks are all real traversal obstacles, and the one '
            + 'crossing left unlabelled goes through a building, whose per-pixel collision mask is '
            + 'not transcribed.',
        exits: [
            { exit_id: 'west_crossing', to: 94, kind: 'edge' },
            { exit_id: 'north_crossing', to: 89, kind: 'edge' },
            { exit_id: 'east_crossing', to: 12, kind: 'edge' },
            { exit_id: 'house_door', to: 86, kind: 'teleporter' },
            { exit_id: 'owls_nest_stairs', to: 2, kind: 'teleporter' },
            { exit_id: 'hut_door', to: 1, kind: 'teleporter' },
            { exit_id: 'gundernourd_stairs', to: 13, kind: 'teleporter' },
        ],
        locations: [],
    },
    {
        region_id: 'starting_house',
        name: 'Starting House',
        level: 86,
        notes: 'One room, no traversal obstacle — so no subgraph (a region without one is a single '
            + 'implicit sub-region, and carries no boilerplate).',
        exits: [{ exit_id: 'door', to: 0, kind: 'teleporter' }],
        // Every chest in Seedling yields a seal piece (Chest.as `open()`).
        locations: [{ name: 'Starting House - Chest', entity: 'chest', vanilla_item: 'Seal' }],
    },
    {
        region_id: 'owls_nest_entrance',
        name: "Owl's Nest — Entrance",
        level: 2,
        notes: 'The Dungeon 1 stairwell, between the overworld and the first dungeon room.',
        exits: [
            { exit_id: 'stairs_up', to: 0, kind: 'teleporter' },
            { exit_id: 'descent', to: 3, kind: 'teleporter' },
        ],
        locations: [],
    },
    {
        region_id: 'dungeon1_room1',
        name: "Owl's Nest — First Room",
        level: 3,
        notes: 'Added in Phase 5a as the analyzer\'s acceptance case: a breakable rock walls off '
            + 'the tile holding the stairs down, so the split and its "Sword OR Spear" rule are '
            + 'computed from the tile map, not guessed. Its east and west doors are real map edges '
            + 'this partial atlas does not yet cover.',
        exits: [
            { exit_id: 'stairs_up', to: 2, kind: 'teleporter' },
            { exit_id: 'east_door', to: 4, kind: 'teleporter' },
            { exit_id: 'descent', to: 11, kind: 'teleporter' },
            { exit_id: 'west_door', to: 111, kind: 'teleporter' },
        ],
        locations: [],
    },
];

// Both directions of each door, wired into the vanilla layout.
const CONNECTIONS = [
    [['overworld_start', 'house_door'], ['starting_house', 'door']],
    [['overworld_start', 'owls_nest_stairs'], ['owls_nest_entrance', 'stairs_up']],
    [['owls_nest_entrance', 'descent'], ['dungeon1_room1', 'stairs_up']],
];

/**
 * Build the starter atlas document. Exported and side-effect free so the
 * regeneration gate can run in vitest: unlike the map extract, everything this
 * needs (seedling-map.json) is committed, so "regenerates byte-identically" is
 * checkable without a Seedling checkout.
 */
export function buildStarterAtlas() {
    analysisNotes.length = 0;
    const session = new AtlasSession(createEmptyAtlas({
        game: 'seedling',
        name: 'Seedling — vanilla (starter)',
        description: 'PARTIAL: the first regions around the game start, authored with the '
            + 'region-marking tool as the seed to grow the full map from. Geometry is derived from '
            + 'seedling-map.json, so every exit tile is a real level-link entity; the sub-region '
            + 'splits and their access rules are computed by the Phase-5a reachability analyzer.',
        tileSize: TILE,
        mapSource: 'ogmo-extract',
        mapDocument: path.basename(MAP_FILE),
    }));

    for (const spec of REGIONS) {
        const level = levelOf(spec.level);
        session.addRegion({
            region_id: spec.region_id,
            name: spec.name,
            bounds: { x: 0, y: 0, w: level.width, h: level.height },
            map_ref: spec.level,
            rules_source: 'manual',
        });
        session.region(spec.region_id).annotations.notes = spec.notes;

        for (const exit of spec.exits) {
            session.addExit(spec.region_id, {
                exit_id: exit.exit_id,
                tiles: linkTiles(spec.level, exit.to),
                kind: exit.kind,
            });
        }
        for (const loc of spec.locations) {
            const entity = level.entities.find((e) => e.type === loc.entity);
            if (!entity) throw new Error(`level ${spec.level} has no ${loc.entity} entity`);
            session.addLocation(spec.region_id, {
                name: loc.name,
                tile: [Math.floor(entity.x / TILE), Math.floor(entity.y / TILE)],
                vanilla_item: loc.vanilla_item,
            });
        }
    }

    for (const [from, to] of CONNECTIONS) session.connect(from, to);
    session.setStart('overworld_start');

    // Phase 5a: the sub-region splits are COMPUTED, not authored. Running the
    // analyzer here rather than committing its output by hand is what keeps the
    // atlas honest about the terrain — `--check` then covers the analysis too,
    // so a semantics-table edit that changes a rule shows up as a red gate
    // rather than as an atlas quietly disagreeing with the map it describes.
    //
    // Applied with `stamp: false` so toDocument() stays the single stamping
    // path, exactly as the panel's Accept does.
    for (const region of session.regions().map((r) => r.region_id)) {
        const analysis = analyzeSeedlingRegion(session.atlas, region, { mapDoc: MAP, gameConfig: GAME_CONFIG });
        if (analysis.skipped) continue;
        const applied = applySeedlingRegionAnalysis(session.atlas, analysis, { stamp: false });
        for (const p of applied.problems) analysisNotes.push(`${region}: ${p.message}`);
        for (const n of analysis.needs_authoring) {
            analysisNotes.push(`${region}: ${n.from} ${n.bidirectional ? '<->' : '->'} ${n.to} NEEDS A HAND-WRITTEN RULE — ${n.reasons.join('; ')}`);
        }
    }
    return session.toDocument();
}

/**
 * What the analysis pass had to say — inexact bindings and crossings it could
 * not label. Populated by buildStarterAtlas; surfaced by main() so a
 * regeneration never hides them.
 */
export const analysisNotes = [];

export const STARTER_ATLAS_PATH = OUT_FILE;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

function main() {
    const doc = buildStarterAtlas();
    const text = compactJsonFile(doc);

    const result = validateRegionAtlas(doc, { mapDoc: MAP });
    for (const note of analysisNotes) console.log(`ANALYSIS: ${note}`);
    for (const w of result.warnings) console.log(`WARN: ${w}`);
    for (const e of result.errors) console.error(`ERROR: ${e}`);
    if (!result.ok) process.exit(1);

    if (process.argv.includes('--check')) {
        const committed = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, 'utf8') : null;
        if (committed !== text) {
            console.error(`ERROR: ${path.relative(repoRoot, OUT_FILE)} differs from a fresh build`);
            process.exit(1);
        }
        console.log(`OK: ${path.relative(repoRoot, OUT_FILE)} matches a fresh build`);
    } else {
        fs.writeFileSync(OUT_FILE, text);
        console.log(`wrote ${path.relative(repoRoot, OUT_FILE)}`);
    }
    const s = result.stats;
    const rows = doc.regions.flatMap((r) => r.subgraph?.internal_exits ?? []);
    console.log(
        `${doc.atlas_id} — ${s.regions} regions, ${s.sub_regions} analyzer sub-regions, `
        + `${s.exits} exits, ${s.locations} locations, ${s.connections} connections; `
        + `${rows.filter((e) => e.source === 'analyzer').length} computed internal exit(s), `
        + `${rows.filter((e) => (e.source ?? 'manual') !== 'analyzer').length} awaiting a hand-written rule `
        + `(${result.warnings.length} warnings)`,
    );
}
