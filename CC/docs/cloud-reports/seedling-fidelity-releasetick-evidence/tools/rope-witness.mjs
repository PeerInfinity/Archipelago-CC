// The rope rock's player release step against the game: replay a game-witnessed fixture (`fixtures/rockbutton-witness/*.json`, tape + per-tick samples) through the model and print the model's player beside the game's around the cut. Usage: node tools/rope-witness.mjs <fixture.json> '<overrides json>' <from,to>
import { readFileSync } from 'node:fs';
const R = new URL('../../../../../frontend/modules/seedlingDemo/', import.meta.url).href;
const { withContactFidelity } = await import(R + 'contactFidelity.js');
const { parseTape } = await import(R + 'tapeFormat.js');
const { createTapeStepper } = await import(R + 'tapeRunner.js');
const { atlasLevelSource } = await import(R + 'levelSource.js');
const f = process.argv[2]; const over = JSON.parse(process.argv[3] ?? '{}');
const [a, b] = (process.argv[4] ?? '150,170').split(',').map(Number);
const raw = JSON.parse(readFileSync(f, 'utf8'));
const tape = parseTape(JSON.stringify(raw.tape));
const game = new Map((raw.samples ?? []).map((s) => [s.t, s]));
withContactFidelity(over, () => {
  let run = null; let t = 0; let maxd = 0;
  const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (tt, s, h, rn) => { run = rn; } });
  let r = st.next();
  while (!r.done) {
    t += 1;
    const g = game.get(t - 1);
    if (run && g) { const d = Math.hypot(run.state.x - g.x, run.state.y - g.y); if (t > 140) maxd = Math.max(maxd, d);
      if (t >= a && t <= b) console.log(t, 'model', run.state.x.toFixed(4), run.state.y.toFixed(4), 'game', g.x.toFixed(4), g.y.toFixed(4), d > 1e-6 ? 'Δ ' + d.toFixed(4) : ''); }
    r = st.next();
  }
  console.log('falls', JSON.stringify(run?.rockFalls?.map((x) => [x.t, x.id, x.deadFrames])), 'max Δ after t140', maxd.toFixed(4));
});
