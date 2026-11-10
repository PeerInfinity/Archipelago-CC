// scratch: one captured request's dashless pass uncapped; prints the turret approaches (TURRET_APPROACH_COUNTS) and work.
import { readFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const ROOT = args.root ?? '/home/user/Archipelago-CC';
const { restoreRequest } = await import(ROOT + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(ROOT + '/frontend/modules/seedlingDemo/atlasSource.js');
const JR = await import(ROOT + '/frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const SB = await import(ROOT + '/frontend/modules/seedlingDemo/solverBot.js');
let req;
for (const line of readFileSync(args.requests, 'utf8').trim().split('\n')) {
  const row = JSON.parse(line); if (String(row.id) !== args.id) continue;
  req = restoreRequest(row.requests.find((c) => String(c.i) === args.i).request);
}
const { passes, source, budgetWork, upgradeWindowWork, ...tape } = req;
let work = 0; const bySite = {};
const t0 = Date.now();
const a = JR.settleSolve(() => JR.solveFromTape({ ...tape, levelSource: levelSourceFromAtlas(source.records), dashMode: 'none', adds: null,
  fineCheckpoints: true, shouldStop: (s) => { work += 1; bySite[s] = (bySite[s] ?? 0) + 1; return false; } }));
console.log(JSON.stringify({ ok: a.ok, ticks: a.ok ? a.plan.solution.length : null, work, bySite, ms: Date.now() - t0,
  approaches: SB.TURRET_APPROACH_COUNTS.approaches, msg: a.ok ? null : a.message.slice(0, 300) }));
