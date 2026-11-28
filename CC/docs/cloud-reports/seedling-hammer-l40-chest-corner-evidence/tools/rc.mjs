// MEASUREMENT-ONLY (remeasure-11; remeasure-10's + OAC, PSB, HSB): replay ONE captured request in this process (the replay script's replayOnce) and print
// the switches' own counters afterwards (BOS, GSW, PM, PKH, SPL, KTA from re-measure-9, plus PKSW, PKRB, DSS, LHM), and,
// for a plan, its ticks and hits: the plan's keys replayed on a FRESH run after the request's own prefix
// (hammerPkswHitsRows.js's freshReplay). The answer hash = the page's when the keys are the page's, so the hits are the page plan's.
// Run with the same SEEDLING_* env as the page's worker.
// node replay-counts.mjs <requests.jsonl[.gz]> <id> <i> [budgetWork override]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const [file, id, i, budget] = process.argv.slice(2);
const ROOT = '/home/user/Archipelago-CC';
const raw = file.endsWith('.gz') ? gunzipSync(readFileSync(file)).toString() : readFileSync(file, 'utf8');
const row = file.endsWith('.json.gz') && !file.includes('jsonl') ? { requests: [JSON.parse(raw)] } : raw.split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((r) => String(r.id) === id);
const req = row.requests[Number(i)];
if (budget) req.request.budgetWork = Number(budget);
const sb = await import(`${ROOT}/frontend/modules/seedlingDemo/solverBot.js`);
const { levelSourceFromAtlas } = await import(`${ROOT}/frontend/modules/seedlingDemo/atlasSource.js`);
const JS = await import(`${ROOT}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
const { solveAnytime, ANYTIME_PASSES, replayTape } = await import(`${ROOT}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
const { restoreRequest } = await import(`${ROOT}/scripts/procgen/seedlingSolveRequestCodec.js`);
const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);
const e = (n) => process.env[`SEEDLING_${n}`] ?? '-';
const { passes = ANYTIME_PASSES, source, ...tape } = restoreRequest(req.request);
const levelSource = levelSourceFromAtlas(source.records);
const t0 = Date.now();
const answer = solveAnytime({ ...tape, source, levelSource }, { passes });
const text = answer.ok ? JSON.stringify(answer.plan.solution.map((k) => [...k])) : String(answer.message ?? '');
let play = '';
if (answer.ok) {
    const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, equips: tape.equips ?? null,
        scratchPersistence: tape.scratchPersistence === true });
    const h0 = run.playerHits.length; const d0 = run.playerDeaths.length;
    for (const [k, held] of answer.plan.solution.entries()) {
        const slot = answer.plan.equipsAt?.get(k);
        if (slot !== undefined) run.equipNow(slot);
        run.advance(held);
    }
    const hits = run.playerHits.slice(h0).map((h) => `t${h.t} ${h.source}:${h.id}`);
    play = ` ticks=${answer.plan.solution.length} hits=${hits.length} deaths=${run.playerDeaths.length - d0} ${JSON.stringify(hits)}`;
}
const on = (n) => (sb[n]?.enabled ?? '?');
console.log(`COUNTS ${id}:${i}${budget ? ' budget=' + budget : ''} env PKSW=${e('PRESS_KILL_START_WAIT')} PKRB=${e('PRESS_KILL_REFUGE_BOMBS')} DSS=${e('DASH_STAND_SIGHT')} LHM=${e('LATCHED_HOLD_MOVE')} PKH=${e('PRESS_KILL_HOLD')} OAC=${e('OPP_AIM_CHASERS')} PSB=${e('PRESS_KILL_STRIKE_BOMBS')} HSB=${e('HIT_AVOID_STAND_BOMBS')}`
    + ` enabled PKSW=${on('PRESS_KILL_START_WAIT')} PKRB=${on('PRESS_KILL_REFUGE_BOMBS')} DSS=${on('DASH_STAND_SIGHT')} LHM=${on('LATCHED_HOLD_MOVE')} PKH=${on('PRESS_KILL_HOLD')} OAC=${on('OPP_AIM_CHASERS')} PSB=${on('PRESS_KILL_STRIKE_BOMBS')} HSB=${JS.HIT_AVOID_STAND_BOMBS?.enabled ?? '?'}`
    + ` BOS=${on('BRIDGE_OPEN_STRAY')} GSW=${on('GOAL_START_WAIT')} PM=${on('PREVIEW_METER')} SPL=${on('STRIKE_PREVIEW_LEAN')} KTA=${on('KEYLOCK_TURRET_ARRIVAL')} KTEB=${on('KEYLOCK_TURRET_EDGE_BAIT')} HF=${on('HAMMER_FIGHT')}`);
console.log(`  result ok=${answer.ok} kind=${answer.kind ?? null} work=${answer.work} answer=${sha(text)} ms=${Date.now() - t0}${play}`);
console.log(`  live   ok=${req.result?.ok} kind=${req.result?.kind} work=${req.result?.work} answer=${req.result?.answer} solverEnv=${req.result?.solverEnv}`);
if (!answer.ok) console.log(`  message=${text.slice(0, 700)}`);
const j = (v, n = 1500) => JSON.stringify(v)?.slice(0, n);
console.log(`  PRESS_KILL_START_WAIT_COUNTS.rows=${j(sb.PRESS_KILL_START_WAIT_COUNTS?.rows)}`);
console.log(`  PRESS_KILL_REFUGE_BOMBS_COUNTS=${j(sb.PRESS_KILL_REFUGE_BOMBS_COUNTS)}`);
console.log(`  DASH_STAND_SIGHT.counts=${j(sb.DASH_STAND_SIGHT?.counts)}`);
console.log(`  LATCHED_HOLD_MOVE_COUNTS=${j(sb.LATCHED_HOLD_MOVE_COUNTS)}`);
console.log(`  OPP_AIM_CHASERS_COUNTS=${j(sb.OPP_AIM_CHASERS_COUNTS)}`);
console.log(`  HIT_AVOID_STAND_BOMBS_COUNTS=${j(JS.HIT_AVOID_STAND_BOMBS_COUNTS)}`);
console.log(`  PRESS_KILL_STRIKE_BOMBS_COUNTS=${j(sb.PRESS_KILL_STRIKE_BOMBS_COUNTS)}`);
console.log(`  PRESS_KILL_HOLD_COUNTS.rows=${j(sb.PRESS_KILL_HOLD_COUNTS?.rows)}`);
console.log(`  BRIDGE_OPEN_STRAY_COUNTS.waived=${j(sb.BRIDGE_OPEN_STRAY_COUNTS?.waived)}`);
console.log(`  GOAL_START_WAIT_COUNTS.tries=${j(sb.GOAL_START_WAIT_COUNTS?.tries)}`);
console.log(`  PREVIEW_METER_COUNTS=${j(sb.PREVIEW_METER_COUNTS)}`);
console.log(`  STRIKE_PREVIEW_LEAN_COUNTS=${j(sb.STRIKE_PREVIEW_LEAN_COUNTS)}`);
console.log(`  KEYLOCK_TURRET_ARRIVAL_COUNTS.asked=${j(sb.KEYLOCK_TURRET_ARRIVAL_COUNTS?.asked, 600)}`);
