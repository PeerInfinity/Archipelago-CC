import { ctx, solve, chainNext } from './chain.mjs';
const { J, levelSource, tape0 } = ctx;
const a1 = solve(tape0);
const { tape: t2 } = chainNext(tape0, a1.plan, { kind: 'reach-exit', exit: { x: 184, y: 64 } });
for (let d = 1; d <= 16; d++) {
  const perTick = [...t2.perTick, ...Array.from({ length: d }, () => new Set())];
  const run = J.replayTape({ staging: t2.staging, perTick, levelSource, equips: t2.equips, scratchPersistence: true });
  const work = J.createWorkClock ? null : null;
  let n = 0; const shouldStop = () => { n++; return false; };
  const r = (() => { try { return { ok: true, plan: J.solveFromTape({ ...t2, levelSource, perTick, live: J.liveOf(run), dashMode: 'none', shouldStop, fineCheckpoints: true }) }; } catch (e) { return { ok: false, msg: String(e.message).slice(0, 120) }; } })();
  console.log('delay', d, r.ok ? `${r.plan.solution.length + d}t ${r.plan.modelHits?.hits}h` : 'refused ' + r.msg, 'units', n);
}
