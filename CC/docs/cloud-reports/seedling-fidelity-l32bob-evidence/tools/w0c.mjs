const R = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
import { readFileSync } from 'node:fs';
const { solveFromTape, liveOf, replayTape } = await import(R + 'jsRuntimeSolver.js');
const { solveStaging, stagingFromTape } = await import(R + 'tapeRunner.js');
const { parseTape } = await import(R + 'tapeFormat.js');
const { atlasLevelSource } = await import(R + 'levelSource.js');
const src = atlasLevelSource();
const GOAL = { kind: 'encounter', at: { x: 64, y: 128 }, drop: { item: 'Fire' }, then: null };
const [name, stepS, fromS, toS] = process.argv.slice(2);
const step = Number(stepS ?? 10);
const t = JSON.parse(readFileSync(R + `fixtures/tapes/${name}.json`, 'utf8'));
const staging = solveStaging(stagingFromTape(parseTape({ ...t, tick_count: 0, inputs: [] })));
const solve = (perTick) => {
  const live = liveOf(replayTape({ staging, perTick, levelSource: src, scratchPersistence: true }));
  return solveFromTape({ staging, perTick, live, levelSource: src, solverGoal: GOAL, scratchPersistence: true, dashMode: 'none' });
};
const base = solve([]);
console.log('base', base.solution.length);
const plan = base.solution;
for (let k = Number(fromS ?? step); k < Math.min(plan.length, Number(toS ?? 1e9)); k += step) {
  try { const p = solve(plan.slice(0, k)); console.log(k, 'SOLVED', p.solution.length); }
  catch (e) { console.log(k, 'REFUSED', e.constructor.name, String(e.message).slice(0, 260)); }
}
