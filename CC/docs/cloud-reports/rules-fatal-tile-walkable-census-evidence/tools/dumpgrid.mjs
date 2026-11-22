// Print one level's playthrough grid (kinds/conditions), bodies, landings, traps.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../../..');
const P = await import(pathToFileURL(path.join(repo, 'scripts/procgen/make-seedling-playthrough-rules.mjs')));
const { combatCensusOf } = await import(pathToFileURL(path.join(repo, 'frontend/modules/seedlingDemo/levelWorld.js')));
const n = Number(process.argv[2]);
const level = P.PLAYTHROUGH_MAP.levels.find((l) => l.level === n);
const g = P.playthroughGridFor(level);
const ch = { open: '.', wall: '#', sink: '~', gated: 'G', manual: 'M', directional: 'd' };
const bodies = combatCensusOf(level).enemies;
const mark = new Map();
for (const b of bodies) mark.set(`${Math.floor((b.x + 8) / 16)},${Math.floor((b.y + 8) / 16)}`, 'E');
for (const e of level.entities ?? []) if (/trap/.test(e.type)) mark.set(`${Math.floor(e.x / 16)},${Math.floor(e.y / 16)}`, 'T');
console.log(`L${n} ${g.width}x${g.height}`);
console.log('    ' + [...Array(g.width).keys()].map((x) => x % 10).join(''));
for (let y = 0; y < g.height; y++) {
  let s = '';
  for (let x = 0; x < g.width; x++) {
    const c = g.cells[y * g.width + x];
    s += mark.get(`${x},${y}`) ?? (c.enter ? 'e' : ch[c.kind] ?? '?');
  }
  console.log(String(y).padStart(3) + ' ' + s);
}
const kinds = {};
for (const c of g.cells) if (c.conditions?.length) kinds[JSON.stringify(c.conditions)] = (kinds[JSON.stringify(c.conditions)] ?? 0) + 1;
console.log(kinds);
console.log('bodies', bodies.map((b) => `${b.tag}@${b.x},${b.y}`).join(' '));
console.log('entities', (level.entities ?? []).map((e) => `${e.type}@${e.x},${e.y}${e.attrs?.to !== undefined ? '->' + e.attrs.to : ''}`).join(' '));
