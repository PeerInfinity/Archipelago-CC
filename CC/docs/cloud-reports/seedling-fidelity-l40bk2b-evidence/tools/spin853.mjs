import { readFileSync } from 'node:fs';
const SD = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(SD + 'tapeFormat.js');
const { createTapeStepper } = await import(SD + 'tapeRunner.js');
const { atlasLevelSource } = await import(SD + 'levelSource.js');
const tape = parseTape(readFileSync(process.argv[2], 'utf8'));
const live = JSON.parse(readFileSync(process.argv[3], 'utf8'));
let run = null; const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
let r = st.next(); let shown = 0;
while (!r.done) {
  const t = r.value.observation.t;
  if (run && live[t] && t > 0) {
    const ms = (run.entities('spinnerBodies') ?? []).map((c) => [c.id, c.x, c.y, c.hits ?? null]);
    const ls = live[t][2];
    if (JSON.stringify(ms) !== JSON.stringify(ls) && shown < 4) { console.log(`t${t} spinners differ\n live ${JSON.stringify(ls)}\n tape ${JSON.stringify(ms)}`); shown += 1; }
  }
  r = st.next();
}
