import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape, heldKeysAt } = await import(R + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await import(R + 'tapeRunner.js');
const { atlasLevelSource } = await import(R + 'levelSource.js');
const { CONTACT_FIDELITY } = await import(R + 'contactFidelity.js');
const tape = parseTape(readFileSync(process.argv[2], 'utf8'));
const FROM = Number(process.argv[3] ?? 1790); const N = Number(process.argv[4] ?? 40);
const run = createRunForStaging(stagingFromTape(tape), atlasLevelSource());
const keys = (t) => new Set(heldKeysAt(tape, t));
for (let t = 0; t < FROM; t += 1) run.advance(keys(t));
const f = run.chaserForecast();
let worst = 0; let first = null;
for (let k = 0; k < N; k += 1) {
  const p = { x: run.state.x, y: run.state.y, vx: run.state.vx, vy: run.state.vy, direction: run.state.direction };
  const proj = f.step(p, { slashing: false });
  run.advance(keys(FROM + k));
  const live = new Map(run.entities('chasers').map((c) => [c.id, c]));
  for (const b of proj) { if (!b.id.startsWith('bob@736')) continue; const c = live.get(b.id);
    const d = Math.max(Math.abs(c.x - b.x), Math.abs(c.y - b.y)); if (d > worst) worst = d; if (d > 1e-9 && !first) first = { t: run.ticksCompleted, id: b.id, f: [b.x, b.y], live: [c.x, c.y] }; }
}
console.log(JSON.stringify({ on: CONTACT_FIDELITY.chaserSpinnerWalls, from: FROM, n: N, worst, first, at: run.ticksCompleted }));
