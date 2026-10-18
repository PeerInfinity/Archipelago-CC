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
 *   --json-status PATH       write the run's status object (`-` = stdout); see cliRun.js
 *   -h, --help               print this and exit
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

import { argvHelp } from './argvHelp.js';
import { KIND, W, flag, oneOf, parseFlags } from './cliFlags.js';
import { runCli, parseOrUsage } from './cliRun.js';

// Substrate libraries (procgenCore/substrateLibraries.js) — loaded by main, not on import.
import { checkSubstrateIds, loadPipelineSubstrates } from './registerPipelineSubstrates.js';

import { growMaze, buildRulesJson, getRegionExits } from
    '../../frontend/modules/procgenPipeline/procgenPipelineEngine.js';

argvHelp(import.meta.url);

// --- CLI parser ---

/** ⛓ The flags this driver takes (cliFlags.js parses them). */
const FLAGS = {
    '--seed': W.seed,
    '--grid': W.grid,
    '--region': W.region,
    '--quota': W.quota,
    '--mix': W.mixCounts,
    '--start': W.start,
    '--stop-on-pool-empty': flag('stopOnPoolEmpty', KIND.on),
    '--max-regions': flag('maxRegions', KIND.int),
    '--items': W.items,
    '--obstacles': W.obstacles,
    '--branch': flag('branch', KIND.float),
    '--no-bidirectional': W.noBidirectional,
    '--asymmetric': flag('asymmetric', oneOf('add', 'remove')),
    '-o': W.out,
    '--out': W.out,
    // the value is read by cliRun.js; not echoed into the dump's config
    '--json-status': W.jsonStatus,
    '-h': W.help,
};

function parseArgs(argv) {
    const out = parseFlags(argv, FLAGS, {
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
    }, { metaUrl: import.meta.url });
    if (Object.keys(out.quotas).length > 0 && Object.keys(out.mix).length > 0) {
        throw new Error('--quota and --mix are mutually exclusive');
    }
    return out;
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

async function main(status) {
    const config = parseOrUsage(() => parseArgs(process.argv.slice(2)));
    await loadPipelineSubstrates();
    checkSubstrateIds(config, {
        layout: 'grid', tool: 'dump-grid-growth', counts: { quotas: '--quota', mix: '--mix' }, start: 'start',
    });

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
        // The format stamp (§5au item 4): bump the version when a reader of
        // the old shape would misread the new one.
        kind: 'grid-growth-dump',
        envelope_version: 1,
        config,
        startCell,
        stats,
        regions: shapeRegions(grid),
        rulesJson,
    };

    const outPath = resolve(process.cwd(), config.out);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(dump, null, 2));
    console.error(`Wrote ${outPath}`);
    status.outputs.dump = outPath;
    status.summary = {
        seed: config.seed, regionsBuilt: stats.regionsBuilt,
        stopReason: stats.stopReason ?? null, substrateCounts: stats.substrateCounts ?? null,
    };
    console.error(`  regionsBuilt: ${stats.regionsBuilt}`
        + `  stopReason: ${stats.stopReason}`
        + `  substrateCounts: ${JSON.stringify(stats.substrateCounts)}`);
}

// Only run main when invoked directly (not when imported as a module).
// The substrate libraries we import pull in modules with background
// timers (stateManagerProxy etc.), which keeps Node alive after main
// returns. Force-exit on success so the script doesn't hang.
runCli('dump-grid-growth', import.meta.url, main);
