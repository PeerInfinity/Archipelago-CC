import { readFileSync } from 'node:fs';
const M = process.cwd() + '/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createTapeStepper } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const [witness, census] = process.argv.slice(2);
const tape = parseTape(JSON.stringify(JSON.parse(readFileSync(witness, 'utf8')).tape));
const bot = JSON.parse(readFileSync(census, 'utf8')).rows;
const st = createTapeStepper(tape, { levelSource: atlasLevelSource() });
const col = []; let r; try { r = st.next(); while (!r.done) { const o = r.value.observation; col[o.t] = [o.x, o.y]; r = st.next(); } } catch (e) { console.log('THREW', e.message.slice(0, 200)); }
const bad = [];
for (const row of bot) { if (!row.botObs || !col[row.t]) continue; const d = Math.max(Math.abs(row.botObs[0] - col[row.t][0]), Math.abs(row.botObs[1] - col[row.t][1])); if (d > 1e-9) bad.push(`t${row.t}:${d.toFixed(2)}`); }
console.log(`${witness.split('/').pop()} vs Bot obs: ${bot.filter((b) => b.botObs).length} ticks, mismatched ${bad.length} [${bad.slice(0, 8).join(' ')}]`);
