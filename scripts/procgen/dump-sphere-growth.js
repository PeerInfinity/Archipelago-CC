#!/usr/bin/env node
/**
 * Headless sphere-driven growth driver — plan the spheres, run
 * growSpheres + buildRulesJson in Node, verify the sphere oracle, and
 * write everything to disk. Procgen-engine debugging without the
 * browser. See docs/json/developer/procgen/sphere-growth.md.
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
 *   --no-arrow-entry         skip bounce's prepareSphereGrowth prep (the free
 *                            arrow → starting item); regionParams still carry
 *                            the braid layout (minus the free arrow)
 *   --fall-behavior MODE     override bounce bounceFallBehavior (default: the
 *                            substrate default, 'current')
 *   --physics-profile ID     override bounce bouncePhysicsProfile (default: the
 *                            substrate default, 'dj'; non-'experimental' stamps
 *                            params.physics into payloads)
 *   --param key=value        override any substrate procgen param (e.g.
 *                            --param bounceBraidWidth=318 --param bounceJitter=0);
 *                            numeric values are coerced. Repeat per param.
 *   --enable-loop-mode       embed loop_costs in rules.json (mirrors the
 *                            procgen panel's "Enable loop mode" toggle —
 *                            the runtime loops module auto-enters loop
 *                            mode when loop_costs is present). Off by
 *                            default; needs the sphere_log, which is
 *                            embedded by default.
 *   --region-xp-effect MODE  per-region xpEffect stamped on loop_costs
 *                            entries: 'cost' (default) | 'speed' | 'both'
 *                            | 'none'. Only meaningful with
 *                            --enable-loop-mode.
 *   --consumable-tiles N     per-maze-region cross-game consumable tiles (X1).
 *                            Default 0 = OFF: the content pass draws no rng and
 *                            emits no sidecar key, so every existing preset
 *                            regenerates byte-identically. The foreign pool is
 *                            built from the OTHER quota'd substrates' registry
 *                            sharing.items declarations; an empty pool places
 *                            nothing.
 *   --consumable-count N     grant count stamped per consumable tile (default 1)
 *   --mana-tiles N           per-maze-region mana-refill tiles (default 0 = OFF)
 *   --mana-tile-amount N     mana granted per refill tile (default 0; a refill
 *                            tile is only placed when this is > 0)
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
import '../../frontend/modules/textAdventureSubstrateWrapper/textAdventureSubstrateWrapperLibrary.js';
import '../../frontend/modules/bounceDemo/bounceDemoLibrary.js';
import '../../frontend/modules/runnerDemo/runnerDemoLibrary.js';

import { growSpheres, buildRulesJson, getRegionExits, compactSphereTree } from
    '../../frontend/modules/procgenPipeline/procgenPipelineEngine.js';
import { planSpheres, computeItemSpheres, compareSpheresToPlan } from
    '../../frontend/modules/procgenPipeline/spherePlanner.js';
import { DEFAULT_ITEMS } from
    '../../frontend/modules/shared/procgen/library.js';
import { substrateRegistry } from
    '../../frontend/modules/shared/procgen/substrateRegistry.js';
import {
    defaultProcgenParams, activeSubstrateIds,
    collectSphereGrowthPrep, assembleRegionParams,
    mergeSubstrateItemLib, resolveVictoryItem,
} from '../../frontend/modules/procgenPipeline/sphereConfigHooks.js';

/**
 * Build the X1 consumable-tile config, or null when byte-inert.
 *
 * Returning null (rather than an all-zero object) is the load-bearing
 * half: the content-module pass is gated on the result being active, so
 * at defaults it never runs, never draws rng, and never emits a sidecar
 * key — the D3/S3 byte-inert requirement.
 *
 * The foreign pool is the union of the OTHER quota'd substrates'
 * registry `sharing.items` declarations (D2), mirroring how
 * spiral-step's buildOmsiSubstrateConfig assembles its pool. Maze is
 * excluded — a maze tile granting a maze item would just be an item.
 */
function buildConsumableTileConfig(config) {
    const consumableCount = Math.max(0, config.consumableTiles | 0);
    const manaCount = Math.max(0, config.manaTiles | 0);
    const manaAmount = Number(config.manaTileAmount) || 0;
    if (consumableCount === 0 && !(manaCount > 0 && manaAmount > 0)) return null;

    const pool = [];
    for (const [id, n] of Object.entries(config.quotas)) {
        if (!(n > 0) || id === 'maze') continue;
        const decl = substrateRegistry.get(id)?.sharing?.items;
        const types = decl?.types ?? decl?.getTypes?.() ?? null;
        if (Array.isArray(types)) {
            for (const t of types) pool.push({ substrate: id, type: t });
        }
    }
    return {
        consumableCount,
        manaCount,
        manaAmount,
        countPerTile: Math.max(1, config.consumableCount | 0),
        pool,
    };
}

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
        // null = "not provided" → the substrate's defaultProcgenParams value
        // wins (bounce: physics 'dj', fall 'current'). A flag value overrides.
        fallBehavior: null,
        physicsProfile: null,
        params: {},
        enableLoopMode: false,
        regionXpEffect: 'cost',
        // X1 consumable tiles — byte-inert defaults (all zero ⇒ the
        // content-module pass returns before touching the rng).
        consumableTiles: 0,
        consumableCount: 1,
        manaTiles: 0,
        manaTileAmount: 0,
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
    const parseStrKv = (s) => {
        const i = s.indexOf('=');
        if (i < 0) throw new Error(`expected key=value, got '${s}'`);
        return [s.slice(0, i), s.slice(i + 1)];
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
            case '--physics-profile': out.physicsProfile = next(); break;
            case '--param': {
                // Generic substrate-param override (e.g.
                // --param bounceBraidWidth=318 --param bounceJitter=0). Numeric
                // values are coerced; everything else stays a string.
                const [k, v] = parseStrKv(next());
                out.params[k] = /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
                break;
            }
            case '--enable-loop-mode': out.enableLoopMode = true; break;
            case '--region-xp-effect': out.regionXpEffect = next(); break;
            case '--consumable-tiles': out.consumableTiles = parseInt(next(), 10); break;
            case '--consumable-count': out.consumableCount = parseInt(next(), 10); break;
            case '--mana-tiles': out.manaTiles = parseInt(next(), 10); break;
            case '--mana-tile-amount': out.manaTileAmount = parseFloat(next()); break;
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
            exits,
        });
    }
    out.sort((a, b) => a.id.localeCompare(b.id));
    return out;
}

// --- main ---

async function main() {
    const config = parseArgs(process.argv.slice(2));

    // Merged item library + victory resolution via the shared substrate-hook
    // assembly (same path the panel + sphere-step CLI use).
    const selectedSubs = new Set(Object.keys(config.quotas));
    if (config.start) selectedSubs.add(config.start);
    const itemLib = mergeSubstrateItemLib(DEFAULT_ITEMS, selectedSubs);
    const victory = resolveVictoryItem({
        explicit: config.victory, itemPool: config.items, itemLib, selectedIds: selectedSubs,
    });

    // Substrate params: merged defaultProcgenParams overlaid with explicit CLI
    // flags. The bounce hooks read the bounce*-prefixed keys; --param sets the
    // rest. The shared prep runs each active substrate's prepareSphereGrowth
    // (bounce's free arrow → a starting item + pool delta + bounceFreeArrow
    // regionParam); buildRegionParams produces the full braid layout. This
    // replaces the old inline arrow block + minimal {fallBehavior,
    // physicsProfile} regionParams. --no-arrow-entry skips ONLY the prep
    // (regionParams still carry the braid layout, minus the free arrow).
    const params = defaultProcgenParams({});
    if (config.physicsProfile != null) params.bouncePhysicsProfile = config.physicsProfile;
    if (config.fallBehavior != null) params.bounceFallBehavior = config.fallBehavior;
    Object.assign(params, config.params);
    const activeIds = activeSubstrateIds(config.quotas, config.start);
    const itemPool = { ...config.items };
    const prep = config.arrowEntry
        ? collectSphereGrowthPrep({
            activeIds, itemPool, quotas: config.quotas,
            startSubstrate: config.start, seed: config.seed, params,
        })
        : {
            startingItems: [], lockedCanonicalItems: [],
            exclusiveSpheres: {}, regionParams: {}, note: '',
        };
    const regionParams = assembleRegionParams({
        activeIds, mode: 'sphere', params, extra: prep.regionParams,
    });
    const startingItems = prep.startingItems;
    const lockedCanonicalItems = prep.lockedCanonicalItems;
    const exclusiveSpheres = prep.exclusiveSpheres;
    const arrowNote = prep.note;

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

    const consumableTileOpts = buildConsumableTileConfig(config);

    const { grid, stats, startCell, tree } = growSpheres({
        regionSize: config.region,
        itemLib,
        seed: config.seed,
        regionParams,
        // null at defaults ⇒ the content pass never runs (byte-inert).
        ...(consumableTileOpts ? { consumableTileOpts } : {}),
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
        // Loop mode: stamp loop_costs (derived from the embedded sphere
        // log) so the runtime loops module auto-enters loop mode on
        // load. enableLoopMode defaults false → byte-identical to the
        // pre-flag output for non-loop runs.
        enableLoopMode: config.enableLoopMode,
        regionXpEffect: config.regionXpEffect,
        procgenMetadata: {
            driver: 'sphere-growth',
            stop_reason: stats.stopReason,
            sphere_plan: plan,
            // Compact abstract tree (no grid) for sphere-append from a bare
            // rules.json — kept in parity with the panel/CLI stepCompile path.
            sphere_tree: compactSphereTree(tree),
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
    if (config.enableLoopMode) {
        const lc = rulesJson.loop_costs;
        console.log(`  loop mode: ON — loop_costs ${lc ? 'embedded' : 'MISSING'}`
            + (lc ? ` (${Object.keys(lc.regions ?? {}).length} regions,`
                + ` ${Object.keys(lc.locations ?? {}).length} locations,`
                + ` xpEffect=${config.regionXpEffect})` : ''));
        if (!lc) {
            console.error('  WARNING: --enable-loop-mode set but no loop_costs emitted'
                + ' (sphere_log missing?)');
        }
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
