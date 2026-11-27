// MEASUREMENT-ONLY: solve a committed page-request fixture as the page does; print the answer and LATCHED_HOLD_MOVE's rows.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const ROOT = '/home/user/Archipelago-CC';
const { restoreRequest } = await import(`${ROOT}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { levelSourceFromAtlas } = await import(`${ROOT}/frontend/modules/seedlingDemo/atlasSource.js`);
const { solveAnytime, replayTape, ANYTIME_PASSES } = await import(`${ROOT}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
const { atlasLevelSource } = await import(`${ROOT}/frontend/modules/seedlingDemo/levelSource.js`);
const sb = await import(`${ROOT}/frontend/modules/seedlingDemo/solverBot.js`);
const f = process.argv[2];
const buf = readFileSync(f);
const raw = JSON.parse(f.endsWith('.gz') ? gunzipSync(buf).toString() : buf.toString());
const body = raw.requests ? raw.requests[Number(process.env.REQ_I ?? 0)].request : (raw.request ?? raw);
const req = restoreRequest(body);
const { passes = ANYTIME_PASSES, source, ...tape } = req;
let levelSource = source ? levelSourceFromAtlas(source.records) : atlasLevelSource();
if (raw.levels) { const base = levelSource; const own = new Map(raw.levels.map(([l, r]) => [l, restoreRequest(r)])); levelSource = (l) => own.get(l) ?? base(l); }
if (process.env.LHM_FORKS) sb.LATCHED_HOLD_MOVE.maxForks = Number(process.env.LHM_FORKS);
if (process.env.LHM_DELAYS) sb.LATCHED_HOLD_MOVE.delays = process.env.LHM_DELAYS.split(",").map(Number);
const t0 = Date.now();
let a;
try { a = solveAnytime({ ...tape, levelSource }, { passes }); } catch (e) { a = { ok: false, message: `THROW ${e.message}` }; }
const text = a.ok ? JSON.stringify(a.plan.solution.map((k) => [...k])) : String(a.message ?? '');
let hits = null;
if (a.ok) {
  const run = replayTape({ staging: tape.staging, perTick: tape.perTick ?? [], levelSource, scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
  const h0 = run.playerHits.length;
  a.plan.solution.forEach((h, k) => { const s = a.plan.equipsAt?.get?.(k); if (s !== undefined) run.equipNow(s); run.advance(h); });
  hits = run.playerHits.slice(h0).map((x) => `t${x.t} ${x.source}:${x.id}`);
}
const c = sb.LATCHED_HOLD_MOVE_COUNTS;
console.log(JSON.stringify({ fx: f.split('/fixtures/').pop(), on: sb.LATCHED_HOLD_MOVE.enabled, ok: a.ok, work: a.work ?? null, ticks: a.plan?.solution?.length ?? null,
  answer: createHash('sha1').update(text).digest('hex').slice(0, 12), hits, ms: Date.now() - t0,
  lhm: { asked: c.asked, moves: c.moves.map((m) => ({ t: m.t, presser: m.presser, target: m.target, ticks: m.ticks })), declined: c.declined.map((d) => d.why.slice(0, Number(process.env.LHM_WHY ?? 120))) },
  msg: a.ok ? null : text.slice(0, 160) }));
