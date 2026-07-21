/**
 * Generate the preset the in-app omsi REGION-SPLIT test loads (arc C):
 *
 *   omsi_region_split_test   maze start + 2 omsi regions, BOTH town 0. The
 *                            omsi substrate emits TWO separate zones (via the
 *                            `regionSplit` pipeline-① config), each a genuine
 *                            procgen region carrying an `omsiRegion` overlay
 *                            descriptor { townIndex 0, an Explore gate on
 *                            'Wander' at a low threshold }. The two regions
 *                            are region OVERLAYS of the one town: entering one
 *                            swaps its per-region value props live, so r1
 *                            starts with a FRESH Explore level and returning
 *                            to r0 restores its state — the round-trip the
 *                            byte-gate can't witness (managed-mode machinery).
 *
 * Exits between the two omsi zones come from the layout's grid adjacency (the
 * bridge derives one synthetic exit action per graph exit, jta-style); this
 * generator guarantees a direct r0<->r1 edge so the round-trip is a single hop.
 *
 * Re-running is idempotent. Register once with register-preset.py.
 *
 *   node scripts/test/generate-omsi-region-split-test-preset.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

const SEED = 1;
const SEED_ID = 'AP_14089154938208861744';
const GAME_ID = 'omsi_region_split_test';
const GAME_NAME = 'Omsi Region Split Test';

// The region-split config: 2 overlays of town 0, gated on 'Wander' explored to
// 5% of the level-100 cap (0.05 * 505000 = 25250 exp) — low enough that the
// in-app leg can cross it by setting expWander directly.
const REGION_SPLIT = {
    townIndex: 0,
    count: 2,
    exploreVar: 'Wander',
    exploreThreshold: 0.05,
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
    await import(pathToFileURL(path.join(repoRoot,
        'frontend/modules/mazeRoom/mazeRoomLibrary.js')));
    await import(pathToFileURL(path.join(repoRoot,
        'frontend/modules/omsiSubstrateWrapper/omsiSubstrateWrapperLibrary.js')));

    const omsi = substrateRegistry.get('omsi');
    // Install BEFORE arrange so zoneCount (= regionSplit.count) validates the
    // omsi:2 quota, and extractZoneRules emits the omsiRegion descriptors.
    omsi.applyPipelineConfig({ regionSplit: REGION_SPLIT });

    const outDir = path.join(repoRoot, 'frontend/presets', GAME_ID, SEED_ID);
    const outFile = path.join(outDir, `${SEED_ID}_rules.json`);

    const { grid, startCell } = engine.arrangeShuffledSpiral({
        regionSize: { width: 8, height: 6 },
        itemPool: {},
        obstaclePool: {},
        seed: SEED,
        growthParams: {
            substrateQuotas: { maze: 2, omsi: 2 },
            assumeBidirectional: true,
            startSubstrate: 'maze',
            // Recorded on the preset too, so the stepped-pipeline / panel
            // path reproduces this world from config alone.
            substrateConfig: { omsi: { regionSplit: REGION_SPLIT } },
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
    const sidecars = rules.preset_sidecars?.[playerId] ?? {};

    // Every substrate region opts into shared-pool mirroring (manaEnabled).
    for (const sidecar of Object.values(sidecars)) {
        if (sidecar?.playable_payload) sidecar.playable_payload.manaEnabled = true;
    }

    const omsiRegions = Object.entries(sidecars)
        .filter(([, sc]) => sc.substrate === 'omsi')
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    if (omsiRegions.length !== 2) {
        throw new Error(`expected exactly 2 omsi regions, got ${omsiRegions.length}`);
    }
    const [r0Id, r0Sidecar] = omsiRegions[0];
    const [r1Id, r1Sidecar] = omsiRegions[1];

    // Guarantee a direct r0<->r1 graph edge so the round-trip is one hop (the
    // spiral may or may not have placed the two omsi zones adjacent). Adding a
    // graph exit = an entry in BOTH the sidecar's exits (the Map the bridge
    // reads) and the region-def exits (the AP graph). Idempotent: skip if a
    // link to the other omsi region already exists.
    ensureExit(rules, playerId, r0Sidecar, r0Id, r1Id, 'E');
    ensureExit(rules, playerId, r1Sidecar, r1Id, r0Id, 'W');

    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(rules, null, 2) + '\n');

    // ── Sanity round-trip on the written file ───────────────────────────────
    for (const [regionId, sidecar] of [[r0Id, r0Sidecar], [r1Id, r1Sidecar]]) {
        const p = sidecar.playable_payload;
        if (p.omsiTown !== 0) throw new Error(`omsi region ${regionId} omsiTown !== 0`);
        const o = p.omsiRegion;
        if (o?.regionId !== regionId || o.townIndex !== 0 || o.exploreVar !== REGION_SPLIT.exploreVar) {
            throw new Error(`omsiRegion descriptor malformed on ${regionId}: ${JSON.stringify(o)}`);
        }
        const linksOther = (p.exits ?? []).some((e) => e.targetRegion === (regionId === r0Id ? r1Id : r0Id));
        if (!linksOther) throw new Error(`omsi region ${regionId} has no exit to its sibling`);
    }

    console.log(`wrote ${path.relative(repoRoot, outFile)}`);
    console.log(`  omsi region r0: ${r0Id} (town 0 overlay)`);
    console.log(`  omsi region r1: ${r1Id} (town 0 overlay)`);
    console.log(`  explore gate: ${REGION_SPLIT.exploreVar} >= ${REGION_SPLIT.exploreThreshold * 100}% `
        + `(exp ${Math.ceil(REGION_SPLIT.exploreThreshold * 505000)})`);
    console.log('Register with:\n'
        + `  python3 scripts/utils/register-preset.py `
        + `${path.relative(repoRoot, outFile)} --game-id ${GAME_ID} --game-name '${GAME_NAME}'`);
}

/**
 * Ensure `sidecar`'s region has a graph exit to `targetId` (both the runtime
 * exits array the bridge reads and the AP region-def exits). No-op if one
 * already exists.
 */
function ensureExit(rules, playerId, sidecar, regionId, targetId, side) {
    const payload = sidecar.playable_payload;
    payload.exits ??= [];
    if (payload.exits.some((e) => e.targetRegion === targetId)) return;
    const exitName = `exit_to_${targetId}`;
    payload.exits.push({
        exit_id: exitName,
        x: 0, y: 0,
        side,
        exitName,
        targetRegion: targetId,
        targetExitId: `exit_to_${regionId}`,
        isBackExit: false,
        isTeleporter: false,
    });
    const regionDef = rules.regions[playerId][regionId];
    (regionDef.exits ??= []).push({
        name: exitName,
        connected_region: targetId,
        access_rule: { rule: 'True_' },
    });
}

main().catch((err) => { console.error(err); process.exit(1); });
