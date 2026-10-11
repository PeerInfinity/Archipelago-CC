import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const D = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo';
const { parseTape } = await import(join(D, 'tapeFormat.js'));
const { createTapeStepper } = await import(join(D, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(D, 'levelSource.js'));
const tape = parseTape(readFileSync(process.argv[2], 'utf8'));
const game = JSON.parse(readFileSync(process.argv[3], 'utf8'));
const g = new Map(); for (const f of game) { if (!g.has(f.t)) g.set(f.t, []); g.get(f.t).push(f); }
let run = null; let n = 0; let first = null; const tag = process.argv[4];
const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
let r = st.next();
while (!r.done) {
  const o = r.value.observation;
  const gs = g.get(o.t) ?? [];
  const ok = gs.some((f) => f.level === run.level && Math.abs(f.px - o.x) < 1e-9 && Math.abs(f.py - o.y) < 1e-9);
  if (gs.length) n++;
  if (gs.length && !ok && first === null) { first = o.t; console.log('FIRST player diff t', o.t, 'model', o.x, o.y, run.level, 'game', gs.map((f) => [f.level, f.px, f.py])); }
  if (first !== null && o.t <= first + 3) console.log(o.t, o.x, o.y, gs.map((f) => [f.px, f.py]).slice(0, 2), tag ? JSON.stringify((run.entities('chasers') ?? []).filter((c) => c.tag === tag).map((c) => [c.x, c.y, c.vx, c.vy, c.hits, c.hitsTimer])) : '');
  r = st.next();
}
console.log('compared', n, 'first', first);
