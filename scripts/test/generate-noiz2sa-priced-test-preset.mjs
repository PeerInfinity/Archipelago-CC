/**
 * Generate the PRICED Noiz2sa preset (bulletml N5) the in-app pricing row loads:
 *
 *   noiz2sa_priced_test   the substrate's three zones (one, no and two locations), arranged as
 *                         `generate-noiz2sa-substrate-test-preset.mjs` arranges them, but built in LOOP MODE
 *                         through the pipeline's own path (`buildRulesJson({enableLoopMode: true})`): the
 *                         Noiz2sa `priceRegions` hook walks the one cost model's plan and writes each region's
 *                         spans, drain rate and `pricing`, then `generateLoopCosts` writes the block (each
 *                         region's own rate, with the shared writer's payload-rate rule).
 *
 * The hand-built `noiz2sa_substrate_test` stays UNPRICED: its rows measure fixed spans (1:1, 1:2–1:3, 1:boss–2:1).
 * Deterministic per seed; re-running overwrites the rules.json.
 *
 *   node scripts/test/generate-noiz2sa-priced-test-preset.mjs
 *   node scripts/test/generate-noiz2sa-priced-test-preset.mjs --out-dir /tmp/scratch
 *   node scripts/test/generate-noiz2sa-priced-test-preset.mjs --final-span 9:7–9:boss
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolvePresetOutDir } from './presetOutDir.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

const SEED = 1;
const SEED_ID = 'AP_14089154938208861744';
const GAME_ID = 'noiz2sa_priced_test';
const GAME_NAME = 'Noiz2sa Priced Test';

async function main() {
    const imp = (p) => import(pathToFileURL(path.join(repoRoot, p)));
    const engine = await imp('frontend/modules/procgenPipeline/procgenPipelineEngine.js');
    const { mergeSubstrateItemLib } = await imp('frontend/modules/procgenPipeline/sphereConfigHooks.js');
    const { DEFAULT_ITEMS } = await imp('frontend/modules/shared/procgen/library.js');
    const lib = await imp('frontend/modules/noiz2saSubstrate/noiz2saSubstrateLibrary.js');
    const pricing = await imp('frontend/modules/noiz2saSubstrate/noiz2saPricing.js');

    const at = process.argv.indexOf('--final-span');
    const finalSpan = at >= 0 ? process.argv[at + 1] : pricing.DEFAULT_FINAL_SPAN;

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
    const rules = engine.buildRulesJson(grid, {
        startCell,
        seed: SEED,
        itemLib: mergeSubstrateItemLib(DEFAULT_ITEMS, ['noiz2sa']),
        gameName: GAME_NAME,
        completionConditionItem: lib.NOIZ2SA_VICTORY_ITEM_NAME,
        enableLoopMode: true,
        procgenParams: { [pricing.FINAL_SPAN_PARAM]: finalSpan },
    });

    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(rules, null, 2) + '\n');

    const playerId = Object.keys(rules.regions)[0];
    const block = rules.loop_costs?.[playerId];
    let priced = 0;
    for (const [regionId, sc] of Object.entries(rules.preset_sidecars?.[playerId] ?? {})) {
        if (sc.substrate !== 'noiz2sa') continue;
        const p = sc.playable_payload;
        if (!p.pricing) throw new Error(`${regionId}: not priced`);
        priced++;
        console.log(`  ${regionId}: ${lib.describeRegion(p)}; rate ${p.timeDrainPerSecond}/s (block ${block?.regions?.[regionId]?.timeDrainPerSecond}); `
            + `skill ${p.pricing.skill}, p ${p.pricing.p}, E ${p.pricing.seconds} s, cost ${p.pricing.cost}${p.pricing.final ? ' (final)' : ''}`);
    }
    if (priced !== lib.NOIZ2SA_ZONES.length) throw new Error(`expected ${lib.NOIZ2SA_ZONES.length} priced regions, got ${priced}`);
    console.log(`pointsPerMana ${Object.values(rules.preset_sidecars[playerId]).find((sc) => sc.playable_payload?.pricing)?.playable_payload.pricing.pointsPerMana}`);
    console.log(`wrote ${path.relative(repoRoot, outFile)}`);
    console.log('Register with:\n'
        + `  python3 scripts/utils/register-preset.py ${path.relative(repoRoot, outFile)} `
        + `--game-id ${GAME_ID} --game-name '${GAME_NAME}'`);
}

main().catch((err) => { console.error(err); process.exit(1); });
