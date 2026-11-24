// scratch: replay one captured request in this process, print the whole answer message
import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC';
const [file, idi, at] = process.argv.slice(2);
const [id, i] = idi.split(':').map(Number);
const { restoreRequest } = await import(`${R}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { atSeamTime } = await import(`${R}/scripts/procgen/replay-seedling-solve-request.mjs`);
const { levelSourceFromAtlas } = await import(`${R}/frontend/modules/seedlingDemo/atlasSource.js`);
const { solveAnytime, ANYTIME_PASSES } = await import(`${R}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
const sb = await import(`${R}/frontend/modules/seedlingDemo/solverBot.js`);
let c = null;
for (const l of readFileSync(file, 'utf8').split('\n')) { if (!l) continue; const j = JSON.parse(l); if (j.id === id) { c = j.requests.find((r) => r.i === i); break; } }
const req = restoreRequest(at && at !== "-" ? atSeamTime(c.request, Number(at)) : c.request);
if (process.argv[5]) req.budgetWork = Number(process.argv[5]);
const { passes = ANYTIME_PASSES, source, ...tape } = req;
const levelSource = levelSourceFromAtlas(source.records);
const t0 = Date.now();
const a = solveAnytime({ ...tape, source, levelSource }, { passes });
console.log(JSON.stringify({ ok: a.ok, kind: a.kind, work: a.work, ms: Date.now() - t0, passes: (a.passes ?? []).map(({ ms, ...p }) => p),
  ticks: a.ok ? a.plan.solution.length : null, modelHits: a.ok ? a.plan.modelHits ?? null : null, meter: { ...sb.PREVIEW_METER_COUNTS } }));
console.log(a.ok ? 'PLAN' : a.message);
