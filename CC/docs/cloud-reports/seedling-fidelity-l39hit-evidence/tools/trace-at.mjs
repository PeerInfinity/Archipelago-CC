// MEASURE ONLY: the dashless pass's solveSegment at seam T, unbudgeted (shouldStop never true, fine checkpoints asked
// as the page's pass does), to read its decision trace rows (tick → verb, goal) around the hit.
import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/';
const [capFile, seam, from = '1300', to = '1700'] = process.argv.slice(2);
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { atSeamTime } = await import(R + 'scripts/procgen/replay-seedling-solve-request.mjs');
const { levelSourceFromAtlas } = await import(R + 'frontend/modules/seedlingDemo/atlasSource.js');
const { replayTape, solverGoalsOf } = await import(R + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const { solveSegment } = await import(R + 'frontend/modules/seedlingDemo/solverBot.js');
const cap = JSON.parse(readFileSync(capFile, 'utf8').split('\n')[0]).requests[0].request;
const req = restoreRequest(atSeamTime(cap, Number(seam)));
const levelSource = levelSourceFromAtlas(req.source.records);
const run = replayTape({ staging: req.staging, perTick: req.perTick, levelSource, scratchPersistence: req.scratchPersistence === true });
let work = 0;
const out = solveSegment({ run, goals: solverGoalsOf(req.solverGoal), name: req.name ?? 'l39hit', boot: req.staging.boot, prefix: req.perTick,
    dashMode: 'none', shouldStop: () => { work += 1; return false; }, fineCheckpoints: true });
console.log('ticks', out.perTick.length - req.perTick.length, 'work', work, 'goal', JSON.stringify(req.solverGoal).slice(0, 200));
for (const r of out.trace?.rows ?? []) {
    if (r.tick >= Number(from) && r.tick <= Number(to) || r.tick === 0) console.log(`tick ${r.tick} verb=${r.strategy?.verb} goal=${JSON.stringify(r.goal).slice(0, 160)} saw=(${r.saw?.x},${r.saw?.y}) note=${String(r.strategy?.note ?? r.note ?? '').slice(0, 300)} rejected=${JSON.stringify(r.rejected ?? []).slice(0, 300)}`);
}
console.log('all rows:', (out.trace?.rows ?? []).map((r) => `${r.tick}:${r.strategy?.verb}`).join(' '));
