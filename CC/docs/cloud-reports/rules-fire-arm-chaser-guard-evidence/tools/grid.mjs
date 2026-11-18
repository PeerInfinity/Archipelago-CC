// Print a level's playthrough grid: kind letter per cell, '*' conditioned; and tile types.
import { PLAYTHROUGH_MAP, playthroughGridFor } from '../../../../../scripts/procgen/make-seedling-playthrough-rules.mjs';
import * as HP from '../../../../../scripts/procgen/seedlingHolderParking.js';
const n = Number(process.argv[2]);
const level = PLAYTHROUGH_MAP.levels.find((l) => l.level === n);
const g = playthroughGridFor(level);
const tt = HP.tileTypesOf(level, g.width);
const kinds = new Map();
for (let y = 0; y < g.height; y += 1) {
  let row = '', row2 = '';
  for (let x = 0; x < g.width; x += 1) {
    const c = g.cells[y * g.width + x];
    kinds.set(c.kind, (kinds.get(c.kind) ?? 0) + 1);
    row += (c.conditions?.length ? '*' : c.kind[0]);
    const t = tt.get(y * g.width + x);
    row2 += t === 17 ? 'L' : t === 1 ? 'W' : t === 6 ? 'P' : t === undefined ? '.' : (t > 9 ? '#' : String(t));
  }
  console.log(String(y).padStart(2), row, ' ', row2);
}
console.log([...kinds]);
const conds = new Map();
for (const c of g.cells) for (const k of c.conditions ?? []) conds.set(JSON.stringify(k).slice(0, 120), 1);
console.log([...conds.keys()].slice(0, 20));
console.log(level.entities.map((e) => `${e.type}@${e.x},${e.y}`).join(' '));
