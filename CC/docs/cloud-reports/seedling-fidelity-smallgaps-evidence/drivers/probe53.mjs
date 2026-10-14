import { readFileSync } from 'node:fs';
const M = process.cwd() + '/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createTapeStepper } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { dangerDuringTransit } = await import(M + 'dangerMap.js');
const { previewWalk, strikePolicyFor } = await import(M + 'solverBot.js');
const { playerBoxAt } = await import(M + 'playerPhysicsV2.js');
const g = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const trace = JSON.parse(readFileSync(process.argv[3], 'utf8'));
const row = trace.find((r) => r.tick === 53);
let run = null;
const st = createTapeStepper(parseTape(JSON.stringify(g.tape)), { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
let r = st.next();
while (!r.done && r.value.observation.t < 53) r = st.next();
console.log('at', run.ticksCompleted, run.state.x, run.state.y);
const pv = previewWalk(run, row.path, 1, { strike: strikePolicyFor(run) });
console.log('preview samples', pv.samples.length, 'truncated', pv.truncated?.kind ?? null);
const first = pv.samples.find((s) => g.rows[s.tick - 1] && (Math.abs(g.rows[s.tick - 1].x - s.x) > 1e-9 || Math.abs(g.rows[s.tick - 1].y - s.y) > 1e-9)); console.log("first part", first && first.tick, first && [first.x, first.y, g.rows[first.tick - 1].x, g.rows[first.tick - 1].y], "held", first && [...(first.held ?? [])]);
for (const s of pv.samples) {
  const d = dangerDuringTransit(run, s.tick, playerBoxAt(s.x, s.y), s.arrows, s.chasers, s.spits ?? null, s.grenades ?? null);
  if (s.tick >= 118 && s.tick <= 126 || d.danger) console.log('tick', s.tick, s.x.toFixed(2), s.y.toFixed(2), d.danger ? 'DANGER ' + JSON.stringify(d.sources ?? d).slice(0, 200) : 'clear', 'game', g.rows[s.tick - 1] ? g.rows[s.tick - 1].x.toFixed(2) + ',' + g.rows[s.tick - 1].y.toFixed(2) : '');
}
