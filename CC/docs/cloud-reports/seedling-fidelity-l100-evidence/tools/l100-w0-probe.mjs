import { readFileSync } from 'node:fs';
const M = '../../../../../frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const { planWaypoints, plannerObstacleAt, nodeCentre, nodeAt, BotDriverV2Error } = await import(M + 'botDriverV2.js');
const { solverPlanOpts } = await import(M + 'solverBot.js');
const atlas = JSON.parse(readFileSync(new URL('../../../../../frontend/modules/flashPanel/atlases/seedling-map.json', import.meta.url)));
const tape = parseTape(readFileSync(process.argv[2], 'utf8'));
const staging = solveStaging(stagingFromTape(tape));
const run = createRunForStaging(staging, levelSourceFromAtlas(atlas));
const w = run.world;
console.log('state', run.state.x, run.state.y, 'world', w.width, w.height);
const rock = (w.solids ?? []).find((s) => s.rockId === 'breakablerock@128,144');
console.log('rock', JSON.stringify(rock && { rect: rock.rect, id: rock.rockId }));
const pm = (w.pixelmasks ?? []);
console.log('pixelmasks', pm.length, pm.slice(0, 50).map((p) => `${p.id ?? p.name}@${p.x},${p.y} ${p.type ?? ''} ${p.w ?? p.width}x${p.h ?? p.height}`).join(' | '));
const contacts = new Set();
const opts0 = solverPlanOpts(run, contacts, { nodeMargin: 0, triggerMargin: 0 });
const opts = solverPlanOpts(run, contacts);
// grid dump, 8 px, around region
const ob = (x, y, o) => { const r = plannerObstacleAt(w, x, y, null, o); return r ? (r.kind ?? 'X') + ':' + (r.id ?? '') : null; };
for (const pitch of [16, 8]) {
  console.log(`\n== ${pitch}px obstacle map (cell centres), rows y, cols x; . free, letter=kind`);
  const W = w.width * 16, H = w.height * 16; const legend = new Map();
  for (let y = pitch / 2; y < H; y += pitch) {
    let line = String(y).padStart(4) + ' ';
    for (let x = pitch / 2; x < W; x += pitch) {
      const r = ob(x, y, opts0);
      if (!r) { line += '.'; continue; }
      if (!legend.has(r)) legend.set(r, String.fromCharCode(legend.size < 26 ? 65 + legend.size : 97 + legend.size - 26));
      line += legend.get(r);
    }
    console.log(line);
  }
  for (const [k, v] of legend) console.log(' ', v, k);
}
const cell = nodeAt((rock.rect.x + rock.rect.right) / 2, (rock.rect.y + rock.rect.bottom) / 2, 16);
console.log('\nrock cell', cell);
for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
  if (!dx && !dy) continue;
  const c = nodeCentre(cell.tx + dx, cell.ty + dy, 16);
  const o = ob(c.x, c.y, opts0);
  let verdict = o ? `OBST ${o}` : '';
  if (!o) {
    try { planWaypoints(w, run.state, c, null, opts); verdict = 'PLANS'; }
    catch (e) { if (!(e instanceof BotDriverV2Error)) throw e; verdict = 'noplan: ' + e.message.slice(0, 220); }
  }
  console.log(`(${c.x},${c.y}) d=${dx},${dy} ${verdict}`);
}
console.log('\nentities:');
for (const k of ['mobiles','enemies','chasers','jellyfish','jellyfishes']) { try { const v = run.entities(k); if (v) console.log(k, JSON.stringify([...(v.values?.() ?? v)].slice(0,10)).slice(0,1500)); } catch (e) { console.log(k, 'ERR', e.message.slice(0,80)); } }
console.log('world keys', Object.keys(w).join(','));
console.log('\ntiles (terrain kinds):');
const tk = new Map();
for (let ty = 0; ty < w.height; ty++) { let line = String(ty).padStart(3)+' '; for (let tx = 0; tx < w.width; tx++) { const t = (w.tiles ?? []).find((q) => q.tx === tx && q.ty === ty); const k = String(t?.name ?? 'none'); if (!tk.has(k)) tk.set(k, String.fromCharCode(97 + tk.size)); line += tk.get(k); } console.log(line); }
for (const [k,v] of tk) console.log(' ', v, k.slice(0,120));
console.log('pm detail', JSON.stringify(w.pixelmasks.map(p=>({id:p.id, mask:p.mask?.name ?? p.maskName ?? p.cls?.mask, x:p.maskX,y:p.maskY}))).slice(0,2000));
console.log('\nfine candidates (8px, ±4):');
const { FINE_LATTICE } = await import(M + 'solverBot.js');
const fineOpts = solverPlanOpts(run, contacts, { lattice: FINE_LATTICE });
const fc = nodeAt(136, 152, 8);
const SR = 16;
const rr = rock.rect;
const dist = (x, y) => Math.hypot(Math.max(rr.x - x, 0, x - rr.right), Math.max(rr.y - y, 0, y - rr.bottom));
for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
  const c = nodeCentre(fc.tx + dx, fc.ty + dy, 8);
  const o = ob(c.x, c.y, opts0); if (o) continue;
  if (dist(c.x, c.y) > SR) continue;
  let v; try { const wp = planWaypoints(w, run.state, c, null, fineOpts); v = 'PLANS ' + JSON.stringify((wp.waypoints ?? wp).map?.((p) => [p.x, p.y]) ?? wp).slice(0, 400); } catch (e) { v = 'noplan ' + e.message.slice(0, 100); }
  console.log(`(${c.x},${c.y}) d=${dist(c.x,c.y).toFixed(1)} ${v}`);
}
const p0 = w.pixelmasks.find((p) => p.maskX === 112 && p.maskY === 96);
console.log('\nmask keys', Object.keys(p0), Object.keys(p0.mask ?? {}));
const m = p0.mask;
for (let y = 0; y < (m.h ?? m.height ?? 16); y++) { let l = ''; for (let x = 0; x < (m.w ?? m.width ?? 16); x++) { const b = m.bits ? m.bits[y * (m.w ?? m.width) + x] : (m.data ? m.data[y * (m.w ?? m.width) + x] : (m.rows ? (typeof m.rows[y] === 'string' ? m.rows[y][x] === '#' || m.rows[y][x] === '1' : m.rows[y][x]) : '?')); l += b ? '#' : '.'; } console.log(l); }
