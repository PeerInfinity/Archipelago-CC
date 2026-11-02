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
const row = JSON.parse(gunzipSync(readFileSync(`${root}/frontend/modules/seedlingDemo/fixtures/spin-witness/leg860-request.json.gz`)).toString('utf8'));
const c = row.request;
const REQ = restoreRequest({ ...c, staging: { ...c.staging, seam: { ...c.staging.seam, time: 5950 } } });
const SOURCE = levelSourceFromAtlas(REQ.source.records);
const standAt = (x, y) => replayTape({ staging: { ...REQ.staging, boot: { ...REQ.staging.boot, x: x - 8, y: y - 8 } }, perTick: [], levelSource: SOURCE, scratchPersistence: REQ.scratchPersistence === true, equips: REQ.equips ?? null, holds: REQ.holds ?? null });
const [x, y, key] = [Number(process.argv[3]), Number(process.argv[4]), process.argv[5]];
const run = standAt(x, y); const n = run.ticksCompleted;
// capture the forecasts the escape asked
const orig = run.spinnerForecastWithPress.bind(run); const asked = [];
run.spinnerForecastWithPress = (rows, o) => { const f = orig(rows, o); asked.push({ rows, players: !!o.players, f }); return f; };
const r = pressEscape(run, { state: run.state, at: n, keys: [new Set([key])], pressAt: n + 1, id: 'spinner@816,848', caller: 'aim' });
console.log('answer', r.ok, r.landing - n, r.keys?.length);
for (const a of asked) console.log('forecast rows', a.rows, 'players', a.players, 'bumps', JSON.stringify(a.f.shieldBump?.bumps), 'landing', a.f.landing?.t - n);
const first = asked[1].f;
const keys = [new Set([key]), new Set(['primary'])]; for (let t = n + 2; t < r.landing; t++) keys.push(new Set()); keys.push(...r.keys);
const d = standAt(x, y); const b0 = d.shieldBumps.length;
for (let i = 0; i < keys.length; i++) {
  const h = d.playerHits.length; d.advance(keys[i]);
  const b = (d.entities('spinnerBodies') ?? []).find((q) => q.id === 'spinner@816,848');
  const fr = first.rows[i]?.[first.bodies[i]?.findIndex((q) => q.id === 'spinner@816,848')];
  const err = b && fr ? Math.max(Math.abs(b.rect.x - fr.x), Math.abs(b.rect.y - fr.y)).toFixed(2) : '-';
  if (i < 6 || d.playerHits.length > h || (i % 10 === 0)) console.log(i, [...keys[i]].join('+') || '.', 'player', d.state.x.toFixed(2), d.state.y.toFixed(2), 'v', d.state.vx.toFixed(2), d.state.vy.toFixed(2), 'body', b ? `${b.rect.x.toFixed(2)},${b.rect.y.toFixed(2)} hits${b.hits} t${b.hitsTimer}` : 'gone', 'fc', fr ? `${fr.x.toFixed(2)},${fr.y.toFixed(2)}` : '-', 'err', err, d.playerHits.length > h ? 'HIT ' + JSON.stringify(d.playerHits.at(-1)).slice(0, 200) : '');
}
console.log('run bumps', JSON.stringify(d.shieldBumps.slice(b0).map((b) => ({ t: b.t, i: b.t - n, id: b.id, shoved: b.shoved, v: b.v }))));
