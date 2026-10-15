// SCRATCH: where two committed walks of the same staging part (the first tick their held sets differ).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const M = (p) => import(join('/home/user/Archipelago-CC/frontend/modules/seedlingDemo', p));
const { createTapeStepper } = await M('tapeRunner.js');
const { parseTape } = await M('tapeFormat.js');
const { atlasLevelSource } = await M('levelSource.js');
const keys = (f) => { const held = []; const st = createTapeStepper(parseTape(readFileSync(f, 'utf8')), { levelSource: atlasLevelSource(), onTick: (t, s, h) => { held[t] = h; } }); for (let r = st.next(); !r.done; r = st.next()); return held.filter(Boolean).map((k) => [...k].sort().join('+')); };
const a = keys(process.argv[2]); const b = keys(process.argv[3]);
let i = 0; while (i < a.length && a[i] === b[i]) i += 1;
console.log('lengths', a.length, b.length, 'first difference at index', i, a[i], '|', b[i]);
