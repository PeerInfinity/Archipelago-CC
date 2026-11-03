// node leg860.mjs <root>  — env: SEEDLING_PRESS_ESCAPE_EXACT / _SHIELD_CLAIM / SEEDLING_FORECAST_SHIELD_BUMP / XPARTS_OFF
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
Error.stackTraceLimit = 200;
const FROZ = [];
{ const oa = Object.assign; Object.assign = function (t, ...s) { if (t instanceof Error && s[0]?.code === 'FROZEN_TICK_PRESS') FROZ.push({ msg: t.message.slice(0, 300), stack: new Error('cap').stack }); return oa.call(Object, t, ...s); }; }
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
const kills = []; const FPC = await import(D + 'strikePolicy.js');
G.PRESS_KILL_DONE_TRACE.sink = (k) => kills.push(k);
const esc = { asked: 0, claimed: 0, noClaim: 0, ok: 0 };
const tally = {}; SB.HAMMER_ESCAPE_TRACE.sink = (r) => { const k = `${r.caller}:${r.ok ? 'ok' : (r.claim ? r.bound : 'noclaim')}`; const e = (tally[k] ??= { n: 0, ts: [] , why: r.why?.slice(0, 140) }); e.n++; if (e.ts.length < 6) e.ts.push(r.t); esc.asked++; if (r.ok) esc.ok++; else if (r.claim) esc.claimed++; else esc.noClaim++; };
SB.CHOOSER_PAIR.size = 3;
const t0 = performance.now(); const HD = process.env.HAMMER_DEFAULTS === '1';
const answer = HD ? solveAnytime({ ...tape, budgetWork: 10240, source, levelSource: levelSourceFromAtlas(source.records) }, { passes }) : SB.withChooserPair(true, () => SB.withIceTurretStaticKill(true, () => withOpportunisticStrike(true,
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
console.log(JSON.stringify({ hd: HD, fpc: FPC.FROZEN_PRESS_COUNTS ?? null, froz: FROZ.length, frozFirst: FROZ[0] ?? null, frozLast: FROZ.at(-1) ?? null, env: { X: process.env.SEEDLING_PRESS_ESCAPE_EXACT ?? '0', S: process.env.SEEDLING_PRESS_ESCAPE_SHIELD_CLAIM ?? '0', K: process.env.SEEDLING_FORECAST_SHIELD_BUMP ?? '0', off: process.env.XPARTS_OFF ?? '' },
  ok: answer.ok, work: answer.work ?? answer.budget?.work ?? null, msg: (answer.message ?? '').slice(0, 1600), obstacle: answer.obstacle ?? null, kind: answer.kind ?? null, pass: answer.pass ?? null, killed: mine.length > 0, replay, esc, spin: { ...G.PRESS_ESCAPE_SHIELD_CLAIM_COUNTS }, x: { ...X.PRESS_ESCAPE_EXACT_COUNTS }, ms, tally, stack: answer.error?.stack?.slice(0, 1500) ?? answer.stack?.slice(0,1500) ?? null, keys: Object.keys(answer) }));
