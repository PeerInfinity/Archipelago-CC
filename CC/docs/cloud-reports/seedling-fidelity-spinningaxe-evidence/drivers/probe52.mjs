// From a game record (game.mjs output) + a decision trace: rebuild the walk row's preview at its tick, compare it
// with the drive (the game rows) and ask the danger map at each sample.  node probe52.mjs <game.json> <trace.json> <tick>
import { readFileSync } from 'node:fs';
const M = process.cwd() + '/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createTapeStepper } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { dangerDuringTransit } = await import(M + 'dangerMap.js');
const sb = await import(M + 'solverBot.js');
const { playerBoxAt } = await import(M + 'playerPhysicsV2.js');
const g = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const trace = JSON.parse(readFileSync(process.argv[3], 'utf8'));
const T = Number(process.argv[4]);
const row = trace.find((r) => r.tick === T);
let run = null;
const st = createTapeStepper(parseTape(JSON.stringify(g.tape)), { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
let r = st.next();
while (!r.done && r.value.observation.t < T) r = st.next();
console.log('at', run.ticksCompleted, run.state.x, run.state.y, 'path', JSON.stringify(row.path));
const pv = sb.previewWalk(run, row.path, 1, { strike: sb.strikePolicyFor ? sb.strikePolicyFor(run) : undefined });
console.log('preview samples', pv.samples.length, 'truncated', pv.truncated?.kind ?? null, 'first tick', pv.samples[0]?.tick);
const G = new Map(g.rows.map((x) => [x.t, x]));
let shown = 0;
for (const s of pv.samples) {
  const gr = G.get(s.tick - 1); // a sample carries the PRE-move position of frame s.tick
  const part = gr && (Math.abs(gr.x - s.x) > 1e-9 || Math.abs(gr.y - s.y) > 1e-9);
  const d = dangerDuringTransit(run, s.tick, playerBoxAt(s.x, s.y), s.arrows, s.chasers, s.spits ?? null, s.grenades ?? null);
  if ((part && shown++ < 3) || d.danger || (s.tick >= 155 && s.tick <= 162)) console.log('tick', s.tick, s.x.toFixed(2), s.y.toFixed(2), part ? 'PART' : 'same', d.danger ? 'DANGER ' + JSON.stringify(d.sources ?? d).slice(0, 160) : 'clear', 'game(t-1)', gr ? gr.x.toFixed(2) + ',' + gr.y.toFixed(2) : '');
}
