// ASCII map of L26 from the NEW-LOCKS leg 286 request (the (8,2) arrival). '.' floor '#' solid '~' water 'o' pit
// X puncher, R rocklock, T teleporter, P pole (Solid until pulled), @ arrival.
const R = new URL('../../../../../', import.meta.url).pathname;
const { LEG_286 } = await import(R + 'frontend/modules/seedlingDemo/hammerNewLocksLegs.js');
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { buildLevelWorld, ROLES } = await import(R + 'frontend/modules/seedlingDemo/levelWorld.js');
const rec = restoreRequest(LEG_286.requests[0].request).source.records.get(26);
const w = buildLevelWorld(rec, { roles: ROLES });
const g = [...Array(rec.height)].map(() => Array(rec.width).fill(' '));
for (const t of w.tiles) g[t.ty][t.tx] = /Water/.test(t.name) ? '~' : /Pit/.test(t.name) ? 'o' : /Lava/.test(t.name) ? '^' : '.';
for (const s of w.solids) { const tx = Math.floor((s.rect.x + 1) / 16), ty = Math.floor((s.rect.y + 1) / 16); if (g[ty]?.[tx] !== undefined) g[ty][tx] = '#'; }
const L = { tree: '#', puncher: 'X', rocklock: 'R', teleporter: 'T', pole: 'P', dungeonspire: 'S', torch: 'i' };
for (const e of rec.entities) { const c = L[e.type]; if (c) { const tx = Math.floor(e.x / 16), ty = Math.floor(e.y / 16); if (g[ty]?.[tx] !== undefined) g[ty][tx] = c; } }
g[2][8] = '@';
console.log('    ' + [...Array(rec.width)].map((_, i) => i % 10).join(''));
g.forEach((r, i) => console.log(String(i).padStart(3) + ' ' + r.join('')));
for (const e of rec.entities) if (!/tree|torch|light/.test(e.type)) console.log(e.type, e.x, e.y, JSON.stringify(e.attrs ?? {}));
console.log('solids:', w.solids.filter(s=>s.tag).map(s=>`${s.tag}:${JSON.stringify(s.rect)}`).join(' '));
