// FACE 1: solve one captured request with BURN_STANCE_AVOID's trace sink attached (prints each re-ranking).
//   SEEDLING_BURN_STANCE_AVOID=1 node trace.mjs --req=<file.json.gz> [--seam=<clock>]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
const R = process.env.REPO || process.cwd();
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
const M = (p) => import(join(R, 'frontend/modules/seedlingDemo', p));
const { restoreRequest } = await import(join(R, 'scripts/procgen/seedlingSolveRequestCodec.js'));
const { levelSourceFromAtlas } = await M('atlasSource.js');
const JR = await M('jsRuntimeSolver.js');
const SB = await M('solverBot.js');
SB.BURN_STANCE_AVOID_TRACE.sink = (x) => console.log('TRACE', JSON.stringify(x));
const cap = JSON.parse(gunzipSync(readFileSync(arg('req'))).toString('utf8'));
const c0 = cap.request;
const seam = arg('seam') === null ? c0.staging.seam.time : Number(arg('seam'));
const { passes = JR.ANYTIME_PASSES, source, ...tape } = restoreRequest({ ...c0, staging: { ...c0.staging, seam: { ...c0.staging.seam, time: seam } } });
const ans = JR.solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes });
console.log('ANSWER', ans.ok, ans.kind ?? '', ans.work, ans.ok ? ans.plan.solution.length : String(ans.message).slice(0, 200));
