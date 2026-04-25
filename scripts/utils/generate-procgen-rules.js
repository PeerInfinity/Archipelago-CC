#!/usr/bin/env node
/**
 * Run the procgen pipeline engine headlessly and emit a rules.json.
 *
 * Same engine the procgenPipeline panel calls (growMaze + buildRulesJson),
 * just without the UI in the loop. Useful for re-running step-8
 * verification on fresh outputs without going through the browser, and
 * for scripted regression on the procgen pipeline itself.
 *
 * Defaults match `frontend/modules/procgenPipeline/procgenPipelineUI.js`'s
 * DEFAULT_PARAMS and DEFAULT_SCENARIO so the no-arg invocation produces
 * a rules.json equivalent to what a user gets by clicking "Generate"
 * with the panel's defaults.
 *
 * Usage:
 *   scripts/utils/generate-procgen-rules.js
 *   scripts/utils/generate-procgen-rules.js --seed 1 --out frontend/downloads/AP_1_rules.json
 *   scripts/utils/generate-procgen-rules.js --grid-width 4 --grid-height 4 \
 *       --items key_red:3,key_blue:1 --obstacles door_red:3,door_blue:1
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// Mirrors procgenPipelineUI's DEFAULT_PARAMS / DEFAULT_SCENARIO.
const DEFAULTS = {
    seed: 1,
    gridWidth: 3,
    gridHeight: 3,
    regionWidth: 8,
    regionHeight: 6,
    minSuccessPct: 30,
    maxSuccessPct: 60,
    walkerTrials: 15,
    maxItemsPerRegion: 2,
    maxRegions: null,
    items: { key_red: 2 },
    obstacles: { door_red: 2 },
    out: null,  // Resolved below to frontend/downloads/AP_<seed>_rules.json
};

function parseCounts(spec, label) {
    // "key_red:2,key_blue:1" → { key_red: 2, key_blue: 1 }
    const out = {};
    if (!spec) return out;
    for (const part of spec.split(',')) {
        const [id, countStr] = part.split(':');
        if (!id || !countStr) {
            throw new Error(`--${label}: bad token '${part}', expected 'id:count'`);
        }
        const count = parseInt(countStr, 10);
        if (!Number.isFinite(count) || count < 0) {
            throw new Error(`--${label}: bad count for '${id}': '${countStr}'`);
        }
        out[id.trim()] = count;
    }
    return out;
}

function parseArgs(argv) {
    const args = { ...DEFAULTS };
    const intKeys = new Set([
        'seed', 'gridWidth', 'gridHeight', 'regionWidth', 'regionHeight',
        'minSuccessPct', 'maxSuccessPct', 'walkerTrials', 'maxItemsPerRegion',
        'maxRegions',
    ]);
    const flagToKey = {
        '--seed': 'seed',
        '--grid-width': 'gridWidth',
        '--grid-height': 'gridHeight',
        '--region-width': 'regionWidth',
        '--region-height': 'regionHeight',
        '--min-success-pct': 'minSuccessPct',
        '--max-success-pct': 'maxSuccessPct',
        '--walker-trials': 'walkerTrials',
        '--max-items-per-region': 'maxItemsPerRegion',
        '--max-regions': 'maxRegions',
        '--items': 'items',
        '--obstacles': 'obstacles',
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
        if (key === 'items') args.items = parseCounts(val, 'items');
        else if (key === 'obstacles') args.obstacles = parseCounts(val, 'obstacles');
        else if (key === 'out') args.out = val;
        else if (intKeys.has(key)) {
            const parsed = val === 'null' ? null : parseInt(val, 10);
            if (val !== 'null' && !Number.isFinite(parsed)) {
                throw new Error(`${flag}: bad integer '${val}'`);
            }
            args[key] = parsed;
        }
    }
    if (!args.out) {
        args.out = path.join(PROJECT_ROOT, 'frontend', 'downloads', `AP_${args.seed}_rules.json`);
    }
    return args;
}

function printHelp() {
    console.log(`Usage: generate-procgen-rules.js [options]

Options:
  --seed <int>                  Generation seed (default: ${DEFAULTS.seed})
  --grid-width <int>            Grid width in cells (default: ${DEFAULTS.gridWidth})
  --grid-height <int>           Grid height in cells (default: ${DEFAULTS.gridHeight})
  --region-width <int>          Per-region tile width (default: ${DEFAULTS.regionWidth})
  --region-height <int>         Per-region tile height (default: ${DEFAULTS.regionHeight})
  --min-success-pct <int>       Walker min success % (default: ${DEFAULTS.minSuccessPct})
  --max-success-pct <int>       Walker max success % (default: ${DEFAULTS.maxSuccessPct})
  --walker-trials <int>         Walker trials per proposal (default: ${DEFAULTS.walkerTrials})
  --max-items-per-region <int>  Item budget per region (default: ${DEFAULTS.maxItemsPerRegion})
  --max-regions <int|null>      Cap on regions built (default: null = grid-bounded)
  --items <spec>                Item pool, e.g. 'key_red:2,key_blue:1'
                                (default: 'key_red:2')
  --obstacles <spec>            Obstacle pool, e.g. 'door_red:2,door_blue:1'
                                (default: 'door_red:2')
  --out <path>                  Output rules.json path
                                (default: frontend/downloads/AP_<seed>_rules.json)
  -h, --help                    Show this message and exit
`);
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    const enginePath = path.join(
        PROJECT_ROOT, 'frontend', 'modules', 'procgenPipeline',
        'procgenPipelineEngine.js',
    );
    const { growMaze, buildRulesJson, stringifyRulesJson } = await import(enginePath);

    console.log('generate-procgen-rules:');
    console.log(`  seed                  = ${args.seed}`);
    console.log(`  grid                  = ${args.gridWidth}x${args.gridHeight}`);
    console.log(`  region                = ${args.regionWidth}x${args.regionHeight}`);
    console.log(`  walker_success_pct    = ${args.minSuccessPct}-${args.maxSuccessPct} (trials=${args.walkerTrials})`);
    console.log(`  max_items_per_region  = ${args.maxItemsPerRegion}`);
    console.log(`  max_regions           = ${args.maxRegions == null ? 'null' : args.maxRegions}`);
    console.log(`  items                 = ${JSON.stringify(args.items)}`);
    console.log(`  obstacles             = ${JSON.stringify(args.obstacles)}`);
    console.log(`  out                   = ${args.out}`);

    const { grid, pool, stats, startCell } = growMaze({
        gridDims: { width: args.gridWidth, height: args.gridHeight },
        regionSize: { width: args.regionWidth, height: args.regionHeight },
        itemPool: { ...args.items },
        obstaclePool: { ...args.obstacles },
        seed: args.seed,
        regionParams: {
            minSuccessPct: args.minSuccessPct / 100,
            maxSuccessPct: args.maxSuccessPct / 100,
            walkerTrials: args.walkerTrials,
        },
        growthParams: {
            maxItemsPerRegion: args.maxItemsPerRegion,
            maxRegions: args.maxRegions ?? null,
        },
    });

    const rulesJson = buildRulesJson(grid, { startCell, seed: args.seed });
    const text = stringifyRulesJson(rulesJson);

    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, text + '\n', 'utf-8');

    const poolRemaining = pool.snapshot();
    console.log(`\nGrowth: regions=${stats.regionsBuilt} skipped=${stats.regionsSkipped} stopReason=${stats.stopReason}`);
    console.log(`Pool remaining: items=${JSON.stringify(poolRemaining.items)} obstacles=${JSON.stringify(poolRemaining.obstacles)}`);
    console.log(`Wrote ${args.out}`);
}

main().catch((err) => {
    console.error(`generate-procgen-rules: ${err.message}`);
    process.exit(1);
});
