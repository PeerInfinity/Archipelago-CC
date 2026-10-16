import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { stagingFromTape } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { solveAnytime, ANYTIME_PASSES } = await import(M + 'jsRuntimeSolver.js');
const { arrivalSolveRequest } = await import(M + 'wasmArrival.js');
const W = JSON.parse(readFileSync(M + 'fixtures/chaser-witness/axetiming-l61-152-plan.json', 'utf8'));
const staging = stagingFromTape(parseTape(JSON.stringify(W.tape)));
for (const budget of [640, 2560]) {
  const req = arrivalSolveRequest({ staging, solverGoal: { kind: 'reach-exit', exit: { x: 0, y: 160 } }, levelSource: atlasLevelSource(), records: null });
  const r = solveAnytime({ ...req, budgetWork: budget, upgradeWindowWork: 85 }, { passes: ANYTIME_PASSES });
  console.log(budget, r.ok, r.ok ? r.plan.solution.length : r.message.slice(0, 120), JSON.stringify(r.passes));
}
