// Scratch: ASCII render of a delivered level on the model's planner geometry. node ascii.mjs <level> [y0 y1]
import { loadAtlas } from '../../../../frontend/modules/seedlingDemo/levelSource.js';
import { levelSourceFromAtlas } from '../../../../frontend/modules/seedlingDemo/atlasSource.js';
import { createRunForStaging } from '../../../../frontend/modules/seedlingDemo/tapeRunner.js';
import { arrivalStaging, gameLandings } from '../../../../frontend/modules/seedlingDemo/fidelityArrival.js';
import { plannerObstacleAt } from '../../../../frontend/modules/seedlingDemo/botDriverV2.js';
import { patchedMapDocument } from '../../../../frontend/modules/seedlingDemo/seedlingSetPatches.js';
const A = patchedMapDocument(loadAtlas());
const n = Number(process.argv[2]); const y0 = Number(process.argv[3] ?? 0); const y1 = Number(process.argv[4] ?? 999);
const r = A.levels.find((q) => q.level === n);
const l = gameLandings(A).find((q) => q.level === n);
const run = createRunForStaging(arrivalStaging(l), levelSourceFromAtlas(A));
const w = run.world; const o = run.liveGeometryOpts();
const mark = new Map();
const sym = { fallrock: 'R', fallrocklarge: 'R', button: 'b', buttonroom: 'B', rope: '~', wand: 'W', teleporter: 'T', stairsup: 'S', stairsdown: 'S', cover: 'c', wandlock: 'w', pulser: 'p', lock: 'L' };
for (const e of r.entities) if (sym[e.type]) {
  const big = ['fallrocklarge'].includes(e.type);
  for (const [dx, dy] of big ? [[0,0],[16,0],[0,16],[16,16]] : [[0,0]]) mark.set(`${(e.x+dx)/16|0},${(e.y+dy)/16|0}`, sym[e.type]);
}
for (const lg of gameLandings(A).filter((q) => q.level === n)) mark.set(`${lg.x/16|0},${lg.y/16|0}`, mark.get(`${lg.x/16|0},${lg.y/16|0}`) ?? '@');
let hdr = '    '; for (let x = 0; x < w.width; x++) hdr += (x % 10); console.log(hdr);
for (let y = 0; y < w.height; y++) {
  if (y*16 < y0 || y*16 > y1) continue;
  let s = String(y).padStart(3) + ' ';
  for (let x = 0; x < w.width; x++) {
    const m = mark.get(`${x},${y}`); if (m) { s += m; continue; }
    const h = plannerObstacleAt(w, x*16+8, y*16+8, null, o);
    s += !h ? '.' : h.kind === 'teleporter' ? 'T' : h.kind === 'proximity-hazard' ? 'h' : h.kind === 'pit' ? 'o' : (h.blocker?.tag ? 'x' : '#');
  }
  console.log(s);
}
