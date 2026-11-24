// MEASUREMENT-ONLY (remeasure-7): replay ONE captured request in this process (the replay script's replayOnce) and print
// the two switches' own counters afterwards. Run with the same SEEDLING_* env as the page's worker.
// node replay-counts.mjs <requests.jsonl[.gz]> <id> <i>
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const [file, id, i] = process.argv.slice(2);
const ROOT = '/home/user/Archipelago-CC';
const raw = file.endsWith('.gz') ? gunzipSync(readFileSync(file)).toString() : readFileSync(file, 'utf8');
const row = raw.split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((r) => String(r.id) === id);
const req = row.requests[Number(i)];
const { replayOnce } = await import(`${ROOT}/scripts/procgen/replay-seedling-solve-request.mjs`);
const sb = await import(`${ROOT}/frontend/modules/seedlingDemo/solverBot.js`);
const r = await replayOnce(req.request);
console.log(`COUNTS ${id}:${i} env GSW=${process.env.SEEDLING_GOAL_START_WAIT ?? '-'} PM=${process.env.SEEDLING_PREVIEW_METER ?? '-'} enabled GSW=${sb.GOAL_START_WAIT.enabled} PM=${sb.PREVIEW_METER.enabled}`);
console.log(`  result kind=${r.kind} ok=${r.ok} work=${r.work} answer=${r.answer} ms=${r.ms} | live answer=${req.result?.answer} work=${req.result?.work} kind=${req.result?.kind} solverEnv=${req.result?.solverEnv}`);
console.log(`  GOAL_START_WAIT_COUNTS.tries=${JSON.stringify(sb.GOAL_START_WAIT_COUNTS.tries)}`);
console.log(`  PREVIEW_METER_COUNTS=${JSON.stringify(sb.PREVIEW_METER_COUNTS)}`);
