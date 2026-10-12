// replay a tape in the model; compare the player per tick to a game players[] file (probe output, columns form)
import { readFileSync } from 'node:fs';
const REPO = '/home/user/Archipelago-CC';
const M = (p) => import(`${REPO}/frontend/modules/seedlingDemo/${p}`);
const { parseTape } = await M('tapeFormat.js');
const { createTapeStepper } = await M('tapeRunner.js');
const { atlasLevelSource } = await M('levelSource.js');
const [tapeF, gameF] = process.argv.slice(2);
const tape = parseTape(readFileSync(tapeF, 'utf8'));
const g = JSON.parse(readFileSync(gameF, 'utf8'));
const cols = g.playersColumns; const ix = (k) => cols.indexOf(k);
const lvl = Number(process.env.LEVEL ?? 74);
const game = new Map(g.players.map((r) => cols ? [r[ix('t')], { level: r[ix('game.level')], x: r[ix('game.x')], y: r[ix('game.y')] }]
  : [r[0], { level: lvl, x: r[1], y: r[2] }]));
const obs = [];
const st = createTapeStepper(tape, { levelSource: atlasLevelSource() });
let r = st.next(); let threw = null;
try { while (!r.done) { obs.push(r.value.observation); r = st.next(); } } catch (e) { threw = e.message.slice(0, 300); }
const bad = [];
let n = 0;
for (const o of obs) {
  const e = game.get(o.t); if (!e) continue; n++;
  if (e.level !== o.level || Math.abs(e.x - o.x) > 1e-9 || Math.abs(e.y - o.y) > 1e-9) bad.push([o.t, +(e.x - o.x).toFixed(3), +(e.y - o.y).toFixed(3), e.level, o.level]);
}
console.log(`${tapeF.split('/').pop()}: model ticks ${obs.length} compared ${n} mismatched ${bad.length} first ${JSON.stringify(bad.slice(0, 4))}${threw ? ' THREW ' + threw : ''}`);
