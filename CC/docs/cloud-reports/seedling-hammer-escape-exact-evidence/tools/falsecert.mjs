import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const root = process.argv[2];
const M = (p) => import(`${root}/${p}`);
const { restoreRequest } = await M('scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await M('frontend/modules/seedlingDemo/atlasSource.js');
const { replayTape } = await M('frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const { pressEscape } = await M('frontend/modules/seedlingDemo/solverBot.js');
const X = await M('frontend/modules/seedlingDemo/pressEscapeExact.js');
X.PRESS_ESCAPE_EXACT.enabled = true;
for (const p of (process.env.XPARTS_OFF ?? '').split(',').filter(Boolean)) X.PRESS_ESCAPE_EXACT.parts[p] = false;
const row = JSON.parse(gunzipSync(readFileSync(`${root}/frontend/modules/seedlingDemo/fixtures/spin-witness/leg860-request.json.gz`)).toString('utf8'));
const c = row.request;
const REQ = restoreRequest({ ...c, staging: { ...c.staging, seam: { ...c.staging.seam, time: 5950 } } });
const SOURCE = levelSourceFromAtlas(REQ.source.records);
const standAt = (x, y) => replayTape({ staging: { ...REQ.staging, boot: { ...REQ.staging.boot, x: x - 8, y: y - 8 } }, perTick: [], levelSource: SOURCE, scratchPersistence: REQ.scratchPersistence === true, equips: REQ.equips ?? null, holds: REQ.holds ?? null });
const NO = new Set();
for (let y = 830; y <= 872; y += 3) for (let x = 790; x <= 846; x += 3) for (const key of ['left', 'right', 'up', 'down']) {
  let run; try { run = standAt(x, y); } catch { continue; }
  const n = run.ticksCompleted;
  let r; try { r = pressEscape(run, { state: run.state, at: n, keys: [new Set([key])], pressAt: n + 1, id: 'spinner@816,848', caller: 'aim' }); } catch { continue; }
  if (!r.ok) continue;
  const keys = [new Set([key]), new Set(['primary'])]; for (let t = n + 2; t < r.landing; t++) keys.push(NO); keys.push(...r.keys);
  const d = standAt(x, y); const hits = []; const b0 = d.shieldBumps.length;
  keys.forEach((k, i) => { const h = d.playerHits.length; d.advance(k); if (d.playerHits.length > h) hits.push({ i, t: n + i, src: d.playerHits.at(-1)?.source ?? d.playerHits.at(-1)?.kind ?? JSON.stringify(d.playerHits.at(-1)).slice(0, 120) }); });
  if (hits.length) console.log(JSON.stringify({ x, y, key, landing: r.landing - n, keys: keys.length, hits, bumps: d.shieldBumps.slice(b0).map((b) => [b.t - n, b.family, b.id, b.shoved]) }));
}
