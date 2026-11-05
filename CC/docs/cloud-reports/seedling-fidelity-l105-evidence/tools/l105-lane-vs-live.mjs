// L105 W0 (measure-only): BEAMLANE's lane preview vs the live run driving its keys. NEEDS a temporary probe line after the
// lane `previewWalk` in solverBot.js: `globalThis.__L105_LANE = { walk, t0: run.ticksCompleted, corridor };` (copy + restore).
// Usage: node l105-lane-vs-live.mjs <request.jsonl> [d]
import { readFileSync } from 'node:fs';
import { restoreRequest } from '../../../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { atSeamTime } from '../../../../../scripts/procgen/replay-seedling-solve-request.mjs';
const { levelSourceFromAtlas } = await import('../../../../../frontend/modules/seedlingDemo/atlasSource.js');
const { createRunForStaging } = await import('../../../../../frontend/modules/seedlingDemo/tapeRunner.js');
const { solveSegment } = await import('../../../../../frontend/modules/seedlingDemo/solverBot.js');
const { solverGoalsOf } = await import('../../../../../frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const [file, d = '0'] = process.argv.slice(2);
const cap = JSON.parse(readFileSync(file, 'utf8').split('\n')[0]).requests[0].request;
const req = restoreRequest(atSeamTime(cap, cap.staging.seam.time + Number(d)));
const levelSource = levelSourceFromAtlas(req.source.records);
const mk = () => createRunForStaging(req.staging, levelSource, { scratchPersistence: req.scratchPersistence });
const run = mk();
const out = solveSegment({ run, goals: solverGoalsOf(req.solverGoal), name: req.name, boot: req.staging.boot, prefix: [], dashMode: 'none', forkRun: mk });
const L = globalThis.__L105_LANE;
console.log('lane t0', L.t0, 'samples', L.walk.samples.length, 'truncated', JSON.stringify(L.walk.truncated), 'corridor', JSON.stringify(L.corridor));
const r2 = mk();
const sm0 = L.walk.samples[0];
console.log('sample keys', Object.keys(sm0));
let first = null;
for (let i = 0; i < L.walk.samples.length; i += 1) {
  const sm = L.walk.samples[i];
  const adv = r2.advance(new Set(sm.held));
  if (i >= 205 && i <= 214) console.log('ADV', i, JSON.stringify({hitX: adv.hitX, hitY: adv.hitY, s: {x: r2.state.x, y: r2.state.y, vx: r2.state.vx, terrain: r2.state.terrain}, held: [...sm.held], chasers: (sm.chasers ?? []).map?.((c) => c.id ?? c).slice?.(0, 4)}).slice(0, 600));
  const nx = L.walk.samples[i + 1]; if (!nx) break;
  const dx = Math.abs(r2.state.x - nx.x), dy = Math.abs(r2.state.y - nx.y);
  if ((dx > 1e-9 || dy > 1e-9) && first === null) { first = i; }
  if ((first !== null && i >= first - 3 && i <= first + 12) || i % 40 === 0) console.log(i, 'tick', sm.tick, 'prev', nx.x.toFixed(2), nx.y.toFixed(2), JSON.stringify([...sm.held]), 'live', r2.state.x.toFixed(2), r2.state.y.toFixed(2), 'hits', r2.playerHits.length);
}
console.log('first divergence at sample', first);
