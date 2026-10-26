const B = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { readFileSync } = await import('node:fs');
const { createJsRuntime } = await import(B + 'jsRuntimeCore.js');
const { liveOf, solveAnytime, SOLVER_BUDGET_WORK } = await import(B + 'jsRuntimeSolver.js');
const { withDashOnlyWindow } = await import(B + 'dashOnlyWindowHook.js');
const { indexLevels, levelSourceFromAtlas } = await import(B + 'atlasSource.js');
const { withContactFidelity } = await import(B + 'contactFidelity.js');
const MAP = JSON.parse(readFileSync('/home/user/Archipelago-CC/frontend/modules/flashPanel/atlases/seedling-map.json', 'utf8'));
const SRC = levelSourceFromAtlas(indexLevels(MAP));
function l4() {
  const rt = createJsRuntime(); rt.setVanilla(MAP);
  rt.queueItems([{ class: 'Main', property: 'hasSword', value: true }]);
  rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [4, 16, 16] }]); rt.tick();
  const s = rt.session; const tp = rt.run.world.teleporters[0];
  return { staging: s.staging, perTick: s.perTick, live: liveOf(rt.run), levelSource: SRC, name: 'should-stop-L4', solverGoal: { kind: 'reach-exit', exit: { x: tp.x, y: tp.y } }, scratchPersistence: rt.run.scratchPersistence === true };
}
const counter = () => { let n = 0; return () => n++; };
for (const over of [{}, { holdWaitPriced: true }]) {
  for (const w of [1, 75, 76, 200]) {
    const r = withContactFidelity(over, () => withDashOnlyWindow(false, () => solveAnytime({ ...l4(), budgetWork: w === 1 ? 1e9 : SOLVER_BUDGET_WORK, upgradeWindowWork: w }, { clock: counter() })));
    console.log(JSON.stringify(over), 'window', w, r.plan?.pass, r.plan?.solution?.length, JSON.stringify(r.passes.map(({ ms, ...x }) => x)));
  }
}
