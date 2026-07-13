#!/usr/bin/env node
/**
 * Stepped-spiral Part 3, Phase-B gate (c): a panel/pipeline-generated jta
 * spiral world solves + plays in-app.
 *
 * The in-app substrate test `jta-dataset-world-progression` (jtaDatasetTests.js)
 * loads the committed `jta_dataset_test` preset, balances it at rules load
 * (Pass B) and plays zones 0->1 — the end-to-end solve+play proof. That preset
 * is built by scripts/test/generate-jta-locations-test-preset.mjs the MONOLITH
 * way (setJta* globals + arrangeShuffledSpiral). This guard proves the Part-3
 * stepped-spiral pipeline + the ② content config seam produces the SAME preset,
 * byte-for-byte:
 *
 *   1. pipeline grid (runSpiralToStep + substrateConfig.jta) === monolith grid,
 *      compiled with the generator's exact opts.
 *   2. that pipeline rules.json === the committed jta_dataset_test preset on disk.
 *
 * So the world the in-app test already solves + plays is exactly what the
 * pipeline emits — closing gate (c) without a second heavy playwright run.
 *
 *   node scripts/procgen/verify-jta-dataset-pipeline-preset.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

// Mirror the jta_dataset_test entry in generate-jta-locations-test-preset.mjs.
const SEED = 1;
const SEED_ID = 'AP_14089154938208861744';
const GAME_ID = 'jta_dataset_test';
const GAME_NAME = 'JtA Dataset Test';
const QUOTA = 3;
const GOAL_ZONE = QUOTA - 1;
const COMMITTED = path.join(repoRoot, 'frontend/presets', GAME_ID, SEED_ID, `${SEED_ID}_rules.json`);

let failures = 0;
const ok = (cond, msg) => {
    console.log(`${cond ? 'PASS' : 'FAIL'}: ${msg}`);
    if (!cond) failures += 1;
};

const imp = (rel) => import(pathToFileURL(path.join(repoRoot, rel)));

async function main() {
    const jtaLib = await imp('frontend/modules/jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js');
    const engine = await imp('frontend/modules/procgenPipeline/procgenPipelineEngine.js');
    const { substrateRegistry } = await imp('frontend/modules/shared/procgen/substrateRegistry.js');
    const { mergeSubstrateItemLib } = await imp('frontend/modules/procgenPipeline/sphereConfigHooks.js');
    const { DEFAULT_ITEMS } = await imp('frontend/modules/shared/procgen/library.js');
    const { generateJtaDataset } = await imp('frontend/modules/jtaSubstrateWrapper/generateDataset.js');
    const spiral = await imp('frontend/modules/procgenPipeline/spiralSteps.js');

    const profile = JSON.parse(fs.readFileSync(
        path.join(repoRoot, 'CC/scripts/jta-stats/results/vanilla-profile.json'), 'utf8')).static;
    const vanilla = JSON.parse(fs.readFileSync(
        path.join(repoRoot, 'frontend/modules/jtaSubstrateWrapper/datasets/vanilla.json'), 'utf8'));

    // The dataset the generator embeds: seed 1, 3 zones (deterministic).
    const datasetDoc = generateJtaDataset({
        seed: 1, profile, vanilla, params: { zoneCount: QUOTA },
    }).dataset;

    const victoryName = substrateRegistry.get('jta').victoryItem;
    const itemLib = mergeSubstrateItemLib(DEFAULT_ITEMS, ['jta']);

    // Compile a grid exactly the way generate-jta-locations-test-preset.mjs does
    // (same buildRulesJson opts + the loop_costs block + JSON formatting), so a
    // byte compare against the committed preset is meaningful.
    const compile = (grid, startCell) => {
        const rules = engine.buildRulesJson(grid, {
            startCell, seed: SEED, itemLib, gameName: GAME_NAME,
            completionConditionItem: victoryName,
        });
        rules.loop_costs = {
            regions: {}, locations: {}, defaultRegionCost: 50, defaultLocationCost: 10,
        };
        return JSON.stringify(rules, null, 2) + '\n';
    };

    // --- monolith grid (the generator's path) ---
    jtaLib.setJtaDataset(datasetDoc);
    jtaLib.setJtaEmitZoneLocations(true);
    jtaLib.setJtaGoalZone(GOAL_ZONE);
    jtaLib.setJtaPerkShuffleSeed(null);
    const mono = engine.arrangeShuffledSpiral({
        regionSize: { width: 8, height: 6 }, itemPool: {}, obstaclePool: {}, seed: SEED,
        growthParams: { substrateQuotas: { jta: QUOTA }, assumeBidirectional: true, startSubstrate: 'jta' },
    });
    const monoRules = compile(mono.grid, mono.startCell);

    // --- pipeline grid (Part 3: stepped spiral + ② content config seam) ---
    // Reset the globals first to prove ① applySubstrateConfig installs the
    // dataset + zone-locations knobs from config alone.
    jtaLib.setJtaDataset(null);
    jtaLib.setJtaEmitZoneLocations(false);
    jtaLib.setJtaGoalZone(null);
    const env = await spiral.runSpiralToStep(spiral.newSpiralEnvelope({
        config: {
            regionSize: { width: 8, height: 6 }, itemPool: {}, obstaclePool: {}, seed: SEED,
            growthParams: {
                substrateQuotas: { jta: QUOTA }, assumeBidirectional: true, startSubstrate: 'jta',
                substrateConfig: {
                    jta: {
                        datasetDoc, emitZoneLocations: true, goalZone: GOAL_ZONE, perkShuffleSeed: null,
                    },
                },
            },
        },
        compileIn: { seed: SEED },
    }), 'regions');
    const pipeRules = compile(env.regions.grid, env.regions.startCell);

    ok(env.content?.dataset_id === datasetDoc.dataset_id,
        'pipeline ② content materialised the dataset onto the envelope');
    ok(pipeRules === monoRules,
        'pipeline (config seam) rules.json === monolith (globals) rules.json, byte-for-byte');

    if (!fs.existsSync(COMMITTED)) {
        ok(false, `committed preset missing: ${path.relative(repoRoot, COMMITTED)} `
            + '(regenerate with scripts/test/generate-jta-locations-test-preset.mjs --only jta_dataset_test)');
    } else {
        const committed = fs.readFileSync(COMMITTED, 'utf8');
        ok(pipeRules === committed,
            `pipeline rules.json === committed ${GAME_ID} preset the in-app test solves + plays`);
    }

    console.log(failures === 0
        ? '\nALL PASS — the pipeline reproduces the playable jta_dataset_test world'
        : `\n${failures} FAILURE(S)`);
    process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
