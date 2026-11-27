import { ctx, solve, chainNext } from './chain.mjs';
const { J, levelSource, tape0, sha } = ctx;
const { withWalkBladeArm, WALK_BLADE_ARM_COUNTS } = await import('/home/user/Archipelago-CC/frontend/modules/seedlingDemo/walkBladeArm.js');
const { withAxeTimingSwordSwap } = await import('/home/user/Archipelago-CC/frontend/modules/seedlingDemo/solverBot.js');
const a1 = withWalkBladeArm(false, () => solve(tape0));
const { tape: t2 } = chainNext(tape0, a1.plan, { kind: 'reach-exit', exit: { x: 184, y: 64 } });
for (const on of [false, true]) {
  WALK_BLADE_ARM_COUNTS.rows.length = 0; WALK_BLADE_ARM_COUNTS.equips = 0;
  const a = withWalkBladeArm(on, () => solve(t2));
  const run = J.replayTape({ staging: t2.staging, perTick: [...t2.perTick, ...a.plan.solution], levelSource,
    equips: new Map([...t2.equips, ...[...a.plan.equipsAt].map(([t, s]) => [t + t2.perTick.length, s])]), scratchPersistence: true });
  const h = run.ledger('playerHits').filter((x) => x.t > t2.perTick.length);
  console.log(on ? 'ON ' : 'OFF', a.plan.solution.length, sha(JSON.stringify(a.plan.solution.map((k) => [...k]))), 'work', a.work, 'cut', J.budgetCut(a),
    a.passes.map((p) => `${p.pass}:${p.ticks}/${p.modelHits?.hits}h/w${p.work}${p.cut ? '/cut:' + p.cut : ''}`).join(' '), 'replayHits', JSON.stringify(h.map((x) => [x.t, x.id])),
    'equips', JSON.stringify([...a.plan.equipsAt]), 'bladeRows', JSON.stringify(WALK_BLADE_ARM_COUNTS.rows.slice(0, 6)));
}
const ns = withAxeTimingSwordSwap(false, () => withWalkBladeArm(true, () => solve(tape0)));
console.log('37:8 swap OFF blade ON', ns.ok, ns.ok ? ns.plan.solution.length : String(ns.message).slice(0, 200), 'work', ns.work, JSON.stringify(ns.passes.map(p=>[p.pass,p.ok,p.ticks,p.modelHits?.hits,p.work])));
const nb = withAxeTimingSwordSwap(false, () => withWalkBladeArm(false, () => solve(tape0)));
console.log('37:8 swap OFF blade OFF', nb.ok, nb.ok ? nb.plan.solution.length : sha(String(nb.message)), 'work', nb.work);
