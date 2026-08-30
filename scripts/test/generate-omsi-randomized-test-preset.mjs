/**
 * Generate `omsi_randomized_test` — the fixture for the AP-V1 unlock
 * randomization in-app tests (unlock-discretization plan §7).
 *
 *   omsi_randomized_test   2 maze regions + 1 omsi region (Beginnersville),
 *                          start in the maze, loop_costs embedded, and the
 *                          omsi region carrying the FULL town-0 discovery
 *                          pool: 90 quantity-step locations holding
 *                          "<Var> Supply Step" items, plus `travel_onward`
 *                          holding 'Victory'. Access rules are the
 *                          town-scoped HasFromList ordinal counts
 *                          (0 … 89), so the world has a clean one-per-
 *                          sphere progression chain.
 *
 * Placement is CANONICAL: every location holds its own native item
 * (buildRulesJson derives the pool 1:1 from the location `item` fields).
 * A real AP fill via the Python round-trip is a deferred follow-on —
 * same status as the jta locations preset.
 *
 * Differs from generate-omsi-substrate-test-preset.mjs only in the
 * substrate config: `{ towns: 1, emitUnlockLocations: true }` instead of
 * the defaults. That preset stays the emission-OFF byte-inertness
 * reference and must keep regenerating byte-identical.
 *
 * Re-running is idempotent (overwrites the rules.json). Register the
 * preset index entry once with scripts/utils/register-preset.py (the
 * script prints the command).
 *
 *   node scripts/test/generate-omsi-randomized-test-preset.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

const SEED = 1;
const SEED_ID = 'AP_14089154938208861744';
const GAME_ID = 'omsi_randomized_test';
const GAME_NAME = 'Omsi Randomized Test';

const TOWNS = 1;
// Town 0's discovery pool: Pots 50 + Locks 10 + SQuests 20 + LQuests 10.
const EXPECTED_SUPPLY_LOCATIONS = 90;

async function main() {
    const load = (rel) => import(pathToFileURL(path.join(repoRoot, rel)));

    const engine = await load('frontend/modules/procgenPipeline/procgenPipelineEngine.js');
    const { substrateRegistry } = await load('frontend/modules/shared/procgen/substrateRegistry.js');
    const { mergeSubstrateItemLib } = await load('frontend/modules/procgenPipeline/sphereConfigHooks.js');
    const { DEFAULT_ITEMS } = await load('frontend/modules/shared/procgen/library.js');
    // Substrate libraries register on import.
    await load('frontend/modules/mazeRoom/mazeRoomLibrary.js');
    await load('frontend/modules/omsiSubstrateWrapper/omsiSubstrateWrapperLibrary.js');
    const { ensureUnlockTable } = await load('frontend/modules/omsiSubstrateWrapper/unlockPool.js');

    // The ① config seam is synchronous, so the fork's unlock table has
    // to be resolved BEFORE the pipeline runs (unlockPool.js header).
    await ensureUnlockTable();

    const omsi = substrateRegistry.get('omsi');
    omsi.applyPipelineConfig({ towns: TOWNS, emitUnlockLocations: true });

    const outDir = path.join(repoRoot, 'frontend/presets', GAME_ID, SEED_ID);
    const outFile = path.join(outDir, `${SEED_ID}_rules.json`);

    const { grid, startCell } = engine.arrangeShuffledSpiral({
        regionSize: { width: 8, height: 6 },
        itemPool: {},
        obstaclePool: {},
        seed: SEED,
        growthParams: {
            substrateQuotas: { maze: 2, omsi: TOWNS },
            assumeBidirectional: true,
            startSubstrate: 'maze',
            // Recorded on the preset too, so the stepped-pipeline / panel
            // path reproduces this world from config alone.
            substrateConfig: { omsi: { towns: TOWNS, emitUnlockLocations: true } },
        },
    });

    const victoryName = omsi.victoryItem;
    const itemLib = mergeSubstrateItemLib(DEFAULT_ITEMS, ['omsi']);
    const rules = engine.buildRulesJson(grid, {
        startCell,
        seed: SEED,
        itemLib,
        gameName: GAME_NAME,
        completionConditionItem: victoryName,
    });

    rules.loop_costs = {
        regions: {}, locations: {}, defaultRegionCost: 50, defaultLocationCost: 10,
    };

    const playerId = Object.keys(rules.regions)[0];
    for (const sidecar of Object.values(rules.preset_sidecars?.[playerId] ?? {})) {
        if (sidecar?.playable_payload) sidecar.playable_payload.manaEnabled = true;
    }

    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(rules, null, 2) + '\n');

    // ── Sanity gates ────────────────────────────────────────────────
    const sidecars = rules.preset_sidecars?.[playerId] ?? {};
    const omsiRegions = Object.entries(sidecars).filter(([, sc]) => sc.substrate === 'omsi');
    if (omsiRegions.length !== TOWNS) {
        throw new Error(`expected ${TOWNS} omsi region(s), got ${omsiRegions.length}`);
    }
    const [omsiRegionId, omsiSidecar] = omsiRegions[0];
    const payload = omsiSidecar.playable_payload ?? {};
    if (payload.omsiTown !== 0) {
        throw new Error(`omsi region ${omsiRegionId} payload.omsiTown !== 0: ${payload.omsiTown}`);
    }
    if (payload.victoryTown !== TOWNS) {
        throw new Error(`payload.victoryTown !== ${TOWNS}: ${payload.victoryTown}`);
    }
    if (payload.manaEnabled !== true) {
        throw new Error(`omsi region ${omsiRegionId} is not manaEnabled`);
    }

    const apLocations = payload.ap_locations ?? {};
    const rowKeys = Object.keys(apLocations).filter((k) => k.startsWith('q:'));
    if (rowKeys.length !== EXPECTED_SUPPLY_LOCATIONS) {
        throw new Error(`expected ${EXPECTED_SUPPLY_LOCATIONS} supply rows in ap_locations, got ${rowKeys.length}`);
    }
    const victoryLocName = apLocations.travel_onward;
    if (victoryLocName !== `${omsiRegionId}__travel_onward`) {
        throw new Error(`ap_locations.travel_onward broken: ${victoryLocName}`);
    }
    if (apLocations.start_journey) {
        throw new Error('emission-ON world must not carry the legacy start_journey key');
    }
    // The raw row ids (colons) are the fork's vocabulary; the AP names
    // are the sanitized ones.
    for (const [rowId, apName] of Object.entries(apLocations)) {
        const expected = `${omsiRegionId}__${rowId.replace(/[^A-Za-z0-9_]/g, '_')}`;
        if (apName !== expected) {
            throw new Error(`ap_locations['${rowId}'] = '${apName}', expected '${expected}'`);
        }
    }

    const regionDef = rules.regions[playerId][omsiRegionId];
    const locs = regionDef?.locations ?? [];
    if (locs.length !== EXPECTED_SUPPLY_LOCATIONS + 1) {
        throw new Error(`omsi region has ${locs.length} locations, expected ${EXPECTED_SUPPLY_LOCATIONS + 1}`);
    }

    // Access-rule counts: monotone non-decreasing, 0 … K-1, all HasFromList.
    const counts = [];
    for (const loc of locs) {
        if (loc.name === victoryLocName) continue;
        const r = loc.access_rule;
        // An omitted rule is materialized by buildRulesJson as the
        // explicit `True_` default — that is the count-0 case.
        if (!r || r.rule === 'True_') { counts.push(0); continue; }
        if (r.rule !== 'HasFromList') {
            throw new Error(`location ${loc.name} uses rule '${r.rule}', expected HasFromList`);
        }
        counts.push(r.args.count);
    }
    for (let i = 1; i < counts.length; i++) {
        if (counts[i] < counts[i - 1]) {
            throw new Error(`access-rule counts not monotone at ${i}: ${counts[i - 1]} -> ${counts[i]}`);
        }
    }
    if (counts[0] !== 0 || counts[counts.length - 1] !== EXPECTED_SUPPLY_LOCATIONS - 1) {
        throw new Error(`access-rule counts span ${counts[0]}…${counts[counts.length - 1]}, `
            + `expected 0…${EXPECTED_SUPPLY_LOCATIONS - 1}`);
    }
    const victoryLoc = locs.find((l) => l.name === victoryLocName);
    if (victoryLoc?.access_rule?.args?.count !== EXPECTED_SUPPLY_LOCATIONS - 1) {
        throw new Error(`victory rule count ${victoryLoc?.access_rule?.args?.count}, `
            + `expected ${EXPECTED_SUPPLY_LOCATIONS - 1}`);
    }

    // Item pool balances: one supply-step copy per supply location,
    // plus the single Victory item.
    const placed = locs.map((l) => (typeof l.item === 'string' ? l.item : l.item?.name));
    const victoryPlacements = placed.filter((n) => n === victoryName).length;
    const supplyPlacements = placed.filter((n) => n?.endsWith(' Supply Step')).length;
    if (victoryPlacements !== 1 || supplyPlacements !== EXPECTED_SUPPLY_LOCATIONS) {
        throw new Error(`pool imbalance: ${supplyPlacements} supply + ${victoryPlacements} victory `
            + `(expected ${EXPECTED_SUPPLY_LOCATIONS} + 1)`);
    }

    const startRegion = rules.start_regions?.[playerId]?.default?.[0]
        ?? rules.start_regions?.[0] ?? '(none)';

    console.log(`wrote ${path.relative(repoRoot, outFile)}`);
    console.log(`  omsi region: ${omsiRegionId} (town 0, manaEnabled, ${TOWNS} town(s))`);
    console.log(`  ${supplyPlacements} supply-step locations, counts ${counts[0]}…${counts[counts.length - 1]}`);
    console.log(`  victory location: ${victoryLocName} -> '${victoryName}'`);
    console.log(`  start region: ${JSON.stringify(startRegion)}`);
    console.log('Register with:\n'
        + `  python3 scripts/utils/register-preset.py `
        + `${path.relative(repoRoot, outFile)} --game-id ${GAME_ID} --game-name '${GAME_NAME}'`);
}

main().catch((err) => { console.error(err); process.exit(1); });
