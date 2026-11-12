// Tile BFS on L40 from the L39 arrival, door SHUT: tiles from the model's own world (walkable = a tile the model
// does not list as a solid; water/pit/lava excluded: canSwim false at BK2's sphere), every Solid entity a wall
// (locks shut, pushables unmoved, pulser, turret, trees). Prints which activators (by tset) the arrival reaches.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const R = new URL('../../../../../', import.meta.url).pathname;
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { buildLevelWorld, ROLES } = await import(R + 'frontend/modules/seedlingDemo/levelWorld.js');
const fx = JSON.parse(gunzipSync(readFileSync(R + 'frontend/modules/seedlingDemo/fixtures/hammer-bk2-approach-order/leg873-l39-l40-bk2-request.json.gz')));
const rec = restoreRequest(fx.requests[0].request).source.records.get(40);
const w = buildLevelWorld(rec, { roles: ROLES });
const W = rec.width, H = rec.height;
const open = [...Array(H)].map(() => Array(W).fill(false));
for (const t of w.tiles) open[t.ty][t.tx] = !/Water|Lava|Pit/.test(t.name);
for (const s of w.solids) { const tx = Math.floor((s.rect.x + 1) / 16), ty = Math.floor((s.rect.y + 1) / 16); if (open[ty]?.[tx] !== undefined) open[ty][tx] = false; }
const SOLID_ENT = /wandlock|bosslock|pushableblock|pulser|iceturret|burnabletree|lock$|crusher|spinningaxe/;
for (const e of rec.entities) if (SOLID_ENT.test(e.type)) open[Math.floor(e.y / 16)][Math.floor(e.x / 16)] = false;
const start = [30, 56];
const seen = new Set([start.join()]); const q = [start];
while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; const k = `${nx},${ny}`; if (open[ny]?.[nx] && !seen.has(k)) { seen.add(k); q.push([nx, ny]); } } }
const adj = (tx, ty) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(`${tx + dx},${ty + dy}`));
console.log(`arrival (30,56) reaches ${seen.size} tiles with the door shut`);
for (const e of rec.entities) {
    if (!/button|pulser|wandlock|pushableblock|apitem|teleporter|stairs|control/.test(e.type)) continue;
    const tx = Math.floor(e.x / 16), ty = Math.floor(e.y / 16);
    console.log(`${adj(tx, ty) ? 'REACHED ' : 'not     '} ${e.type}@${e.x},${e.y} (${tx},${ty}) ${JSON.stringify(e.attrs ?? {})}`);
}
