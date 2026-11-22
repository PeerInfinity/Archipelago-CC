// Print one level's RAW tile types (the level data's `t`, via seedlingSemantics.tileTypeForPlacement; '..' = no placement),
// then the playthrough grid's kind letter (o open, w wall, s sink, g gated, m manual, d directional). '*' = patched ≠ vanilla.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../../..');
const P = await import(pathToFileURL(path.join(repo, 'scripts/procgen/make-seedling-playthrough-rules.mjs')));
const SEM = await import(pathToFileURL(path.join(repo, 'frontend/modules/flashPanel/seedlingSemantics.js')));
const n = Number(process.argv[2]);
const lv = P.PLAYTHROUGH_MAP.levels.find((l) => l.level === n);
const van = P.VANILLA_MAP.levels.find((l) => l.level === n);
const typesOf = (l) => {
  const m = new Map();
  for (const layer of l.layers ?? []) { if (layer.name === 'cliffsides') continue; for (const p of layer.tiles ?? []) m.set(`${p[0]},${p[1]}`, SEM.tileTypeForPlacement(p)); }
  return m;
};
const T = typesOf(lv), V = typesOf(van);
const g = P.playthroughGridFor(lv);
console.log(`L${n} layers: ${(lv.layers ?? []).map((l) => l.name).join(',')}`);
console.log('    ' + [...Array(lv.width).keys()].map((x) => String(x).padStart(4)).join(''));
for (let y = 0; y < lv.height; y++) {
  let s = '';
  for (let x = 0; x < lv.width; x++) {
    const t = T.get(`${x},${y}`), v = V.get(`${x},${y}`);
    const c = g.cells[y * g.width + x];
    s += ` ${t === undefined ? '..' : String(t).padStart(2)}${t !== v ? '*' : c.kind[0]}`;
  }
  console.log(String(y).padStart(3) + s);
}
