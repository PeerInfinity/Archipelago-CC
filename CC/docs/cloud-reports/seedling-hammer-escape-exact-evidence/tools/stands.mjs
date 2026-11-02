// usage: node stands.mjs <root>   (env: SEEDLING_FORECAST_SHIELD_BUMP, SEEDLING_PRESS_ESCAPE_SHIELD_CLAIM, ...)
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const root = process.argv[2];
const M = (p) => import(`${root}/${p}`);
const { restoreRequest } = await M('scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await M('frontend/modules/seedlingDemo/atlasSource.js');
const { replayTape } = await M('frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const { pressEscape } = await M('frontend/modules/seedlingDemo/solverBot.js');
const G = await M('frontend/modules/seedlingDemo/pressKillGuards.js');
const X = await M('frontend/modules/seedlingDemo/pressEscapeExact.js');
for (const p of (process.env.XPARTS_OFF ?? '').split(',').filter(Boolean)) X.PRESS_ESCAPE_EXACT.parts[p] = false;
const row = JSON.parse(gunzipSync(readFileSync(`${root}/frontend/modules/seedlingDemo/fixtures/spin-witness/leg860-request.json.gz`)).toString('utf8'));
const c = row.request;
const REQ = restoreRequest({ ...c, staging: { ...c.staging, seam: { ...c.staging.seam, time: 5950 } } });
const SOURCE = levelSourceFromAtlas(REQ.source.records);
function standAt(x, y, shield = true) {
  const items = { ...REQ.staging.seam.items, hasShield: shield };
  const staging = { ...REQ.staging, boot: { ...REQ.staging.boot, x: x - 8, y: y - 8 }, seam: { ...REQ.staging.seam, items } };
  return replayTape({ staging, perTick: [], levelSource: SOURCE, scratchPersistence: REQ.scratchPersistence === true, equips: REQ.equips ?? null, holds: REQ.holds ?? null });
}
const STANDS = { certified: [808, 854, 'right'], envelope: [814, 854, 'right'], exhausted: [829, 860, 'left'], approach: [820, 854, 'right'] };
for (const [name, [x, y, key]] of Object.entries(STANDS)) {
  G.resetPressEscapeShieldClaimCounts(); X.resetPressEscapeExactCounts();
  const run = standAt(x, y);
  const t0 = performance.now();
  const r = pressEscape(run, { state: run.state, at: run.ticksCompleted, keys: [new Set([key])], pressAt: run.ticksCompleted + 1, id: 'spinner@816,848', caller: 'aim' });
  console.log(JSON.stringify({ name, ok: r.ok, claim: r.claim, bound: r.bound ?? null, keys: r.keys?.length ?? null, why: r.why?.slice(0, 160) ?? null, ms: Math.round(performance.now() - t0), spin: { ...G.PRESS_ESCAPE_SHIELD_CLAIM_COUNTS }, x: Object.fromEntries(Object.entries(X.PRESS_ESCAPE_EXACT_COUNTS).filter(([k,v])=>v)) }));
}
