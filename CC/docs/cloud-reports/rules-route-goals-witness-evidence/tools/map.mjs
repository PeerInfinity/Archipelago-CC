// rules-route-goals-witness: ASCII map of one level from a captured sweep request (`node map.mjs <capture.jsonl> <leg id> <level>`):
// '.' floor, '#' solid, '~' water, 'o' pit, '^' lava, and letters for entities (W wandlock, B bosslock, b buttonroom, * apitem, D darktrap, L lightpole, T teleporter, O finalboss ...).
import { readFileSync } from 'node:fs';
const R = (process.env.REPO || process.cwd()) + '/';
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { buildLevelWorld, ROLES } = await import(R + 'frontend/modules/seedlingDemo/levelWorld.js');
const [file, id, lvl] = process.argv.slice(2);
let req; for (const line of readFileSync(file, 'utf8').trim().split('\n')) { const o = JSON.parse(line); if (String(o.id) === id) { req = restoreRequest(o.requests[0].request); break; } }
const rec = req.source.records.get(Number(lvl)); const w = buildLevelWorld(rec, { roles: ROLES });
const g = [...Array(rec.height)].map(() => Array(rec.width).fill(' '));
for (const t of w.tiles) g[t.ty][t.tx] = /Water/.test(t.name) ? '~' : /Pit/.test(t.name) ? 'o' : /Lava/.test(t.name) ? '^' : '.';
for (const s of w.solids) { const tx = Math.floor((s.rect.x + 1) / 16), ty = Math.floor((s.rect.y + 1) / 16); if (g[ty]?.[tx] !== undefined) g[ty][tx] = '#'; }
const L = { wandlock: 'W', bosslock: 'B', buttonroom: 'b', button: 'u', apitem: '*', pushableblockfire: 'F', pushableblock: 'P', pushableblockspear: 'S', pulser: 'p', teleporter: 'T', darktrap: 'D', lightpole: 'L', tree: '#', burnabletree: 't', spinner: 'x', puncher: 'X', rocklock: 'R', magicallock: 'M', shieldlocknorm: 'H', stairsdown: 'v', witch: 'w', finalboss: 'O' };
for (const e of rec.entities) { const c = L[e.type]; if (c) { const tx = Math.floor(e.x / 16), ty = Math.floor(e.y / 16); if (g[ty]?.[tx] !== undefined) g[ty][tx] = c; } }
console.log('    ' + [...Array(rec.width)].map((_, i) => i % 10).join(''));
g.forEach((r, i) => console.log(String(i).padStart(3) + ' ' + r.join('')));
