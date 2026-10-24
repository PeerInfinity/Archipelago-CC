// usage: node dumpplan.mjs <repoRoot> <leg.jsonl> <i> <out.json>
import { readFileSync, writeFileSync } from 'node:fs';
const [root, file, iStr, out] = process.argv.slice(2);
const { restoreRequest } = await import(`${root}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { levelSourceFromAtlas } = await import(`${root}/frontend/modules/seedlingDemo/atlasSource.js`);
const { solveAnytime, ANYTIME_PASSES } = await import(`${root}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
const line = JSON.parse(readFileSync(file, 'utf8').split('\n')[0]);
const cap = line.requests.find((q) => q.i === Number(iStr));
const req = restoreRequest(cap.request);
const { passes = ANYTIME_PASSES, source, ...tape } = req;
const levelSource = levelSourceFromAtlas(source.records);
const answer = solveAnytime({ ...tape, source, levelSource }, { passes });
const plan = answer.plan;
console.log('ok', answer.ok, 'keys', Object.keys(plan ?? {}));
const sol = plan.solution.map((k) => [...k]);
sol.forEach((k, t) => { if (t >= 80 && t <= 112) console.log(t, k.join(',')); });
writeFileSync(out, JSON.stringify({ solution: sol, planKeys: Object.keys(plan), staging: Object.keys(tape) }, null, 0));
