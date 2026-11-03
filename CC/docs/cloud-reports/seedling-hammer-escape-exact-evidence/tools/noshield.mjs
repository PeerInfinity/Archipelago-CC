import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const root = process.argv[2];
const M = (p) => import(`${root}/${p}`);
const { restoreRequest } = await M('scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await M('frontend/modules/seedlingDemo/atlasSource.js');
const { replayTape } = await M('frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const { pressEscape } = await M('frontend/modules/seedlingDemo/solverBot.js');
const X = await M('frontend/modules/seedlingDemo/pressEscapeExact.js');
const row = JSON.parse(gunzipSync(readFileSync(`${root}/frontend/modules/seedlingDemo/fixtures/spin-witness/leg860-request.json.gz`)).toString('utf8'));
const c = row.request;
const REQ = restoreRequest({ ...c, staging: { ...c.staging, seam: { ...c.staging.seam, time: 5950 } } });
const SOURCE = levelSourceFromAtlas(REQ.source.records);
function standAt(x, y) { const items = { ...REQ.staging.seam.items, hasShield: false };
  return replayTape({ staging: { ...REQ.staging, boot: { ...REQ.staging.boot, x: x - 8, y: y - 8 }, seam: { ...REQ.staging.seam, items } }, perTick: [], levelSource: SOURCE, scratchPersistence: REQ.scratchPersistence === true, equips: REQ.equips ?? null, holds: REQ.holds ?? null }); }
for (const [x, y, key] of [[808, 854, 'right'], [814, 854, 'right'], [829, 860, 'left'], [820, 854, 'right']]) {
  for (const on of [false, true]) {
    const r = X.withPressEscapeExact(on, () => { const run = standAt(x, y); return pressEscape(run, { state: run.state, at: run.ticksCompleted, keys: [new Set([key])], pressAt: run.ticksCompleted + 1, id: 'spinner@816,848', caller: 'aim' }); });
    const d = standAt(x, y); d.advance(new Set([key]));
    console.log(x, y, on, r.ok, r.claim, r.bound, (r.why ?? '').slice(0, 120), 'runHitAtT0:', d.playerHits.length);
  }
}
