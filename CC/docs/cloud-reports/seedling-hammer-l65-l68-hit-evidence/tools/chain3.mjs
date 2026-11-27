// the 3-leg chain 37:8 -> L65->L68 (184,64) -> L68 Health; fresh replay of the whole chain. Measurement only.
import { writeFileSync } from 'node:fs';
import { ctx, solve, chainNext } from './chain.mjs';
const { J, levelSource, tape0, sha } = ctx;
const legs = [];
let tape = tape0;
const goals = [{ kind: 'reach-exit', exit: { x: 184, y: 64 } }, { kind: 'collect-placement', placement: { x: 16, y: 16 } }];
let a = solve(tape);
const row = (name, a, from) => ({ name, ok: a.ok, ticks: a.ok ? a.plan.solution.length : null, work: a.work,
  answer: sha(a.ok ? JSON.stringify(a.plan.solution.map((k) => [...k])) : String(a.message ?? '')), from,
  passes: a.passes.map((p) => `${p.pass}:${p.ok ? p.ticks + 't' : 'refused'}${p.modelHits ? '/' + p.modelHits.hits + 'h' : ''}${p.work != null ? '/w' + p.work : ''}${p.limit ? '/' + p.limit : ''}${p.cut ? '/cut:' + p.cut : ''}${p.tries != null ? '/tries' + p.tries : ''}`).join(' '),
  verbs: a.ok ? a.plan.verbs : null, budgetCut: J.budgetCut(a), msg: a.ok ? null : String(a.message).slice(0, 300) });
legs.push(row('37:8 L63->L65', a, 't0'));
for (const [i, g] of goals.entries()) {
  if (!a.ok) break;
  const { tape: t, run } = chainNext(tape, a.plan, g);
  const r0 = J.liveOf(run).row;
  tape = t; a = solve(tape);
  legs.push(row(i === 0 ? 'L65->L68 (184,64)' : 'L68 Health (16,16)', a, `L${r0.level} (${r0.x.toFixed(1)},${r0.y.toFixed(1)}) t${tape.perTick.length}`));
}
let full = null;
if (a.ok) {
  const off = tape.perTick.length;
  const perTick = [...tape.perTick, ...a.plan.solution];
  const equips = new Map([...tape.equips, ...[...a.plan.equipsAt].map(([t, s]) => [t + off, s])]);
  const run = J.replayTape({ staging: tape.staging, perTick, levelSource, equips, scratchPersistence: true });
  full = { ticks: perTick.length, hits: run.ledger('playerHits'), deaths: run.ledger('playerDeaths').length, end: J.liveOf(run).row,
    equips: [...equips].sort((x, y) => x[0] - y[0]) };
  if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify({ perTick: perTick.map((k) => [...k]), equips: full.equips }));
}
for (const l of legs) console.log(JSON.stringify(l));
console.log('FULL', JSON.stringify(full));
