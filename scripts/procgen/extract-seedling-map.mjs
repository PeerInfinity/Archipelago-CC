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
//   node scripts/procgen/extract-seedling-map.mjs                       # --source defaults to the vendor/seedling submodule
//   node scripts/procgen/extract-seedling-map.mjs --check
//   node scripts/procgen/extract-seedling-map.mjs --source <seedling-checkout> [--out other.json] [--check]
//
// --source defaults to the `vendor/seedling` submodule, resolved against the
// repo root (not the cwd), pinned at the default build's source commit.
//
// --check re-extracts and compares against the committed file (or `--out`'s)
// WITHOUT writing; it exits 1 on any difference, naming the first differing
// level and field. The document carries no timestamp precisely so that check
// can be exact: same checkout in, same bytes out. Its train-tier wrapper is
// extract-seedling-map.train.test.js (train jobs + the nightly).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseOelLevel, parseLevelTable, TILE_SIZE } from './seedlingOgmo.js';
import { compactJsonFile } from '../../frontend/modules/procgenPipeline/compactJson.js';


import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
export const SEEDLING_MAP_SCHEMA_VERSION = 1;

const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
export const DEFAULT_OUT = join(REPO_ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json');
export const DEFAULT_SOURCE = join(REPO_ROOT, 'vendor/seedling');
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

const describe = (v) => {
    const t = JSON.stringify(v);
    return t === undefined ? 'absent' : t.length > 80 ? `${t.slice(0, 77)}...` : t;
};

/**
 * The first place two documents differ, as `levels[N] (Class path).field[i]...: committed X, extracted Y`;
 * null when they are deep-equal. Walks keys in the extracted document's order, then any extra committed key.
 */
export function firstDifference(committed, extracted, at = '') {
    if (Object.is(committed, extracted)) return null;
    const bothObjects = committed && extracted && typeof committed === 'object' && typeof extracted === 'object'
        && Array.isArray(committed) === Array.isArray(extracted);
    if (!bothObjects) return `${at || '(root)'}: committed ${describe(committed)}, extracted ${describe(extracted)}`;
    if (Array.isArray(extracted)) {
        for (let i = 0; i < Math.max(committed.length, extracted.length); i += 1) {
            let label = `${at}[${i}]`;
            const lvl = extracted[i] ?? committed[i];
            if (at === 'levels' && lvl && typeof lvl === 'object') label += ` (${lvl.class} ${lvl.path})`;
            const d = firstDifference(committed[i], extracted[i], label);
            if (d) return d;
        }
        return null;
    }
    for (const k of [...new Set([...Object.keys(extracted), ...Object.keys(committed)])]) {
        const d = firstDifference(committed[k], extracted[k], at ? `${at}.${k}` : k);
        if (d) return d;
    }
    return null;
}

/**
 * `--check` as a function (the train-tier wrapper imports it): extract `source` in memory and byte-compare with `out`.
 * @returns {{ok: boolean, message: string, levelCount: number, bytes: number, difference: string|null}}
 */
export function checkSeedlingMap({ source = DEFAULT_SOURCE, out = DEFAULT_OUT } = {}) {
    const doc = extractSeedlingMap(resolve(source));
    const text = compactJsonFile(doc, { maxInline: 220 });
    const base = { levelCount: doc.level_count, bytes: text.length };
    if (!existsSync(out)) {
        return { ...base, ok: false, difference: null, message: `${out} does not exist — run without --check to create it` };
    }
    const committed = readFileSync(out, 'utf8');
    if (committed === text) {
        return { ...base, ok: true, difference: null, message: `${out} matches a fresh extract (${doc.level_count} levels, ${text.length} bytes)` };
    }
    let difference;
    try {
        difference = firstDifference(JSON.parse(committed), doc)
            ?? 'the same data, formatted differently (re-run without --check to re-format)';
    } catch (e) {
        difference = `the committed file is not JSON (${e.message})`;
    }
    return {
        ...base, ok: false, difference,
        message: `${out} differs from a fresh extract of ${source}\n`
            + `  committed ${committed.length} bytes, extracted ${text.length} bytes\n`
            + `  first difference: ${difference}`,
    };
}

function main() {
    const argv = process.argv.slice(2);
    const flag = (name) => {
        const i = argv.indexOf(name);
        return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
    };
    const sourceRoot = resolve(flag('--source') ?? DEFAULT_SOURCE);
    const check = argv.includes('--check');
    const outPath = flag('--out') ?? DEFAULT_OUT;

    if (check) {
        const r = checkSeedlingMap({ source: sourceRoot, out: outPath });
        if (r.ok) console.log(`OK: ${r.message}`);
        else console.error(`ERROR: ${r.message}`);
        process.exit(r.ok ? 0 : 1);
    }

    const doc = extractSeedlingMap(sourceRoot);
    // maxInline 220: keeps a whole entity (type, position and its attributes)
    // on one line while still breaking the per-level tile lists one placement
    // per line.
    const text = compactJsonFile(doc, { maxInline: 220 });

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
