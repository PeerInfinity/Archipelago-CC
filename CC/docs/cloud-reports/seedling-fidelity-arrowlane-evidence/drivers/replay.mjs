import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const M = (p) => import(join('/home/user/Archipelago-CC/frontend/modules', p));
const { atlasLevelSource } = await M('seedlingDemo/levelSource.js');
const { parseTape } = await M('seedlingDemo/tapeFormat.js');
const { createTapeStepper } = await M('seedlingDemo/tapeRunner.js');
let run = null;
const st = createTapeStepper(parseTape(readFileSync(process.argv[2], 'utf8')), { levelSource: atlasLevelSource(), onTick: (t, x, h, rn) => { run = rn; } });
const from = Number(process.argv[3] ?? 0);
let r = st.next();
while (!r.done) {
  const o = r.value.observation;
  if (o.t >= from && run) console.log(o.t, o.level ?? run.level, o.x?.toFixed?.(2), o.y?.toFixed?.(2), 'armed', JSON.stringify([...(run.entities('armedArrowTraps') ?? [])]), 'hits', (run.ledger('playerHits') ?? []).length, 'rocks', (run.rocksBroken ?? []).length);
  r = st.next();
}
