import { readFileSync } from 'node:fs';
import { parseTape } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/tapeFormat.js';
import { createTapeStepper } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/tapeRunner.js';
import { atlasLevelSource } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/levelSource.js';
import { playerBoxAt } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/playerPhysicsV2.js';
import { dangerAt } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/dangerMap.js';
import { swordTickAt } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/solverBot.js';
const [p, ...ts] = process.argv.slice(2);
let run = null;
const st = createTapeStepper(parseTape(readFileSync(p, 'utf8')), { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
for (let r = st.next(); !r.done; r = st.next()) {
  const t = r.value.observation.t;
  if (!run || !ts.includes(String(t))) continue;
  const box = playerBoxAt(run.state.x, run.state.y);
  const pad = dangerAt(run, run.ticksCompleted, box);
  const tick = swordTickAt(run, run.state.x, run.state.y);
  const timed = dangerAt(run, run.ticksCompleted, box, { swordTick: tick });
  const wait = dangerAt(run, run.ticksCompleted + 5, box, { swordTick: tick });
  const b = (run.entities('chasers') ?? []).find((c) => c.id === 'bobsoldier@48,80');
  console.log(t, 'tc', run.ticksCompleted, `p(${run.state.x.toFixed(2)},${run.state.y.toFixed(2)})`, b ? `b(${b.x.toFixed(2)},${b.y.toFixed(2)}) h${b.hits} ht${b.hitsTimer} ${b.destroy ? 'DEAD' : ''}` : 'gone', 'pad', pad.danger, pad.sources.map((s) => s.why).join('|').slice(0, 140), '| timed', timed.danger, timed.sources.map((s) => s.why).join('|').slice(0, 100), '| wait+5', wait.danger, 'torch', !!run.inventory.hasTorch);
}
