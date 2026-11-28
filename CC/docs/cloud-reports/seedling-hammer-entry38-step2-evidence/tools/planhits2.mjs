// usage: [BUDGET=n] [KEYS_OUT=f] node planhits.mjs <jsonl> <id> <i> — solve the captured request, replay the plan fresh, print hits. Measurement only.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const R = '/home/user/Archipelago-CC/';
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(R + 'frontend/modules/seedlingDemo/atlasSource.js');
const J = await import(R + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const G = await import(R + 'frontend/modules/seedlingDemo/spearPressGateWait.js');
const F = await import(R + 'frontend/modules/seedlingDemo/pressGlideFollow.js');
const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);
const [,, file, id, i] = process.argv;
const leg = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((r) => String(r.id) === id);
const cap = leg.requests.find((r) => String(r.i) === i).request;
let { passes = J.ANYTIME_PASSES, source, ...tape } = restoreRequest(cap);
if (process.env.PASS) passes = passes.filter((p) => p.pass === process.env.PASS);
if (process.env.BUDGET) tape.budgetWork = Number(process.env.BUDGET);
if (process.env.WINDOW) tape.upgradeWindowWork = Number(process.env.WINDOW);
const levelSource = levelSourceFromAtlas(source.records);
G.resetSpearPressGateWaitCounts();
const a = J.solveAnytime({ ...tape, source, levelSource }, { passes });
const text = a.ok ? JSON.stringify(a.plan.solution.map((k) => [...k])) : String(a.message ?? '');
console.log('ANSWER', JSON.stringify({ ok: a.ok, answer: sha(text), work: a.work, ticks: a.ok ? a.plan.solution.length : null,
  passes: (a.passes ?? []).map(({ ms, ...r }) => r), message: a.ok ? null : text.slice(0, 400) }));
console.log('SPGW', JSON.stringify(G.SPEAR_PRESS_GATE_WAIT_COUNTS), 'enabled', G.SPEAR_PRESS_GATE_WAIT.enabled);
console.log('PGF', JSON.stringify({...F.PRESS_GLIDE_FOLLOW_COUNTS, declined: F.PRESS_GLIDE_FOLLOW_COUNTS.declined.map((d) => ({ ...d, why: d.why.slice(0, 160) }))}), 'enabled', F.PRESS_GLIDE_FOLLOW.enabled);
if (a.ok) {
  const off = tape.perTick.length;
  const equips = new Map([...(tape.equips ?? new Map()), ...[...(a.plan.equipsAt ?? [])].map(([t, s]) => [t + off, s])]);
  const run = J.replayTape({ staging: tape.staging, perTick: [...tape.perTick, ...a.plan.solution], levelSource, equips,
    scratchPersistence: tape.scratchPersistence === true });
  const hits = (run.ledger('playerHits') ?? []).filter((h) => h.t > off);
  const deaths = (run.ledger('playerDeaths') ?? []).filter((h) => h.t > off);
  console.log('REPLAY', JSON.stringify({ off, end: off + a.plan.solution.length, hits: hits.map((h) => ({ t: h.t, source: h.source, id: h.id })), deaths: deaths.length, live: J.liveOf(run).row }));
  if (process.env.KEYS_OUT) writeFileSync(process.env.KEYS_OUT, JSON.stringify({ off, solution: a.plan.solution.map((k) => [...k]), equipsAt: [...(a.plan.equipsAt ?? [])] }));
}
