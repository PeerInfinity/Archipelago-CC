// scratch (L40RES D1): first tick each model spinner has no bit-exact game spinner
import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape, heldKeysAt } = await import(M + 'tapeFormat.js');
const { stagingFromTape, createRunForStaging } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const [tapeFile, gameFile, which = 'last'] = process.argv.slice(2);
const tape = parseTape(readFileSync(tapeFile, 'utf8'));
const game = JSON.parse(readFileSync(gameFile, 'utf8'));
const G = new Map(game.frames.map((f) => [f.t, (which === 'first' ? f.first : (f.last ?? f.first))]));
const run = createRunForStaging(stagingFromTape(tape), atlasLevelSource());
const bad = new Map();
for (let t = 0; t <= 1600; t++) {
  const g = G.get(t);
  if (g) {
    const gs = g.mobiles.filter((m) => /Spinner$/.test(m.cls));
    for (const s of run.entities('spinnerBodies') ?? []) {
      if (bad.has(s.id)) continue;
      const ok = gs.some((m) => Math.abs(m.x - s.x) < 1e-6 && Math.abs(m.y - s.y) < 1e-6);
      if (!ok) {
        const near = gs.map((m) => [Math.hypot(m.x - s.x, m.y - s.y), m]).sort((a, b) => a[0] - b[0])[0];
        bad.set(s.id, t);
        console.log('DIV', s.id, 't', t, 'model', s.x.toFixed(3), s.y.toFixed(3), 'v', JSON.stringify(s.v ?? [s.vx, s.vy]), 'hits', s.hits, '| nearest game', near?.[1].x.toFixed(3), near?.[1].y.toFixed(3), 'v', near?.[1].vx?.toFixed(3), near?.[1].vy?.toFixed(3), 'd', near?.[0].toFixed(2), 'onscreen', near?.[1].on_screen, 'player', run.state.x.toFixed(1), run.state.y.toFixed(1));
      }
    }
    if (t % 200 === 0) console.log('t', t, 'model spinners', (run.entities('spinnerBodies') ?? []).length, 'game', gs.length);
  }
  if (t === 1600) break;
  run.advance(heldKeysAt(tape, t));
}
