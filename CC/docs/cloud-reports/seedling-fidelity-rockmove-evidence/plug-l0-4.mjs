// Scratch: the smallest set of extra static `rock` tiles that restores {0,4}'s gate with its rock moved to (80,128).
import { loadAtlas } from '../../../../frontend/modules/seedlingDemo/levelSource.js';
import { levelSourceFromAtlas } from '../../../../frontend/modules/seedlingDemo/atlasSource.js';
import { createRunForStaging } from '../../../../frontend/modules/seedlingDemo/tapeRunner.js';
import { arrivalStaging, gameLandings } from '../../../../frontend/modules/seedlingDemo/fidelityArrival.js';
import { plannerObstacleAt } from '../../../../frontend/modules/seedlingDemo/botDriverV2.js';
const A = loadAtlas();
const move = (doc, extra, to) => ({ ...doc, levels: doc.levels.map((r) => r.level !== 0 ? r : { ...r, entities: r.entities
    .map((e) => (e.type === 'breakablerock' && e.x === 80 && e.y === 112 ? { ...e, x: to.x, y: to.y } : e))
    .concat(extra.map(([x, y]) => ({ type: 'rock', x, y, attrs: {} }))) }) });
function flood(doc, l, cleared = []) {
  const run = createRunForStaging(arrivalStaging(l, { cleared }), levelSourceFromAtlas(doc)); const w = run.world; const o = run.liveGeometryOpts();
  const s = [Math.floor(run.state.x / 16), Math.floor(run.state.y / 16)]; const seen = new Set([s.join()]); const doors = new Set(); const q = [s];
  while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x+dx, ny = y+dy; const k = `${nx},${ny}`;
    if (nx<0||ny<0||nx>=w.width||ny>=w.height||seen.has(k)) continue; const h = plannerObstacleAt(w, nx*16+8, ny*16+8, null, o);
    if (h?.kind === 'teleporter') { const t = w.teleporters.find((t) => t.rect.x <= nx*16+8 && nx*16+8 < t.rect.right && t.rect.y <= ny*16+8 && ny*16+8 < t.rect.bottom); doors.add(t ? `L${t.to}@${t.x},${t.y}` : k); seen.add(k); continue; }
    if (h && h.kind !== 'proximity-hazard') continue; seen.add(k); q.push([nx, ny]); } }
  return { tiles: seen.size, doors: [...doors].sort() };
}
const lands = gameLandings(A).filter((l) => l.level === 0);
const gated = lands.find((l) => l.from === 1); const open = lands.filter((l) => l !== gated);
const report = (name, doc) => {
  const held = flood(doc, gated); const cleared = flood(doc, gated, [4]);
  const leak = open.filter((l) => flood(doc, l).doors.includes('L1@80,96')).map((l) => `L${l.from}`);
  console.log(JSON.stringify({ name, pocketHeld: held, pocketCleared: { tiles: cleared.tiles, doors: cleared.doors.length }, openSideReachesL1Door: leak }));
};
report('base (rock at 80,112)', A);
const to = { x: 80, y: 128 };
report('moved (80,128), no plug', move(A, [], to));
for (const plug of [[[64,112]], [[96,112]], [[64,112],[96,112]], [[64,112],[96,112],[64,96]], [[64,112],[96,112],[96,96]]]) report(`moved (80,128) + plug ${JSON.stringify(plug)}`, move(A, plug, to));
// From the POCKET (L1's landing) with the Sword: break the moved rock (the CLEARTAG `fromPocket` question), plugged map.
import { solveSegment, SolverRefusal } from '../../../../frontend/modules/seedlingDemo/solverBot.js';
for (const [name, plug] of [['moved, no plug', []], ['moved + plug (96,112)', [[96, 112]]]]) {
  const doc = move(A, plug, to);
  try {
    const run = createRunForStaging(arrivalStaging(gated, { items: ['hasSword'] }), levelSourceFromAtlas(doc));
    const out = solveSegment({ run, goals: [{ kind: 'clear-tag', tag: { level: 0, tag: 4 }, at: { ...to }, obstacle: `breakablerock@${to.x},${to.y}` }],
      name: 'rockmove-l0-4-pocket', boot: { level: 0, x: gated.x, y: gated.y } });
    console.log(JSON.stringify({ name, fromPocket: 'SOLVES', ticks: out.perTick.length, verb: out.records.find((r) => r.goal === 'clear-tag')?.strategy ?? null }));
  } catch (e) { console.log(JSON.stringify({ name, fromPocket: e instanceof SolverRefusal ? 'REFUSES' : 'THREW', why: String(e.message).slice(0, 200) })); }
}
