// The model's replay of a tape vs a game record (game.mjs): first parting, model hit ticks.
import { readFileSync } from 'node:fs';
const M = process.cwd() + '/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createTapeStepper } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const g = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const tape = parseTape(JSON.stringify(g.tape));
let run = null;
const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
const col = []; let err = null;
try { let r = st.next(); while (!r.done) { const o = r.value.observation; col[o.t] = { x: o.x, y: o.y, level: o.level }; r = st.next(); } } catch (e) { err = e.message; }
const hits = run ? (run.playerHits ?? []) : [];
const parted = g.rows.filter((r) => col[r.t] && (Math.abs(col[r.t].x - r.x) > 1e-9 || Math.abs(col[r.t].y - r.y) > 1e-9 || col[r.t].level !== r.level));
console.log(`model: ${col.length} obs${err ? `, THREW: ${err.slice(0, 300)}` : ''}; parted ${parted.length}, first ${parted[0] ? `t${parted[0].t} game (${parted[0].x.toFixed(2)},${parted[0].y.toFixed(2)}) model (${col[parted[0].t].x.toFixed(2)},${col[parted[0].t].y.toFixed(2)})` : 'none'}`);
console.log('model playerHits:', JSON.stringify(hits.map((h) => ({ t: h.t, source: h.source, id: h.id }))).slice(0, 600));
