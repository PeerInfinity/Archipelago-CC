// rules-l77-trap-chase-witness: K's unwitnessed movers. For each row: the boot = the game's own landing from the
// source door (the source level's teleporter `playerx/playery` into the mover), the goal = the mover's teleporter to the
// target level. Prints the beam command per row (the beam is chase/beam.mjs: the JS model only CHOOSES keys).
//   node movers.mjs            -> one line per row: id boot goal items
import { readFileSync } from 'node:fs';
import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname);
const repo = path.resolve(here, '../../../../..');
const A = JSON.parse(readFileSync(path.join(repo, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const levels = new Map((A.levels ?? A).map((l) => [l.level, l]));
const tel = (from, to) => (levels.get(from)?.entities ?? []).filter((e) => (e.type === 'teleporter' || e.type.startsWith('stairs')) && Number(e.attrs?.to) === to);
export const ROWS = [
    // [id, mover level, from level, to level, items]  (items: tapeFormat flags; [] = FREE)
    ['L26-25to27', 26, 25, 27, []], ['L26-27to25', 26, 27, 25, []],
    ['L28-26to25', 28, 26, 25, []], ['L28-25to26', 28, 25, 26, []],
    ['L53-48to51', 53, 48, 51, []], ['L53-51to48', 53, 51, 48, []],
    ['L73-74to72-suit', 73, 74, 72, ['hasDarkSuit']], ['L73-72to74-suit', 73, 72, 74, ['hasDarkSuit']],
    ['L74-73to75', 74, 73, 75, []], ['L74-75to73', 74, 75, 73, []],
    ['L75-74to71', 75, 74, 71, []], ['L75-71to74', 75, 71, 74, []],
    ['L78-77to79-suit', 78, 77, 79, ['hasDarkSuit']], ['L78-79to77-suit', 78, 79, 77, ['hasDarkSuit']],
    ['L80-79to71-suit', 80, 79, 71, ['hasDarkSuit']], ['L80-71to79-suit', 80, 71, 79, ['hasDarkSuit']],
    ['L88-12to87', 88, 12, 87, []], ['L88-87to12', 88, 87, 12, []],
    ['L91-89to92', 91, 89, 92, []], ['L91-92to89', 91, 92, 89, []],
];
export function rowSpec([id, mover, from, to, items]) {
    const ins = tel(from, mover); const outs = tel(mover, to);
    return { id, mover, from, to, items,
        boots: ins.map((e) => `${mover}:${e.attrs.playerx}:${e.attrs.playery}`), goals: outs.map((e) => `${e.x}:${e.y}:${to}`) };
}
if (import.meta.url === `file://${process.argv[1]}`) for (const r of ROWS) console.log(JSON.stringify(rowSpec(r)));
