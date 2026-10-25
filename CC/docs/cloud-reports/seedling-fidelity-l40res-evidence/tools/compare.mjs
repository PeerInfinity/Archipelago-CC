// scratch (L40RES D1): model vs game per tick — player, bombs, spinners; prints first divergences + window
import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { stagingFromTape, createRunForStaging } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const [tapeFile, gameFile, w0, w1, which = 'last'] = process.argv.slice(2);
const tape = parseTape(readFileSync(tapeFile, 'utf8'));
const game = JSON.parse(readFileSync(gameFile, 'utf8'));
const G = new Map(game.frames.map((f) => [f.t, (which === 'first' ? f.first : (f.last ?? f.first))]));
const run = createRunForStaging(stagingFromTape(tape), atlasLevelSource());
const ticks = JSON.parse(readFileSync(process.env.PLAN, 'utf8')).solution;
let firstDiv = null; let hitsSeen = 0;
const lo = +w0, hi = +w1;
for (let t = 0; t <= ticks.length; t++) {
  const g = G.get(t);
  const ph = run.ledger('playerHits') ?? [];
  if (ph.length !== hitsSeen) { console.log('MODEL HIT at t', t, JSON.stringify(ph.at(-1)).slice(0, 300)); hitsSeen = ph.length; }
  if (g) {
    const dx = run.state.x - g.status.x, dy = run.state.y - g.status.y;
    if (firstDiv === null && Math.hypot(dx, dy) > 1e-6) { firstDiv = t; console.log('FIRST PLAYER DIVERGENCE t', t, 'model', run.state.x, run.state.y, 'game', g.status.x, g.status.y); }
    if (t >= lo && t <= hi) {
      console.log(`t${t} P model (${run.state.x.toFixed(3)},${run.state.y.toFixed(3)}) game (${g.status.x.toFixed(3)},${g.status.y.toFixed(3)}) hits ${g.status.hits} ht ${g.status.hits_timer}`);
      const gb = g.mobiles.filter((m) => /Bomb$|Spinner$|BombPusher$/.test(m.cls) && Math.hypot(m.x - g.status.x, m.y - g.status.y) < 90);
      for (const m of gb) console.log(`     G ${m.cls.split('::')[1]} (${m.x.toFixed(3)},${m.y.toFixed(3)}) v(${(m.vx??0).toFixed(3)},${(m.vy??0).toFixed(3)}) ${m.anim ?? ''} f${m.f ?? ''}`);
      for (const b of (run.entities('bombs') ?? [])) console.log(`     M bomb ${JSON.stringify(b).slice(0, 200)}`);
      const sb = run.entities('spinnerBodies');
      for (const s of (sb?.values ? [...sb.values()] : (sb ?? []))) { if (s && s.x !== undefined && Math.hypot(s.x - run.state.x, s.y - run.state.y) < 90) console.log(`     M spinner ${JSON.stringify(s).slice(0, 220)}`); }
    }
  }
  if (t === ticks.length) break;
  run.advance(new Set(ticks[t]));
}
