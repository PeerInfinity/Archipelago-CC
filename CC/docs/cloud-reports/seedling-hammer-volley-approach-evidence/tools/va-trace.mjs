// node leg860.mjs <root>  — env: SEEDLING_PRESS_ESCAPE_EXACT / _SHIELD_CLAIM / SEEDLING_FORECAST_SHIELD_BUMP / XPARTS_OFF
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
Error.stackTraceLimit = 200;
const FROZ = [];
{ const oa = Object.assign; Object.assign = function (t, ...s) { if (t instanceof Error && s[0]?.code === 'FROZEN_TICK_PRESS') FROZ.push({ msg: t.message.slice(0, 300), stack: new Error('cap').stack }); return oa.call(Object, t, ...s); }; }

// VA scratch: the per-tick trace of LWEIGH's reordered weigh from its stance walk's first tick (decides nothing)
const VA_ROWS = [];
const TID = process.env.TID ?? 'iceturret@472,400';
globalThis.__VA_TRACE = (rewind, perTick, equips, start, resolved, live) => {
  const f = rewind.replay(start);
  const done = new Set();
  const row = (k, ff) => {
    const t = f.entities('turrets')?.get(TID); const c = (f.entities('turretDamage') ?? []).find((x) => x.id === TID) ?? {};
    const d = t ? Math.trunc(Math.hypot(f.state.x - t.x, f.state.y - t.y)) : null;
    const bl = f.blastsInFlight.map((b) => `${b.id}@${b.x.toFixed(1)},${b.y.toFixed(1)}v${b.vx.toFixed(2)},${b.vy.toFixed(2)}`).join(' ');
    return `t${f.ticksCompleted} key[${[...(k ?? [])].join('+')}] p(${f.state.x.toFixed(1)},${f.state.y.toFixed(1)}) T(${t?.x},${t?.y})${t?.dead ? ' DEAD' : ''} st${c.shootTimer} ${c.anim || '-'} hT${c.hitsTimer} hp${c.hits} d${d} frz${f.progress('frozenTimer')} ff${ff ? `${ff.refusedNext ? 'R' : '-'}${ff.timerNext}${ff.contact ? 'C' : ''}` : ''} hits${f.ledger('playerHits').length} [${bl}]`;
  };
  VA_ROWS.push(`# start index ${start}, run t${f.ticksCompleted}, stance ${JSON.stringify(resolved.stance)}, live end t${live.ticksCompleted}`);
  VA_ROWS.push(row(null, null));
  for (let i = start; i < perTick.length; i++) {
    for (const [j, e] of equips.entries()) if (!done.has(j) && e.t === f.ticksCompleted) { f.equipNow(e.slot); done.add(j); VA_ROWS.push(`  equip ${e.slot} @t${e.t}`); }
    const ff = f.progress('freezeForecast');
    f.advance(perTick[i]);
    VA_ROWS.push(row(perTick[i], ff));
  }
  VA_ROWS.push(`# replay end p(${f.state.x.toFixed(2)},${f.state.y.toFixed(2)}) vs live p(${live.state.x.toFixed(2)},${live.state.y.toFixed(2)}); hits replay ${f.ledger('playerHits').length} live ${live.ledger('playerHits').length}; volleys ${JSON.stringify(f.volleys?.slice?.(-8) ?? null)}`);
  VA_ROWS.push(`# live hits ${JSON.stringify(live.ledger('playerHits').slice(-3))}`);
};
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
const PASSES = [];
const answer = HD ? solveAnytime({ ...tape, budgetWork: 10240, source, levelSource: levelSourceFromAtlas(source.records) }, { passes, onPass: (one, best, i) => PASSES.push({ i, pass: one.pass, ok: one.ok, work: one.work ?? null, msg: String(one.message ?? '').slice(0, 700) }) }) : SB.withChooserPair(true, () => SB.withIceTurretStaticKill(true, () => withOpportunisticStrike(true,
  () => SB.withLatchWeighFirst(true, () => withContactFidelity({ orbitFreeAim: true, strategyBoundDistinct: true },
  () => solveAnytime({ ...tape, budgetWork: 10240, source, levelSource: levelSourceFromAtlas(source.records) }, { passes, onPass: (one, best, i) => PASSES.push({ i, pass: one.pass, ok: one.ok, work: one.work ?? null, ticks: one.perTick?.length ?? one.tape?.tick_count ?? null, msg: String(one.message ?? '').slice(0, 700) }) }))))));
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
if (process.env.VA_OUT) (await import('node:fs')).writeFileSync(process.env.VA_OUT, VA_ROWS.join('\n') + '\n');
console.log(JSON.stringify({ design: process.env.VA_DESIGN ?? null, designOut: globalThis.__VA_DESIGN_OUT ?? null, passesSeen: PASSES, va: SB.VOLLEY_APPROACH_COUNTS ?? null, vaOn: SB.VOLLEY_APPROACH?.enabled ?? null, ta: SB.TURRET_APPROACH_COUNTS?.approaches ?? null, hd: HD, fpc: FPC.FROZEN_PRESS_COUNTS ?? null, froz: FROZ.length, frozFirst: FROZ[0] ?? null, frozLast: FROZ.at(-1) ?? null, env: { X: process.env.SEEDLING_PRESS_ESCAPE_EXACT ?? '0', S: process.env.SEEDLING_PRESS_ESCAPE_SHIELD_CLAIM ?? '0', K: process.env.SEEDLING_FORECAST_SHIELD_BUMP ?? '0', off: process.env.XPARTS_OFF ?? '' },
  ok: answer.ok, work: answer.work ?? answer.budget?.work ?? null, msg: (answer.message ?? '').slice(0, 1600), obstacle: answer.obstacle ?? null, kind: answer.kind ?? null, pass: answer.pass ?? null, killed: mine.length > 0, replay, esc, spin: { ...G.PRESS_ESCAPE_SHIELD_CLAIM_COUNTS }, x: { ...X.PRESS_ESCAPE_EXACT_COUNTS }, ms, tally, stack: answer.error?.stack?.slice(0, 1500) ?? answer.stack?.slice(0,1500) ?? null, keys: Object.keys(answer) }));
