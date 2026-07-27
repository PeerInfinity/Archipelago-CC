#!/usr/bin/env node
// Region-atlas → vanilla rules.json compiler CLI (projections 1 and 3;
// CC/docs/plans/region-atlas-plan.md, Phases 3 and 4).
//
// Compiles an authored atlas into the AP rules.json the frontend loads: the
// real game's map as an ordinary region graph (projection 1), plus the
// `preset_sidecars` + `flash_panel` blocks that bind every region naming a real
// level to the flash substrate so the real game plays inside it (projection 3).
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
//        [--game-name NAME] [--seed N] [--check] [--quiet] [--allow-invalid]
//
//   # regenerate the committed Seedling preset, then gate it
//   node scripts/procgen/region-atlas-compile.mjs \
//       frontend/modules/flashPanel/atlases/seedling.json \
//       -o frontend/presets/seedling_atlas/AP_1/AP_1_rules.json
//   node scripts/procgen/region-atlas-compile.mjs \
//       frontend/modules/flashPanel/atlases/seedling.json \
//       -o frontend/presets/seedling_atlas/AP_1/AP_1_rules.json --check
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { compileRegionAtlas, formatCompileReport } from '../../frontend/modules/procgenPipeline/regionAtlasCompiler.js';
import { stringifyRulesJson } from '../../frontend/modules/shared/rulesJsonBuilder.js';

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const valueOf = (flag) => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
};

const atlasFile = argv.find((a, i) => !a.startsWith('-') && !['-o', '--out', '--game-name', '--seed'].includes(argv[i - 1]));
if (!atlasFile) {
    console.error('usage: node scripts/procgen/region-atlas-compile.mjs <atlas.json> [-o out.json] [--game-name NAME] [--seed N] [--check] [--quiet] [--allow-invalid]');
    process.exit(2);
}

const outFile = valueOf('-o') ?? valueOf('--out') ?? null;
const check = has('--check');
const quiet = has('--quiet');
const allowInvalid = has('--allow-invalid');

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

const seedArg = valueOf('--seed');
let result;
try {
    result = compileRegionAtlas(atlas, {
        mapDoc,
        allowInvalid,
        gameName: valueOf('--game-name'),
        seed: seedArg === undefined ? undefined : Number(seedArg),
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
