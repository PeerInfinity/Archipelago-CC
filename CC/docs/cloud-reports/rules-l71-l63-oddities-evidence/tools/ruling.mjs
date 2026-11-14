// Prints killLockRoomRuling for the given levels (default 71 99), every undecided/unmeasured note,
// each body's standing tile, and the tile-type census of the room.
import { readFileSync } from 'node:fs';
import { killLockRoomRuling } from '../../../../../frontend/modules/flashPanel/seedlingPlaythroughOverlay.js';
import { tileTypeForPlacement, conditionKey } from '../../../../../frontend/modules/flashPanel/seedlingSemantics.js';
const MAP = JSON.parse(readFileSync(new URL('../../../../../frontend/modules/flashPanel/atlases/seedling-map.json', import.meta.url), 'utf8'));
const levels = process.argv.slice(2).map(Number);
for (const id of (levels.length ? levels : [71, 99])) {
  const level = MAP.levels.find((l) => l.level === id);
  const tiles = new Map(); const census = {};
  for (const layer of level.layers ?? []) { if (layer.name === 'cliffsides') continue;
    for (const p of layer.tiles ?? []) { const t = tileTypeForPlacement(p); if (t !== null) { tiles.set(`${p[0]},${p[1]}`, t); census[t] = (census[t] ?? 0) + 1; } } }
  const r = killLockRoomRuling(level);
  console.log(`=== L${id} verdict=${r?.verdict} condition=${r?.condition ? conditionKey(r.condition) : null}`);
  console.log(`locks: ${r?.locks.join(', ')}  hazards: ${JSON.stringify(r?.hazards)}`);
  console.log(`tile census (type:count): ${JSON.stringify(census)}`);
  for (const b of r?.bodies ?? []) {
    const [x, y] = b.at.split('@')[1].split(',').map(Number);
    const cx = Math.floor((x + 8) / 16), cy = Math.floor((y + 8) / 16);
    console.log(`  body ${b.at} cell ${cx},${cy} stands-on tile ${tiles.get(`${cx},${cy}`) ?? 'none'} env=${b.env} free=${b.free}`);
  }
  for (const w of r?.why ?? []) console.log(`  why: ${w}`);
  const where6 = [...tiles].filter(([, t]) => t === 6).map(([k]) => k);
  console.log(`  tile6 cells: ${where6.join(' ') || 'none'}`);
}
