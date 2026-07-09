/**
 * Generate the small, deterministic Phase-2 (zone-randomization) presets the
 * in-app JtA tests load. Two worlds come out of this one script:
 *
 *   jta_locations_test    2 zones, IDENTITY perk placement (no shuffle) so
 *                         `jta-location-check-and-perk-grant` can assert a
 *                         KNOWN placement: region_0_0__13 holds 'How to Read'.
 *   jta_randomized_test   4 zones, SHUFFLED perk placement — the Phase-4 smoke
 *                         world for `jta-randomized-balanced-progression`,
 *                         which balances it at rules load and plays zones 1->3.
 *
 * Both are produced by the modern procgen pipeline's Pass A (unlike
 * jta_substrate_test, the OLD apworld export whose locations are named by task
 * name): every JtA zone task becomes an AP location (`region_R_C__<taskId>`),
 * perk display-name items are placed on task locations, filler on the rest, and
 * one 'Victory' goal item in the goal zone. Each region's sidecar carries
 * `ap_locations` + `task_patches` (the grant-suppression seam).
 *
 * The output is written straight from buildRulesJson (no world_generator /
 * Generate.py) — a complete pipeline rules.json the frontend loads
 * directly, like the bounce/runner demo presets. Deterministic per seed.
 *
 * Re-running is idempotent (overwrites the rules.json). Register the
 * preset index entry with scripts/utils/register-preset.py (done once).
 *
 *   node scripts/test/generate-jta-locations-test-preset.mjs            # both
 *   node scripts/test/generate-jta-locations-test-preset.mjs --only jta_randomized_test
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

const SEED = 1;
// Seed 1's AP id. Both presets are Pass-A only (no Generate.py), so they share
// it; they live under different game-id directories.
const SEED_ID = 'AP_14089154938208861744';

const PRESETS = [
    {
        gameId: 'jta_locations_test',
        gameName: 'JtA Locations Test',
        quota: 2,               // zones 0 and 1 — enough for a goal + a walk
        shuffleSeed: null,      // identity placement
    },
    {
        gameId: 'jta_randomized_test',
        gameName: 'JtA Randomized Test',
        // Four zones: the smoke test walks 1 -> 3, so it needs a zone beyond
        // the two it traverses, and the goal must not sit in the start zone.
        quota: 4,
        shuffleSeed: SEED,      // perks move off their native tasks
    },
];

async function generate(preset, mods) {
    const { jtaLib, engine, substrateRegistry, mergeSubstrateItemLib, DEFAULT_ITEMS, zoneTaskData } = mods;
    const { gameId, gameName, quota, shuffleSeed } = preset;
    const goalZone = quota - 1;   // arrangeShuffledSpiral maps the Nth jta region to zone N
    const outDir = path.join(repoRoot, 'frontend/presets', gameId, SEED_ID);
    const outFile = path.join(outDir, `${SEED_ID}_rules.json`);

    jtaLib.setJtaEmitZoneLocations(true);
    jtaLib.setJtaGoalZone(goalZone);
    jtaLib.setJtaPerkShuffleSeed(shuffleSeed);

    const { grid, startCell } = engine.arrangeShuffledSpiral({
        regionSize: { width: 8, height: 6 }, itemPool: {}, obstaclePool: {}, seed: SEED,
        growthParams: { substrateQuotas: { jta: quota }, assumeBidirectional: true, startSubstrate: 'jta' },
    });

    const victoryName = substrateRegistry.get('jta').victoryItem;
    const itemLib = mergeSubstrateItemLib(DEFAULT_ITEMS, ['jta']);
    const rules = engine.buildRulesJson(grid, {
        startCell, seed: SEED, itemLib,
        gameName,
        completionConditionItem: victoryName,
    });

    // The loops module auto-enters loop mode when cost data is present;
    // the jta bridge ignores loop_costs (it drains the shared pool via its
    // own per-tick energy calc), but SOME block must exist to flip runtime
    // into loop mode. Arbitrary defaults, never consulted — mirrors
    // scripts/test/generate-jta-substrate-test-preset.py.
    rules.loop_costs = {
        regions: {}, locations: {}, defaultRegionCost: 50, defaultLocationCost: 10,
    };

    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(rules, null, 2) + '\n');

    const allRegions = Object.values(rules.regions).flatMap((byName) => Object.values(byName));
    const locCount = allRegions.reduce((a, r) => a + (r.locations?.length ?? 0), 0);
    const startRegion = rules.start_regions?.[0] ?? '(none)';
    console.log(`wrote ${path.relative(repoRoot, outFile)}`);
    console.log(`  ${quota} jta zones, ${locCount} task locations, start region ${startRegion}`);
    console.log(`  goal zone ${goalZone} hosts '${victoryName}'`
        + `, perk placement ${shuffleSeed == null ? 'IDENTITY' : `shuffled (seed ${shuffleSeed})`}`);

    // A shuffled preset whose shuffle happened to be the identity would make
    // the smoke test's "randomized" claim vacuous — assert it really moved.
    if (shuffleSeed != null) {
        const perkNames = new Set(jtaLib.JTA_PERK_ITEM_NAMES);
        const nativePerkOf = new Map(
            zoneTaskData.JTA_ZONE_TASK_DATA.flatMap((z) => z.tasks).map((t) => [t.id, t.perk ?? null]));
        const moved = [];
        let perkLocs = 0;
        for (const region of allRegions) {
            for (const loc of region.locations ?? []) {
                // buildRulesJson wraps placements as {name, player, advancement, type}.
                const itemName = typeof loc.item === 'string' ? loc.item : loc.item?.name;
                if (!perkNames.has(itemName)) continue;
                perkLocs++;
                const taskId = Number(String(loc.name).split('__')[1]);
                if (nativePerkOf.get(taskId) !== itemName) moved.push(`${loc.name}<-${itemName}`);
            }
        }
        console.log(`  ${moved.length}/${perkLocs} perk(s) moved off their native task`);
        if (!perkLocs) throw new Error(`${gameId}: no perk items placed — is the item lib merged?`);
        if (!moved.length) throw new Error(`${gameId}: shuffle seed ${shuffleSeed} produced the identity placement`);
    }
    console.log('Register with:\n'
        + `  python3 scripts/utils/register-preset.py `
        + `${path.relative(repoRoot, outFile)} --game-id ${gameId} --game-name '${gameName}'`);
}

async function main() {
    const only = process.argv.includes('--only')
        ? process.argv[process.argv.indexOf('--only') + 1] : null;
    const mods = {
        jtaLib: await import(pathToFileURL(path.join(repoRoot,
            'frontend/modules/jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js'))),
        engine: await import(pathToFileURL(path.join(repoRoot,
            'frontend/modules/procgenPipeline/procgenPipelineEngine.js'))),
        substrateRegistry: (await import(pathToFileURL(path.join(repoRoot,
            'frontend/modules/shared/procgen/substrateRegistry.js')))).substrateRegistry,
        mergeSubstrateItemLib: (await import(pathToFileURL(path.join(repoRoot,
            'frontend/modules/procgenPipeline/sphereConfigHooks.js')))).mergeSubstrateItemLib,
        DEFAULT_ITEMS: (await import(pathToFileURL(path.join(repoRoot,
            'frontend/modules/shared/procgen/library.js')))).DEFAULT_ITEMS,
        zoneTaskData: await import(pathToFileURL(path.join(repoRoot,
            'frontend/modules/jtaSubstrateWrapper/zoneTaskData.js'))),
    };
    for (const preset of PRESETS) {
        if (only && preset.gameId !== only) continue;
        console.log(`\n--- ${preset.gameId}`);
        await generate(preset, mods);
    }
}

main().catch((err) => { console.error(err); process.exit(1); });
