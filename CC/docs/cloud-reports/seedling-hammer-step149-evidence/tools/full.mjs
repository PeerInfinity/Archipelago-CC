// MEASUREMENT-ONLY: solve one captured request, print the FULL answer message and passes.
// node full.mjs <requests.jsonl[.gz]> <id> <i> [budget]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const ROOT = '/home/user/Archipelago-CC';
const [file, id, i, budget] = process.argv.slice(2);
const raw = file.endsWith('.gz') ? gunzipSync(readFileSync(file)).toString() : readFileSync(file, 'utf8');
const row = raw.split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((r) => String(r.id) === id);
const cap = row.requests[Number(i)].request;
if (budget) cap.budgetWork = Number(budget);
if (process.env.SEAM_SHIFT) cap.staging.seam.time += Number(process.env.SEAM_SHIFT);
const { restoreRequest } = await import(`${ROOT}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { levelSourceFromAtlas } = await import(`${ROOT}/frontend/modules/seedlingDemo/atlasSource.js`);
const { solveAnytime, ANYTIME_PASSES } = await import(`${ROOT}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
const req = restoreRequest(cap);
const { passes = ANYTIME_PASSES, source, ...tape } = req;
const levelSource = levelSourceFromAtlas(source.records);
const t0 = Date.now();
const a = solveAnytime({ ...tape, source, levelSource }, { passes });
console.log('KEY', row.key, 'goals', JSON.stringify(tape.goals ?? tape.goal)?.slice(0, 800));
console.log('BOOT', JSON.stringify(tape.staging?.boot ?? tape.boot), 'budget', cap.budgetWork);
console.log('RESULT ok', a.ok, 'kind', a.kind, 'work', a.work, 'ms', Date.now() - t0, 'ticks', a.plan?.solution?.length);
console.log('PASSES', JSON.stringify((a.passes ?? []).map(({ ms, ...r }) => r)));
console.log('MESSAGE', a.message);
if (process.env.DUMP) { const { writeFileSync } = await import('node:fs'); writeFileSync(process.env.DUMP, JSON.stringify({ ok: a.ok, solution: a.plan?.solution?.map((k) => [...k]), message: a.message })); }
const sb = await import(`${ROOT}/frontend/modules/seedlingDemo/solverBot.js`);
console.log('PKSW', JSON.stringify(sb.PRESS_KILL_START_WAIT_COUNTS?.rows ?? null).slice(0, 3000));
if (a.ok && process.env.HITS) {
  const ex = a.plan.expected;
  console.log('EXPECTED keys', Object.keys(ex[0]).join(','), 'len', ex.length, 'prefix', a.plan.prefixLength);
  for (let k = 1; k < ex.length; k += 1) {
    const p = ex[k - 1], q = ex[k];
    for (const f of ['hits', 'playerHits', 'health', 'hp', 'deaths']) if (f in q && JSON.stringify(q[f]) !== JSON.stringify(p[f])) console.log('  tick', k, f, JSON.stringify(p[f]), '->', JSON.stringify(q[f]), 'at', q.x?.toFixed?.(2), q.y?.toFixed?.(2), 'lv', q.level);
  }
  console.log('verbs', a.plan.verbs);
}
if (a.ok && process.env.HITS) {
  const { replayTape } = await import(`${ROOT}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
  console.log('TAPE fields', Object.keys(tape).join(','));
  const pre = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, equips: tape.equips ?? null, holds: tape.holds ?? null });
  console.log('prefix hits', JSON.stringify(pre.ledger('playerHits')));
  const eq = new Map(tape.equips ?? []);
  for (const [t, s] of a.plan.equipsAt ?? []) eq.set(tape.perTick.length + t, s);
  const all = replayTape({ staging: tape.staging, perTick: [...tape.perTick, ...a.plan.solution], levelSource, equips: eq, holds: tape.holds ?? null });
  console.log('full hits', JSON.stringify(all.ledger('playerHits')), 'end', all.level, all.state.x.toFixed(1), all.state.y.toFixed(1));
}
if (a.ok && process.env.HITS) {
  const { createRunForStaging } = await import(`${ROOT}/frontend/modules/seedlingDemo/tapeRunner.js`);
  const eq = new Map(tape.equips ?? []);
  for (const [t, s] of a.plan.equipsAt ?? []) eq.set(tape.perTick.length + t, s);
  const keys = [...tape.perTick, ...a.plan.solution];
  const r = createRunForStaging(tape.staging, levelSource);
  const [from, to] = (process.env.HITS_WIN ?? '1500,1720').split(',').map(Number);
  keys.forEach((h, i) => { const s = eq.get(i); if (s !== undefined) r.equipNow(s); r.advance(h);
    if (i >= from && i <= to && (i % 5 === 0)) console.log('POS', i + 1, r.state.x.toFixed(1), r.state.y.toFixed(1), [...h].join('+'), 'broken', JSON.stringify([...(r.world.brokenRocks ?? [])]).slice(0,80)); });
}
