#!/usr/bin/env node
/**
 * make-seedling-er-preset — **THE `seedling_er` PRESET** (ENTRANCE RANDOMIZATION E4b): the Seedling playthrough with its
 * STAIRS entrance-randomized — the `entranceShuffle` mode (`procgenPipeline/entranceShuffleSteps.js`) run headless over
 * the committed playthrough atlas at `SEEDLING_ER_STATE`'s seed, through the same door every preset takes
 * (`presetRun.buildRunFromState` → `runPresetHeadless`).
 *
 * ⚖ user 2026-11-01: Q1 stairs only · Q2 coupled · Q4 ER only, VANILLA ITEMS · Q5 zero unclassified. The 26 stairs pairs
 * less the PIN-CHAIN pair (L0's stairsdown the L110 pit chain fires, and its reverse) are shuffled: 25 pairs, 50 exits.
 * Every collectible stays where the game put it. The world is a FUNCTION of `SEEDLING_ER_STATE` and the committed
 * playthrough atlas / producer / derived-rule table — never a hand edit. Deterministic (no clock, no Math.random), so
 * `--check` is an exact regeneration gate.
 *
 * ⛔ Q3: the play-time redirect is E5 — the game still takes a stair to its vanilla room; this preset is the LOGIC.
 *
 * Run:
 *   node scripts/procgen/make-seedling-er-preset.mjs           # write frontend/presets/seedling_er/AP_1/AP_1_rules.json
 *   node scripts/procgen/make-seedling-er-preset.mjs --check   # the gate: a fresh run equals the committed file
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
export const SEEDLING_ER_PRESET = path.join(REPO, 'frontend/presets/seedling_er/AP_1/AP_1_rules.json');

/** The preset's definition: the mode and its run. `atlasId` is read off the committed atlas (the producer's --check holds it). */
export function seedlingErState() {
    const atlasId = JSON.parse(fs.readFileSync(path.join(REPO, 'frontend/modules/flashPanel/atlases/seedling-playthrough.json'), 'utf8')).atlas_id;
    return Object.freeze({ mode: 'entranceShuffle', params: Object.freeze({ atlasId, seed: 1 }) });
}

/** A fresh build: `{rulesText, rulesJson, stats}`. */
export async function buildSeedlingErPreset() {
    const { loadPipelineSubstrates } = await import('./registerPipelineSubstrates.js');
    await loadPipelineSubstrates();
    const { buildRunFromState, runPresetHeadless } = await import('../../frontend/modules/procgenPipeline/presetRun.js');
    const { stringifyRulesJson } = await import('../../frontend/modules/shared/rulesJsonBuilder.js');
    const { rulesJson, stats } = await runPresetHeadless(buildRunFromState(seedlingErState()));
    return { rulesJson, rulesText: stringifyRulesJson(rulesJson), stats };
}

if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const check = process.argv.includes('--check');
    const { rulesText, rulesJson, stats } = await buildSeedlingErPreset();
    const block = rulesJson.entrance_randomization['1'];
    console.log(`seedling_er: seed ${block.seed}, ${block.placements.length} placements, ${stats.moved} exit(s) moved, `
        + `draws ${stats.attempts.draws} (${stats.attempts.shuffleRefused} shuffle-refused, ${stats.attempts.rejectedUnbeatable} unbeatable, `
        + `${stats.attempts.rejectedCheck} check-rejected), ${stats.spheres} sphere states; source atlas ${block.source.atlas_id}`);
    const rel = path.relative(REPO, SEEDLING_ER_PRESET);
    if (check) {
        const committed = fs.existsSync(SEEDLING_ER_PRESET) ? fs.readFileSync(SEEDLING_ER_PRESET, 'utf8') : null;
        if (committed !== rulesText) {
            console.error(`ERROR: ${rel} differs from a fresh build`);
            process.exit(1);
        }
        console.log(`OK: ${rel} matches a fresh build`);
        return;
    }
    fs.mkdirSync(path.dirname(SEEDLING_ER_PRESET), { recursive: true });
    fs.writeFileSync(SEEDLING_ER_PRESET, rulesText);
    console.log(`wrote ${rel}`);
}
