// scratch: step the plan and print when each rock is recorded hit / gone, plus the slash state
import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC';
const { restoreRequest } = await import(R + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { atSeamTime } = await import(R + '/scripts/procgen/replay-seedling-solve-request.mjs');
const { levelSourceFromAtlas } = await import(R + '/frontend/modules/seedlingDemo/atlasSource.js');
const { createRunForStaging } = await import(R + '/frontend/modules/seedlingDemo/tapeRunner.js');
const [capFile, planFile] = process.argv.slice(2);
const plan = JSON.parse(readFileSync(planFile, 'utf8'));
const line = readFileSync(capFile, 'utf8').split('\n').filter(Boolean).map(JSON.parse).find((r) => r.id === 376);
const req = restoreRequest(atSeamTime(line.requests[0].request, plan.seam));
const run = createRunForStaging(req.staging, levelSourceFromAtlas(req.source.records), {});
const prim = [];
for (let i = 0; i < 1262; i += 1) {
  if (plan.solution[i].includes('primary')) prim.push(i);
  const before = run.rocksBroken.length;
  run.advance(new Set(plan.solution[i]));
  if (i >= 1244 && i <= 1258) {
    const s = run.state;
    console.log('adv', i, 'row', i + 1, 'pos', s.x.toFixed(3), s.y.toFixed(3), 'newRocks', JSON.stringify(run.rocksBroken.slice(before).map((r) => [r.id, r.hitTick, r.goneAt])),
      'slash', JSON.stringify(run.slash ?? run.slashState ?? null)?.slice(0, 200));
  }
}
console.log('primary presses near', prim.filter((p) => p > 1200));
console.log(Object.keys(run).filter((k) => /slash|press|swing/i.test(k)).join(' '));
