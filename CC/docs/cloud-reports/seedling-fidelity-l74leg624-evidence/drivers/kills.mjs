import { readFileSync } from 'node:fs';
const M = (p) => import(`/home/user/Archipelago-CC/frontend/modules/seedlingDemo/${p}`);
const { parseTape } = await M('tapeFormat.js');
const { createTapeStepper } = await M('tapeRunner.js');
const { atlasLevelSource } = await M('levelSource.js');
const tape = parseTape(readFileSync(process.argv[2], 'utf8'));
let run = null; const timers = {};
const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
let r = st.next();
while (!r.done) { const t = r.value.observation.t; for (const c of (run?.entities('chasers') ?? [])) (timers[c.id] ??= {})[t] = [c.hits, c.hitsTimer]; r = st.next(); }
for (const p of run.ledger('presses')) {
  const landed = p.hits.filter((h) => h.landed);
  if (!landed.length) continue;
  for (const h of landed) console.log(`press t${p.t} fired t${p.fired} -> ${h.id} hits ${h.hits}${h.killed ? ' KILLED' : ''}; body (hits,timer) at press-1: ${JSON.stringify(timers[h.id]?.[p.t - 1])}, at press: ${JSON.stringify(timers[h.id]?.[p.t])}`);
}
