#!/usr/bin/env node
/**
 * rules-ap-chest-solid evidence: does the COMMITTED seedling_er draw stay beatable under the tree's rules?
 * The committed block names its placements by the AP exit names of ITS compile; those are mapped back to atlas
 * endpoints through that same document's sidecars (`apExitNamesByEndpoint`), then to the tree's classified doorways
 * (`doorway.from`), applied over the tree's atlas (`applyPlacements`), compiled by the mode's own hook, and judged by the
 * mode's own `beatability` + `hooks.checks` — exactly the `compile` runner's acceptance, for one fixed draw.
 * It also replays the tree's own draw loop and prints every attempt's verdict.
 * Usage: node er-replay-committed-draw.mjs <committed seedling_er AP_1_rules.json>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const I = (p) => import(path.join(REPO, p));
const committed = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const { loadPipelineSubstrates } = await I('scripts/procgen/registerPipelineSubstrates.js');
await loadPipelineSubstrates();
const S = await I('frontend/modules/procgenPipeline/entranceShuffleSteps.js');
const { apExitNamesByEndpoint } = await I('frontend/modules/procgenPipeline/entranceRandomizationReach.js');
const { buildEntranceRun } = await I('frontend/modules/procgenPipeline/presetRun.js');
const { seedlingErState } = await I('scripts/procgen/make-seedling-er-preset.mjs');
const run = buildEntranceRun(seedlingErState());
const hooks = await S.entranceShuffleHooksFor(run.atlasId).load();
const env = await S.runEntranceToStep(S.newEntranceEnvelope(run), 'compile', { hooks });
console.log(`TREE DRAW: accepted attempt ${env.shuffle.attempt}; attempts ${JSON.stringify(env.compile.attempts)}`);
for (const a of env.attempts) console.log(`  attempt ${a.attempt}: ${a.verdict}${a.why ? ` — ${a.why}` : ''}`);
const endOf = new Map([...apExitNamesByEndpoint(committed, '1')].map(([k, n]) => [n, k]));
const doorOf = new Map(env.classify.doorways.map((d) => [`${d.from[0]}/${d.from[1]}`, d]));
const placements = committed.entrance_randomization['1'].placements.map((p) => {
    const de = endOf.get(p.exit); const te = endOf.get(p.target);
    const D = doorOf.get(de); const T = doorOf.get(te);
    if (!D || !T) throw new Error(`unmapped placement ${JSON.stringify(p)} (${de} / ${te})`);
    return { exit: D.id, target: T.id };
});
console.log(`COMMITTED DRAW: ${placements.length} placements mapped to the tree's doorways`);
const { atlas, moved } = S.applyPlacements(env.pool.atlas, env.classify, placements);
const landing = S.landingSetProblems(env.pool.atlas, atlas);
console.log(`  landing-set problems: ${landing.length}`);
const out = await hooks.compile(atlas, { moved, authored: env.pool.atlas, ...(env.gameName ? { gameName: env.gameName } : {}) });
S.annotateEntranceRandomization(out.rules, env.classify, placements, { seed: env.seed, atlasId: env.source.atlasId });
const beat = S.beatability(out.rules);
console.log(`  beatability: ${beat.ok ? `OK, ${beat.spheres} spheres` : `NOT BEATABLE — ${beat.why}`}`);
const refused = beat.ok ? (await hooks.checks?.(out.rules, { vanilla: env.vanilla.rules, atlas, classification: env.classify, moved, placements, log: beat.log })) ?? [] : [];
console.log(`  mode checks: ${refused.length ? `REFUSED — ${refused.join('; ')}` : 'pass'}`);
console.log(`VERDICT: the committed draw ${beat.ok && refused.length === 0 && landing.length === 0 ? 'STAYS ACCEPTABLE' : 'IS NOT ACCEPTABLE'} under the tree's rules`);
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(out.rules));
