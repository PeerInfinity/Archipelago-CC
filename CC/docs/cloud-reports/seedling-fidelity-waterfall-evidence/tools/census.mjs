import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/';
const M = R + 'frontend/modules/seedlingDemo/';
const { buildLevelWorld } = await import(M + 'levelWorld.js');
const atlas = JSON.parse(readFileSync(R + 'frontend/modules/flashPanel/atlases/seedling-map.json'));
let total = 0;
for (const rec of atlas.levels) {
  let w; try { w = buildLevelWorld(rec); } catch (e) { console.log('L' + rec.level, 'ERR', e.message.slice(0, 80)); continue; }
  const t = w.waterfallTiles; if (!t.length) continue; total += t.length;
  const set = new Set(t.map((q) => `${q.tx},${q.ty}`));
  // columns: contiguous vertical runs
  const cols = new Map(); for (const q of t) { if (!cols.has(q.tx)) cols.set(q.tx, []); cols.get(q.tx).push(q.ty); }
  const runs = [...cols].sort((a, b) => a[0] - b[0]).map(([tx, ys]) => { ys.sort((a, b) => a - b); const r = []; let s = ys[0], p = ys[0]; for (const y of ys.slice(1)) { if (y === p + 1) { p = y; continue; } r.push(`${s}-${p}`); s = p = y; } r.push(`${s}-${p}`); return `x${tx}:${r.join(',')}`; });
  console.log(`L${rec.level} tiles=${t.length} ${runs.join(' ')}`);
}
console.log('TOTAL', total);
