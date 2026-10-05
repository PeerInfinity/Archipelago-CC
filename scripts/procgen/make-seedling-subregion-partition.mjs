#!/usr/bin/env node
/**
 * The SUB-REGION PARTITION of the Seedling atlases: which tile of a level is in which sub-region
 * (solver-walk §5.17, logical sub-region links).
 *
 * A region with a subgraph is split by the reachability analyzer into walkable COMPONENTS, and each kept
 * component is a sub-region (`level_0__r8c0`). The atlas keeps the ids and the crossings between them,
 * not the tiles, so the region binding could not tell which sub-region a player stands in. This file
 * re-runs each atlas's OWN analysis (the same grid, the same options) and writes the tiles down:
 *
 *   seedling-playthrough.json  `make-seedling-playthrough-rules.mjs`'s grid + analyzer options
 *   seedling.json (starter)    `seedlingAtlasAnalysis.analyzeSeedlingRegion` with the starter generator's deps (model oracles included)
 *
 * A tile in no kept sub-region is `.`: a wall, crossing material (water, a bush, a building's sprite
 * rect), or a pocket the generator pruned. The binding treats `.` as "no news", so a seam never flickers.
 *
 * Every region is CHECKED against its atlas before anything is written: each declared sub-region is a
 * component, and each location / exit whose tile is walkable lies in the sub-region the atlas binds it
 * to. A mismatch throws, by name.
 *
 * Output: `frontend/modules/flashPanel/atlases/seedling-subregion-partition.json`, keyed by `atlas_id`
 * (a rules file names its atlas in `region_atlas.atlas_id`, so a stale partition is refused by id).
 *
 * Usage:
 *   node scripts/procgen/make-seedling-subregion-partition.mjs [--check]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const imp = (p) => import(pathToFileURL(path.join(repoRoot, p)));
const ATLAS_DIR = path.join(repoRoot, 'frontend/modules/flashPanel/atlases');
export const PARTITION_PATH = path.join(ATLAS_DIR, 'seedling-subregion-partition.json');

/** One character per sub-region (its index in `sub_regions`); `.` = no sub-region. */
export const PARTITION_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * The rows of one region's partition: `componentsResult` over a `width × height` grid, each kept
 * sub-region (`subs`) by its alphabet character.
 */
export function partitionRows({ indexOf, components }, width, height, subs) {
    if (subs.length > PARTITION_ALPHABET.length) {
        throw new Error(`${subs.length} sub-regions exceed the partition alphabet (${PARTITION_ALPHABET.length})`);
    }
    const rows = [];
    for (let y = 0; y < height; y += 1) {
        let row = '';
        for (let x = 0; x < width; x += 1) {
            const c = indexOf[y * width + x];
            const at = c >= 0 ? subs.indexOf(components[c].id) : -1;
            row += at >= 0 ? PARTITION_ALPHABET[at] : '.';
        }
        rows.push(row);
    }
    return rows;
}

/**
 * Check one region's partition against its atlas: every sub-region is present, and every location / exit
 * standing on a walkable tile lies in the sub-region the atlas binds it to. Returns the problems.
 */
export function partitionProblems(region, entry) {
    const problems = [];
    const at = ([tx, ty]) => {
        const x = tx - entry.origin[0];
        const y = ty - entry.origin[1];
        const ch = entry.rows[y]?.[x];
        return ch && ch !== '.' ? entry.sub_regions[PARTITION_ALPHABET.indexOf(ch)] : null;
    };
    for (const s of entry.sub_regions) {
        if (!entry.rows.some((r) => r.includes(PARTITION_ALPHABET[entry.sub_regions.indexOf(s)]))) {
            problems.push(`${region.region_id}: sub-region "${s}" holds no tile`);
        }
    }
    const bound = [...(region.locations ?? []).map((l) => [l.name, l.tile, l.sub_region]),
        ...(region.exits ?? []).map((e) => [e.exit_id, e.entrance_tile, e.sub_region])];
    for (const [name, tile, sub] of bound) {
        if (!tile) continue;
        const got = at(tile);
        if (got && got !== sub) problems.push(`${region.region_id}: "${name}" at ${JSON.stringify(tile)} is in "${got}", the atlas binds it to "${sub}"`);
    }
    return problems;
}

/** The partition of one atlas document: `{atlas, tile_size, regions}`. `analyze(region)` → `{componentsResult, origin, width, height}`. */
function atlasPartition(file, atlas, analyze) {
    const regions = {};
    let checked = 0;
    for (const region of atlas.regions) {
        const subs = region.subgraph?.sub_regions;
        if (!subs || subs.length < 2) continue;
        const a = analyze(region);
        const entry = {
            level: Number(region.map_ref),
            origin: a.origin,
            width: a.width,
            height: a.height,
            sub_regions: subs,
            rows: partitionRows(a.componentsResult, a.width, a.height, subs),
        };
        const problems = partitionProblems(region, entry);
        if (problems.length) throw new Error(`the ${file} partition disagrees with its atlas:\n  ${problems.join('\n  ')}`);
        checked += 1;
        regions[region.region_id] = entry;
    }
    return { doc: { atlas: file, tile_size: atlas.tile_space?.tile_size ?? 16, regions }, checked };
}

/** Build the whole partition document (both atlases). */
export async function buildSubRegionPartition() {
    const read = (f) => JSON.parse(fs.readFileSync(path.join(ATLAS_DIR, f), 'utf8'));
    const MAP = read('seedling-map.json');
    const GAME_CONFIG = JSON.parse(fs.readFileSync(path.join(repoRoot, 'frontend/modules/flashPanel/games/seedling.json'), 'utf8'));
    const { analyzeRegion } = await imp('frontend/modules/procgenPipeline/regionAtlasAnalyzer.js');
    const PT = await imp('scripts/procgen/make-seedling-playthrough-rules.mjs');
    // ⛓ RULES patched-set — PATCH PER ATLAS. The playthrough derives from the DELIVERED set (the generator's
    // own `PLAYTHROUGH_MAP`, `SEEDLING_SET_PATCHES` applied); the starter atlas runs the built-in map, so it
    // reads the extract VANILLA (`MAP`). Each partition re-runs its own atlas's analysis on its own rooms.
    const ptLevelOf = (id) => PT.PLAYTHROUGH_MAP.levels.find((l) => l.level === Number(id));
    const { analyzeSeedlingRegion } = await imp('frontend/modules/flashPanel/seedlingAtlasAnalysis.js');
    const STARTER = await imp('scripts/procgen/make-seedling-starter-atlas.mjs');

    const playthrough = read('seedling-playthrough.json');
    const starter = read('seedling.json');
    const out = { generator: 'scripts/procgen/make-seedling-subregion-partition.mjs',
        description: 'GENERATED — do not edit. Which tile of a level is in which sub-region, per atlas; one '
            + `character per tile, the sub-region's index in "sub_regions" over "${PARTITION_ALPHABET.slice(0, 3)}…", `
            + '"." for none. Regenerate after either atlas changes.',
        alphabet: PARTITION_ALPHABET,
        atlases: {} };
    const stats = {};
    const p = atlasPartition('seedling-playthrough.json', playthrough, (region) => {
        const level = ptLevelOf(region.map_ref);
        const a = analyzeRegion(region, PT.playthroughGridFor(level), PT.playthroughAnalyzerOptions);
        return { componentsResult: a.componentsResult, origin: [0, 0], width: level.width, height: level.height };
    });
    out.atlases[playthrough.atlas_id] = p.doc;
    stats[playthrough.atlas_id] = p.checked;
    const s = atlasPartition('seedling.json', starter, (region) => {
        const a = analyzeSeedlingRegion(starter, region.region_id, { ...STARTER.STARTER_ANALYSIS_DEPS, mapDoc: MAP, gameConfig: GAME_CONFIG });
        const b = region.bounds;
        return { componentsResult: a.componentsResult, origin: [b.x, b.y], width: b.w, height: b.h };
    });
    out.atlases[starter.atlas_id] = s.doc;
    stats[starter.atlas_id] = s.checked;
    return { doc: out, stats };
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const check = process.argv.includes('--check');
    const { compactJsonFile } = await imp('frontend/modules/procgenPipeline/compactJson.js');
    const { doc, stats } = await buildSubRegionPartition();
    const text = compactJsonFile(doc);
    const rel = path.relative(repoRoot, PARTITION_PATH);
    if (check) {
        const committed = fs.existsSync(PARTITION_PATH) ? fs.readFileSync(PARTITION_PATH, 'utf8') : null;
        if (committed !== text) {
            console.error(`ERROR: ${rel} differs from a fresh build`);
            process.exit(1);
        }
        console.log(`OK: ${rel} matches a fresh build`);
    } else {
        fs.writeFileSync(PARTITION_PATH, text);
        console.log(`wrote ${rel}`);
    }
    for (const [id, n] of Object.entries(stats)) console.log(`${id}: ${n} region(s) with sub-regions, each checked against its atlas`);
}
