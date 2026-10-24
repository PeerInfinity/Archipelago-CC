// MISCRES D2: per-site work census of a captured solve request (counting progress hook). Usage: node sites.mjs <cap.jsonl> <i> [nobudget] [passes=dashless,full]
import { readFileSync } from 'node:fs';
const R = new URL('../../../../../', import.meta.url).pathname;
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(R + 'frontend/modules/seedlingDemo/atlasSource.js');
const { solveAnytime, ANYTIME_PASSES } = await import(R + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const { withSolveProgress } = await import(R + 'frontend/modules/seedlingDemo/solveProgress.js');
const [file, iArg, mode = '', passArg = ''] = process.argv.slice(2);
const c = JSON.parse(readFileSync(file, 'utf8').trim().split('\n')[0]);
const q = c.requests.find((r) => r.i === Number(iArg));
const { atSeamTime } = await import(R + 'scripts/procgen/replay-seedling-solve-request.mjs');
const AT = process.argv.find((a) => a.startsWith('--at='))?.slice(5);
const req = restoreRequest(AT ? atSeamTime(q.request, Number(AT)) : q.request);
let { passes = ANYTIME_PASSES, source, ...tape } = req;
if (mode === 'nobudget') delete tape.budgetWork;
if (mode === 'huge') tape.budgetWork = 1e9;
console.log('seam', tape.staging?.seam?.time);
if (passArg) passes = passes.filter((p) => passArg.split(',').includes(p.pass));
const levelSource = levelSourceFromAtlas(source.records);
const counts = new Map();
let n = 0;
const seq = [];
const t0 = Date.now();
const answer = withSolveProgress((site) => { n += 1; counts.set(site, (counts.get(site) ?? 0) + 1); if (seq.length < 400000) seq.push(site); },
  () => solveAnytime({ ...tape, source, levelSource }, { passes, onPass: (one) => { console.log('PASS', one.pass ?? '', JSON.stringify({ ok: one.ok, kind: one.kind, work: one.work, deadline: one.deadline, ticks: one.plan?.ticks })); } }));
console.log('budget', tape.budgetWork ?? 'none', 'ms', Date.now() - t0, 'points', n, 'ok', answer.ok, 'kind', answer.kind, 'work', answer.work);
console.log('passes', JSON.stringify((answer.passes ?? []).map(({ ms, ...r }) => r)));
console.log('sites', JSON.stringify([...counts].sort((a, b) => b[1] - a[1])));
if (!answer.ok) console.log('message', String(answer.message).slice(0, 6000));
else console.log('plan ticks', answer.plan?.ticks, 'verbs', JSON.stringify(answer.plan?.verbs ?? null));
// run-length of the site sequence (first 60 runs)
const runs = []; for (const s of seq) { if (runs.length && runs.at(-1)[0] === s) runs.at(-1)[1]++; else runs.push([s, 1]); }
console.log('runs', runs.length, JSON.stringify(runs.slice(0, 80)));
