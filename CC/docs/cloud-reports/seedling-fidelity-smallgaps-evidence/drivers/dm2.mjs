import { readFileSync } from 'node:fs';
const M = process.cwd() + '/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createTapeStepper } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { hazardDanger, axeVisitClock } = await import(M + 'dangerMap.js');
const { playerBoxAt } = await import(M + 'playerPhysicsV2.js');
const g = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const tape = parseTape(JSON.stringify(g.tape));
let run = null; const obs = [];
const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
let r = st.next(); let at0 = null;
while (!r.done) { const o = r.value.observation; obs[o.t] = o; if (o.t === Number(process.argv[3] ?? 1) && !at0) { at0 = true;
  console.log('asking at ticksCompleted', run.ticksCompleted, 'gameTime', run.gameTime, 'clock', JSON.stringify(axeVisitClock(run)));
  for (const T of (process.env.TICKS||'').split(',').map(Number)) {
    // the plan's position: from the game record
    const p = g.rows[T - 1]; const box = playerBoxAt(p.x, p.y);
    const hits = hazardDanger(run, box, T, 'transit');
    console.log('tick', T, 'pre-move obs', T - 1, p.x.toFixed(2), p.y.toFixed(2), '->', hits.map((h) => h.id + ' ' + (h.phase ? JSON.stringify(h.phase) : h.why.slice(0, 100))).join(' | ') || 'clear');
  }
} r = st.next(); }
