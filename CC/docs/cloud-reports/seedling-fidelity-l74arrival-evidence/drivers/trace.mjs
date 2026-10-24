import { readFileSync } from 'node:fs';
const REPO = '/home/user/Archipelago-CC';
const M = (p) => import(`${REPO}/frontend/modules/seedlingDemo/${p}`);
const { parseTape } = await M('tapeFormat.js');
const { createTapeStepper } = await M('tapeRunner.js');
const { atlasLevelSource } = await M('levelSource.js');
const tape = parseTape(readFileSync(process.argv[2], 'utf8'));
const [a, b] = (process.argv[3] ?? '0-20').split('-').map(Number);
let run = null;
const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
let r = st.next();
try { while (!r.done) { const o = r.value.observation; if (o.t >= a && o.t <= b) console.log(o.t, o.level, o.x, o.y); r = st.next(); } } catch (e) { console.log('THREW', e.message.slice(0, 400)); }
for (const k of ['playerHits', 'playerDeaths', 'transitions']) { try { console.log(k, JSON.stringify(run?.ledger?.(k) ?? run?.[k]).slice(0, 400)); } catch (e) { console.log(k, 'n/a'); } }
