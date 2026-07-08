/**
 * Generate the jta_locations_test preset — a small, deterministic
 * Phase-2 (zone-randomization) world used by the in-app test
 * `jta-location-check-and-perk-grant`.
 *
 * Unlike jta_substrate_test (the OLD apworld export whose locations are
 * named by task name), this preset is produced by the modern procgen
 * pipeline's Pass A: every JtA zone task becomes an AP location
 * (`region_R_C__<taskId>`), perk display-name items are placed on their
 * vanilla task locations (identity — setJtaPerkShuffleSeed left off for a
 * KNOWN placement the test can assert), filler on the rest, and one
 * 'Victory' goal item in the goal zone. Each region's sidecar carries
 * `ap_locations` + `task_patches` (the grant-suppression seam).
 *
 * The output is written straight from buildRulesJson (no world_generator /
 * Generate.py) — a complete pipeline rules.json the frontend loads
 * directly, like the bounce/runner demo presets. Deterministic per seed.
 *
 * Re-running is idempotent (overwrites the rules.json). Register the
 * preset index entry with scripts/utils/register-preset.py (done once).
 *
 *   node scripts/test/generate-jta-locations-test-preset.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

const SEED = 1;
const QUOTA = 2;              // zones 0 and 1 — small but enough for a goal + a walk
const GOAL_ZONE = QUOTA - 1;  // arrangeShuffledSpiral maps the Nth jta region to zone N
const GAME_NAME = 'JtA Locations Test';
const OUT_DIR = path.join(repoRoot,
    'frontend/presets/jta_locations_test/AP_14089154938208861744');
const OUT_FILE = path.join(OUT_DIR, 'AP_14089154938208861744_rules.json');

async function main() {
    const jtaLib = await import(pathToFileURL(path.join(repoRoot,
        'frontend/modules/jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js')));
    const engine = await import(pathToFileURL(path.join(repoRoot,
        'frontend/modules/procgenPipeline/procgenPipelineEngine.js')));
    const { substrateRegistry } = await import(pathToFileURL(path.join(repoRoot,
        'frontend/modules/shared/procgen/substrateRegistry.js')));
    const { mergeSubstrateItemLib } = await import(pathToFileURL(path.join(repoRoot,
        'frontend/modules/procgenPipeline/sphereConfigHooks.js')));
    const { DEFAULT_ITEMS } = await import(pathToFileURL(path.join(repoRoot,
        'frontend/modules/shared/procgen/library.js')));

    // Emit zone-locations, goal in the deepest zone, IDENTITY perk
    // placement (no shuffle) so the test knows exactly which location
    // holds which perk.
    jtaLib.setJtaEmitZoneLocations(true);
    jtaLib.setJtaGoalZone(GOAL_ZONE);
    jtaLib.setJtaPerkShuffleSeed(null);

    const { grid, startCell } = engine.arrangeShuffledSpiral({
        regionSize: { width: 8, height: 6 }, itemPool: {}, obstaclePool: {}, seed: SEED,
        growthParams: { substrateQuotas: { jta: QUOTA }, assumeBidirectional: true, startSubstrate: 'jta' },
    });

    const victoryName = substrateRegistry.get('jta').victoryItem;
    const itemLib = mergeSubstrateItemLib(DEFAULT_ITEMS, ['jta']);
    const rules = engine.buildRulesJson(grid, {
        startCell, seed: SEED, itemLib,
        gameName: GAME_NAME,
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

    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(OUT_FILE, JSON.stringify(rules, null, 2) + '\n');

    // Report the identity placement the test relies on.
    const allRegions = Object.values(rules.regions).flatMap((byName) => Object.values(byName));
    const locCount = allRegions.reduce((a, r) => a + (r.locations?.length ?? 0), 0);
    const startRegion = rules.start_regions?.[0] ?? '(none)';
    console.log(`wrote ${path.relative(repoRoot, OUT_FILE)}`);
    console.log(`  ${QUOTA} jta zones, ${locCount} task locations, start region ${startRegion}`);
    console.log(`  goal zone ${GOAL_ZONE} hosts '${victoryName}'`);
    console.log('Register with:\n'
        + `  python3 scripts/utils/register-preset.py `
        + `${path.relative(repoRoot, OUT_FILE)} --game-id jta_locations_test `
        + `--game-name '${GAME_NAME}'`);
}

main().catch((err) => { console.error(err); process.exit(1); });
