// solve2tape.mjs --requests=<jsonl> --id=N [--i=0] [--seam=<time>] --out=<tape.json> : replay a captured request, write the plan as a staged tape
import { readFileSync, writeFileSync } from 'node:fs';
const REPO = '/home/user/Archipelago-CC';
const arg = (k, d = null) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const { restoreRequest } = await import(`${REPO}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { levelSourceFromAtlas } = await import(`${REPO}/frontend/modules/seedlingDemo/atlasSource.js`);
const { solveAnytime, ANYTIME_PASSES } = await import(`${REPO}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
const { buildStagedTape } = await import(`${REPO}/frontend/modules/seedlingDemo/botDriverV1.js`);
const id = Number(arg('id')); const i = Number(arg('i', '0'));
const line = readFileSync(arg('requests'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((r) => r.id === id);
const cap = line.requests.find((r) => r.i === i);
let captured = cap.request;
if (arg('seam') !== null) captured = { ...captured, staging: { ...captured.staging, seam: { ...captured.staging.seam, time: Number(arg('seam')) } } };
const req = restoreRequest(captured);
const { passes = ANYTIME_PASSES, source, ...tape } = req;
const levelSource = levelSourceFromAtlas(source.records);
const t0 = Date.now();
const answer = solveAnytime({ ...tape, source, levelSource }, { passes: cap.passes ?? passes });
console.log('ok', answer.ok, 'kind', answer.kind, 'ms', Date.now() - t0, 'ticks', answer.plan?.solution?.length, answer.ok ? '' : String(answer.message).slice(0, 300));
if (answer.ok) {
  const t = buildStagedTape({ staging: req.staging, perTick: answer.plan.solution, name: `leg${id}` });
  writeFileSync(arg('out'), JSON.stringify(t));
  console.log('wrote', arg('out'), 'seam.time', req.staging.seam.time, 'boot', JSON.stringify(req.staging.boot));
}
process.exit(0);
