#!/usr/bin/env node
// Region-atlas → sphere-growth content pool CLI
// (CC/docs/plans/region-atlas-plan.md, Phase 6).
//
// Compiles an authored atlas into the POOL DOCUMENT sphere growth reads when it
// is asked to place pre-built regions of a real game inside a world it grows.
// The pool is the Phase-5b maze projection plus, per exit, the atlas's own
// authored access rule — the third capture contract (see regionAtlasPool.js).
//
// It is derived, not authored: the committed pool is a build artifact with an
// exact `--check` regeneration gate, exactly like the two committed presets.
// Regenerate it whenever the atlas, the semantics tables, or the projection
// change; the pool_id carries a content hash, so a stale pool is loud.
//
// Usage:
//   node scripts/procgen/region-atlas-pool.mjs <atlas.json> [-o out.json]
//        [--game-config PATH] [--check] [--quiet]
//
//   # regenerate the committed Seedling pool, then gate it
//   node scripts/procgen/region-atlas-pool.mjs \
//       frontend/modules/flashPanel/atlases/seedling.json \
//       -o frontend/atlas-pools/seedling-atlas-pool.json
//   node scripts/procgen/region-atlas-pool.mjs \
//       frontend/modules/flashPanel/atlases/seedling.json \
//       -o frontend/atlas-pools/seedling-atlas-pool.json --check

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileRegionAtlas } from '../../frontend/modules/procgenPipeline/regionAtlasCompiler.js';
import {
    buildAtlasPool, entryRequirement, formatAtlasPoolNotes, validateAtlasPool,
} from '../../frontend/modules/procgenPipeline/regionAtlasPool.js';
import { seedlingMazeProjectionDeps } from '../../frontend/modules/flashPanel/seedlingAtlasAnalysis.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// Which game's semantics tables build the maze projection's cell grids — the
// same table region-atlas-compile.mjs keeps. Phase 7 adds RWK here.
const MAZE_PROJECTIONS = { seedling: seedlingMazeProjectionDeps };

const USAGE = 'usage: node scripts/procgen/region-atlas-pool.mjs <atlas.json> [-o out.json] [--game-config PATH] [--check] [--quiet]';

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const valueOf = (flag) => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
};

const VALUE_FLAGS = ['-o', '--out', '--game-config'];
const atlasFile = argv.find((a, i) => !a.startsWith('-') && !VALUE_FLAGS.includes(argv[i - 1]));
if (!atlasFile) {
    console.error(USAGE);
    process.exit(2);
}
const outFile = valueOf('-o') ?? valueOf('--out') ?? null;
const check = has('--check');
const quiet = has('--quiet');

const atlasPath = resolve(atlasFile);
const atlas = JSON.parse(readFileSync(atlasPath, 'utf8'));

const mapName = atlas.tile_space?.map_document;
if (typeof mapName !== 'string' || mapName.length === 0) {
    console.error('ERROR: the atlas names no tile_space.map_document — there is no tile map to project');
    process.exit(2);
}
const mapPath = resolve(dirname(atlasPath), mapName);
if (!existsSync(mapPath)) {
    console.error(`ERROR: tile_space.map_document "${mapName}" not found beside the atlas`);
    process.exit(2);
}
const mapDoc = JSON.parse(readFileSync(mapPath, 'utf8'));

const build = MAZE_PROJECTIONS[atlas.game];
if (!build) {
    console.error(`ERROR: no maze projection is registered for game "${atlas.game}" — its tile semantics have not been transcribed yet`);
    process.exit(2);
}
const configPath = valueOf('--game-config')
    ?? resolve(REPO, 'frontend/modules/flashPanel/games', `${atlas.game}.json`);
if (!existsSync(configPath)) {
    console.error(`ERROR: per-game config not found at ${configPath} — it is where the flag -> AP item mapping comes from`);
    process.exit(2);
}
const gameConfig = JSON.parse(readFileSync(configPath, 'utf8'));
const mazeProjection = build({ mapDoc, gameConfig });
if (!quiet) for (const u of mazeProjection.unresolved ?? []) console.log(`WARN: ${u}`);

let pool;
let notes;
try {
    const { rules } = compileRegionAtlas(atlas, {
        mapDoc, sidecarFlavor: 'maze', mazeProjection,
    });
    ({ pool, notes } = buildAtlasPool(atlas, rules));
} catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exit(1);
}

const vr = validateAtlasPool(pool);
const text = `${JSON.stringify(pool, null, 2)}\n`;

if (!quiet) {
    for (const line of formatAtlasPoolNotes(notes)) console.log(line);
    for (const w of vr.warnings) console.log(`WARN: ${w}`);
    for (const e of vr.errors) console.error(`ERROR: ${e}`);
    console.log(`pool ${pool.pool_id}: ${pool.entries.length} entr(ies)`);
    // The requirement census is the sorter's input, so print it here: it is the
    // one place a change in the atlas's rules shows up as a change in WHERE the
    // sphere sorter can put a region.
    for (const entry of pool.entries) {
        const req = entryRequirement(entry);
        const slots = entry.location_slots;
        console.log(`  ${entry.entry_id}: ${entry.exits.length} exit(s), ${slots} slot(s), `
            + (req.declined
                ? `DECLINED (${req.declined})`
                : `entry ${req.gate.length === 0 ? 'FREE' : `needs [${req.gate.join(', ')}]`} via ${req.via}`));
    }
}

if (check) {
    if (!outFile) {
        console.error('ERROR: --check needs -o <file> to compare against');
        process.exit(2);
    }
    const target = resolve(outFile);
    if (!existsSync(target)) {
        console.error(`FAIL: ${outFile} does not exist — run without --check to write it`);
        process.exit(1);
    }
    const current = readFileSync(target, 'utf8');
    if (current !== text) {
        console.error(`FAIL: ${outFile} is not what this atlas builds to (${current.length}B on disk vs ${text.length}B built) — regenerate it`);
        process.exit(1);
    }
    console.log(`OK: ${outFile} is byte-identical to the built pool`);
    process.exit(vr.ok ? 0 : 1);
}

if (outFile) {
    const target = resolve(outFile);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
    if (!quiet) console.log(`wrote ${outFile} (${text.length} bytes)`);
} else {
    process.stdout.write(text);
}
process.exit(vr.ok ? 0 : 1);
