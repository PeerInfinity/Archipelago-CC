import { readFileSync } from 'node:fs';
const M = process.cwd() + '/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createTapeStepper } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { hazardDanger } = await import(M + 'dangerMap.js');
const { playerBoxAt } = await import(M + 'playerPhysicsV2.js');
for (const f of process.argv.slice(2)) {
  const t = JSON.parse(readFileSync(f, 'utf8'));
  let run = null;
  const st = createTapeStepper(parseTape(JSON.stringify(t)), { levelSource: atlasLevelSource(), onTick: (a, b, c, rn) => { run = rn; } });
  let r = st.next(); while (!r.done && r.value.observation.t < 388) r = st.next();
  const d = hazardDanger(run, playerBoxAt(run.state.x, run.state.y), 389, 'transit');
  console.log(t.seam.time, 'at', run.ticksCompleted, run.state.x.toFixed(2), run.state.y.toFixed(2), JSON.stringify(d.map((x) => [x.id, (x.why || '').slice(0, 90)])));
}
