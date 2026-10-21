import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createTapeStepper } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const tape = parseTape(readFileSync(process.argv[2], 'utf8'));
const game = JSON.parse(readFileSync(process.argv[3], 'utf8')).samples;
const on = process.argv[4] !== 'off';
const col = []; let err = null; let lastRun = null;
withContactFidelity({ tentacleBeastFight: on }, () => {
  let run = null;
  const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
  try { let r = st.next(); while (!r.done) { const o = r.value.observation; col[o.t] = { x: o.x, y: o.y, lvl: o.level, f: run?.tentacleBeastFight ?? null, hits: run?.damage?.hits, ws: run?.state }; r = st.next(); } }
  catch (e) { err = e; }
  lastRun = run;
});
if (err) console.log('MODEL THREW after', col.length, err.stack.slice(0, 900));
const fmt = (n) => Math.round(n * 1000) / 1000;
let n = 0, first = null;
for (const g of game) {
  const m = col[g.t]; if (!m) continue;
  const gb = g.boss && { a: g.boss.anim };
  const gt = (g.tentacleRows ?? []).map((r) => `${fmt(r[0])},${fmt(r[1])}:${r[2]}${r[3]}`).sort();
  const gw = (g.whirlpools ?? []).map((r) => `${fmt(r[0])},${fmt(r[1])}`).sort();
  const mb = m.f?.beast;
  const mt = (m.f?.tentacles ?? []).map((t) => `${fmt(t.x)},${fmt(t.y)}:${t.anim}${t.index}`).sort();
  const mw = (m.f?.whirlpools ?? []).map((w) => `${fmt(w.x)},${fmt(w.y)}`).sort();
  const d = [];
  if (Math.abs(m.x - g.x) > 1e-9 || Math.abs(m.y - g.y) > 1e-9) d.push(`player g(${g.x},${g.y}) m(${m.x},${m.y})`);
  if (gb && mb && (gb.a ?? '') !== mb.anim) d.push(`beast g(${gb.a}) m(${mb.anim})`);
  if (gt.join('|') !== mt.join('|')) d.push(`tent g[${gt}] m[${mt}]`);
  if (!process.env.NOWP && gw.join('|') !== mw.join('|')) d.push(`wp g[${gw}] m[${mw}]`);
  if (g.hits !== m.hits) d.push(`hits g${g.hits} m${m.hits}`);
  if (d.length) { n++; if (n <= (+process.env.SHOW || 6)) console.log('t', g.t, d.join(' ; ')); if (first === null) first = g.t; }
}
if (col.length < game.length) n += 1000;
console.log(`${n === 0 ? 'PASS' : 'FAIL'}: ${n} differing sampled ticks (first ${first}) of ${game.length}; model ticks ${col.length}`);
