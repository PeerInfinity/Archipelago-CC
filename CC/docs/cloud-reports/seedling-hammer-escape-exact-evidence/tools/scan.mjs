import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const root = process.argv[2];
const M = (p) => import(`${root}/${p}`);
const { restoreRequest } = await M('scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await M('frontend/modules/seedlingDemo/atlasSource.js');
const { replayTape } = await M('frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const { pressEscape } = await M('frontend/modules/seedlingDemo/solverBot.js');
const X = await M('frontend/modules/seedlingDemo/pressEscapeExact.js');
const G = await M('frontend/modules/seedlingDemo/pressKillGuards.js');
const row = JSON.parse(gunzipSync(readFileSync(`${root}/frontend/modules/seedlingDemo/fixtures/spin-witness/leg860-request.json.gz`)).toString('utf8'));
const c = row.request;
const REQ = restoreRequest({ ...c, staging: { ...c.staging, seam: { ...c.staging.seam, time: 5950 } } });
const SOURCE = levelSourceFromAtlas(REQ.source.records);
const standAt = (x, y) => replayTape({ staging: { ...REQ.staging, boot: { ...REQ.staging.boot, x: x - 8, y: y - 8 } }, perTick: [], levelSource: SOURCE, scratchPersistence: REQ.scratchPersistence === true, equips: REQ.equips ?? null, holds: REQ.holds ?? null });
const NO = new Set();
const ask = (x, y, key, arm) => {
  X.PRESS_ESCAPE_EXACT.enabled = arm.x; G.PRESS_ESCAPE_SHIELD_CLAIM.enabled = arm.s;
  Object.assign(X.PRESS_ESCAPE_EXACT.parts, { probe: true, prune: arm.prune ?? true, contact: arm.contact ?? true });
  X.resetPressEscapeExactCounts();
  let run; try { run = standAt(x, y); } catch (e) { return null; }
  const n = run.ticksCompleted;
  let r; try { r = pressEscape(run, { state: run.state, at: n, keys: [new Set([key])], pressAt: n + 1, id: 'spinner@816,848', caller: 'aim' }); } catch (e) { return { err: String(e.message).slice(0, 60) }; }
  const cls = r.ok ? 'cert' : (r.claim ? `neg:${r.bound}` : (/PRESS_ESCAPE_EXACT/.test(r.why) ? 'noclaim:exact' : (/SHIELD_CLAIM/.test(r.why) ? 'noclaim:spin' : 'noclaim')));
  let truth = null;
  if (r.ok) { const keys = [new Set([key]), new Set(['primary'])]; for (let t = n + 2; t < r.landing; t++) keys.push(NO); keys.push(...r.keys);
    const d = standAt(x, y); const h0 = d.playerHits.length; for (const k of keys) d.advance(k); truth = d.playerHits.length - h0; }
  return { cls, cuts: X.PRESS_ESCAPE_EXACT_COUNTS.cuts, truthHits: truth };
};
const arms = { spin: { x: false, s: true }, exact: { x: true, s: false }, noPrune: { x: true, s: false, prune: false }, noContact: { x: true, s: false, contact: false } };
const out = [];
for (let y = 830; y <= 872; y += 3) for (let x = 790; x <= 846; x += 3) for (const key of ['left', 'right', 'up', 'down']) {
  const o = { x, y, key };
  for (const [a, arm] of Object.entries(arms)) o[a] = ask(x, y, key, arm);
  if (o.exact === null) continue;
  out.push(o);
}
const tally = {};
for (const o of out) for (const a of Object.keys(arms)) { const k = `${a}:${o[a]?.cls ?? o[a]?.err}`; tally[k] = (tally[k] ?? 0) + 1; }
console.log(JSON.stringify(tally));
const falseCerts = {}; for (const a of Object.keys(arms)) falseCerts[a] = out.filter((o) => o[a]?.cls === 'cert' && o[a].truthHits > 0).length;
console.log('false certificates (cert whose driven path is hit):', JSON.stringify(falseCerts));
console.log('exact cuts>0:', out.filter((o) => o.exact?.cuts > 0).length, 'prune changed the answer:', out.filter((o) => o.exact?.cls !== o.noPrune?.cls).length);
for (const o of out.filter((o) => o.exact?.cls !== o.noPrune?.cls).slice(0, 12)) console.log(JSON.stringify(o));
