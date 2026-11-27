import { ctx, solve, chainNext } from './chain.mjs';
const { J, levelSource, tape0 } = ctx;
const SB = await import('/home/user/Archipelago-CC/frontend/modules/seedlingDemo/solverBot.js');
const a1 = solve(tape0);
const { tape: t2 } = chainNext(tape0, a1.plan, { kind: 'reach-exit', exit: { x: 184, y: 64 } });
const mk = () => J.replayTape({ staging: t2.staging, perTick: t2.perTick, levelSource, equips: t2.equips, scratchPersistence: true });
const run0 = mk();
const forkRun = J.forkRunFor({ staging: t2.staging, levelSource, scratchPersistence: true, equips: t2.equips, prefixLength: t2.perTick.length });
const out = SB.solveSegment({ run: run0, goals: J.solverGoalsOf(t2.solverGoal), name: 'probe', boot: t2.staging.boot, prefix: t2.perTick, dashMode: 'none', forkRun });
const sol = out.perTick.slice(t2.perTick.length);
// equips: from out? use records of equips by replaying run0? the run recorded primary; re-derive equips by watching primary changes is hard; use solveFromTape plan instead
const plan = J.solveFromTape({ ...t2, levelSource, dashMode: 'none' });
const T = Number(process.env.AT ?? 1151);
const run = mk(); const off = t2.perTick.length;
const actual = [];
for (const [k, held] of plan.solution.entries()) {
  const s = plan.equipsAt.get(k); if (s !== undefined) run.equipNow(s);
  if (off + k === T) break;
  run.advance(held);
}
console.log('at', run.ticksCompleted, run.state.x, run.state.y, run.progress('primaryWeapon'));
const path = JSON.parse(process.env.PATHW ?? '[{"x":200,"y":136},{"x":168,"y":136},{"x":168,"y":104},{"x":184,"y":104},{"x":184,"y":88},{"x":192,"y":72}]');
const { DEFAULT_TOLERANCE } = await import('/home/user/Archipelago-CC/frontend/modules/seedlingDemo/botDriverV1.js'); console.log('tol', DEFAULT_TOLERANCE); const w = SB.previewWalk(run, path, Number(process.env.TOL ?? DEFAULT_TOLERANCE), { strike: SB.strikePolicyFor(run, { dashMode: 'none' }) });
console.log('preview samples', w.samples.length, 'trunc', JSON.stringify(w.truncated)?.slice(0,300));
const s0 = w.samples[0]; console.log('sample keys', Object.keys(s0));
// actual continuation
const act = new Map();
for (let k = T - off; k < plan.solution.length; k++) { const s = plan.equipsAt.get(k); if (s !== undefined) run.equipNow(s); run.advance(plan.solution[k]); const c = run.chasers[0]; act.set(run.ticksCompleted, [run.state.x, run.state.y, c?.x, c?.y]); }
for (const sm of w.samples) {
  if (sm.tick < 1240 || sm.tick > 1300) continue;
  const b = (sm.chasers ?? sm.bodies ?? []).find?.(c => String(c.id).startsWith('bob'));
  const a = act.get(sm.tick);
  console.log(sm.tick, 'prev', sm.x.toFixed(1), sm.y.toFixed(1), b ? `bob ${b.x.toFixed(1)},${b.y.toFixed(1)}` : JSON.stringify(sm.chasers)?.slice(0,80), '| act', a?.map(v => v?.toFixed(1)).join(','));
}
let firstP = null, firstB = null;
for (const sm of w.samples) { const a = act.get(sm.tick); if (!a) continue; const b = (sm.chasers ?? []).find(c => String(c.id).startsWith('bob'));
  if (firstP === null && (Math.abs(a[0]-sm.x) > 1e-6 || Math.abs(a[1]-sm.y) > 1e-6)) firstP = [sm.tick, sm.x, sm.y, a[0], a[1], [...(sm.held??[])].join('+')];
  if (firstB === null && b && (Math.abs(a[2]-b.x) > 1e-6 || Math.abs(a[3]-b.y) > 1e-6)) firstB = [sm.tick, b.x, b.y, a[2], a[3]]; }
console.log('first player diff', JSON.stringify(firstP)); console.log('first bob diff', JSON.stringify(firstB));
for (const sm of w.samples) { if (sm.tick < (firstB?.[0] ?? 0) - 3 || sm.tick > (firstB?.[0] ?? 0) + 6) continue; const b = (sm.chasers ?? []).find(c => String(c.id).startsWith('bob')); const a = act.get(sm.tick); console.log('  ', sm.tick, sm.x.toFixed(2), sm.y.toFixed(2), b?.x.toFixed(2), b?.y.toFixed(2), '| act', a.map(v=>v.toFixed(2)).join(','), [...(sm.held??[])].join('+')); }
