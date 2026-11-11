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
 *   node scripts/procgen/make-seedling-er-preset.mjs --check --atlas-out=<file>   # also write the SHUFFLED atlas (ER E4c)
 *
 * ⛓ ER E4c — the SHUFFLED ATLAS (`buildSeedlingErSource`): the same run, stepped, with its accepted placements applied to the
 * authored atlas (`applyPlacements`, the mode's own) — the graph `seedling_er` was compiled from. Nothing commits it: the
 * ER maze projection (`make-seedling-playthrough-maze.mjs --source=<file>`) and the whole-game certifier's ER arm
 * (`probe-seedling-whole-game-certify.mjs --source=er`) build it in the run. It must compile to the committed preset, byte
 * for byte, or it is refused (it would not be the graph the preset names).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
export const SEEDLING_ER_PRESET = path.join(REPO, 'frontend/presets/seedling_er/AP_1/AP_1_rules.json');
/** The preset's game name: not the vanilla playthrough's (no world package of that game generates this document). */
export const SEEDLING_ER_GAME = 'Seedling Playthrough ER';

/** The preset's definition: the mode and its run. `atlasId` is read off the committed atlas (the producer's --check holds it). */
export function seedlingErState() {
    const atlasId = JSON.parse(fs.readFileSync(path.join(REPO, 'frontend/modules/flashPanel/atlases/seedling-playthrough.json'), 'utf8')).atlas_id;
    // ⛓ its own game: the vanilla playthrough's world package does not generate it (an ER world package is its own).
    return Object.freeze({ mode: 'entranceShuffle', params: Object.freeze({ atlasId, seed: 1, gameName: SEEDLING_ER_GAME }) });
}

/** A fresh build: `{rulesText, rulesJson, stats}`. */
export async function buildSeedlingErPreset() {
    const { loadPipelineSubstrates } = await import('./registerPipelineSubstrates.js');
    await loadPipelineSubstrates();
    const { prepareRunFromState, runPresetHeadless } = await import('../../frontend/modules/procgenPipeline/presetRun.js');
    const { nodePackIo } = await import('../../frontend/modules/contentPacks/nodePackIo.js');
    const { stringifyRulesJson } = await import('../../frontend/modules/shared/rulesJsonBuilder.js');
    // ⛓ CONTENT SETS C3 — the async entry (an entranceShuffle bundle has no substrate mix: an empty stack).
    const { rulesJson, stats } = await runPresetHeadless(await prepareRunFromState(seedlingErState(), { io: nodePackIo() }));
    return { rulesJson, rulesText: stringifyRulesJson(rulesJson), stats };
}

/**
 * The SHUFFLED ATLAS the preset compiles (see the docblock): `{atlas, roomsAtlas, moved, rulesJson, rulesText}` — `roomsAtlas`
 * the authored atlas the run pooled (the producer's own build), `moved` the departures placed elsewhere than their reverse.
 */
export async function buildSeedlingErSource() {
    const { loadPipelineSubstrates } = await import('./registerPipelineSubstrates.js');
    await loadPipelineSubstrates();
    const S = await import('../../frontend/modules/procgenPipeline/entranceShuffleSteps.js');
    const { buildEntranceRun } = await import('../../frontend/modules/procgenPipeline/presetRun.js');
    const { stringifyRulesJson } = await import('../../frontend/modules/shared/rulesJsonBuilder.js');
    const run = buildEntranceRun(seedlingErState());
    const hooks = await S.entranceShuffleHooksFor(run.atlasId).load();
    const env = await S.runEntranceToStep(S.newEntranceEnvelope(run), 'compile', { hooks });
    const { atlas, moved } = S.applyPlacements(env.pool.atlas, env.classify, env.shuffle.placements);
    const rulesJson = env.compile.rulesJson;
    return { atlas, roomsAtlas: env.pool.atlas, moved: [...moved].sort(), rulesJson, rulesText: stringifyRulesJson(rulesJson) };
}

if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const check = process.argv.includes('--check');
    const atlasOut = process.argv.find((a) => a.startsWith('--atlas-out='))?.slice('--atlas-out='.length) ?? null;
    if (atlasOut !== null && !atlasOut) throw new Error('--atlas-out= names no file');
    if (atlasOut) {
        const src = await buildSeedlingErSource();
        const committed = fs.existsSync(SEEDLING_ER_PRESET) ? fs.readFileSync(SEEDLING_ER_PRESET, 'utf8') : null;
        if (committed !== src.rulesText) {
            console.error(`ERROR: the stepped run does not compile to ${path.relative(REPO, SEEDLING_ER_PRESET)} — regenerate the preset first`);
            process.exit(1);
        }
        fs.mkdirSync(path.dirname(path.resolve(atlasOut)), { recursive: true });
        fs.writeFileSync(path.resolve(atlasOut), `${JSON.stringify(src.atlas)}\n`);
        console.log(`wrote the shuffled atlas ${src.atlas.atlas_id} (${src.moved.length} departure(s) moved; rooms ${src.roomsAtlas.atlas_id}) to ${atlasOut}`);
        if (!check) return;
    }
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
