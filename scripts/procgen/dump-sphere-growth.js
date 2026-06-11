#!/usr/bin/env node
/**
 * Headless sphere-driven growth driver — plan the spheres, run
 * growSpheres + buildRulesJson in Node, verify the sphere oracle, and
 * write everything to disk. Procgen-engine debugging without the
 * browser. See NewDocs/plans/procedural-generation/sphere-driven-growth.md.
 *
 * Usage:
 *   node scripts/procgen/dump-sphere-growth.js \
 *       --seed 1 \
 *       --region 8x6 \
 *       --items key_red=1 --items key_blue=1 --items victory=1 \
 *       --spheres 3 \
 *       --victory victory \
 *       --fillers 2 --revisit 0.25 \
 *       -o /tmp/sphere-dump.json
 *
 * Flags:
 *   --seed N                 RNG seed (default 1)
 *   --region WxH             region dims (default 8x6)
 *   --grid WxH               grid dims (default: auto-sized)
 *   --items id=N             item pool entry; repeat per item
 *   --spheres N              sphere count (default 3)
 *   --items-per-sphere N     alternative to --spheres
 *   --pin id=S               pin all of an item's instances to sphere S
 *   --victory id             pin item to the final sphere + use as the
 *                            completion-condition item (default: an
 *                            is_victory item from the pool, if any)
 *   --quota id=N             per-substrate region quota; repeat
 *   --start id               start substrate
 *   --max-items-per-region N (default 2)
 *   --fillers N              filler regions, no items (default 0)
 *   --revisit P              revisit ratio for attachments (default 0.25)
 *   --no-bidirectional       disable back-exits
 *   --no-arrow-entry         skip the panel's bounce arrow-entry
 *                            orchestration (exclusive sphere 1 /
 *                            starting item)
 *   --fall-behavior MODE     bounce fallBehavior regionParam (default 'current')
 *   --rules-out PATH         additionally write the bare rules.json here
 *   -o, --out PATH           output JSON path (default ./sphere-growth-dump.json)
 *
 * Output JSON shape:
 *   {
 *     config, plan, startCell, stats,
 *     oracle: { computed, errors },   // errors MUST be [] — fails loudly otherwise
 *     tree: [{ index, wave, gate, parent, side, substrate, items, isFiller }],
 *     regions: [...],                 // same shape as dump-grid-growth
 *     rulesJson,
 *   }
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Substrate libraries register their adapters on import.
import '../../frontend/modules/mazeRoom/mazeRoomLibrary.js';
import '../../frontend/modules/textAdventureSubstrate/textAdventureSubstrateLibrary.js';
import '../../frontend/modules/bounceDemo/bounceDemoLibrary.js';

import { growSpheres, buildRulesJson } from
    '../../frontend/modules/procgenPipeline/procgenPipelineEngine.js';
import { planSpheres, computeItemSpheres, compareSpheresToPlan } from
    '../../frontend/modules/procgenPipeline/spherePlanner.js';
import { DEFAULT_ITEMS } from
    '../../frontend/modules/shared/procgen/library.js';
import { substrateRegistry } from
    '../../frontend/modules/shared/procgen/substrateRegistry.js';
import { createRng } from '../../frontend/modules/shared/rng.js';

// --- CLI parser ---

function parseArgs(argv) {
    const out = {
        seed: 1,
        region: { width: 8, height: 6 },
        grid: null,
        items: {},
        spheres: 3,
        itemsPerSphere: null,
        pins: {},
        victory: null,
        quotas: {},
        start: null,
        maxItemsPerRegion: 2,
        fillers: 0,
        revisit: 0.25,
        bidirectional: true,
        arrowEntry: true,
        fallBehavior: 'current',
        rulesOut: null,
        out: './sphere-growth-dump.json',
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
            case '--grid': out.grid = parseWxH(next()); break;
            case '--items': {
                const [id, n] = parseKv(next());
                out.items[id] = n;
                break;
            }
            case '--spheres': out.spheres = parseInt(next(), 10); break;
            case '--items-per-sphere':
                out.itemsPerSphere = parseInt(next(), 10);
                out.spheres = null;
                break;
            case '--pin': {
                const [id, s] = parseKv(next());
                out.pins[id] = s;
                break;
            }
            case '--victory': out.victory = next(); break;
            case '--quota': {
                const [id, n] = parseKv(next());
                out.quotas[id] = n;
                break;
            }
            case '--start': out.start = next(); break;
            case '--max-items-per-region':
                out.maxItemsPerRegion = parseInt(next(), 10);
                break;
            case '--fillers': out.fillers = parseInt(next(), 10); break;
            case '--revisit': out.revisit = parseFloat(next()); break;
            case '--no-bidirectional': out.bidirectional = false; break;
            case '--no-arrow-entry': out.arrowEntry = false; break;
            case '--fall-behavior': out.fallBehavior = next(); break;
            case '--rules-out': out.rulesOut = next(); break;
            case '-o':
            case '--out': out.out = next(); break;
            case '-h':
            case '--help':
                console.log('See the docblock in scripts/procgen/dump-sphere-growth.js');
                process.exit(0);
                break;
            default:
                throw new Error(`unknown flag: ${a}`);
        }
    }
    if (Object.keys(out.items).length === 0) {
        // Sensible default pool for quick runs.
        out.items = { key_red: 1, key_green: 1, key_blue: 1, key_yellow: 1, victory: 1 };
    }
    return out;
}

function shapeRegions(grid) {
    const out = [];
    for (const [, region] of grid.cells) {
        const exits = [];
        const exitMap = region.playable_payload?.exits;
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
            exits,
        });
    }
    out.sort((a, b) => a.id.localeCompare(b.id));
    return out;
}

// --- main ---

async function main() {
    const config = parseArgs(process.argv.slice(2));

    // Merged item library, mirroring the panel's _mergedItemLib():
    // DEFAULT_ITEMS plus any libraryItems declared by selected
    // substrates (quotas + start substrate).
    const selectedSubs = new Set(Object.keys(config.quotas));
    if (config.start) selectedSubs.add(config.start);
    const itemLib = { ...DEFAULT_ITEMS };
    for (const id of selectedSubs) {
        const extra = substrateRegistry.get(id)?.libraryItems;
        if (extra) Object.assign(itemLib, extra);
    }

    // Victory resolution, mirroring _resolveVictoryItemId(): explicit
    // flag, else an is_victory item in the pool (merged lib), else a
    // selected substrate's registry victoryItem.
    let victory = config.victory;
    if (!victory) {
        victory = Object.keys(config.items)
            .find((id) => itemLib[id]?.is_victory) ?? null;
    }
    if (!victory) {
        for (const id of selectedSubs) {
            const vi = substrateRegistry.get(id)?.victoryItem;
            if (vi) { victory = vi; break; }
        }
    }

    // Bounce arrow entry, mirroring the panel's _runSphereGrowth():
    // bounce START → sphere 1 is EXACTLY one seeded-random arrow (the
    // start-stack intro); any other start → the arrow leaves the pool
    // and becomes a starting item.
    const itemPool = { ...config.items };
    const quotaIds = Object.keys(config.quotas);
    const bounceSelected = (config.quotas.bounce ?? 0) > 0 || config.start === 'bounce';
    const bounceStarts = config.start === 'bounce'
        || (config.start == null && bounceSelected
            && quotaIds.length > 0 && quotaIds.every((id) => id === 'bounce'));
    const exclusiveSpheres = {};
    const startingItems = [];
    const lockedCanonicalItems = [];
    let arrowNote = '';
    if (config.arrowEntry && bounceSelected) {
        const arrows = ['Left arrow', 'Right arrow']
            .filter((a) => (itemPool[a] ?? 0) > 0);
        if (arrows.length > 0) {
            const pick = arrows[Math.floor(
                createRng((config.seed * 31 + 17) | 0).next() * arrows.length)];
            if (bounceStarts) {
                exclusiveSpheres[1] = [pick];
                lockedCanonicalItems.push(pick);
                arrowNote = `${pick} = sphere 1 (the start stack)`;
            } else {
                startingItems.push(pick);
                itemPool[pick] -= 1;
                if (itemPool[pick] <= 0) delete itemPool[pick];
                arrowNote = `${pick} granted as a starting item`;
            }
        }
    }

    const plan = planSpheres({
        itemPool,
        ...(config.spheres != null
            ? { sphereCount: config.spheres }
            : { itemsPerSphere: config.itemsPerSphere }),
        pins: config.pins,
        exclusiveSpheres,
        ...(victory && (itemPool[victory] ?? 0) > 0
            ? { victoryItem: victory } : {}),
        seed: config.seed,
    });

    const { grid, stats, startCell, tree } = growSpheres({
        regionSize: config.region,
        itemLib,
        seed: config.seed,
        regionParams: { fallBehavior: config.fallBehavior },
        growthParams: {
            spherePlan: plan,
            maxItemsPerRegion: config.maxItemsPerRegion,
            fillerCount: config.fillers,
            revisitRatio: config.revisit,
            assumeBidirectional: config.bidirectional,
            ...(config.grid ? { gridDims: config.grid } : {}),
            ...(Object.keys(config.quotas).length > 0
                ? { substrateQuotas: config.quotas } : {}),
            ...(config.start ? { startSubstrate: config.start } : {}),
        },
    });

    const rulesJson = buildRulesJson(grid, {
        startCell,
        seed: config.seed,
        itemLib,
        startingItems,
        lockedCanonicalItems,
        ...(startingItems.length > 0 ? {
            sourceItems: Object.fromEntries(startingItems.map((name, i) => [name, {
                name,
                id: 999 - i,
                classification: 'progression',
                groups: ['Everything'],
            }])),
        } : {}),
        ...(victory ? { completionConditionItem: victory } : {}),
        procgenMetadata: {
            driver: 'sphere-growth',
            stop_reason: stats.stopReason,
            sphere_plan: plan,
        },
    });

    // The oracle: the emitted world must compute back to the plan.
    const computed = computeItemSpheres(rulesJson);
    const oracleErrors = compareSpheresToPlan(computed, plan);

    const dump = {
        config,
        plan,
        startCell,
        stats,
        oracle: { computed, errors: oracleErrors },
        tree: tree.nodes.map((n) => ({
            index: n.index,
            wave: n.wave,
            gate: n.gate,
            gateCounts: n.gateCounts,
            parent: n.parent,
            side: n.side,
            substrate: n.substrate,
            region_id: n.region_id ?? null,
            items: n.items,
            isFiller: n.isFiller,
        })),
        regions: shapeRegions(grid),
        rulesJson,
    };

    const outPath = resolve(process.cwd(), config.out);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(dump, null, 2));
    console.log(`Wrote ${outPath}`);
    if (config.rulesOut) {
        const rulesPath = resolve(process.cwd(), config.rulesOut);
        mkdirSync(dirname(rulesPath), { recursive: true });
        writeFileSync(rulesPath, JSON.stringify(rulesJson, null, 2));
        console.log(`Wrote ${rulesPath}`);
    }
    console.log(`  regionsBuilt: ${stats.regionsBuilt}`
        + `  teleporters: ${stats.teleportersPlaced}`
        + `  substrateCounts: ${JSON.stringify(stats.substrateCounts)}`);
    console.log(`  plan: ${plan.spheres.map((s) => `S${s.sphere}=[${s.items.join(',')}]`).join(' ')}`);
    if (arrowNote) console.log(`  arrow entry: ${arrowNote}`);
    if (startingItems.length > 0) {
        console.log(`  starting items: ${startingItems.join(', ')}`);
    }
    if (oracleErrors.length > 0) {
        console.error('SPHERE ORACLE FAILED:');
        for (const e of oracleErrors) console.error(`  ${e}`);
        process.exit(1);
    }
    console.log('  sphere oracle: OK (computed spheres == plan)');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().then(() => process.exit(0)).catch((e) => {
        console.error(`ERROR: ${e.message}`);
        process.exit(1);
    });
}
