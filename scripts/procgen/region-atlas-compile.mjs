#!/usr/bin/env node
// Region-atlas → vanilla rules.json compiler CLI (projections 1 and 3;
// CC/docs/plans/region-atlas-plan.md, Phases 3, 4 and 5b).
//
// Compiles an authored atlas into the AP rules.json the frontend loads: the
// real game's map as an ordinary region graph (projection 1), plus the
// `preset_sidecars` block that binds every region naming a real level to a
// playable substrate (projection 3), in one of two FLAVOURS:
//
//   default   the real recompiled game (`flash_<game>` + the `flash_panel`
//             wiring). Needs the game's machine-local wasm artifact to play.
//   --maze    the region's analyzed tile map projected into the MAZE substrate
//             (Phase 5b). Real geometry, real item gating, no artifact — which
//             is what lets the in-app suite test it.
//
// The two flavours are SEPARATE PRESETS and never merged: one sidecar per AP
// region per preset, and a file carrying both would ask two substrates to own
// one region. --maze needs the game's semantics tables (it recomputes the tile
// partition through the analyzer), so it also loads the per-game config the
// analyze CLI uses — that is where flag -> AP item comes from.
//
// The output is deterministic (no timestamps, no clock), so --check is an exact
// "does the committed preset still regenerate byte-identically" gate, the same
// shape extract-seedling-map.mjs and make-seedling-starter-atlas.mjs use.
//
// When the atlas names a map-source document (tile_space.map_document) it is
// loaded from beside the atlas so every map_ref resolves during validation. An
// atlas that does not validate is NOT compiled unless --allow-invalid is given.
//
// Usage:
//   node scripts/procgen/region-atlas-compile.mjs <atlas.json> [-o out.json]
//        [--maze] [--game-config PATH] [--game-name NAME] [--seed N]
//        [--check] [--quiet] [--allow-invalid]
//
//   # regenerate the committed Seedling presets, then gate them
//   node scripts/procgen/region-atlas-compile.mjs \
//       frontend/modules/flashPanel/atlases/seedling.json \
//       -o frontend/presets/seedling_atlas/AP_1/AP_1_rules.json
//   node scripts/procgen/region-atlas-compile.mjs --maze \
//       frontend/modules/flashPanel/atlases/seedling.json \
//       -o frontend/presets/seedling_atlas_maze/AP_1/AP_1_rules.json --check
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileRegionAtlas, formatCompileReport } from '../../frontend/modules/procgenPipeline/regionAtlasCompiler.js';
import { stringifyRulesJson } from '../../frontend/modules/shared/rulesJsonBuilder.js';
import { seedlingMazeProjectionDeps } from '../../frontend/modules/flashPanel/seedlingAtlasAnalysis.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// Which game's semantics tables build the maze projection's cell grids. One
// entry today; Phase 7 adds RWK here. An unknown game is an error rather than a
// silently empty projection.
const MAZE_PROJECTIONS = { seedling: seedlingMazeProjectionDeps };

const USAGE = 'usage: node scripts/procgen/region-atlas-compile.mjs <atlas.json> [-o out.json] [--maze] [--game-config PATH] [--game-name NAME] [--seed N] [--check] [--quiet] [--allow-invalid]';

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const valueOf = (flag) => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
};

const VALUE_FLAGS = ['-o', '--out', '--game-name', '--seed', '--game-config'];
const atlasFile = argv.find((a, i) => !a.startsWith('-') && !VALUE_FLAGS.includes(argv[i - 1]));
if (!atlasFile) {
    console.error(USAGE);
    process.exit(2);
}

const outFile = valueOf('-o') ?? valueOf('--out') ?? null;
const check = has('--check');
const quiet = has('--quiet');
const allowInvalid = has('--allow-invalid');
const maze = has('--maze');

const atlasPath = resolve(atlasFile);
const atlas = JSON.parse(readFileSync(atlasPath, 'utf8'));

// The map document sits beside the atlas (Phase-2 convention). Without it the
// atlas is still structurally checkable, so a missing one warns rather than dies.
const mapName = atlas.tile_space?.map_document;
let mapDoc;
if (typeof mapName === 'string' && mapName.length > 0) {
    const mapPath = resolve(dirname(atlasPath), mapName);
    if (existsSync(mapPath)) mapDoc = JSON.parse(readFileSync(mapPath, 'utf8'));
    else if (!quiet) console.log(`WARN: tile_space.map_document "${mapName}" not found beside the atlas — map_ref values are unresolved`);
}

// The maze flavour recomputes the tile partition from the map document through
// the analyzer, so it needs both the terrain and the game's condition
// vocabulary. Neither is optional: without the map there is nothing to project,
// and without the config every crossing rule would come out unresolved.
let mazeProjection;
if (maze) {
    const build = MAZE_PROJECTIONS[atlas.game];
    if (!build) {
        console.error(`ERROR: no maze projection is registered for game "${atlas.game}" — its tile semantics have not been transcribed yet`);
        process.exit(2);
    }
    if (!mapDoc) {
        console.error('ERROR: --maze needs the atlas\'s tile_space.map_document beside the atlas — there is no tile map to project');
        process.exit(2);
    }
    const configPath = valueOf('--game-config')
        ?? resolve(REPO, 'frontend/modules/flashPanel/games', `${atlas.game}.json`);
    if (!existsSync(configPath)) {
        console.error(`ERROR: per-game config not found at ${configPath} — it is where the flag -> AP item mapping comes from`);
        process.exit(2);
    }
    const gameConfig = JSON.parse(readFileSync(configPath, 'utf8'));
    mazeProjection = build({ mapDoc, gameConfig });
    if (!quiet) for (const u of mazeProjection.unresolved ?? []) console.log(`WARN: ${u}`);
}

const seedArg = valueOf('--seed');
let result;
try {
    result = compileRegionAtlas(atlas, {
        mapDoc,
        allowInvalid,
        gameName: valueOf('--game-name'),
        seed: seedArg === undefined ? undefined : Number(seedArg),
        ...(maze ? { sidecarFlavor: 'maze', mazeProjection } : {}),
    });
} catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exit(1);
}
const { rules, report } = result;
const text = `${stringifyRulesJson(rules)}\n`;

if (!quiet) {
    for (const w of report.atlas_warnings) console.log(`WARN: ${w}`);
    for (const e of report.atlas_errors) console.error(`ERROR: ${e}`);
    for (const line of formatCompileReport(report)) console.log(line);
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
        console.error(`FAIL: ${outFile} is not what this atlas compiles to (${current.length}B on disk vs ${text.length}B compiled) — regenerate it`);
        process.exit(1);
    }
    console.log(`OK: ${outFile} is byte-identical to the compiled atlas`);
    process.exit(0);
}

if (outFile) {
    const target = resolve(outFile);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
    if (!quiet) console.log(`wrote ${outFile} (${text.length} bytes)`);
} else {
    process.stdout.write(text);
}
process.exit(report.atlas_valid || allowInvalid ? 0 : 1);
