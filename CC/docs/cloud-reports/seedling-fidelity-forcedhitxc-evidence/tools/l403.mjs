import { readFileSync } from 'node:fs'; import { gunzipSync } from 'node:zlib';
const R='../../../../../'; const D=R+'frontend/modules/seedlingDemo/';
const { withContactFidelity } = await import(D+'contactFidelity.js');
const { levelSourceFromAtlas } = await import(D+'atlasSource.js');
const { ANYTIME_PASSES, solveAnytime } = await import(D+'jsRuntimeSolver.js');
const { LAPSE_NARROW_RETRY } = await import(D+'solverBot.js');
const { FORCED_HIT_TRACE } = await import(D+'forcedHit.js');
const { restoreRequest } = await import(R+'scripts/procgen/seedlingSolveRequestCodec.js');
const line = JSON.parse(gunzipSync(readFileSync(R+'CC/docs/cloud-reports/seedling-fidelity-lapsecost-evidence/d1/leg-403-requests.jsonl.gz')).toString().split('\n')[0]);
const req = restoreRequest(line.requests[0].request);
const solve = (r, over={}) => { const { passes = ANYTIME_PASSES, source, ...tape } = r; return solveAnytime({ ...tape, ...over, source, levelSource: levelSourceFromAtlas(source.records) }, { passes }); };
const budget = Number(process.argv[2] ?? 160); const narrow = process.argv[3] !== 'narrow-on';
for (const su of [false, true]) {
  const rows=[]; FORCED_HIT_TRACE.sink = (r)=>rows.push(r);
  LAPSE_NARROW_RETRY.enabled = !narrow ? true : false;
  const on = withContactFidelity({ strikeIframeLapse: true, secondaryUse: su }, () => solve(req, budget ? { budgetWork: budget } : {}));
  LAPSE_NARROW_RETRY.enabled = true; FORCED_HIT_TRACE.sink=null;
  console.log(`secondaryUse=${su} budget=${budget} ok=${on.ok} work=${on.work} len=${on.plan?.solution?.length} verbs=${JSON.stringify(on.plan?.verbs)}`);
  console.log(' passes', JSON.stringify(on.passes?.map(p=>({pass:p.pass,ok:p.ok,deadline:p.deadline,limit:p.limit,work:p.work}))));
  for (const r of rows) console.log(' fh', r.outcome, JSON.stringify(r.at), r.proof?.nodes, (r.keys||[]).map(k=>k.join('+')||'·').join(' '), (r.why||'').slice(0,200));
}
