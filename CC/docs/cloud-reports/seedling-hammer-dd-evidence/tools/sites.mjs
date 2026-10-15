import { join } from 'node:path';
const R = process.cwd();
const sb = await import(join(R, 'frontend/modules/seedlingDemo/solverBot.js'));
const { createRunForStaging } = await import(join(R, 'frontend/modules/seedlingDemo/tapeRunner.js'));
const { atlasLevelSource } = await import(join(R, 'frontend/modules/seedlingDemo/levelSource.js'));
const P = await import(join(R, 'scripts/procgen/plan-seedling-bobsoldier2.mjs'));
const D = await import(join(R, 'scripts/procgen/plan-seedling-hammer-dd-walkkill.mjs'));
for (const [n, st] of [['alive', await P.bobsoldier2Staging()], ['walkkill', await D.walkKillStaging()]]) for (const on of [false, true]) {
  const run = createRunForStaging(st, atlasLevelSource()); const sites = {}; let n2 = 0;
  try { sb.withPressKillDoneOnWalk(on, () => sb.solveSegment({ run, goals: JSON.parse(JSON.stringify(P.BOBSOLDIER2_STEP50.goals)), name: 'x', boot: st.boot, dashMode: 'all', shouldStop: (s) => { n2++; sites[s] = (sites[s] ?? 0) + 1; return false; } })); } catch (e) {}
  console.log(n, on, n2, JSON.stringify(sites));
}
