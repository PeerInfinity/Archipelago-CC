#!/usr/bin/env node
/**
 * Headless shuffled-spiral driver — runs arrangeShuffledSpiral +
 * buildRulesJson in Node and writes the result to disk. Sibling of
 * dump-grid-growth.js for the new layout algorithm.
 *
 * Usage:
 *   node scripts/procgen/dump-shuffled-spiral.js \
 *       --seed 1 \
 *       --quota jta=5 \
 *       --start jta \
 *       -o /tmp/spiral.json
 * Flags:
 *   --seed N                 RNG seed (default 1)
 *   --region WxH             region dims (default 8x6)
 *   --quota id=N             per-substrate region quota; repeat per
 *                            substrate (at least one required)
 *   --start id               start substrate ('auto' or substrate id)
 *   --no-bidirectional       disable assumeBidirectional (default on)
 *   --items id=N             item pool entry (procedural substrates
 *                            only); repeat per item
 *   --obstacles id=N         obstacle pool entry; repeat per obstacle
 *   --jta-locations          emit jta zone tasks as AP locations (off by
 *                            default — byte-identical to prior jta dumps)
 *   -o, --out PATH           output JSON path
 *                            (default ./shuffled-spiral-dump.json)
 *   --config PATH            read flags from a JSON object (the keys a dump
 *                            echoes as `config`; flags given here win; exit 3
 *                            if it fails the schema); see cliFlags.js
 *   --config-schema          print that JSON Schema and exit
 *   --json-status PATH       write the run's status object (`-` = stdout); see cliRun.js
 *   -h, --help               print this and exit
 *
 * The grid is auto-sized to fit sum(quotas) regions; --grid is not
 * accepted. Cross-branch asymmetric exits do not arise (every cell
 * has the same 4-way always-accessible exits) so no asymmetric-exit
 * flag is exposed.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { argvHelp } from './argvHelp.js';
import { KIND, W, flag, parseFlags } from './cliFlags.js';
import { runCli, parseOrUsage } from './cliRun.js';

// Substrate libraries (procgenCore/substrateLibraries.js) — loaded by main, not on import.
import { checkSubstrateIds, loadPipelineSubstrates } from './registerPipelineSubstrates.js';

import { arrangeShuffledSpiral, buildRulesJson, getRegionExits } from
    '../../frontend/modules/procgenPipeline/procgenPipelineEngine.js';
import { setJtaEmitZoneLocations } from
    '../../frontend/modules/jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js';

argvHelp(import.meta.url);

/** ⛓ The flags this driver takes (cliFlags.js parses them). */
const FLAGS = {
    '--seed': W.seed,
    '--region': W.region,
    '--quota': W.quota,
    '--start': W.start,
    '--no-bidirectional': W.noBidirectional,
    '--jta-locations': flag('jtaLocations', KIND.on),
    '--items': W.items,
    '--obstacles': W.obstacles,
    '-o': W.out,
    '--out': W.out,
    // the value is read by cliRun.js; not echoed into the dump's config
    '--config': W.config,
    '--config-schema': W.configSchema,
    '--json-status': W.jsonStatus,
    '-h': W.help,
};

function parseArgs(argv) {
    const out = parseFlags(argv, FLAGS, {
        seed: 1,
        region: { width: 8, height: 6 },
        quotas: {},
        start: 'auto',
        bidirectional: true,
        items: {},
        obstacles: {},
        jtaLocations: false,
        out: './shuffled-spiral-dump.json',
    }, { metaUrl: import.meta.url });
    if (Object.keys(out.quotas).length === 0) {
        throw new Error('at least one --quota is required');
    }
    return out;
}


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
                });
            }
        }
        out.push({
            id: region.region_id,
            substrate: region.substrate,
            cell: region.cell ?? null,
            // Surface jtaZone (and any other zone-specific fields) so
            // dumps are useful for verifying zone ordering.
            ...(typeof region.playable_payload?.jtaZone === 'number'
                ? { jtaZone: region.playable_payload.jtaZone } : {}),
            exits,
        });
    }
    out.sort((a, b) => a.id.localeCompare(b.id));
    return out;
}

async function main(status) {
    const config = parseOrUsage(() => parseArgs(process.argv.slice(2)));
    status.config = config;
    await loadPipelineSubstrates();
    checkSubstrateIds(config, {
        layout: 'spiral', tool: 'dump-shuffled-spiral', counts: { quotas: '--quota' }, start: 'start',
    });
    // Opt-in jta zone-locations channel (Phase 1 skeleton). Off by
    // default so jta dumps stay byte-identical to prior runs.
    setJtaEmitZoneLocations(config.jtaLocations);
    const {
        grid, stats, startCell, goalItem,
    } = arrangeShuffledSpiral({
        regionSize: config.region,
        itemPool: { ...config.items },
        obstaclePool: { ...config.obstacles },
        seed: config.seed,
        growthParams: {
            substrateQuotas: config.quotas,
            assumeBidirectional: config.bidirectional,
            ...(config.start && config.start !== 'auto'
                ? { startSubstrate: config.start } : {}),
        },
    });
    // Completion-condition item: the goal the spiral's item layer placed
    // (`Victory`), or null for a world without one.
    const rulesJson = buildRulesJson(grid, {
        startCell,
        seed: config.seed,
        completionConditionItem: goalItem,
    });
    const dump = {
        // The format stamp (§5au item 4): bump the version when a reader of
        // the old shape would misread the new one.
        kind: 'shuffled-spiral-dump',
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

runCli('dump-shuffled-spiral', import.meta.url, main);
