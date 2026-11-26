// MEASUREMENT-ONLY (f1-refusal): the planner's two non-default LHM configs, solved as their committed rows solve them.
//   node lhmcfg.mjs 371   → leg 371 @5266, PRESS_KILL_BOMBS OFF, the dashless pass alone (hammerRefugeBandText's solve371)
//   node lhmcfg.mjs 368a  → leg 368 @5290, BOMB_PHASE_WAIT OFF, {dashSpinnerForecast:false}, every pass (fidelityL40Bk2's solveAt)
//   node lhmcfg.mjs 368b  → the same with L40BK2_D2_SWITCHES
// Switches from SEEDLING_* env. Prints {cfg, ok, work, ticks, hits (fresh replay), passes, msg}.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
const ROOT = '/home/user/Archipelago-CC'; const D = `${ROOT}/frontend/modules/seedlingDemo`;
const { restoreRequest } = await import(`${ROOT}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { levelSourceFromAtlas } = await import(`${D}/atlasSource.js`);
const J = await import(`${D}/jsRuntimeSolver.js`);
const { withPressKillBombs } = await import(`${D}/pressKillCost.js`);
const { withContactFidelity } = await import(`${D}/contactFidelity.js`);
const { withBombPhaseWait, LATCHED_HOLD_MOVE_COUNTS } = await import(`${D}/solverBot.js`);
const { L40BK2_D2_SWITCHES, L40BK2_WITNESS_DIR } = await import(`${D}/fidelityL40Bk2.js`);
const cfg = process.argv[2];
let line, time, run;
if (cfg === '371') { line = JSON.parse(gunzipSync(readFileSync(`${D}/fixtures/hammer-bx-371/leg371-l40-request.json.gz`)).toString()); time = 5266; }
else { line = JSON.parse(gunzipSync(readFileSync(join(L40BK2_WITNESS_DIR, 'leg368-request.jsonl.gz'))).toString()); time = 5290; }
const c = line.requests[0].request;
const req = restoreRequest({ ...c, staging: { ...c.staging, seam: { ...c.staging.seam, time } } });
const { passes = J.ANYTIME_PASSES, source, ...tape } = req;
const levelSource = levelSourceFromAtlas(source.records);
const solve = (ps) => J.solveAnytime({ ...tape, source, levelSource }, { passes: ps });
let a;
if (cfg === '371') a = withPressKillBombs(false, () => solve(passes.slice(0, 1)));
else a = withBombPhaseWait(false, () => withContactFidelity(cfg === '368a' ? { dashSpinnerForecast: false } : L40BK2_D2_SWITCHES, () => solve(passes)));
let hits = null;
if (a.ok) {
  const r = J.replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
  const h0 = r.playerHits.length;
  a.plan.solution.forEach((h, k) => { const s = a.plan.equipsAt?.get?.(k); if (s !== undefined) r.equipNow(s); r.advance(h); });
  hits = r.playerHits.slice(h0).map((x) => `t${x.t} ${x.source}:${x.id}`);
}
console.log(JSON.stringify({ cfg, variant: process.env.VARIANT ?? null, ok: a.ok, work: a.work, ticks: a.plan?.solution?.length ?? null, hits,
  lhm: { asked: LATCHED_HOLD_MOVE_COUNTS.asked, moves: LATCHED_HOLD_MOVE_COUNTS.moves.length, declined: LATCHED_HOLD_MOVE_COUNTS.declined.length },
  hsb: { ...J.HIT_AVOID_STAND_BOMBS_COUNTS }, rsb: { ...J.REFUSAL_STAND_BOMBS_COUNTS },
  passes: (a.passes ?? []).map((p) => [p.pass, p.ok ? p.ticks : (p.kind ?? 'x'), p.work, p.modelHits ? p.modelHits.hits : null, p.cut ?? p.deadline ?? null].join(':')),
  msg: a.ok ? null : String(a.message).slice(0, 260) }));
