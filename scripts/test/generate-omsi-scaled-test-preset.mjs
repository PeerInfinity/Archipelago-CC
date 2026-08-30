/**
 * Generate `omsi_scaled_test` — the fixture for the arc-A counts-refactor
 * in-app test (unlock-discretization plan §3.5 [ARC A]). Same world shape
 * as omsi_randomized_test (2 maze regions + 1 omsi Beginnersville region,
 * start in the maze, loop_costs embedded) but with a SCALED unlock pool:
 * `substrateConfig.omsi.unlockScale = 0.2`.
 *
 * At scale 0.2 town 0 thins from 90 supply rows to 18 (Pots 10, Locks 2,
 * SQuests 4, LQuests 2), each selected at evenly-spaced Explore steps
 * (Pots 5,10,…,50; Locks/LQuests 5,10; SQuests 5,10,15,20). The Explore
 * percentages that fire AP checks therefore MOVE — Pots checks at
 * 10/20/…/100 Explored, not 2/4/…, — which is what the in-app leg proves
 * end to end. `travel_onward` holds 'Victory' with a Σ L_v − 1 = 17 rule.
 *
 * The var carries `unlockMeta.vars[v].itemCount` (I_v ≠ R_v), so the
 * bridge maps item copies → capacity as round(count·R_v/I_v): a full set
 * of I_v copies reaches exactly the native baseMax.
 *
 * Placement is CANONICAL: every location holds its own native item.
 * A real AP fill via the Python round-trip is a deferred follow-on.
 *
 * Do NOT modify omsi_randomized_test (scale 1) — it is the byte-inertness
 * witness. This is a SEPARATE preset.
 *
 * Re-running is idempotent (overwrites the rules.json). Register the
 * preset index entry once with scripts/utils/register-preset.py (the
 * script prints the command).
 *
 *   node scripts/test/generate-omsi-scaled-test-preset.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

const SEED = 1;
const SEED_ID = 'AP_14089154938208861744';
const GAME_ID = 'omsi_scaled_test';
const GAME_NAME = 'Omsi Scaled Test';

const TOWNS = 1;
const UNLOCK_SCALE = 0.2;
// Town 0 at scale 0.2: Pots 10 + Locks 2 + SQuests 4 + LQuests 2.
const EXPECTED_SUPPLY_LOCATIONS = 18;
// Per-var selected steps (the moved Explore percentages).
const EXPECTED_STEPS = {
    Pots: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50],
    Locks: [5, 10],
    SQuests: [5, 10, 15, 20],
    LQuests: [5, 10],
};
// itemCount (I_v) per var — round(count·R/I) is the bridge multiplier.
const EXPECTED_ITEM_COUNTS = { Pots: 10, Locks: 2, SQuests: 4, LQuests: 2 };
const EXPECTED_ROW_COUNTS = { Pots: 50, Locks: 10, SQuests: 20, LQuests: 10 };

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
    omsi.applyPipelineConfig({
        towns: TOWNS, emitUnlockLocations: true, unlockScale: UNLOCK_SCALE,
    });

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
            substrateConfig: {
                omsi: { towns: TOWNS, emitUnlockLocations: true, unlockScale: UNLOCK_SCALE },
            },
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

    // unlockMeta carries the scaled itemCount alongside the native rowCount.
    const varMeta = payload.unlockMeta?.vars ?? {};
    for (const [v, I] of Object.entries(EXPECTED_ITEM_COUNTS)) {
        const R = EXPECTED_ROW_COUNTS[v];
        if (varMeta[v]?.rowCount !== R || varMeta[v]?.itemCount !== I) {
            throw new Error(`unlockMeta.vars.${v} = ${JSON.stringify(varMeta[v])}, `
                + `expected {town:0, rowCount:${R}, itemCount:${I}}`);
        }
    }

    const apLocations = payload.ap_locations ?? {};
    const rowKeys = Object.keys(apLocations).filter((k) => k.startsWith('q:'));
    if (rowKeys.length !== EXPECTED_SUPPLY_LOCATIONS) {
        throw new Error(`expected ${EXPECTED_SUPPLY_LOCATIONS} supply rows in ap_locations, got ${rowKeys.length}`);
    }
    // The selected steps are exactly the arc-A even spacing (percentages moved).
    const stepsByVar = {};
    for (const k of rowKeys) {
        const [, , v, step] = k.split(':');
        (stepsByVar[v] ??= []).push(Number(step));
    }
    for (const v of Object.keys(EXPECTED_STEPS)) {
        const got = (stepsByVar[v] ?? []).sort((a, b) => a - b);
        const want = EXPECTED_STEPS[v];
        if (JSON.stringify(got) !== JSON.stringify(want)) {
            throw new Error(`${v} selected steps ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
        }
    }
    const victoryLocName = apLocations.travel_onward;
    if (victoryLocName !== `${omsiRegionId}__travel_onward`) {
        throw new Error(`ap_locations.travel_onward broken: ${victoryLocName}`);
    }
    if (apLocations.start_journey) {
        throw new Error('emission-ON world must not carry the legacy start_journey key');
    }
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

    // Access-rule counts: monotone non-decreasing, 0 … L-1 (ordinal, I=L),
    // all HasFromList.
    const counts = [];
    for (const loc of locs) {
        if (loc.name === victoryLocName) continue;
        const r = loc.access_rule;
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
    console.log(`  omsi region: ${omsiRegionId} (town 0, manaEnabled, scale ${UNLOCK_SCALE})`);
    console.log(`  ${supplyPlacements} supply-step locations, counts ${counts[0]}…${counts[counts.length - 1]}`);
    console.log(`  Pots steps ${JSON.stringify(stepsByVar.Pots?.sort((a, b) => a - b))}`);
    console.log(`  victory location: ${victoryLocName} -> '${victoryName}' (count ${EXPECTED_SUPPLY_LOCATIONS - 1})`);
    console.log(`  start region: ${JSON.stringify(startRegion)}`);
    console.log('Register with:\n'
        + `  python3 scripts/utils/register-preset.py `
        + `${path.relative(repoRoot, outFile)} --game-id ${GAME_ID} --game-name '${GAME_NAME}'`);
}

main().catch((err) => { console.error(err); process.exit(1); });
