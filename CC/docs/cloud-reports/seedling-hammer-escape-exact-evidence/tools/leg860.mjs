// node leg860.mjs <root>  — env: SEEDLING_PRESS_ESCAPE_EXACT / _SHIELD_CLAIM / SEEDLING_FORECAST_SHIELD_BUMP / XPARTS_OFF
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const root = process.argv[2];
const D = `${root}/frontend/modules/seedlingDemo/`;
const { levelSourceFromAtlas } = await import(D + 'atlasSource.js');
const { withContactFidelity } = await import(D + 'contactFidelity.js');
const { ANYTIME_PASSES, replayTape, solveAnytime } = await import(D + 'jsRuntimeSolver.js');
const { withOpportunisticStrike } = await import(D + 'pressKillCost.js');
const G = await import(D + 'pressKillGuards.js');
const X = await import(D + 'pressEscapeExact.js');
for (const p of (process.env.XPARTS_OFF ?? '').split(',').filter(Boolean)) X.PRESS_ESCAPE_EXACT.parts[p] = false;
const SB = await import(D + 'solverBot.js');
const { restoreRequest } = await import(`${root}/scripts/procgen/seedlingSolveRequestCodec.js`);
const row = JSON.parse(gunzipSync(readFileSync(D + 'fixtures/spin-witness/leg860-request.json.gz')).toString('utf8'));
const c = row.request;
const REQ = restoreRequest({ ...c, staging: { ...c.staging, seam: { ...c.staging.seam, time: 5950 } } });
const { passes = ANYTIME_PASSES, source, ...tape } = REQ;
const kills = [];
G.PRESS_KILL_DONE_TRACE.sink = (k) => kills.push(k);
const esc = { asked: 0, claimed: 0, noClaim: 0, ok: 0 };
SB.HAMMER_ESCAPE_TRACE.sink = (r) => { esc.asked++; if (r.ok) esc.ok++; else if (r.claim) esc.claimed++; else esc.noClaim++; };
SB.CHOOSER_PAIR.size = 3;
const t0 = performance.now();
const answer = SB.withChooserPair(true, () => SB.withIceTurretStaticKill(true, () => withOpportunisticStrike(true,
  () => SB.withLatchWeighFirst(true, () => withContactFidelity({ orbitFreeAim: true, strategyBoundDistinct: true },
  () => solveAnytime({ ...tape, budgetWork: 10240, source, levelSource: levelSourceFromAtlas(source.records) }, { passes }))))));
const ms = Math.round(performance.now() - t0);
const mine = kills.filter((k) => k.bodies.includes('spinner@816,848'));
let replay = null;
if (mine.length) {
  const k = mine[0];
  const run = replayTape({ staging: tape.staging, perTick: [], levelSource: levelSourceFromAtlas(source.records), scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
  const fired = (t) => (run.equipsFired ?? []).some((e) => e.t === t);
  for (let i = 0; i < k.perTick.length; i++) { for (const e of k.equips.filter((q) => q.t === i)) if (!fired(i)) run.equipNow(e.slot); run.advance(k.perTick[i]); }
  replay = { gone: !(run.entities('spinnerBodies') ?? []).some((b) => b.id === 'spinner@816,848'), hits: run.playerHits.length, deaths: run.playerDeaths.length, landings: k.landings.filter((l) => l.id === 'spinner@816,848').map((l) => l.t) };
}
console.log(JSON.stringify({ env: { X: process.env.SEEDLING_PRESS_ESCAPE_EXACT ?? '0', S: process.env.SEEDLING_PRESS_ESCAPE_SHIELD_CLAIM ?? '0', K: process.env.SEEDLING_FORECAST_SHIELD_BUMP ?? '0', off: process.env.XPARTS_OFF ?? '' },
  ok: answer.ok, work: answer.work ?? answer.budget?.work ?? null, msg: (answer.message ?? '').slice(0, 200), killed: mine.length > 0, replay, esc, spin: { ...G.PRESS_ESCAPE_SHIELD_CLAIM_COUNTS }, x: { ...X.PRESS_ESCAPE_EXACT_COUNTS }, ms }));
