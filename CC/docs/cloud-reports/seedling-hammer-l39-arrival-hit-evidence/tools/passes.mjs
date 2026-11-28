// MEASUREMENT-ONLY: replay one captured request, print the pass rows. node passes.mjs <jsonl.gz> <id> <i> [budget]
import { readFileSync } from 'node:fs'; import { gunzipSync } from 'node:zlib';
const [file, id, i, budget] = process.argv.slice(2);
const ROOT = '/home/user/Archipelago-CC';
const raw = file.endsWith('.gz') ? gunzipSync(readFileSync(file)).toString() : readFileSync(file, 'utf8');
const row = raw.split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((r) => String(r.id) === id);
const req = row.requests[Number(i)];
if (budget) req.request.budgetWork = Number(budget);
if (process.env.SEAM_SHIFT) req.request.staging.seam.time += Number(process.env.SEAM_SHIFT);
const { levelSourceFromAtlas } = await import(`${ROOT}/frontend/modules/seedlingDemo/atlasSource.js`);
const { solveAnytime, ANYTIME_PASSES } = await import(`${ROOT}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
const { restoreRequest } = await import(`${ROOT}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { passes = ANYTIME_PASSES, source, ...tape } = restoreRequest(req.request);
console.log('retry', JSON.stringify(req.retry), 'window', tape.upgradeWindowWork, 'budget', tape.budgetWork, 'passes', passes.map(p=>p.pass));
const a = solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes });
console.log('ok', a.ok, a.kind, 'pass', a.pass, 'work', a.work, 'ticks', a.plan?.solution.length, JSON.stringify(a.plan?.modelHits));
for (const r of a.passes) console.log('  ', JSON.stringify(r));
