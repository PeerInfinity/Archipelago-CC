import { ctx, solve, chainNext } from './chain.mjs';
const { J, levelSource, tape0 } = ctx;
const a1 = solve(tape0);
const { tape: t2 } = chainNext(tape0, a1.plan, { kind: 'reach-exit', exit: { x: 184, y: 64 } });
const a2 = solve(t2);
const plan = a2.plan;
const off = t2.perTick.length;
const run = J.replayTape({ staging: t2.staging, perTick: t2.perTick, levelSource, equips: t2.equips, scratchPersistence: true });
const every = Number(process.argv[2] ?? 10);
for (const [k, held] of plan.solution.entries()) {
  const slot = plan.equipsAt.get(k); if (slot !== undefined) run.equipNow(slot);
  run.advance(held);
  const t = off + k + 1;
  const bob = run.chasers.filter(c => String(c.id).startsWith('bob'));
  const p = run.player ?? {};
  const row = J.liveOf(run).row;
  if (k % every === 0 || (t > 1240 && t < 1300)) console.log(t, [...held].join('+') || '-', row.x.toFixed?.(1) ?? row.x, row.y.toFixed?.(1) ?? row.y, bob.map(b => `${b.id}(${b.x.toFixed(1)},${b.y.toFixed(1)} h${b.hits} ht${b.hitsTimer}${b.dying?' dying':''})`).join(' '), 'all:', run.chasers.length);
}
console.log('chasers at end', JSON.stringify(run.chasers.map(c=>[c.id,c.x|0,c.y|0,c.hits])));
