// MEASUREMENT-ONLY: solve a committed page-request fixture as the page does; one JSON line with the switches' reach.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const ROOT = '/home/user/Archipelago-CC';
const { restoreRequest } = await import(`${ROOT}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { levelSourceFromAtlas } = await import(`${ROOT}/frontend/modules/seedlingDemo/atlasSource.js`);
const { solveAnytime, replayTape } = await import(`${ROOT}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
const { atlasLevelSource } = await import(`${ROOT}/frontend/modules/seedlingDemo/levelSource.js`);
const sb = await import(`${ROOT}/frontend/modules/seedlingDemo/solverBot.js`);
const raw = JSON.parse(gunzipSync(readFileSync(process.argv[2])).toString());
const req = restoreRequest(raw.requests ? raw.requests[0].request : (raw.request ?? raw));
const { passes, source, ...tape } = req;
const levelSource = source ? levelSourceFromAtlas(source.records) : atlasLevelSource();
const t0 = Date.now();
const a = solveAnytime({ ...tape, levelSource }, { passes });
const text = a.ok ? JSON.stringify(a.plan.solution.map((k) => [...k])) : String(a.message ?? '');
let hits = null;
if (a.ok) {
  const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
  const h0 = run.playerHits.length;
  a.plan.solution.forEach((h, k) => { const s = a.plan.equipsAt?.get?.(k); if (s !== undefined) run.equipNow(s); run.advance(h); });
  hits = run.playerHits.slice(h0).map((x) => `t${x.t} ${x.source}:${x.id}`);
}
console.log(JSON.stringify({ fx: process.argv[2].split('/').pop(), key: raw.key ?? null, variant: process.env.VARIANT, ok: a.ok, work: a.work, ticks: a.plan?.solution?.length ?? null,
  answer: createHash('sha1').update(text).digest('hex').slice(0, 12), hits, ms: Date.now() - t0,
  refugeBombs: sb.PRESS_KILL_REFUGE_BOMBS_COUNTS, standSight: sb.DASH_STAND_SIGHT.counts, pksw: sb.PRESS_KILL_START_WAIT_COUNTS.rows.length,
  msg: a.ok ? null : text.slice(0, Number(process.env.MSGLEN ?? 140)) }));
