import { readFileSync } from 'node:fs';
const M = process.cwd() + '/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createTapeStepper } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const [file, from = '0', to = '99999', every = '1'] = process.argv.slice(2);
const tape = parseTape(readFileSync(file, 'utf8'));
let run = null;
const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
let r = st.next();
while (!r.done) {
  const o = r.value.observation;
  if (o.t >= +from && o.t <= +to && (o.t % +every === 0)) {
    const s = run?.state;
    console.log(o.t, run?.level, o.x.toFixed(2), o.y.toFixed(2), s ? `v=(${s.vx.toFixed(3)},${s.vy.toFixed(3)})` : '', s?.terrain ?? '');
  }
  r = st.next();
}
