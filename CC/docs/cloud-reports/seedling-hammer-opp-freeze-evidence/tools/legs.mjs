// node legs.mjs <root> <fixture.json.gz>  — one captured sweep request, solved as the worker does (env switches apply).
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const [root, file] = process.argv.slice(2);
const D = `${root}/frontend/modules/seedlingDemo/`;
const { levelSourceFromAtlas } = await import(D + 'atlasSource.js');
const { ANYTIME_PASSES, solveAnytime } = await import(D + 'jsRuntimeSolver.js');
const PKC = await import(D + 'pressKillCost.js');
const { restoreRequest } = await import(`${root}/scripts/procgen/seedlingSolveRequestCodec.js`);
const row = JSON.parse(gunzipSync(readFileSync(file)).toString('utf8'));
const r0 = row.requests ? row.requests[0] : row;
const req = restoreRequest(r0.request);
const { passes = r0.passes ?? ANYTIME_PASSES, source, ...tape } = req;
const t0 = performance.now();
let answer;
try { answer = solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes }); }
catch (e) { answer = { ok: false, message: `THREW ${e.code ?? ''} ${e.message}` }; }
console.log(JSON.stringify({ file: file.split('/fixtures/')[1], id: row.id, opp: PKC.OPPORTUNISTIC_STRIKE.enabled,
  oppCounts: { ...PKC.OPPORTUNISTIC_STRIKE_COUNTS }, ok: answer.ok, ticks: answer.plan?.solution?.length ?? null,
  work: answer.work ?? null, msg: (answer.message ?? '').slice(0, 400), ms: Math.round(performance.now() - t0) }));
