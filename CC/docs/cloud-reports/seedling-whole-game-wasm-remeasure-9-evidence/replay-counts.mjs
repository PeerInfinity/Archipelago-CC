// MEASUREMENT-ONLY (remeasure-9): replay ONE captured request in this process (the replay script's replayOnce) and print
// the TRAIN-214 switches (BOS, GSW, PM, PKH, SPL, KTA)' own counters afterwards. Run with the same SEEDLING_* env as the page's worker.
// node replay-counts.mjs <requests.jsonl[.gz]> <id> <i> [budgetWork override]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const [file, id, i, budget] = process.argv.slice(2);
const ROOT = '/home/user/Archipelago-CC';
const raw = file.endsWith('.gz') ? gunzipSync(readFileSync(file)).toString() : readFileSync(file, 'utf8');
const row = raw.split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((r) => String(r.id) === id);
const req = row.requests[Number(i)];
if (budget) req.request.budgetWork = Number(budget);
const { replayOnce } = await import(`${ROOT}/scripts/procgen/replay-seedling-solve-request.mjs`);
const sb = await import(`${ROOT}/frontend/modules/seedlingDemo/solverBot.js`);
const e = (n) => process.env[`SEEDLING_${n}`] ?? '-';
const r = await replayOnce(req.request);
console.log(`COUNTS ${id}:${i}${budget ? " budget=" + budget : ""} env BOS=${e("BRIDGE_OPEN_STRAY")} GSW=${e("GOAL_START_WAIT")} PM=${e("PREVIEW_METER")} PKH=${e("PRESS_KILL_HOLD")} SPL=${e("STRIKE_PREVIEW_LEAN")} KTA=${e("KEYLOCK_TURRET_ARRIVAL")} enabled BOS=${sb.BRIDGE_OPEN_STRAY.enabled} GSW=${sb.GOAL_START_WAIT.enabled} PM=${sb.PREVIEW_METER.enabled} PKH=${sb.PRESS_KILL_HOLD.enabled} SPL=${sb.STRIKE_PREVIEW_LEAN.enabled} KTA=${sb.KEYLOCK_TURRET_ARRIVAL.enabled}`);
console.log(`  BRIDGE_OPEN_STRAY_COUNTS.waived=${JSON.stringify(sb.BRIDGE_OPEN_STRAY_COUNTS.waived).slice(0, 1500)}`);
console.log(`  result kind=${r.kind} ok=${r.ok} work=${r.work} answer=${r.answer} ms=${r.ms} | live answer=${req.result?.answer} work=${req.result?.work} kind=${req.result?.kind} solverEnv=${req.result?.solverEnv}`);
console.log(`  GOAL_START_WAIT_COUNTS.tries=${JSON.stringify(sb.GOAL_START_WAIT_COUNTS.tries)}`);
console.log(`  PREVIEW_METER_COUNTS=${JSON.stringify(sb.PREVIEW_METER_COUNTS)}`);
console.log(`  PRESS_KILL_HOLD_COUNTS.rows=${JSON.stringify(sb.PRESS_KILL_HOLD_COUNTS.rows).slice(0, 1500)}`);
console.log(`  STRIKE_PREVIEW_LEAN_COUNTS=${JSON.stringify(sb.STRIKE_PREVIEW_LEAN_COUNTS)}`);
console.log(`  KEYLOCK_TURRET_ARRIVAL_COUNTS.asked=${JSON.stringify(sb.KEYLOCK_TURRET_ARRIVAL_COUNTS.asked).slice(0, 1500)}`);
console.log(`  KEYLOCK_TURRET_COUNTS=${JSON.stringify(sb.KEYLOCK_TURRET_COUNTS).slice(0, 800)}`);
