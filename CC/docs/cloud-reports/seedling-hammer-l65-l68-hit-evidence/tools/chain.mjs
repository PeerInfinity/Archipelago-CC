// chained solve: 37:8 (L63->L65), then L65->L68 (184,64). Measurement only.
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const R = '/home/user/Archipelago-CC/';
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(R + 'frontend/modules/seedlingDemo/atlasSource.js');
const J = await import(R + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const { tapeEquips } = await import(R + 'frontend/modules/seedlingDemo/wasmPlayback.js');
const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);
const file = process.env.CHAIN_FILE ?? '/tmp/claude-0/-home-user-Archipelago-CC/b316bd68-fa14-542c-ba25-94e639865931/scratchpad/S1r11.jsonl.gz';
const legs = gunzipSync(readFileSync(file)).toString('utf8').trim().split('\n').map((l) => JSON.parse(l));
const cap = legs.find((l) => l.id === 37).requests.find((r) => r.i === 8).request;
const { passes = J.ANYTIME_PASSES, source, ...tape0 } = restoreRequest(cap);
const levelSource = levelSourceFromAtlas(source.records);
export const ctx = { J, levelSource, source, passes, tape0, sha };
function brief(a) {
  return { ok: a.ok, kind: a.kind ?? null, work: a.work, ticks: a.ok ? a.plan.solution.length : null,
    answer: sha(a.ok ? JSON.stringify(a.plan.solution.map((k) => [...k])) : String(a.message ?? '')),
    passes: a.passes, msg: a.ok ? null : String(a.message).slice(0, 600) };
}
export function solve(req) { return J.solveAnytime({ ...req, source, levelSource }, { passes }); }
export function chainNext(prevTape, plan, solverGoal, extra = {}) {
  const off = prevTape.perTick.length;
  const perTick = [...prevTape.perTick, ...plan.solution];
  const equips = new Map([...(prevTape.equips ?? new Map())]);
  for (const [t, s] of plan.equipsAt ?? []) equips.set(t + off, s);
  const run = J.replayTape({ staging: prevTape.staging, perTick, levelSource, equips, scratchPersistence: prevTape.scratchPersistence === true });
  return { tape: { ...prevTape, perTick, equips, live: J.liveOf(run), solverGoal, budgetWork: 640, upgradeWindowWork: 85, ...extra }, run };
}
if (process.argv[1].endsWith('chain.mjs')) {
  const a1 = solve(tape0);
  console.log('37:8', JSON.stringify(brief(a1)));
  const { tape: t2, run } = chainNext(tape0, a1.plan, { kind: 'reach-exit', exit: { x: 184, y: 64 } });
  console.log('arrive', JSON.stringify(J.liveOf(run).row));
  const a2 = solve(t2);
  console.log('L65->L68', JSON.stringify(brief(a2)));
  if (a2.ok) {
    const r = J.replayTape({ staging: t2.staging, perTick: [...t2.perTick, ...a2.plan.solution], levelSource,
      equips: new Map([...t2.equips, ...[...a2.plan.equipsAt].map(([t, s]) => [t + t2.perTick.length, s])]), scratchPersistence: true });
    console.log('hits', JSON.stringify(r.ledger ? r.ledger('playerHits') : r.playerHits));
    console.log('budgetCut', J.budgetCut(a2), 'verbs', a2.plan.verbs, 'forcedHits', JSON.stringify(a2.plan.forcedHits ?? null));
  }
}
