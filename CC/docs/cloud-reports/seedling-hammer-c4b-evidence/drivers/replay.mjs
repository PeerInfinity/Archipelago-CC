// scratch: replay a tape file in the model; print the player-hit ledger and events around given ticks
import { readFileSync } from 'node:fs';
const REPO = '/home/user/Archipelago-CC';
const M = (p) => import(`${REPO}/frontend/modules/seedlingDemo/${p}`);
const { parseTape } = await M('tapeFormat.js');
const { createTapeStepper } = await M('tapeRunner.js');
const { atlasLevelSource } = await M('levelSource.js');
const tape = parseTape(readFileSync(process.argv[2], 'utf8'));
let run = null; const obs = [];
const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
let r = st.next();
try { while (!r.done) { obs.push(r.value.observation); r = st.next(); } } catch (e) { console.log('THREW', e.message.slice(0, 600)); }
console.log('ticks', obs.length, 'last', JSON.stringify(obs.at(-1)).slice(0, 300));
for (const k of (process.argv[3] ?? 'playerHits').split(',')) console.log(k, JSON.stringify(run?.ledger?.(k) ?? null).slice(0, 3000));
if (process.env.EXPECT) {
  const exp = JSON.parse(readFileSync(process.env.EXPECT, 'utf8')).exp;
  let first = null;
  for (let i = 0; i < Math.min(exp.length, obs.length); i += 1) {
    const e = exp[i], o = obs[i];
    if (Math.abs(e.x - o.x) > 1e-9 || Math.abs(e.y - o.y) > 1e-9 || e.level !== o.level) { first = { i, e, o }; break; }
  }
  console.log('expected vs replay: n', exp.length, obs.length, 'first diff', JSON.stringify(first));
}
