#!/usr/bin/env node
// Seedling map extractor — turns a Seedling source checkout into the ONE
// committed map-source document the region-marking tool renders from
// (CC/docs/plans/region-atlas-plan.md, Phase 2, Deliverable 1).
//
// Seedling is MIT, so the extract is committed (plan decision 7's
// "coordinates only, never the tile map" constraint is RWK-specific). It is
// deliberately NOT named *_tilemap.json / *_tiles.json: .gitignore drops those
// globally to protect the RWK data, and a file matching them would silently
// fail to be tracked.
//
// Usage:
//   node scripts/procgen/extract-seedling-map.mjs --source ~/CC/seedling
//   node scripts/procgen/extract-seedling-map.mjs --source <path> --check
//   node scripts/procgen/extract-seedling-map.mjs --source <path> --out other.json
//
// --check re-extracts and compares against the committed file WITHOUT writing;
// it exits 1 on any difference. The document carries no timestamp precisely so
// that check can be exact: same checkout in, same bytes out.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseOelLevel, parseLevelTable, TILE_SIZE } from './seedlingOgmo.js';
import { compactJsonFile } from '../../frontend/modules/procgenPipeline/compactJson.js';

export const SEEDLING_MAP_SCHEMA_VERSION = 1;

const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const DEFAULT_OUT = join(REPO_ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json');
const LEVEL_ROOT = 'assets/levels';
const LEVEL_TABLE = 'src/Game.as';

// The entity layer is what the marking tool shows as reference markers when
// placing locations, so the extract keeps every entity. These are the ones the
// tool highlights by default — pickups and the level-to-level links (whose
// `to` attribute is another level number, i.e. the vanilla layout in raw form).
export const NOTABLE_ENTITY_TYPES = [
    'chest', 'sword', 'shield', 'darkshield', 'ghostsword', 'ghostspear', 'wand',
    'firewand', 'feather', 'conch', 'health', 'darksuit', 'torchpickup', 'seed',
    'totem', 'totempart', 'bosskey', 'moonrock', 'moonrockpile',
    'teleporter', 'stairsdown', 'stairsup',
];

function listOelFiles(dir) {
    const found = [];
    const walk = (d) => {
        for (const name of readdirSync(d).sort()) {
            const full = join(d, name);
            if (statSync(full).isDirectory()) walk(full);
            else if (name.endsWith('.oel')) found.push(full);
        }
    };
    walk(dir);
    return found;
}

/**
 * Build the map-source document from a Seedling checkout.
 * Pure apart from the reads; ordering is by level index, so the output is
 * byte-stable for a given checkout.
 */
export function extractSeedlingMap(sourceRoot) {
    const gameAsPath = join(sourceRoot, LEVEL_TABLE);
    if (!existsSync(gameAsPath)) {
        throw new Error(`${sourceRoot} does not look like a Seedling checkout (no ${LEVEL_TABLE})`);
    }
    const table = parseLevelTable(readFileSync(gameAsPath, 'utf8'));

    const levels = table.map(({ level, class: className, path }) => {
        const full = join(sourceRoot, path);
        if (!existsSync(full)) throw new Error(`levels[${level}] (${className}) points at missing file ${path}`);
        const parsed = parseOelLevel(readFileSync(full, 'utf8'), path);
        return { level, class: className, path, ...parsed };
    });

    // Every .oel in the tree that no level index claims. Not an error —
    // Seedling ships a few unused rooms (960x960Water.oel, Island.oel) — but
    // the tool should not present them as reachable game levels, so they are
    // recorded by name only.
    const claimed = new Set(levels.map((l) => l.path));
    const unreferenced = listOelFiles(join(sourceRoot, LEVEL_ROOT))
        .map((f) => relative(sourceRoot, f).split(sep).join('/'))
        .filter((p) => !claimed.has(p));

    const entityTypes = new Map();
    for (const lvl of levels) {
        for (const e of lvl.entities) entityTypes.set(e.type, (entityTypes.get(e.type) ?? 0) + 1);
    }

    return {
        schema_version: SEEDLING_MAP_SCHEMA_VERSION,
        game: 'seedling',
        generator: 'scripts/procgen/extract-seedling-map.mjs',
        source: {
            level_table: LEVEL_TABLE,
            level_root: LEVEL_ROOT,
            license: 'MIT (Seedling source, redistributable)',
        },
        tile_size: TILE_SIZE,
        // `level` is the 0-based index into Game.as's `levels` array — the same
        // number flashPanel/games/seedling.json's teleport / region_coords /
        // location_coords use, and the same one a teleporter entity's `to`
        // attribute names.
        level_count: levels.length,
        entity_types: Object.fromEntries([...entityTypes].sort((a, b) => a[0].localeCompare(b[0]))),
        unreferenced_files: unreferenced,
        levels,
    };
}

function main() {
    const argv = process.argv.slice(2);
    const flag = (name) => {
        const i = argv.indexOf(name);
        return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
    };
    const sourceRoot = flag('--source');
    const check = argv.includes('--check');
    const outPath = flag('--out') ?? DEFAULT_OUT;

    if (!sourceRoot) {
        console.error('usage: node scripts/procgen/extract-seedling-map.mjs --source <seedling-checkout> [--out <file>] [--check]');
        process.exit(2);
    }

    const doc = extractSeedlingMap(resolve(sourceRoot));
    // maxInline 220: keeps a whole entity (type, position and its attributes)
    // on one line while still breaking the per-level tile lists one placement
    // per line.
    const text = compactJsonFile(doc, { maxInline: 220 });

    if (check) {
        if (!existsSync(outPath)) {
            console.error(`ERROR: ${outPath} does not exist — run without --check to create it`);
            process.exit(1);
        }
        const committed = readFileSync(outPath, 'utf8');
        if (committed !== text) {
            console.error(`ERROR: ${outPath} differs from a fresh extract of ${sourceRoot}`);
            console.error(`  committed ${committed.length} bytes, extracted ${text.length} bytes`);
            process.exit(1);
        }
        console.log(`OK: ${outPath} matches a fresh extract (${doc.level_count} levels, ${text.length} bytes)`);
        return;
    }

    writeFileSync(outPath, text);
    const tiles = doc.levels.reduce((n, l) => n + l.layers.reduce((m, y) => m + y.tiles.length, 0), 0);
    const entities = doc.levels.reduce((n, l) => n + l.entities.length, 0);
    console.log(
        `wrote ${relative(REPO_ROOT, outPath)} — ${doc.level_count} levels, `
        + `${tiles} tile placements, ${entities} entities, ${Object.keys(doc.entity_types).length} entity types`,
    );
    if (doc.unreferenced_files.length > 0) {
        console.log(`  (${doc.unreferenced_files.length} unreferenced .oel files recorded by name: ${doc.unreferenced_files.join(', ')})`);
    }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
    main();
}
