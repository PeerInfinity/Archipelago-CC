// scratch (SOUTHDOOR): at a captured request's staging, what stands around the latch pocket, and does the latch plan.
import { readFileSync } from 'node:fs';
const ROOT = '/home/user/Archipelago-CC';
const { restoreRequest } = await import(ROOT + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(ROOT + '/frontend/modules/seedlingDemo/atlasSource.js');
const { replayTape } = await import(ROOT + '/frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const SB = await import(ROOT + '/frontend/modules/seedlingDemo/solverBot.js');
const { planWaypoints } = await import(ROOT + '/frontend/modules/seedlingDemo/botDriverV2.js');
const [file, i] = process.argv.slice(2);
const row = JSON.parse(readFileSync(file, 'utf8').trim().split('\n')[0]);
const req = restoreRequest(row.requests[Number(i)].request);
const { source, passes, ...tape } = req;
const run = replayTape({ staging: tape.staging, perTick: tape.perTick ?? [], levelSource: levelSourceFromAtlas(source.records),
  scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
console.log('at', run.level, run.state.x, run.state.y, 'slots', JSON.stringify(run.progress('inventorySlots')), 'inv', JSON.stringify(run.progress('inventory')));
console.log('open', [...run.entities('openActivators')].join(' '), 'latched', [...(run.entities('latchedGroups') ?? [])].join(' '));
const near = (e) => e.x >= 760 && e.x <= 960 && e.y >= 700 && e.y <= 900;
console.log('openChests', [...run.entities('openChests')].join(' '), 'burned', [...run.entities('burnedTrees')].join(' '));
const opts = SB.solverPlanOpts(run, new Set());
for (const aim of [{ x: 888, y: 776 }, { x: 888, y: 800 }, { x: 888, y: 860 }, { x: 488, y: 579 }, { x: 888, y: 840 }, { x: 872, y: 800 }]) {
  let w = null; try { w = planWaypoints(run.world, run.state, aim, null, opts); } catch (e) { w = 'THREW ' + e.message.slice(0, 120); }
  console.log('plan to', JSON.stringify(aim), Array.isArray(w) ? `${w.length} wps` : w);
}
