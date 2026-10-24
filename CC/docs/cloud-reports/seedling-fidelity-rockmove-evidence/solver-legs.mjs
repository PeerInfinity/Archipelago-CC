// Scratch: the live solver on the legs that cross L29's / L74's rock, per arm (vanilla / remove / remove+button / move),
// on the DELIVERED map (SEEDLING_SET_PATCHES applied) plus the arm's scratch ops. Model only.
import { loadAtlas } from '../../../../frontend/modules/seedlingDemo/levelSource.js';
import { levelSourceFromAtlas } from '../../../../frontend/modules/seedlingDemo/atlasSource.js';
import { createRunForStaging } from '../../../../frontend/modules/seedlingDemo/tapeRunner.js';
import { arrivalStaging } from '../../../../frontend/modules/seedlingDemo/fidelityArrival.js';
import { patchedMapDocument } from '../../../../frontend/modules/seedlingDemo/seedlingSetPatches.js';
import { solveSegment, SolverRefusal } from '../../../../frontend/modules/seedlingDemo/solverBot.js';
const A = patchedMapDocument(loadAtlas());
const ops = (doc, list) => ({ ...doc, levels: doc.levels.map((r) => { const mine = list.filter((o) => o.level === r.level); if (!mine.length) return r;
  let ents = r.entities.slice(); for (const o of mine) { const i = ents.findIndex((e) => e.type === o.type && e.x === o.x && e.y === o.y);
    if (i < 0) throw new Error(`no ${o.type}@${o.x},${o.y}`); ents = o.op === 'remove' ? ents.filter((_, j) => j !== i) : ents.map((e, j) => (j === i ? { ...e, x: o.to.x, y: o.to.y } : e)); }
  return { ...r, entities: ents }; }) });
const ARMS = {
  29: { vanilla: [], remove: [{ op: 'remove', level: 29, type: 'fallrock', x: 112, y: 112 }],
    'remove+button': [{ op: 'remove', level: 29, type: 'fallrock', x: 112, y: 112 }, { op: 'remove', level: 29, type: 'button', x: 112, y: 128 }],
    'move-128-112': [{ op: 'move', level: 29, type: 'fallrock', x: 112, y: 112, to: { x: 128, y: 112 } }] },
  74: { vanilla: [], remove: [{ op: 'remove', level: 74, type: 'fallrock', x: 288, y: 144 }],
    'remove+button': [{ op: 'remove', level: 74, type: 'fallrock', x: 288, y: 144 }, { op: 'remove', level: 74, type: 'button', x: 288, y: 128 }] },
};
const LEGS = [
  { id: 311, level: 29, boot: { x: 16, y: 224 }, exit: { x: 112, y: 32 }, what: 'L22 arrival -> stairs L31 (up the neck)' },
  { id: 313, level: 29, boot: { x: 96, y: 32 }, exit: { x: 0, y: 224 }, what: 'L31 arrival -> tp L22 (down the neck)' },
  { id: 631, level: 74, boot: { x: 288, y: 128 }, exit: { x: 288, y: 144 }, what: 'L73 arrival (on the button) -> tp L73' },
  { id: 634, level: 74, boot: { x: 16, y: 128 }, exit: { x: 288, y: 144 }, what: 'L75 arrival -> tp L73 (over the button)' },
  { id: 630, level: 74, boot: { x: 288, y: 128 }, exit: { x: 16, y: 144 }, what: 'L73 arrival -> tp L75' },
];
const rows = [];
for (const leg of LEGS) for (const [arm, list] of Object.entries(ARMS[leg.level])) {
  const src = levelSourceFromAtlas(ops(A, list));
  let row;
  try {
    const run = createRunForStaging(arrivalStaging({ level: leg.level, ...leg.boot }, { items: ['hasSword'] }), src);
    const out = solveSegment({ run, goals: [{ kind: 'reach-exit', exit: leg.exit }], name: `rockmove-${leg.id}-${arm}`, boot: { level: leg.level, ...leg.boot } });
    row = { verdict: 'SOLVED', ticks: out.perTick.length, cleared: (out.perTick.at(-1)?.persistence_cleared ?? null) };
  } catch (e) { row = { verdict: e instanceof SolverRefusal ? 'REFUSED' : 'THREW', why: String(e.message).replace(/\s+/g, ' ').slice(0, 260) }; }
  rows.push({ leg: leg.id, what: leg.what, arm, ...row });
  console.log(JSON.stringify(rows.at(-1)));
}
