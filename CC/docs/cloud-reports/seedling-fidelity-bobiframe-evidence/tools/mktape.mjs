// scratch: solve a captured request (optionally at --seam), write the plan as a staged tape (--out). Measure only.
import { readFileSync, writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const ROOT = '/home/user/Archipelago-CC';
const { restoreRequest } = await import(ROOT + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(ROOT + '/frontend/modules/seedlingDemo/atlasSource.js');
const JR = await import(ROOT + '/frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const TR = await import(ROOT + '/frontend/modules/seedlingDemo/botDriverV1.js');
let req;
for (const line of readFileSync(args.requests, 'utf8').trim().split('\n')) {
  const row = JSON.parse(line); if (String(row.id) !== args.id) continue;
  const c0 = row.requests.find((c) => String(c.i) === args.i).request;
  req = restoreRequest(args.seam ? { ...c0, staging: { ...c0.staging, seam: { ...c0.staging.seam, time: Number(args.seam) } } } : c0);
}
const { passes: P0 = JR.ANYTIME_PASSES, source, ...tape } = req;
const ans = JR.solveAnytime({ ...tape, levelSource: levelSourceFromAtlas(source.records) }, { passes: P0 });
console.log('answer', ans.ok, ans.ok ? ans.plan.verbs : ans.message?.slice(0, 300), JSON.stringify(ans.passes));
if (!ans.ok) process.exit(1);
const plan = ans.plan;
console.log('plan keys', Object.keys(plan), 'equipsAt', plan.equipsAt?.size, 'len', plan.solution.length);
const perTick = plan.solution.map((k) => [...k]);
writeFileSync(args.out + '.plan.json', JSON.stringify({ perTick, verbs: plan.verbs, keys: Object.keys(plan), equipsAt: plan.equipsAt ? [...plan.equipsAt] : null, persistence: plan.persistence ?? null, staging: tape.staging }));
const built = TR.buildStagedTape({ staging: { ...tape.staging, equips: [...(tape.staging.equips ?? [])] }, perTick, name: args.name ?? 'bobiframe' });
writeFileSync(args.out, JSON.stringify({ ...built, noDamage: false, description: 'scratch' }, null, 1) + '\n');
console.log('wrote', args.out, Object.keys(built));
