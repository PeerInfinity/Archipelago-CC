const R = '/tmp/claude-0/sbwt/'; const D = R + 'frontend/modules/seedlingDemo/';
const { readFileSync } = await import('node:fs'); const { gunzipSync } = await import('node:zlib');
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(D + 'atlasSource.js');
const { replayTape } = await import(D + 'jsRuntimeSolver.js');
const { pressEscape } = await import(D + 'solverBot.js');
const PG = await import(D + 'pressKillGuards.js');
const { withContactFidelity } = await import(D + 'contactFidelity.js');
const c = JSON.parse(gunzipSync(readFileSync(D + 'fixtures/spin-witness/leg860-request.json.gz')).toString('utf8')).request;
const REQ = restoreRequest({ ...c, staging: { ...c.staging, seam: { ...c.staging.seam, time: 5950 } } });
const SOURCE = levelSourceFromAtlas(REQ.source.records);
const standAt = (x, y) => replayTape({ staging: { ...REQ.staging, boot: { ...REQ.staging.boot, x: x - 8, y: y - 8 } }, perTick: [], levelSource: SOURCE, scratchPersistence: REQ.scratchPersistence === true, equips: REQ.equips ?? null, holds: REQ.holds ?? null });
const [x, y, k] = JSON.parse(process.argv[2] ?? '[829,860,"left"]');
for (const key of [false, true]) {
  const cap = {}; globalThis.__sbW0 = (p, o) => { cap[p] = o; };
  const r = withContactFidelity({ forecastShieldBump: key }, () => PG.withPressEscapeShieldClaim(true, () => { const run = standAt(x, y); return pressEscape(run, { state: run.state, at: run.ticksCompleted, keys: [new Set([k])], pressAt: run.ticksCompleted + 1, id: 'spinner@816,848', caller: 'aim' }); }));
  const f = cap.first.first;
  console.log('KEY', key, 'why', r.why);
  console.log('  first.shieldBump', JSON.stringify(f.shieldBump ?? null), 'landing', JSON.stringify(f.landing));
  console.log('  states', [...cap.first.states].map(([t, s]) => `${t}:(${s.x.toFixed(2)},${s.y.toFixed(2)} v ${s.vx.toFixed(2)},${s.vy.toFixed(2)} d${s.direction})`).join(' '));
  const b = f.rows.slice(0, 8).map((row) => row.map((rr) => `${rr.x.toFixed(2)},${rr.y.toFixed(2)}`).find((s, i) => true));
}
// the RUN along the same keys: aim, press, stood train
const run = standAt(x, y); const out = [];
for (const kk of [new Set([k]), new Set(['primary']), ...Array(6).fill(new Set())]) { out.push(`${run.ticksCompleted}:(${run.state.x.toFixed(2)},${run.state.y.toFixed(2)} v ${run.state.vx.toFixed(2)},${run.state.vy.toFixed(2)})`); run.advance(kk); }
console.log('RUN states', out.join(' '), 'hits', JSON.stringify(run.playerHits.map((h) => [h.t, h.source, h.id])), 'bumps', JSON.stringify(run.shieldBumps));
