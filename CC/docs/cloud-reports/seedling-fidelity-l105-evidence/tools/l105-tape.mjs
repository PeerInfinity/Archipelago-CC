#!/usr/bin/env node
// L105 D1: a captured request's staging at seam offset d, solved (the process's switches), written as a staged walk tape
// for a game witness. Usage: node l105-tape.mjs <request.jsonl> <d> <out.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { restoreRequest } from '../../../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { atSeamTime } from '../../../../../scripts/procgen/replay-seedling-solve-request.mjs';
const M = new URL('../../../../../frontend/modules/seedlingDemo/', import.meta.url).pathname;
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const { solveAnytime, ANYTIME_PASSES, replayTape } = await import(M + 'jsRuntimeSolver.js');
const { buildStagedTape } = await import(M + 'botDriverV1.js');
const [file, d = '0', out] = process.argv.slice(2);
const cap = JSON.parse(readFileSync(file, 'utf8').split('\n')[0]).requests[0].request;
const req = restoreRequest(atSeamTime(cap, cap.staging.seam.time + Number(d)));
const { passes = ANYTIME_PASSES, source, ...tape } = req;
const levelSource = levelSourceFromAtlas(source.records);
const ans = solveAnytime({ ...tape, source, levelSource }, { passes });
if (!ans.ok) { console.log('REFUSED', ans.message); process.exit(1); }
const run = replayTape({ staging: tape.staging, perTick: ans.plan.solution, levelSource, scratchPersistence: tape.scratchPersistence });
console.log(`seam ${tape.staging.seam.time}: ${ans.plan.solution.length} t, level ${run.level}, hits ${run.playerHits.length}, deaths ${run.ledger('playerDeaths').length}`);
const built = buildStagedTape({ staging: tape.staging, perTick: ans.plan.solution, name: `l105-d${d}` });
writeFileSync(out, `${JSON.stringify(built, null, 1)}\n`);
console.log('wrote', out);
