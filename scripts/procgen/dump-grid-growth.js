#!/usr/bin/env node
/**
 * Headless grid-growth driver — runs growMaze + buildRulesJson in
 * Node and writes the result to disk. Intended for procgen-engine
 * debugging without booting the browser.
 *
 * Usage:
 *   node scripts/procgen/dump-grid-growth.js \
 *       --seed 1 \
 *       --grid 3x3 \
 *       --region 8x6 \
 *       --quota maze=2 --quota text_adventure=2 \
 *       --start maze \
 *       -o /tmp/dump.json
 *
 * Flags:
 *   --seed N                 RNG seed (default 1)
 *   --grid WxH               grid dims (default 3x3)
 *   --region WxH             region dims (default 8x6)
 *   --quota id=N             per-substrate region quota; repeat per substrate
 *   --mix id=W               per-substrate weight (mix mode); repeat per substrate
 *                            (mutually exclusive with --quota)
 *   --start id               start substrate ('auto' or substrate id)
 *   --stop-on-pool-empty     end growth when item pool empties
 *   --max-regions N          safety cap (engine param)
 *   --items id=N             item pool entry; repeat per item
 *   --obstacles id=N         obstacle pool entry; repeat per obstacle
 *   --branch P               branchProbability (default 0.5)
 *   --no-bidirectional       disable assumeBidirectional (default on)
 *   --asymmetric add|remove  cross-branch one-way exit reconciliation
 *                            (default add)
 *   -o, --out PATH           output JSON path (default ./grid-growth-dump.json)
 *
 * Output JSON shape:
 *   {
 *     config: { ... },           // echoed inputs
 *     stats: { ... },            // growMaze stats incl. substrateCounts
 *     regions: [{ id, substrate, cell: {gx,gy}, exits: [{exit_id, side,
 *                  targetRegion, isBackExit, isTeleporter}, ...] }, ...],
 *     rulesJson: { ... }         // full compiled rules.json
 *   }
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Substrate libraries register their adapters on import. growMaze
// needs at least one registered substrate to build regions.
import '../../frontend/modules/mazeRoom/mazeRoomLibrary.js';
import '../../frontend/modules/textAdventureSubstrateWrapper/textAdventureSubstrateWrapperLibrary.js';

import { growMaze, buildRulesJson, getRegionExits } from
    '../../frontend/modules/procgenPipeline/procgenPipelineEngine.js';

// --- CLI parser ---

function parseArgs(argv) {
    const out = {
        seed: 1,
        grid: { width: 3, height: 3 },
        region: { width: 8, height: 6 },
        quotas: {},
        mix: {},
        start: 'auto',
        stopOnPoolEmpty: false,
        maxRegions: null,
        items: {},
        obstacles: {},
        branch: 0.5,
        bidirectional: true,
        asymmetric: 'add',
        out: './grid-growth-dump.json',
    };
    const parseWxH = (s) => {
        const [w, h] = s.split('x').map((n) => parseInt(n, 10));
        if (!Number.isFinite(w) || !Number.isFinite(h)) {
            throw new Error(`expected WxH, got '${s}'`);
        }
        return { width: w, height: h };
    };
    const parseKv = (s) => {
        const i = s.indexOf('=');
        if (i < 0) throw new Error(`expected id=N, got '${s}'`);
        return [s.slice(0, i), parseInt(s.slice(i + 1), 10)];
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        const next = () => argv[++i];
        switch (a) {
            case '--seed': out.seed = parseInt(next(), 10); break;
            case '--grid': out.grid = parseWxH(next()); break;
            case '--region': out.region = parseWxH(next()); break;
            case '--quota': {
                const [id, n] = parseKv(next());
                out.quotas[id] = n;
                break;
            }
            case '--mix': {
                const [id, n] = parseKv(next());
                out.mix[id] = n;
                break;
            }
            case '--start': out.start = next(); break;
            case '--stop-on-pool-empty': out.stopOnPoolEmpty = true; break;
            case '--max-regions': out.maxRegions = parseInt(next(), 10); break;
            case '--items': {
                const [id, n] = parseKv(next());
                out.items[id] = n;
                break;
            }
            case '--obstacles': {
                const [id, n] = parseKv(next());
                out.obstacles[id] = n;
                break;
            }
            case '--branch': out.branch = parseFloat(next()); break;
            case '--no-bidirectional': out.bidirectional = false; break;
            case '--asymmetric': {
                const v = next();
                if (v !== 'add' && v !== 'remove') {
                    throw new Error(`--asymmetric expects 'add' or 'remove', got '${v}'`);
                }
                out.asymmetric = v;
                break;
            }
            case '-o':
            case '--out': out.out = next(); break;
            case '-h':
            case '--help':
                console.log(extractHelpText());
                process.exit(0);
                break;
            default:
                throw new Error(`unknown flag: ${a}`);
        }
    }
    if (Object.keys(out.quotas).length > 0 && Object.keys(out.mix).length > 0) {
        throw new Error('--quota and --mix are mutually exclusive');
    }
    return out;
}

function extractHelpText() {
    // Mirror the docblock at the top of the file.
    return [
        'Usage: node scripts/procgen/dump-grid-growth.js [flags]',
        '',
        '  --seed N',
        '  --grid WxH                 (default 3x3)',
        '  --region WxH               (default 8x6)',
        '  --quota id=N               repeat per substrate',
        '  --mix id=W                 mutually exclusive with --quota',
        '  --start id                 substrate id or "auto" (default auto)',
        '  --stop-on-pool-empty',
        '  --max-regions N',
        '  --items id=N',
        '  --obstacles id=N',
        '  --branch P                 branchProbability (default 0.5)',
        '  --no-bidirectional',
        '  -o, --out PATH             (default ./grid-growth-dump.json)',
    ].join('\n');
}

// --- Output shaping ---

function shapeRegions(grid) {
    const out = [];
    for (const [, region] of grid.cells) {
        const exits = [];
        const exitMap = getRegionExits(region);
        if (exitMap) {
            for (const [, exit] of exitMap) {
                exits.push({
                    exit_id: exit.exit_id,
                    side: exit.side ?? null,
                    targetRegion: exit.targetRegion ?? null,
                    targetExitId: exit.targetExitId ?? null,
                    isBackExit: !!exit.isBackExit,
                    isTeleporter: !!exit.isTeleporter,
                    exitName: exit.exitName ?? null,
                });
            }
        }
        out.push({
            id: region.region_id,
            substrate: region.substrate,
            cell: region.cell ?? null,
            exits,
        });
    }
    out.sort((a, b) => a.id.localeCompare(b.id));
    return out;
}

// --- main ---

async function main() {
    const config = parseArgs(process.argv.slice(2));

    const growthParams = {
        branchProbability: config.branch,
        assumeBidirectional: config.bidirectional,
        stopOnPoolEmpty: config.stopOnPoolEmpty,
        asymmetricExits: config.asymmetric,
        ...(config.maxRegions != null ? { maxRegions: config.maxRegions } : {}),
        ...(Object.keys(config.quotas).length > 0
            ? { substrateQuotas: config.quotas } : {}),
        ...(Object.keys(config.mix).length > 0
            ? { substrateMix: config.mix } : {}),
        ...(config.start && config.start !== 'auto'
            ? { startSubstrate: config.start } : {}),
    };

    const { grid, stats, startCell } = growMaze({
        gridDims: config.grid,
        regionSize: config.region,
        itemPool: { ...config.items },
        obstaclePool: { ...config.obstacles },
        seed: config.seed,
        growthParams,
    });

    const rulesJson = buildRulesJson(grid, { startCell, seed: config.seed });

    const dump = {
        config,
        startCell,
        stats,
        regions: shapeRegions(grid),
        rulesJson,
    };

    const outPath = resolve(process.cwd(), config.out);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(dump, null, 2));
    console.log(`Wrote ${outPath}`);
    console.log(`  regionsBuilt: ${stats.regionsBuilt}`
        + `  stopReason: ${stats.stopReason}`
        + `  substrateCounts: ${JSON.stringify(stats.substrateCounts)}`);
}

// Only run main when invoked directly (not when imported as a module).
// The substrate libraries we import pull in modules with background
// timers (stateManagerProxy etc.), which keeps Node alive after main
// returns. Force-exit on success so the script doesn't hang.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().then(() => process.exit(0)).catch((e) => {
        console.error(`ERROR: ${e.message}`);
        process.exit(1);
    });
}
