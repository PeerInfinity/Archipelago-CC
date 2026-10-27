// scripted run: argv[3] = JSON list of steps: {to:[x,y]} (greedy walk) | {keys:[..], n} | {keys:[..], until:"x>=116"}
import { readFileSync, writeFileSync } from 'node:fs';
const M = '../../../../../frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const atlas = JSON.parse(readFileSync(new URL('../../../../../frontend/modules/flashPanel/atlases/seedling-map.json', import.meta.url)));
if (process.env.NOJELLY) { const lv = atlas.levels.find((l) => l.level === 100); lv.entities = lv.entities.filter((e) => e.type !== 'jellyfish'); }
const tape = parseTape(readFileSync(process.argv[2], 'utf8'));
const steps = JSON.parse(process.argv[3]);
const staging = solveStaging(stagingFromTape(tape));
const run = createRunForStaging(staging, levelSourceFromAtlas(atlas));
const perTick = []; const equips = []; let t = 0; const V = process.env.V === '1';
const jel = () => (run.entities('chasers') ?? []).filter(c => c.tag === 'jellyfish').map(c => `${c.id.split('@')[1]}:(${c.x.toFixed(0)},${c.y.toFixed(0)})h${c.hits}`).join(' ');
const tick = (k) => { perTick.push(new Set(k)); const r = run.advance(new Set(k)); t++;
  if (V || t % 10 === 0) console.log(`t${t} [${k}] p(${run.state.x.toFixed(1)},${run.state.y.toFixed(1)}) v(${run.state.vx.toFixed(2)},${run.state.vy.toFixed(2)}) hits=${run.playerHits.length} L${run.level} ${jel()}`);
  if (r.transition) { console.log('TRANSITION', JSON.stringify(r.transition)); return 'tr'; }
  if (process.env.CONT && run.playerHits.length && (globalThis.__hitT ??= t) + Number(process.env.CONT) <= t) return 'hit';
  if (run.playerHits.length && !process.env.CONT) { console.log('HIT', JSON.stringify(run.playerHits.at(-1)).slice(0, 200)); return 'hit'; } };
outer: for (const s of steps) {
  if (s.to) { for (let i = 0; i < 400; i++) { const [gx, gy] = s.to; const dx = gx - run.state.x, dy = gy - run.state.y; const k = [];
      if (Math.abs(dx) > (s.tol ?? 1)) k.push(dx > 0 ? 'right' : 'left'); if (Math.abs(dy) > (s.tol ?? 1)) k.push(dy > 0 ? 'down' : 'up');
      if (!k.length) break; if (tick(k)) break outer; } }
  else if (s.equip !== undefined) { run.equipNow(s.equip); console.log('equip', s.equip, run.progress('primaryWeapon')); }
  else if (s.n) { for (let i = 0; i < s.n; i++) if (tick(s.keys)) break outer; }
  else if (s.band) { const f = new Function('p', 'return ' + s.band.until); for (let i = 0; i < 300 && !f(run.state); i++) { const k = run.state.y < s.band.y ? ['right'] : ['up', 'right']; if (tick(k)) break outer; } }
  else if (s.until) { const f = new Function('p', 'return ' + s.until); for (let i = 0; i < 300 && !f(run.state); i++) if (tick(s.keys)) break outer; }
  console.log(`-- step done ${JSON.stringify(s)} at t${t} p(${run.state.x.toFixed(1)},${run.state.y.toFixed(1)})`);
}
console.log('END t', t, 'p', run.state.x, run.state.y, 'level', run.level, 'hits', run.playerHits.length, 'broken', JSON.stringify([...(run.entities('brokenRocks') ?? [])]));
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(perTick.map((s) => [...s])));
