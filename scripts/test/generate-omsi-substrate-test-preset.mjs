/**
 * Generate the small, deterministic preset the in-app omsi substrate
 * tests and scripts/procgen/verify-omsi-mana-leg.mjs load:
 *
 *   omsi_substrate_test   2 maze regions + 1 omsi region (Beginnersville),
 *                         start in the maze, loop_costs embedded (loop
 *                         mode auto-enables). The omsi region rides the
 *                         zone content-source channel — its sidecar
 *                         carries { omsiTown: 0, manaEnabled: true } and
 *                         the Start Journey victory location
 *                         (`<region>__start_journey` holding 'Victory').
 *
 * Produced by the modern procgen pipeline's Pass A (arrangeShuffledSpiral
 * + buildRulesJson, no world_generator / Generate.py) — a complete
 * pipeline rules.json the frontend loads directly, deterministic per
 * seed. Mirrors scripts/test/generate-jta-locations-test-preset.mjs.
 *
 * Re-running is idempotent (overwrites the rules.json). Register the
 * preset index entry once with scripts/utils/register-preset.py (the
 * script prints the command).
 *
 *   node scripts/test/generate-omsi-substrate-test-preset.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

const SEED = 1;
const SEED_ID = 'AP_14089154938208861744';
const GAME_ID = 'omsi_substrate_test';
const GAME_NAME = 'Omsi Substrate Test';

async function main() {
    const engine = await import(pathToFileURL(path.join(repoRoot,
        'frontend/modules/procgenPipeline/procgenPipelineEngine.js')));
    const { substrateRegistry } = await import(pathToFileURL(path.join(repoRoot,
        'frontend/modules/shared/procgen/substrateRegistry.js')));
    const { mergeSubstrateItemLib } = await import(pathToFileURL(path.join(repoRoot,
        'frontend/modules/procgenPipeline/sphereConfigHooks.js')));
    const { DEFAULT_ITEMS } = await import(pathToFileURL(path.join(repoRoot,
        'frontend/modules/shared/procgen/library.js')));
    // Substrate libraries register on import.
    await import(pathToFileURL(path.join(repoRoot,
        'frontend/modules/mazeRoom/mazeRoomLibrary.js')));
    await import(pathToFileURL(path.join(repoRoot,
        'frontend/modules/omsiSubstrateWrapper/omsiSubstrateWrapperLibrary.js')));

    const outDir = path.join(repoRoot, 'frontend/presets', GAME_ID, SEED_ID);
    const outFile = path.join(outDir, `${SEED_ID}_rules.json`);

    const { grid, startCell } = engine.arrangeShuffledSpiral({
        regionSize: { width: 8, height: 6 },
        itemPool: {},
        obstaclePool: {},
        seed: SEED,
        growthParams: {
            substrateQuotas: { maze: 2, omsi: 1 },
            assumeBidirectional: true,
            startSubstrate: 'maze',
        },
    });

    const victoryName = substrateRegistry.get('omsi').victoryItem;
    const itemLib = mergeSubstrateItemLib(DEFAULT_ITEMS, ['omsi']);
    const rules = engine.buildRulesJson(grid, {
        startCell,
        seed: SEED,
        itemLib,
        gameName: GAME_NAME,
        completionConditionItem: victoryName,
    });

    // The loops module auto-enters loop mode when cost data is present.
    // The omsi bridge (like jta's) ignores loop_costs — it drains the
    // shared pool via its own per-tick budget — but the maze regions'
    // per-tile charging DOES consult the region cost. Defaults match the
    // other substrate-test presets.
    rules.loop_costs = {
        regions: {}, locations: {}, defaultRegionCost: 50, defaultLocationCost: 10,
    };

    // buildRulesJson only stamps manaEnabled via enableLoopMode, which
    // needs the sphere-growth path (embedSphereLog). Spiral presets set
    // it by hand — same as generate-jta-substrate-test-preset.py: every
    // substrate region opts into the shared-pool mirroring.
    for (const sidecar of Object.values(rules.preset_sidecars?.[Object.keys(rules.regions)[0]] ?? {})) {
        if (sidecar?.playable_payload) sidecar.playable_payload.manaEnabled = true;
    }

    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(rules, null, 2) + '\n');

    // Sanity: exactly one omsi region, sidecar carries omsiTown 0 +
    // manaEnabled + the victory location, and the Victory item is placed
    // on it.
    const playerId = Object.keys(rules.regions)[0];
    const sidecars = rules.preset_sidecars?.[playerId] ?? {};
    const omsiRegions = Object.entries(sidecars)
        .filter(([, sc]) => sc.substrate === 'omsi');
    if (omsiRegions.length !== 1) {
        throw new Error(`expected exactly 1 omsi region, got ${omsiRegions.length}`);
    }
    const [omsiRegionId, omsiSidecar] = omsiRegions[0];
    const payload = omsiSidecar.playable_payload ?? {};
    if (payload.omsiTown !== 0) {
        throw new Error(`omsi region ${omsiRegionId} payload.omsiTown !== 0: ${payload.omsiTown}`);
    }
    if (payload.manaEnabled !== true) {
        throw new Error(`omsi region ${omsiRegionId} is not manaEnabled`);
    }
    const expectedLocation = payload.ap_locations?.start_journey;
    if (expectedLocation !== `${omsiRegionId}__start_journey`) {
        throw new Error(`omsi region ${omsiRegionId} ap_locations broken: ${JSON.stringify(payload.ap_locations)}`);
    }
    const regionDef = rules.regions[playerId][omsiRegionId];
    const victoryLoc = (regionDef?.locations ?? []).find((l) => l.name === expectedLocation);
    const placedItem = typeof victoryLoc?.item === 'string' ? victoryLoc.item : victoryLoc?.item?.name;
    if (placedItem !== victoryName) {
        throw new Error(`victory location ${expectedLocation} holds '${placedItem}', expected '${victoryName}'`);
    }
    const startRegion = rules.start_regions?.[playerId]?.default?.[0]
        ?? rules.start_regions?.[0] ?? '(none)';

    console.log(`wrote ${path.relative(repoRoot, outFile)}`);
    console.log(`  omsi region: ${omsiRegionId} (town 0, manaEnabled)`);
    console.log(`  victory location: ${expectedLocation} -> '${victoryName}'`);
    console.log(`  start region: ${JSON.stringify(startRegion)}`);
    console.log('Register with:\n'
        + `  python3 scripts/utils/register-preset.py `
        + `${path.relative(repoRoot, outFile)} --game-id ${GAME_ID} --game-name '${GAME_NAME}'`);
}

main().catch((err) => { console.error(err); process.exit(1); });
