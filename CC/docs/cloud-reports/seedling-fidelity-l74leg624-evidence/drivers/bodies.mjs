import { readFileSync } from 'node:fs';
const REPO = '/home/user/Archipelago-CC';
const M = (p) => import(`${REPO}/frontend/modules/seedlingDemo/${p}`);
const { parseTape } = await M('tapeFormat.js');
const { createTapeStepper } = await M('tapeRunner.js');
const { atlasLevelSource } = await M('levelSource.js');
const tape = parseTape(readFileSync(process.argv[2], 'utf8'));
const [a, b] = (process.argv[3] ?? '0-10').split('-').map(Number);
let run = null;
const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
let r = st.next();
while (!r.done) {
  const o = r.value.observation;
  if (o.t >= a && o.t <= b) {
    const ch = (run.entities('chasers') ?? []).map((c) => `${c.id}:(${(+c.x).toFixed(1)},${(+c.y).toFixed(1)}) h${c.hits}/${c.hitsTimer}${c.removed ? ' REM' : ''}${c.bulbPhase ? ' ' + c.bulbPhase : ''}`);
    console.log(o.t, `P(${o.x.toFixed(2)},${o.y.toFixed(2)})`, [...(r.value.held ?? [])].join('+'), ch.join(' | '));
  }
  r = st.next();
}
