// scratch: replay a captured request (file, id, i) under arm A (its stamp with holdWaitPriced/chaserOrbitKill false) and arm B (true)
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const B = '/home/user/Archipelago-CC/';
const { restoreRequest } = await import(B + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(B + 'frontend/modules/seedlingDemo/atlasSource.js');
const { solveAnytime, ANYTIME_PASSES } = await import(B + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const [file, id, i, arms = 'A,B'] = process.argv.slice(2);
const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);
for (const l of readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
  const r = JSON.parse(l);
  if (String(r.id) !== id) continue;
  for (const q of r.requests.filter((x) => i === '*' || String(x.i) === i)) {
    for (const arm of arms.split(',')) {
      const req = restoreRequest(q.request);
      const on = arm === 'B';
      req.contactFidelity = { ...(req.contactFidelity ?? {}), holdWaitPriced: on, chaserOrbitKill: on };
      const { passes = ANYTIME_PASSES, source, ...tape } = req;
      const a = solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes });
      const text = a.ok ? JSON.stringify(a.plan.solution.map((k) => [...k])) : String(a.message ?? '');
      console.log(`id ${id} req ${q.i} arm ${arm} seam ${tape.staging?.seam?.time} ok ${a.ok} work ${a.work} answer ${sha(text)} ${a.ok ? `SOLVED ${a.plan.solution.length} ${JSON.stringify(a.plan.verbs)}` : text.slice(0, 220)}`);
    }
  }
}
