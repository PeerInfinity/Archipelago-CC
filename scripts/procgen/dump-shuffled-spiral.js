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
 *
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
 *   -o, --out PATH           output JSON path
 *                            (default ./shuffled-spiral-dump.json)
 *
 * The grid is auto-sized to fit sum(quotas) regions; --grid is not
 * accepted. Cross-branch asymmetric exits do not arise (every cell
 * has the same 4-way always-accessible exits) so no asymmetric-exit
 * flag is exposed.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Substrate libraries register on import.
import '../../frontend/modules/mazeRoom/mazeRoomLibrary.js';
import '../../frontend/modules/textAdventureSubstrate/textAdventureSubstrateLibrary.js';
import '../../frontend/modules/jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js';
import '../../frontend/modules/bounceDemo/bounceDemoLibrary.js';

import { arrangeShuffledSpiral, buildRulesJson, getRegionExits } from
    '../../frontend/modules/procgenPipeline/procgenPipelineEngine.js';
import { substrateRegistry } from
    '../../frontend/modules/shared/procgen/substrateRegistry.js';

function parseArgs(argv) {
    const out = {
        seed: 1,
        region: { width: 8, height: 6 },
        quotas: {},
        start: 'auto',
        bidirectional: true,
        items: {},
        obstacles: {},
        out: './shuffled-spiral-dump.json',
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
            case '--region': out.region = parseWxH(next()); break;
            case '--quota': {
                const [id, n] = parseKv(next());
                out.quotas[id] = n;
                break;
            }
            case '--start': out.start = next(); break;
            case '--no-bidirectional': out.bidirectional = false; break;
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
    if (Object.keys(out.quotas).length === 0) {
        throw new Error('at least one --quota is required');
    }
    return out;
}

function extractHelpText() {
    return [
        'Usage: node scripts/procgen/dump-shuffled-spiral.js [flags]',
        '',
        '  --seed N                   (default 1)',
        '  --region WxH               (default 8x6)',
        '  --quota id=N               required; repeat per substrate',
        '  --start id                 substrate id or "auto" (default auto)',
        '  --no-bidirectional',
        '  --items id=N',
        '  --obstacles id=N',
        '  -o, --out PATH             (default ./shuffled-spiral-dump.json)',
    ].join('\n');
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

async function main() {
    const config = parseArgs(process.argv.slice(2));
    const { grid, stats, startCell } = arrangeShuffledSpiral({
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
    // Completion-condition item: first quota'd substrate declaring a
    // victoryItem on its registry entry (e.g. bounce — its zone table
    // places the item itself). Mirrors the pipeline UI's substrate
    // fallback in _resolveVictoryItemId; without it the emitted world
    // has no goal and AP defaults to trivially-true completion.
    const victoryItem = Object.entries(config.quotas)
        .map(([id, n]) => (n > 0 ? substrateRegistry.get(id)?.victoryItem : null))
        .find(Boolean) ?? null;
    const rulesJson = buildRulesJson(grid, {
        startCell,
        seed: config.seed,
        completionConditionItem: victoryItem,
    });
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().then(() => process.exit(0)).catch((e) => {
        console.error(`ERROR: ${e.message}`);
        process.exit(1);
    });
}
