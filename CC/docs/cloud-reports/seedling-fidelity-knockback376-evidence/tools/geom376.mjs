// scratch: what does collidesSolid return for the player box near the corner, at the run's state after N advances
import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC';
const { restoreRequest } = await import(R + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { atSeamTime } = await import(R + '/scripts/procgen/replay-seedling-solve-request.mjs');
const { levelSourceFromAtlas } = await import(R + '/frontend/modules/seedlingDemo/atlasSource.js');
const { createRunForStaging } = await import(R + '/frontend/modules/seedlingDemo/tapeRunner.js');
const { playerBoxAt } = await import(R + '/frontend/modules/seedlingDemo/playerPhysicsV2.js');
const [capFile, planFile, N] = process.argv.slice(2);
const plan = JSON.parse(readFileSync(planFile, 'utf8'));
const line = readFileSync(capFile, 'utf8').split('\n').filter(Boolean).map(JSON.parse).find((r) => r.id === 376);
const req = restoreRequest(atSeamTime(line.requests[0].request, plan.seam));
const run = createRunForStaging(req.staging, restoreRequest ? levelSourceFromAtlas(req.source.records) : null, {});
for (let i = 0; i < Number(N); i += 1) run.advance(new Set(plan.solution[i]));
const w = run.world;
for (const y of [131.174, 133.455]) { const c = w.collidesSolid(playerBoxAt(193.673, y), {}); console.log(y, JSON.stringify(c).slice(0,700)); }
console.log("broken", JSON.stringify(run.brokenRocks).slice(0,600)); console.log("rb", JSON.stringify(run.rocksBroken).slice(0,600));
process.exit(0);
for (const y of [] ) {
  const row = [];
  for (const x of [191, 192, 193, 193.673, 194.673]) {
    const c = w.collidesSolid(playerBoxAt(x, y), {});
    row.push(`${x}:${c ? (c.id ?? c.kind ?? c.type ?? JSON.stringify(c).slice(0, 60)) : '-'}`);
  }
  console.log('y', y, row.join(' | '));
}
