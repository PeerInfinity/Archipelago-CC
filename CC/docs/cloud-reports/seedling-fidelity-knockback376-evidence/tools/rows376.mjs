// scratch: replay a saved plan into a fresh run, print model rows on a tick window
import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC';
const { restoreRequest } = await import(R + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { atSeamTime } = await import(R + '/scripts/procgen/replay-seedling-solve-request.mjs');
const { levelSourceFromAtlas } = await import(R + '/frontend/modules/seedlingDemo/atlasSource.js');
const { createRunForStaging } = await import(R + '/frontend/modules/seedlingDemo/tapeRunner.js');
const [capFile, planFile, from, to] = process.argv.slice(2);
const plan = JSON.parse(readFileSync(planFile, 'utf8'));
const line = readFileSync(capFile, 'utf8').split('\n').filter(Boolean).map(JSON.parse).find((r) => r.id === 376);
const req = restoreRequest(atSeamTime(line.requests[0].request, plan.seam));
const levelSource = levelSourceFromAtlas(req.source.records);
const run = createRunForStaging(req.staging, levelSource, {});
const f = (n) => (typeof n === 'number' ? n.toFixed(3) : n);
for (let i = 0; i < plan.solution.length; i += 1) {
  if (i >= Number(from) && i <= Number(to)) {
    const s = run.state; const d = run.damage;
    const sp = run.spinnerBodies.filter((b) => /192,160/.test(b.id ?? ''));
    console.log(i, 'keys', JSON.stringify(plan.solution[i]), 'pre x', f(s.x), 'y', f(s.y), 'v', f(s.v?.x ?? s.vx), f(s.v?.y ?? s.vy), 'hT', d.hitsTimer, 'hits', d.hits, 'dir', s.direction,
      'sp', JSON.stringify(sp.map((b) => ({ x: b.x, y: b.y, v: b.v, st: b.state ?? b.phase, h: b.hitsTimer }))).slice(0, 200));
  }
  run.advance(new Set(plan.solution[i]));
}
console.log('stateKeys', Object.keys(run.state));
console.log('hits', JSON.stringify(run.playerHits).slice(0, 800));
