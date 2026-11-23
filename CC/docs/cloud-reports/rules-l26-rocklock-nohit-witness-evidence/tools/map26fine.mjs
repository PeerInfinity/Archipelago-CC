// L26 at 8 px resolution: '#' any Solid rect (trees 32x32, poles, rocks, the rocklock 'R'), '.' floor, ' ' outside.
// X = a puncher's spawn centre, @ = the arrival (136,40). Column/row labels are pixels/8.
const R = new URL('../../../../../', import.meta.url).pathname;
const { LEG_286 } = await import(R + 'frontend/modules/seedlingDemo/hammerNewLocksLegs.js');
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { buildLevelWorld, ROLES } = await import(R + 'frontend/modules/seedlingDemo/levelWorld.js');
const rec = restoreRequest(LEG_286.requests[0].request).source.records.get(26);
const w = buildLevelWorld(rec, { roles: ROLES });
const W = rec.width * 2, H = rec.height * 2;
const g = [...Array(H)].map(() => Array(W).fill(' '));
for (const t of w.tiles) for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) g[t.ty * 2 + a][t.tx * 2 + b] = /Water/.test(t.name) ? '~' : /Pit/.test(t.name) ? 'o' : '.';
for (const s of w.solids) for (let y = s.rect.y; y < s.rect.bottom; y += 8) for (let x = s.rect.x; x < s.rect.right; x += 8) if (g[y / 8 | 0]?.[x / 8 | 0] !== undefined) g[y / 8 | 0][x / 8 | 0] = s.tag === 'rocklock' ? 'R' : s.tag === 'pole' ? 'P' : '#';
g[176 / 8][88 / 8] = 'X'; g[216 / 8][40 / 8] = 'X'; g[40 / 8][136 / 8] = '@';
console.log('    ' + [...Array(W)].map((_, i) => (i % 10)).join(''));
g.forEach((r, i) => console.log(String(i).padStart(3) + ' ' + r.join('')));
