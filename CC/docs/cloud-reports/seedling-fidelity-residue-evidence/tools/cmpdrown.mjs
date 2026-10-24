import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { parseTape } = await import(M + 'tapeFormat.js');
const { createTapeStepper } = await import(M + 'tapeRunner.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const SRC = atlasLevelSource();
const w = JSON.parse(readFileSync(M + 'fixtures/whirlpool-witness/whirlpool-drown-s15.json', 'utf8'));
const on = process.argv[2] !== 'off';
const out = []; let err = null; let deaths = null;
withContactFidelity({ whirlpoolDrown: on, tentacleHitlessFirst: false }, () => {
  let run = null;
  const st = createTapeStepper(parseTape(JSON.stringify(w.tape)), { levelSource: SRC, onTick: (t, s, h, rn) => { run = rn; } });
  try { let r = st.next(); while (!r.done) { const o = r.value.observation; const v = run ? run.tentacleBeastFight : null;
    out[o.t] = { x: o.x, y: o.y, level: run.level, hits: run.damage.hits, beast: v ? v.beast.anim : null, tentacles: (v?.tentacles ?? []).map((q) => [q.x, q.y, q.anim, q.index, q.alpha]), rngState: v ? v.rngState : null, dead: v ? v.beast.dead === true : false };
    r = st.next(); } } catch (e) { err = e.message.slice(0, 200); }
  deaths = run.ledger('playerDeaths');
});
const rows = (a) => a.map((p) => p.join(',')).sort();
const bad = [];
for (const g of w.samples) { const s = out[g.t]; if (!s) { bad.push(`t ${g.t}: no model tick`); continue; }
  if (s.x !== g.x || s.y !== g.y) bad.push(`t ${g.t}: player game (${g.x}, ${g.y}) model (${s.x}, ${s.y})`);
  if (s.level !== g.level) bad.push(`t ${g.t}: level`); if (s.hits !== g.hits) bad.push(`t ${g.t}: hits game ${g.hits} model ${s.hits}`);
  if (g.level !== 57) continue;
  if ((g.boss?.anim ?? null) !== s.beast) bad.push(`t ${g.t}: beast game ${g.boss?.anim} model ${s.beast}`);
  if (rows(g.tentacleRows).join('|') !== rows(s.tentacles).join('|')) bad.push(`t ${g.t}: tentacles differ`);
  if (s.rngState === null && s.dead) continue;
  if (g.rngState !== s.rngState) bad.push(`t ${g.t}: rng game ${g.rngState} model ${s.rngState}`); }
console.log('model error', err, 'deaths', JSON.stringify(deaths), 'bad', bad.length, JSON.stringify(bad.slice(0, 6)));
for (const t of [2180, 2183, 2184, 2185, 2186, 2187, 2188, 2189, 2190, 2200, 2201, 2202, 2203, 2204]) { const g = w.samples.find((x) => x.t === t); console.log(t, g ? `game ${g.x},${g.y} h${g.hits} l${g.level}` : 'game -', out[t] ? `model ${out[t].x},${out[t].y}` : ''); }
