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
 *   omsi_schedule_test    the SAME world plus a deterministic
 *                         hand-authored P2 award schedule on the omsi
 *                         region's payload: Buy Mana Z1's mana grants —
 *                         grant 1 = FOREIGN jta/Food x2, grant 2 = local
 *                         re-route herbs x3, later grants vanilla. Loaded
 *                         by the omsi-award-schedule in-app test; kept
 *                         separate so omsi_substrate_test stays
 *                         schedule-free (its six tests exercise the
 *                         vanilla managed engine).
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
const SCHEDULE_GAME_ID = 'omsi_schedule_test';
const SCHEDULE_GAME_NAME = 'Omsi Schedule Test';

// The hand-authored P2 award schedule (fork carrier vocabulary,
// actionListXml.js setAwardSchedule): Buy Mana Z1 is a normal-type
// town-0 action with a single deterministic mana grant per completion —
// grant indices restart every loop. 'Food' is a jta vanilla-roster
// name (jta's sharing.items.getTypes serves dataset item names).
const AWARD_SCHEDULE = {
    version: 1,
    awards: {
        BuyManaZ1: {
            mana: [
                { substrate: 'jta', type: 'Food', count: 2 },
                { name: 'herbs', count: 3 },
            ],
        },
    },
    // Lootable contents (§9b-pre): good 0 of Smash Pots re-routes to gold.
    // Non-vanilla contents are what make the fork render the lootDetails
    // row + the "items" tooltip wording (slice 4); Pick Locks carries no
    // schedule, so its row must NOT appear (the ui-parity discipline).
    lootables: {
        Pots: { contents: [{ name: 'gold', count: 5 }] },
    },
};

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

    await buildAndWrite({ engine, substrateRegistry, mergeSubstrateItemLib, DEFAULT_ITEMS,
        gameId: GAME_ID, gameName: GAME_NAME, awardSchedule: null });
    await buildAndWrite({ engine, substrateRegistry, mergeSubstrateItemLib, DEFAULT_ITEMS,
        gameId: SCHEDULE_GAME_ID, gameName: SCHEDULE_GAME_NAME, awardSchedule: AWARD_SCHEDULE });
}

async function buildAndWrite({ engine, substrateRegistry, mergeSubstrateItemLib, DEFAULT_ITEMS,
    gameId, gameName, awardSchedule }) {
    const outDir = path.join(repoRoot, 'frontend/presets', gameId, SEED_ID);
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
        gameName,
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

    // The schedule preset: the award schedule is per-world data riding the
    // omsi region's payload (the bridge installs it on omsi:loadRegion via
    // IdleLoopsManaged.setAwardSchedule).
    if (awardSchedule) {
        for (const sidecar of Object.values(rules.preset_sidecars?.[Object.keys(rules.regions)[0]] ?? {})) {
            if (sidecar?.substrate === 'omsi' && sidecar.playable_payload) {
                sidecar.playable_payload.awardSchedule = awardSchedule;
            }
        }
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
    if (awardSchedule && JSON.stringify(payload.awardSchedule) !== JSON.stringify(awardSchedule)) {
        throw new Error(`omsi region ${omsiRegionId} payload.awardSchedule missing/mangled`);
    }
    const startRegion = rules.start_regions?.[playerId]?.default?.[0]
        ?? rules.start_regions?.[0] ?? '(none)';

    console.log(`wrote ${path.relative(repoRoot, outFile)}`);
    console.log(`  omsi region: ${omsiRegionId} (town 0, manaEnabled${awardSchedule ? ', awardSchedule' : ''})`);
    console.log(`  victory location: ${expectedLocation} -> '${victoryName}'`);
    console.log(`  start region: ${JSON.stringify(startRegion)}`);
    console.log('Register with:\n'
        + `  python3 scripts/utils/register-preset.py `
        + `${path.relative(repoRoot, outFile)} --game-id ${gameId} --game-name '${gameName}'`);
}

main().catch((err) => { console.error(err); process.exit(1); });
