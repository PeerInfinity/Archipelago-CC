// The rows this slice witnesses: boot = the source level's teleporter landing into the mover, goal = the mover's
// teleporter to the target (rules-k-chaser-narrowing's rows.mjs). Prints one JSON per row.
import { readFileSync } from 'node:fs';
import path from 'node:path';
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../../..');
const A = JSON.parse(readFileSync(path.join(repo, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const levels = new Map((A.levels ?? A).map((l) => [l.level, l]));
const tel = (from, to) => (levels.get(from)?.entities ?? []).filter((e) => (e.type === 'teleporter' || e.type.startsWith('stairs')) && Number(e.attrs?.to) === to);
export const ROWS = [
    ['L77-78to76-suit', 77, 78, 76, ['hasDarkSuit']],
    ['L75-71to74-suit', 75, 71, 74, ['hasDarkSuit']],
    ['L75-74to71-suit', 75, 74, 71, ['hasDarkSuit']],
];
for (const [id, mover, from, to, items] of ROWS) {
    const ins = tel(from, mover), outs = tel(mover, to);
    console.log(JSON.stringify({ id, items, boots: ins.map((e) => `${mover}:${e.attrs.playerx}:${e.attrs.playery}`), goals: outs.map((e) => `${e.x}:${e.y}:${to}`) }));
}
