#!/usr/bin/env node
/**
 * Run the top-down driver headlessly against a source rules.json and
 * emit a procgen rules.json (with preset_sidecars).
 *
 * Mirrors the procgen pipeline panel's "Top-down" mode (see
 * `_runTopDown` in frontend/modules/procgenPipeline/procgenPipelineUI.js)
 * so the no-flag invocation produces the same rules.json a user would
 * get by loading the source and clicking "Generate" with the panel's
 * defaults. Maze substrate only — no substrate mixing.
 *
 * Auto-sizes the grid to fit the source's region count (matches
 * `_applyGridDimsFromSource`).
 *
 * Usage:
 *   scripts/utils/generate-topdown-preset.js \
 *       --source-rules path/to/source_rules.json \
 *       --seed 1 \
 *       --out frontend/downloads/AP_1_rules.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const DEFAULTS = {
    seed: 1,
    regionWidth: 8,
    regionHeight: 6,
    minGridDim: 3,
    maxRetries: 5,
    growStep: 2,
    sourceRules: null,
    out: null,
};

function parseArgs(argv) {
    const args = { ...DEFAULTS };
    const intKeys = new Set([
        'seed', 'regionWidth', 'regionHeight', 'minGridDim',
        'maxRetries', 'growStep',
    ]);
    const flagToKey = {
        '--source-rules': 'sourceRules',
        '--seed': 'seed',
        '--region-width': 'regionWidth',
        '--region-height': 'regionHeight',
        '--min-grid-dim': 'minGridDim',
        '--max-retries': 'maxRetries',
        '--grow-step': 'growStep',
        '--out': 'out',
    };
    for (let i = 0; i < argv.length; i++) {
        const flag = argv[i];
        if (flag === '-h' || flag === '--help') {
            printHelp();
            process.exit(0);
        }
        const key = flagToKey[flag];
        if (!key) throw new Error(`Unknown argument: ${flag}`);
        const val = argv[++i];
        if (val === undefined) throw new Error(`${flag} requires a value`);
        if (intKeys.has(key)) {
            const parsed = parseInt(val, 10);
            if (!Number.isFinite(parsed)) throw new Error(`${flag}: bad integer '${val}'`);
            args[key] = parsed;
        } else {
            args[key] = val;
        }
    }
    if (!args.sourceRules) throw new Error('--source-rules is required');
    if (!args.out) {
        args.out = path.join(PROJECT_ROOT, 'frontend', 'downloads', `AP_${args.seed}_rules.json`);
    }
    return args;
}

function printHelp() {
    console.log(`Usage: generate-topdown-preset.js --source-rules <path> [options]

Required:
  --source-rules <path>    Source rules.json (the world to realise)

Options:
  --seed <int>             Procgen RNG seed (default: ${DEFAULTS.seed})
  --region-width <int>     Per-region tile width (default: ${DEFAULTS.regionWidth})
  --region-height <int>    Per-region tile height (default: ${DEFAULTS.regionHeight})
  --min-grid-dim <int>     Floor for auto-sized grid (default: ${DEFAULTS.minGridDim})
  --max-retries <int>      Retries on partial_layout (default: ${DEFAULTS.maxRetries}; 0 disables)
  --grow-step <int>        Cells added to each axis per retry (default: ${DEFAULTS.growStep})
  --out <path>             Output rules.json path
                           (default: frontend/downloads/AP_<seed>_rules.json)
  -h, --help               Show this message and exit
`);
}

// Mirrors procgenPipelineUI's _applyGridDimsFromSource.
function autoSizeGrid(sourceRulesJson, minDim) {
    const regions = sourceRulesJson?.regions?.['1'] ?? {};
    const count = Object.keys(regions).length;
    if (count === 0) return { width: minDim, height: minDim };
    const dim = Math.max(minDim, Math.ceil(Math.sqrt(count * 1.5)));
    return { width: dim, height: dim };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    const sourceAbs = path.resolve(args.sourceRules);
    if (!fs.existsSync(sourceAbs)) {
        throw new Error(`source rules.json not found: ${sourceAbs}`);
    }
    const source = JSON.parse(fs.readFileSync(sourceAbs, 'utf-8'));

    // Side-effect import — the maze substrate library registers itself
    // in substrateRegistry on import. Same as generate-procgen-rules.js
    // and the browser's maze module register() hook.
    const mazeLibPath = path.join(
        PROJECT_ROOT, 'frontend', 'modules', 'mazeRoom', 'mazeRoomLibrary.js',
    );
    await import(mazeLibPath);
    const enginePath = path.join(
        PROJECT_ROOT, 'frontend', 'modules', 'procgenPipeline',
        'procgenPipelineEngine.js',
    );
    const {
        topDownFromRulesJson,
        buildRulesJson,
        stringifyRulesJson,
        computeSourceCounts,
    } = await import(enginePath);

    let gridDims = autoSizeGrid(source, args.minGridDim);
    const regionSizeBase = { width: args.regionWidth, height: args.regionHeight };

    console.log('generate-topdown-preset:');
    console.log(`  source           = ${sourceAbs}`);
    console.log(`  source game_name = ${source.game_name ?? '(none)'}`);
    console.log(`  seed             = ${args.seed}`);
    console.log(`  gridDims         = ${gridDims.width}x${gridDims.height} (auto)`);
    console.log(`  regionSizeBase   = ${regionSizeBase.width}x${regionSizeBase.height}`);
    console.log(`  max-retries      = ${args.maxRetries}, grow-step=${args.growStep}`);
    console.log(`  out              = ${args.out}`);

    // Grow-and-retry on partial_layout. BFS-greedy placement can
    // fragment the grid before all regions are placed, so the auto-
    // sized starting dim isn't always sufficient even when the cell
    // count would suggest it should be. Bump dims and retry until
    // every source region is placed, the placement count plateaus
    // (the rest are unreachable from the source's start, not a
    // sizing issue), or we hit the retry cap.
    let grid, stats, startCell;
    let attempt = 0;
    let prevPlaced = -1;
    while (true) {
        const result = topDownFromRulesJson(source, {
            gridDims,
            regionSizeBase,
            seed: args.seed,
        });
        grid = result.grid;
        stats = result.stats;
        startCell = result.startCell;
        const placed = stats.regionsBuilt;
        const total = stats.regionsTotal;
        console.log(
            `  attempt ${attempt}: ${gridDims.width}x${gridDims.height} -> ` +
            `placed ${placed}/${total}, skipped=${stats.regionsSkipped}, ` +
            `teleporters=${stats.teleportersPlaced}, stop=${stats.stopReason}`,
        );
        if (placed >= total) break;
        if (placed === prevPlaced) {
            const unreachable = total - placed;
            console.log(
                `  plateau at ${placed}/${total}; ${unreachable} region(s) ` +
                `appear unreachable from source's start (not a grid-size issue).`,
            );
            break;
        }
        if (attempt >= args.maxRetries) {
            console.log(`  hit retry cap (${args.maxRetries}); using last result.`);
            break;
        }
        prevPlaced = placed;
        attempt += 1;
        gridDims = {
            width: gridDims.width + args.growStep,
            height: gridDims.height + args.growStep,
        };
    }

    const rulesJson = buildRulesJson(grid, {
        startCell,
        seed: args.seed,
        assumeBidirectional: source.assume_bidirectional_exits !== false,
        startingItems: source.starting_items?.['1'] ?? [],
        sourceItems: source.items?.['1'] ?? null,
        procgenMetadata: {
            driver: 'top-down',
            source_game: source.game_name ?? null,
            source_counts: computeSourceCounts(source, '1'),
            stop_reason: stats.stopReason,
        },
    });
    const text = stringifyRulesJson(rulesJson);

    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, text + '\n', 'utf-8');

    console.log(
        `\nTop-down: regions=${stats.regionsBuilt} skipped=${stats.regionsSkipped} ` +
        `teleporters=${stats.teleportersPlaced} stopReason=${stats.stopReason}`,
    );
    console.log(`Wrote ${args.out}`);
}

main().catch((err) => {
    console.error(`generate-topdown-preset: ${err.message}`);
    process.exit(1);
});
