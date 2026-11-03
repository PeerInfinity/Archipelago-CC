import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const root = process.argv[2];
const M = (p) => import(`${root}/${p}`);
const { restoreRequest } = await M('scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await M('frontend/modules/seedlingDemo/atlasSource.js');
const { replayTape } = await M('frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const { pressEscape } = await M('frontend/modules/seedlingDemo/solverBot.js');
const row = JSON.parse(gunzipSync(readFileSync(`${root}/frontend/modules/seedlingDemo/fixtures/spin-witness/leg860-request.json.gz`)).toString('utf8'));
const c = row.request;
const REQ = restoreRequest({ ...c, staging: { ...c.staging, seam: { ...c.staging.seam, time: 5950 } } });
const SOURCE = levelSourceFromAtlas(REQ.source.records);
const standAt = (x, y) => replayTape({ staging: { ...REQ.staging, boot: { ...REQ.staging.boot, x: x - 8, y: y - 8 } }, perTick: [], levelSource: SOURCE, scratchPersistence: REQ.scratchPersistence === true, equips: REQ.equips ?? null, holds: REQ.holds ?? null });
const STANDS = { certified: [808, 854, 'right'], envelope: [814, 854, 'right'], exhausted: [829, 860, 'left'], approach: [820, 854, 'right'] };
const NO = new Set();
for (const [name, [x, y, key]] of Object.entries(STANDS)) {
  const run = standAt(x, y); const n = run.ticksCompleted;
  const r = pressEscape(run, { state: run.state, at: n, keys: [new Set([key])], pressAt: n + 1, id: 'spinner@816,848', caller: 'aim' });
  const keys = [new Set([key]), new Set(['primary'])];
  if (r.ok) { for (let t = n + 2; t < r.landing; t++) keys.push(NO); keys.push(...r.keys); }
  const d = standAt(x, y); const h0 = d.playerHits.length, b0 = d.shieldBumps.length;
  const hitsAt = [];
  for (let i = 0; i < keys.length; i++) { const before = d.playerHits.length; d.advance(keys[i]); if (d.playerHits.length > before) hitsAt.push(n + i); }
  const body = (d.entities('spinnerBodies') ?? []).find((b) => b.id === 'spinner@816,848');
  console.log(name, JSON.stringify({ ok: r.ok, claim: r.claim, bound: r.bound ?? null, driven: keys.length, hitsAt, bumps: d.shieldBumps.slice(b0).filter((b) => b.family === 'spinner').map((b) => [b.t, b.shoved]), bodyHits: body?.hits ?? 'gone' }));
}
