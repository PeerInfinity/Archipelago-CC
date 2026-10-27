import { readFileSync } from 'node:fs';
const B = '/home/user/Archipelago-CC/';
const { restoreRequest } = await import(B + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(B + 'frontend/modules/seedlingDemo/atlasSource.js');
const { solveAnytime, ANYTIME_PASSES } = await import(B + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const [file, id, i, arm] = process.argv.slice(2);
for (const l of readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
  const r = JSON.parse(l); if (String(r.id) !== id) continue;
  const q = r.requests.find((x) => String(x.i) === i);
  const req = restoreRequest(q.request); const on = arm === 'B';
  req.contactFidelity = { ...(req.contactFidelity ?? {}), holdWaitPriced: on, chaserOrbitKill: on };
  const { passes = ANYTIME_PASSES, source, ...tape } = req;
  const a = solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes });
  console.log(a.ok ? 'SOLVED' : a.message);
}
