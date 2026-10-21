import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createTapeStepper } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const tape = parseTape(readFileSync(process.argv[2], 'utf8'));
const game = JSON.parse(readFileSync(process.argv[3], 'utf8')).samples;
const col = [];
withContactFidelity({ kingOfFireFight: true, tentacleBeastFight: true }, () => {
  let run = null;
  const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
  let r = st.next(); while (!r.done) { const o = r.value.observation; col[o.t] = { x: o.x, y: o.y, level: run.level, kof: run.lavaBossFight }; r = st.next(); }
});
let n = 0;
for (const g of game) { const m = col[g.t]; if (!m || m.x !== g.x || m.y !== g.y || m.level !== g.level || (g.boss !== null) !== !!(m.kof && !m.kof.boss.removed)) { if (n++ < 4) console.log('t', g.t, JSON.stringify(g).slice(0, 200), JSON.stringify(m && { x: m.x, y: m.y, level: m.level })); } }
console.log(n ? 'FAIL ' + n : 'PASS', game.length, 'game bodies seen:', game.filter((g) => g.boss).length);
