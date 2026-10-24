import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape, heldKeysAt } = await import(R + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await import(R + 'tapeRunner.js');
const { atlasLevelSource } = await import(R + 'levelSource.js');
const tape = parseTape(readFileSync(process.argv[2], 'utf8'));
const [lo, hi] = process.argv[3].split('-').map(Number);
const run = createRunForStaging(stagingFromTape(tape), atlasLevelSource());
for (let t = 0; t < Math.min(hi, tape.tick_count); t += 1) {
  run.advance(new Set(heldKeysAt(tape, t)));
  const T = run.ticksCompleted; if (T < lo) continue;
  const b = run.entities('chasers').find((c) => c.id === 'bob@736,752');
  const sp = (run.entities('spinnerBodies') ?? []).map((s) => `${s.id}(${s.x.toFixed(1)},${s.y.toFixed(1)})`).filter((s) => { const m = /\(([-\d.]+),([-\d.]+)\)/.exec(s); return Math.abs(m[1] - b.x) < 20 && Math.abs(m[2] - b.y) < 20; });
  console.log(T, [...heldKeysAt(tape, t)].join('+'), 'P', run.state.x.toFixed(3), run.state.y.toFixed(3), 'bob', b.x.toFixed(3), b.y.toFixed(3), b.hitsTimer, sp.join(' '));
}
