// Tile BFS on a level from a captured request (leg id): walkable = model tiles minus water/pit/lava (unless --swim),
// every Solid entity a wall (locks shut, pushables unmoved) unless listed in --open=type@x,y;...; --block=tx,ty;... extra walls.
// Prints which entities are reached (on or adjacent).
import { readFileSync } from 'node:fs';
const R = (process.env.REPO || process.cwd()) + '/';
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { buildLevelWorld, ROLES } = await import(R + 'frontend/modules/seedlingDemo/levelWorld.js');
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
const [file, id, lvl] = process.argv.slice(2);
let req;
for (const line of readFileSync(file, 'utf8').trim().split('\n')) { const o = JSON.parse(line); if (String(o.id) === id) { req = restoreRequest(o.requests[0].request); break; } }
const rec = req.source.records.get(Number(lvl));
const w = buildLevelWorld(rec, { roles: ROLES });
const W = rec.width, H = rec.height;
const swim = process.argv.includes('--swim');
const open = [...Array(H)].map(() => Array(W).fill(false));
for (const t of w.tiles) open[t.ty][t.tx] = swim ? !/Lava|Pit/.test(t.name) : !/Water|Lava|Pit/.test(t.name);
for (const s of w.solids) { const tx = Math.floor((s.rect.x + 1) / 16), ty = Math.floor((s.rect.y + 1) / 16); if (open[ty]?.[tx] !== undefined) open[ty][tx] = false; }
const opened = new Set((arg('open') ?? '').split(';').filter(Boolean));
const SOLID_ENT = new RegExp(arg('solid') ?? 'lock|pushableblock|pulser|turret|burnabletree|crusher|spinningaxe|breakablerock|rope|lightpole|statue|watcher|finaldoor|magical');
for (const e of rec.entities) if (SOLID_ENT.test(e.type) && !opened.has(`${e.type}@${e.x},${e.y}`)) open[Math.floor(e.y / 16)][Math.floor(e.x / 16)] = false;
for (const e of rec.entities) if (opened.has(`${e.type}@${e.x},${e.y}`)) open[Math.floor(e.y / 16)][Math.floor(e.x / 16)] = true;
for (const b of (arg('block') ?? '').split(';').filter(Boolean)) { const [x, y] = b.split(',').map(Number); open[y][x] = false; }
const sx = Number(arg('x') ?? req.staging.boot.x), sy = Number(arg('y') ?? req.staging.boot.y);
const start = [Math.floor((sx + 4) / 16), Math.floor((sy + 4) / 16)];
const seen = new Set([start.join()]); const q = [start];
while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; const k = `${nx},${ny}`; if (open[ny]?.[nx] && !seen.has(k)) { seen.add(k); q.push([nx, ny]); } } }
const adj = (tx, ty) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(`${tx + dx},${ty + dy}`));
console.log(`L${lvl} from (${sx},${sy}) tile ${start} reaches ${seen.size} tiles; opened=[${[...opened].join(' ')}] swim=${swim}`);
if (arg("dump")) { const g=[...Array(H)].map((_,y)=>[...Array(W)].map((_,x)=>seen.has(`${x},${y}`)?"R":open[y][x]?".":"#").join("")); g.forEach((r,i)=>console.log(String(i).padStart(3)+" "+r)); }
const show = new RegExp(arg('show') ?? '.');
for (const e of rec.entities) {
  if (!show.test(e.type)) continue;
  const tx = Math.floor(e.x / 16), ty = Math.floor(e.y / 16);
  console.log(`${adj(tx, ty) ? 'REACHED ' : 'not     '} ${e.type}@${e.x},${e.y} (${tx},${ty}) ${JSON.stringify(e.attrs ?? {})}`);
}
