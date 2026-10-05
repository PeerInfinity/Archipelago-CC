/**
 * Generate the small, deterministic preset the in-app Noiz2sa substrate test loads:
 *
 *   noiz2sa_substrate_test   3 Noiz2sa regions — the substrate's zone table (`NOIZ2SA_ZONES`:
 *                            1:1, 1:2–1:3, 1:boss–2:1, all on seed 1) with one, no and two
 *                            locations (N4c), each with its own check span; Victory on the last
 *                            location; start in a Noiz2sa region; loop_costs embedded
 *                            (loop mode auto-enables, and the summary regions are time-priced).
 *
 * Produced by the procgen pipeline's Pass A (arrangeShuffledSpiral + buildRulesJson, no world_generator /
 * Generate.py), like `generate-omsi-substrate-test-preset.mjs`: a complete pipeline rules.json the frontend
 * loads directly, deterministic per seed. Re-running is idempotent (overwrites the rules.json).
 *
 *   node scripts/test/generate-noiz2sa-substrate-test-preset.mjs
 *   node scripts/test/generate-noiz2sa-substrate-test-preset.mjs --out-dir /tmp/scratch
 *
 * `--out-dir DIR` writes under DIR/<game_id>/<seed_id>/ instead of frontend/presets/ (see presetOutDir.mjs).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolvePresetOutDir } from './presetOutDir.mjs';
import { stampLoopCosts } from './presetLoopCosts.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

const GENERATOR = 'scripts/test/generate-noiz2sa-substrate-test-preset.mjs';
const SEED = 1;
const SEED_ID = 'AP_14089154938208861744';
const GAME_ID = 'noiz2sa_substrate_test';
const GAME_NAME = 'Noiz2sa Substrate Test';

async function main() {
    const engine = await import(pathToFileURL(path.join(repoRoot,
        'frontend/modules/procgenPipeline/procgenPipelineEngine.js')));
    const { mergeSubstrateItemLib } = await import(pathToFileURL(path.join(repoRoot,
        'frontend/modules/procgenPipeline/sphereConfigHooks.js')));
    const { DEFAULT_ITEMS } = await import(pathToFileURL(path.join(repoRoot,
        'frontend/modules/shared/procgen/library.js')));
    // The substrate library registers on import.
    const lib = await import(pathToFileURL(path.join(repoRoot,
        'frontend/modules/noiz2saSubstrate/noiz2saSubstrateLibrary.js')));

    const { outDir } = resolvePresetOutDir({ repoRoot, gameId: GAME_ID, seedId: SEED_ID });
    const outFile = path.join(outDir, `${SEED_ID}_rules.json`);

    const { grid, startCell } = engine.arrangeShuffledSpiral({
        regionSize: { width: 8, height: 6 },
        itemPool: {},
        obstaclePool: {},
        seed: SEED,
        growthParams: {
            substrateQuotas: { noiz2sa: lib.NOIZ2SA_ZONES.length },
            assumeBidirectional: true,
            startSubstrate: 'noiz2sa',
        },
    });

    const itemLib = mergeSubstrateItemLib(DEFAULT_ITEMS, ['noiz2sa']);
    const rules = engine.buildRulesJson(grid, {
        startCell,
        seed: SEED,
        itemLib,
        gameName: GAME_NAME,
        completionConditionItem: lib.NOIZ2SA_VICTORY_ITEM_NAME,
    });

    // Loop mode auto-enables when cost data is present; write-by-class prices the summary regions by time
    // (presetLoopCosts.mjs — the same call the pipeline makes).
    stampLoopCosts(rules, { sourceFileName: GENERATOR });

    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(rules, null, 2) + '\n');

    // Sanity: one Noiz2sa region per zone, its locations as the payload says; Victory on exactly one.
    const playerId = Object.keys(rules.regions)[0];
    const sidecars = Object.entries(rules.preset_sidecars?.[playerId] ?? {});
    const regions = sidecars.filter(([, sc]) => sc.substrate === 'noiz2sa');
    if (regions.length !== lib.NOIZ2SA_ZONES.length) {
        throw new Error(`expected ${lib.NOIZ2SA_ZONES.length} noiz2sa regions, got ${regions.length}`);
    }
    let victories = 0;
    for (const [regionId, sc] of regions) {
        const payload = sc.playable_payload ?? {};
        const locs = payload.locations ?? [];
        const defs = rules.regions[playerId][regionId]?.locations ?? [];
        if (defs.length !== locs.length) throw new Error(`${regionId}: ${locs.length} payload locations, ${defs.length} in rules.regions`);
        const held = [];
        for (const l of locs) {
            const loc = payload.ap_locations?.[l.id];
            if (loc !== `${regionId}__${l.id}`) throw new Error(`${regionId}: ap_locations broken: ${JSON.stringify(payload.ap_locations)}`);
            const def = defs.find((d) => d.name === loc);
            if (!def) throw new Error(`${regionId}: location ${loc} not in rules.regions`);
            const item = typeof def.item === 'string' ? def.item : def.item?.name;
            if (item === lib.NOIZ2SA_VICTORY_ITEM_NAME) victories++;
            held.push(`${loc} holds '${item}'`);
        }
        console.log(`  ${regionId}: ${lib.describeRegion(payload)}${held.length ? ` → ${held.join(', ')}` : ''}`);
    }
    if (victories !== 1) throw new Error(`expected Victory on exactly one location, got ${victories}`);
    const startRegion = rules.start_regions?.[playerId]?.default?.[0] ?? '(none)';
    console.log(`wrote ${path.relative(repoRoot, outFile)}; start region: ${JSON.stringify(startRegion)}`);
    console.log('Register with:\n'
        + `  python3 scripts/utils/register-preset.py ${path.relative(repoRoot, outFile)} `
        + `--game-id ${GAME_ID} --game-name '${GAME_NAME}'`);
}

main().catch((err) => { console.error(err); process.exit(1); });
