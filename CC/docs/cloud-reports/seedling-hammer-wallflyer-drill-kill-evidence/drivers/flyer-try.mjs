// node flyer-try.mjs <boot fixture> <flyerId> <sx> <sy> : walk to (sx,sy), face the flyer, press on its cadence.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = '/home/user/Archipelago-CC';
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
const { parseTape } = await M('tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await M('tapeRunner.js');
const { patchedMapDocument } = await M('seedlingSetPatches.js');
const { levelSourceFromAtlas } = await M('atlasSource.js');
const { chooseHeld, hasArrived, DEFAULT_TOLERANCE } = await M('botDriverV1.js');
const { planWaypointsOrNull } = await M('solverBot.js').then((m) => m).catch(() => ({}));
const W = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const [id, sx, sy] = [process.argv[3], Number(process.argv[4]), Number(process.argv[5])];
const MAP = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const staging = solveStaging(stagingFromTape(parseTape(JSON.stringify(W.tape ?? W.walk))));
const run = createRunForStaging(staging, levelSourceFromAtlas(patchedMapDocument(MAP)));
const fl = () => run.wallFlyers.bodies.find((w) => w.id === id);
const hits0 = run.ledger('playerHits').length;
let t = 0;
const adv = (k) => { run.advance(new Set(k)); t += 1; const h = run.ledger('playerHits').slice(hits0); if (h.length) { console.log('HIT', t, JSON.stringify(h[0])); process.exit(0); } };
// walk: straight steering (the fixture's room is open between start and stance)
for (; t < 300 && !hasArrived(run.state, { x: sx, y: sy }, DEFAULT_TOLERANCE);) adv(chooseHeld(run.state, { x: sx, y: sy }, DEFAULT_TOLERANCE));
console.log('arrived', t, run.state.x.toFixed(2), run.state.y.toFixed(2), 'dir', run.state.direction, JSON.stringify(fl() && { x: fl().x, y: fl().y, vx: fl().vx, vy: fl().vy }));
for (let k = 0; k < 30 && (Math.abs(run.state.vx) > 1e-9 || Math.abs(run.state.vy) > 1e-9); k++) adv([]);
const f0 = fl(); const key = Math.abs(f0.x - run.state.x) > Math.abs(f0.y - run.state.y) ? (f0.x > run.state.x ? 'right' : 'left') : (f0.y > run.state.y ? 'down' : 'up');
adv([key]); for (let k = 0; k < 30 && (Math.abs(run.state.vx) > 1e-9 || Math.abs(run.state.vy) > 1e-9); k++) adv([]);
console.log('faced', t, key, run.state.x.toFixed(2), run.state.y.toFixed(2), run.state.direction);
let last = false;
for (let k = 0; k < 300; k++) {
  const f = fl();
  if (!f || f.removed) { console.log('REMOVED at', t); break; }
  const slash = run.progress('slashInfo')?.state?.slashTimer ?? 0;
  const ready = !last && slash <= 0 && (f.hitsTimer ?? 0) <= 1 && !f.dieAnim && !f.destroy;
  adv(ready ? ['primary'] : []); last = ready;
  const g = fl();
  if (ready) console.log('press', t, 'flyer hits', g?.hits, 'timer', g?.hitsTimer, 'v', g?.vx, g?.vy, 'anim', JSON.stringify(g?.dieAnim ?? null), g?.destroy);
}
const ev = run.wallFlyers.events.filter((e) => e.id === id);
console.log('events', JSON.stringify(ev.map((e) => [e.t, e.kind])));
console.log('end', t, 'hits', run.ledger('playerHits').length - hits0);
