// ASCII render of a level's tile types (hex-ish glyphs) + entity list. Usage: node grid.mjs <level>
import { readFileSync } from 'node:fs';
import { tileTypeForPlacement } from '../../../../../frontend/modules/flashPanel/seedlingSemantics.js';
const MAP = JSON.parse(readFileSync(new URL('../../../../../frontend/modules/flashPanel/atlases/seedling-map.json', import.meta.url), 'utf8'));
const id = Number(process.argv[2]);
const level = MAP.levels.find((l) => l.level === id);
const G = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const per = {};
let W = 0, H = 0;
for (const layer of level.layers ?? []) {
  const m = per[layer.name] ??= new Map();
  for (const p of layer.tiles ?? []) { const t = tileTypeForPlacement(p); m.set(`${p[0]},${p[1]}`, t); W = Math.max(W, p[0] + 1); H = Math.max(H, p[1] + 1); }
}
console.log(`L${id} keys: ${Object.keys(level).join(',')}  size ${W}x${H}; layers ${Object.keys(per).join(',')}`);
for (const [name, m] of Object.entries(per)) {
  console.log(`-- layer ${name} (glyph = tile type in base36, . = none)`);
  console.log('    ' + [...Array(W).keys()].map((x) => (x % 10)).join(''));
  for (let y = 0; y < H; y++) console.log(String(y).padStart(3) + ' ' + [...Array(W).keys()].map((x) => { const t = m.get(`${x},${y}`); return t == null ? '.' : G[t]; }).join(''));
}
for (const e of level.entities ?? []) console.log(`ent ${e.type}@${e.x},${e.y} cell ${Math.floor(e.x / 16)},${Math.floor(e.y / 16)} ${JSON.stringify(e.attrs ?? {})}`);
