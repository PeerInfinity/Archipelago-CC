// fidelity REMBODY: chaserForecastNow taken at t<from> on skinswing-l71-resite vs the live step, key OFF and ON. Usage: node forecast-probe.mjs [from=58]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const D='../../../../frontend/modules/seedlingDemo/';
const { withContactFidelity } = await import(D+'contactFidelity.js');
const { SKINSWING_WITNESS_DIR } = await import(D+'fidelitySkinSwing.js');
const { parseTape } = await import(D+'tapeFormat.js');
const { createTapeStepper } = await import(D+'tapeRunner.js');
const { atlasLevelSource } = await import(D+'levelSource.js');
const rec = JSON.parse(readFileSync(join(SKINSWING_WITNESS_DIR, 'skinswing-l71-resite.json'), 'utf8'));
const from = Number(process.argv[2] ?? 58);
for (const on of [false, true]) withContactFidelity({ removedBodyBlocks: on }, () => {
  let run = null;
  const st = createTapeStepper(parseTape(JSON.stringify(rec.tape)), { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
  let r = st.next();
  while (r.value.observation.t < from) r = st.next();
  const fc = run.chaserForecast();
  const out = [];
  for (let t = from + 1; t <= from + 8; t++) {
    const proj = fc.step({ ...run.state });
    r = st.next();
    const live = run.chasers.filter((c) => !c.removed);
    const bad = live.map((c) => { const f = proj.find((p) => p.id === c.id); return f ? Math.max(Math.abs(f.x - c.x), Math.abs(f.y - c.y)) : 'missing'; });
    out.push(`t${t}:${live.length}/${proj.length}:${bad.map((b)=>typeof b==='number'?b.toFixed(3):b).join(',')}`);
  }
  console.log(on ? 'ON ' : 'OFF', out.join(' '));
});
