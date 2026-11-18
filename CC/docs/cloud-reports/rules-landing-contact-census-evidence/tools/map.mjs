// rules-fire-only-witness: ASCII map + entity list of one level from the committed atlas (`node map.mjs <level>`).
// '#' a solid (w.solids), '~' water, '^' lava, 's' stairs, '.' other floor; entities overlaid: r rock, B bob, L lavarunner,
// T teleporter, X spinner, J jellyfish. Pixel coordinates: column c spans x 16c..16c+15, row r spans y 16r..16r+15.
import { join } from 'node:path';
const R = new URL('../../../../../', import.meta.url).pathname;
const { atlasLevelSource } = await import(join(R, 'frontend/modules/seedlingDemo/levelSource.js'));
const { buildLevelWorld, ROLES } = await import(join(R, 'frontend/modules/seedlingDemo/levelWorld.js'));
const lvl = Number(process.argv[2]);
const rec = atlasLevelSource()(lvl);
const w = buildLevelWorld(rec, { roles: ROLES });
const g = [...Array(rec.height)].map(() => Array(rec.width).fill(' '));
for (const t of w.tiles) { const c = /Water/.test(t.name) ? '~' : /Lava/.test(t.name) ? '^' : /Stairs/.test(t.name) ? 's' : '.'; if (g[t.ty][t.tx] === ' ' || c !== '.') g[t.ty][t.tx] = c; }
for (const s of w.solids) for (let x = s.rect.x; x < s.rect.right; x += 16) for (let y = s.rect.y; y < s.rect.bottom; y += 16) { const tx = Math.floor(x / 16), ty = Math.floor(y / 16); if (g[ty]?.[tx] !== undefined) g[ty][tx] = '#'; }
const L = { breakablerock: 'r', bob: 'B', lavarunner: 'L', teleporter: 'T', spinner: 'X', jellyfish: 'J' };
for (const e of rec.entities) { const c = L[e.type]; if (!c) continue; const tx = Math.floor(e.x / 16), ty = Math.floor(e.y / 16); if (g[ty]?.[tx] !== undefined) g[ty][tx] = c; }
console.log('   ' + [...Array(rec.width)].map((_, i) => i % 10).join(''));
g.forEach((r, i) => console.log(String(i).padStart(2) + ' ' + r.join('')));
for (const e of rec.entities) console.log(`${e.type}@${e.x},${e.y} (c${Math.floor(e.x / 16)} r${Math.floor(e.y / 16)}) ${JSON.stringify(e.attrs ?? {})}`);
console.log('solids', w.solids.length, [...new Set(w.solids.map((s) => s.tag))].join(' '), 'pixelmasks', (w.pixelmasks ?? []).length);
