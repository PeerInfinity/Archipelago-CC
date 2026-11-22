// The rows this slice witnesses: boot = the source level's teleporter landing into the mover, goal = the mover's
// teleporter to the target (as the witness slice's movers.mjs). Prints one JSON per row.
import { readFileSync } from 'node:fs';
import path from 'node:path';
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../../..');
const A = JSON.parse(readFileSync(path.join(repo, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const levels = new Map((A.levels ?? A).map((l) => [l.level, l]));
const tel = (from, to) => (levels.get(from)?.entities ?? []).filter((e) => (e.type === 'teleporter' || e.type.startsWith('stairs')) && Number(e.attrs?.to) === to);
export const ROWS = [
    ['L72-71to73-suit', 72, 71, 73, ['hasDarkSuit']], ['L72-73to71-suit', 72, 73, 71, ['hasDarkSuit']],
    ['L75-71to74', 75, 71, 74, []],
    ['L91-92to89-swim', 91, 92, 89, ['canSwim']],
];
for (const [id, mover, from, to, items] of ROWS) {
    const ins = tel(from, mover), outs = tel(mover, to);
    console.log(JSON.stringify({ id, items, boots: ins.map((e) => `${mover}:${e.attrs.playerx}:${e.attrs.playery}`), goals: outs.map((e) => `${e.x}:${e.y}:${to}`) }));
}
