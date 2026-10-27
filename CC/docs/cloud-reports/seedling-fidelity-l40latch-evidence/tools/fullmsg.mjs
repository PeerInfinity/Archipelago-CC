// scratch: replay one captured request (id, i) and print the FULL refusal message (and the plan's records when solved)
import { readFileSync } from 'node:fs';
const B = '/home/user/Archipelago-CC/';
const { restoreRequest } = await import(B + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(B + 'frontend/modules/seedlingDemo/atlasSource.js');
const { solveAnytime, ANYTIME_PASSES } = await import(B + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const [file, id, i, seamShift = '0'] = process.argv.slice(2);
for (const l of readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
  const r = JSON.parse(l);
  if (String(r.id) !== id) continue;
  const q = r.requests.find((x) => String(x.i) === i);
  const req = restoreRequest(q.request);
  const { passes = ANYTIME_PASSES, source, ...tape } = req;
  if (Number(seamShift)) tape.staging = { ...tape.staging, seam: { ...tape.staging.seam, time: tape.staging.seam.time + Number(seamShift) } };
  const a = solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes });
  console.log('ok', a.ok, 'seam', tape.staging?.seam?.time, 'work', a.work);
  console.log(a.ok ? `SOLVED ${a.plan.solution.length} verbs ${JSON.stringify(a.plan.verbs)}` : a.message);
}
