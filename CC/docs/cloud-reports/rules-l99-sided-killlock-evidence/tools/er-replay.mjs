#!/usr/bin/env node
// rules-l99-sided-killlock: a seedling_er preset's OWN layout (its entrance_randomization placements) replayed through the
// CURRENT producer and the shuffle's own acceptance (`entranceShuffleSteps.beatability`). Usage:
//   node er-replay.mjs <seedling_er rules.json> [<out compiled rules.json>]
// Run from the repository root of the tree whose producer is asked (the base tree for the control).
import fs from 'node:fs';
import path from 'node:path';
const P = (rel) => path.join(process.cwd(), rel);
const { loadPipelineSubstrates } = await import(P('scripts/procgen/registerPipelineSubstrates.js'));
await loadPipelineSubstrates();
const S = await import(P('frontend/modules/procgenPipeline/entranceShuffleSteps.js'));
const { buildEntranceRun } = await import(P('frontend/modules/procgenPipeline/presetRun.js'));
const { seedlingErState } = await import(P('scripts/procgen/make-seedling-er-preset.mjs'));
const old = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).entrance_randomization['1'].placements;
const run = buildEntranceRun(seedlingErState());
const hooks = await S.entranceShuffleHooksFor(run.atlasId).load();
const env = await S.runEntranceToStep(S.newEntranceEnvelope(run), 'shuffle', { hooks });
const { apExitNamesByEndpoint } = await import(P('frontend/modules/procgenPipeline/entranceRandomizationReach.js'));
const oldRules = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const endOf = new Map([...apExitNamesByEndpoint(oldRules, '1')].map(([k, n]) => [n, k]));
const idByEnd = new Map(env.classify.doorways.map((d) => [`${d.from[0]}/${d.from[1]}`, d.id]));
const placements = old.map((p) => ({ exit: idByEnd.get(endOf.get(p.exit)), target: idByEnd.get(endOf.get(p.target)) }));
const miss = placements.filter((p) => !p.exit || !p.target);
if (miss.length) { console.log('MISS', miss.length); process.exit(1); }
const { atlas, moved } = S.applyPlacements(env.pool.atlas, env.classify, placements);
const { rules } = await hooks.compile(atlas, { moved, authored: env.pool.atlas, gameName: env.gameName });
const beat = S.beatability(rules);
console.log('REPLAY old layout under the current producer: beatable =', beat.ok, beat.ok ? `${beat.spheres} sphere states` : beat.why);
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(rules));
