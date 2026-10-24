// seedling-js-l107-investigate: L107's tile grid by tile NAME (pits are NOT floor) + the solids.
import { runAt } from './runapi.mjs';
const { run } = await runAt(5594);
const w = run.world; const tiles = Array.isArray(w.tiles) ? w.tiles : Object.values(w.tiles);
const names = new Map(); const grid = Array.from({ length: 15 }, () => Array(20).fill(' '));
const code = (n) => ({ 'Odd Tile': '.', 'Fuchsia Tile': ',', Pit: 'o' })[n] ?? (names.set(n, (names.get(n) ?? 0) + 1), n[0]);
for (const t of tiles) if (t.ty < 15 && t.tx < 20) grid[t.ty][t.tx] = code(t.name);
for (const s of w.solids) { const tx = Math.floor(s.x / 16), ty = Math.floor(s.y / 16); if (s.tag?.startsWith?.('tile')) grid[ty][tx] = '#'; else grid[ty][tx] = s.tag[0].toUpperCase(); }
console.log('    ' + [...Array(20).keys()].map((i) => i % 10).join(''));
grid.forEach((r, i) => console.log(String(i).padStart(2), ' ' + r.join('')));
console.log('other names', JSON.stringify([...names]));
console.log('teleporters', JSON.stringify(w.teleporters).slice(0, 600));
