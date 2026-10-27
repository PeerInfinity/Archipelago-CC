// W0: reproduce one decline and print the forecast's and the run's timelines tick by tick.
const R = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
import { readFileSync } from 'node:fs';
const { liveOf, replayTape, forkRunFor } = await import(R + 'jsRuntimeSolver.js');
const { solveStaging, stagingFromTape } = await import(R + 'tapeRunner.js');
const { parseTape } = await import(R + 'tapeFormat.js');
const { atlasLevelSource } = await import(R + 'levelSource.js');
const SB = await import(R + 'solverBot.js');
const P = { ...(await import(R + 'presses.js')), ...(await import(R + 'combatVerbs.js')) };
const src = atlasLevelSource();
const GOAL = { kind: 'encounter', at: { x: 64, y: 128 }, drop: { item: 'Fire' }, then: null };
const [name, kS] = process.argv.slice(2);
const t = JSON.parse(readFileSync(R + `fixtures/tapes/${name}.json`, 'utf8'));
const staging = solveStaging(stagingFromTape(parseTape({ ...t, tick_count: 0, inputs: [] })));
const solveRec = (prefix) => {
  const run = replayTape({ staging, perTick: prefix, levelSource: src, scratchPersistence: true });
  const held = [];
  const searches = [];
  const proxy = new Proxy(run, { get(tg, p) { const v = Reflect.get(tg, p);
    if (p === 'advance') return (h) => { held.push(new Set(h)); return v.call(tg, h); };
    if (p === 'bobBossForecast') return () => { searches.push(tg.ticksCompleted); return v.call(tg); };
    return typeof v === 'function' ? v.bind(tg) : v; } });
  const forkRun = forkRunFor({ staging, levelSource: src, scratchPersistence: true, prefixLength: prefix.length });
  try { const out = SB.solveSegment({ run: proxy, goals: [GOAL], name: 'w0', boot: staging.boot, prefix, dashMode: 'none', forkRun });
    return { ok: true, out, held, searches, run }; }
  catch (e) { return { ok: false, e, held, searches, run }; }
};
const base = solveRec([]);
const plan = base.out.perTick;
const k = Number(kS);
const r = solveRec(plan.slice(0, k));
console.log('solve from', k, r.ok ? 'SOLVED' : `REFUSED ${r.e.message}`);
if (r.ok) process.exit(0);
const m = /at \+(\d+)/.exec(r.e.message); const landedAt = Number(m[1]);
const endTick = r.run.ticksCompleted;              // run's tick count at the refusal
const strikeT = endTick - (landedAt + 1);            // the tick the plan was searched at
console.log('refusal at run tick', endTick, 'strike searched at', strikeT, 'last searches', r.searches.slice(-3));
const pre = [...plan.slice(0, k), ...r.held.slice(0, strikeT - k)];
const run = replayTape({ staging, perTick: pre, levelSource: src, scratchPersistence: true });
console.log('replayed to', run.ticksCompleted);
const sp = SB.searchEncounterStrike(run);
console.log('plan', JSON.stringify({ ...sp, approach: sp.approach, retreat: sp.retreat }));
// forecast copy with logging (forecastEncounterPlan, solverBot.js:1233)
const fc = run.bobBossForecast();
const stepper = run.previewStepper();
const b = fc.clone(fc.body); let p = { ...run.state }; const info = run.progress('slashInfo');
let slash = { ...info.state }; let endsAt = info.endsAt === null ? null : info.endsAt - run.ticksCompleted;
const tests = new Map(); const flog = [];
console.log('slashInfo at start', JSON.stringify(info.state), 'endsAt', info.endsAt, 'ticks', run.ticksCompleted);
const total = sp.n + 1 + 48;
for (let kk = 0; kk < total; kk++) {
  const st = fc.step(b, p);
  const row = { k: kk, bx: +b.x.toFixed(2), by: +b.y.toFixed(2), form: b.form, hits: b.hits, ht: b.hitsTimer, px: +p.x.toFixed(2), py: +p.y.toFixed(2), touch: st.playerHits.length };
  fc.shieldBump(b, p, slash.slashing); slash = P.slashTimerTick(slash);
  const due = tests.get(kk);
  if (due !== undefined) { const v = fc.slash(b, p, due); row.test = v.landed ? 'LAND' : `miss(${v.reached})`; }
  const keys = kk < sp.n ? sp.approach : (kk === sp.n ? [...sp.approach, 'primary'] : sp.retreat);
  if (kk === sp.n) { const out = P.slashSet(slash, { pressed: true, hasSword: true, direction: p.direction }); row.press = out.outcome; slash = out.state; endsAt = kk + P.SLASH_ANIM_TICKS[slash.anim]; for (let i = 1; i <= P.SLASH_HIT_TICKS; i++) tests.set(kk + i, out.slashDirection); }
  p = stepper(p, new Set(keys));
  if (endsAt !== null && kk + 1 >= endsAt) { endsAt = null; slash = P.slashSet(slash, { pressed: false, hasSword: true }).state; }
  flog.push(row);
}
// the run, the same keys
const rlog = [];
const ev0 = run.ledger('bobBossEvents').length;
for (let kk = 0; kk <= sp.landedAt + 2; kk++) {
  const a = run.entities('bobBoss'); const bb = a.get('boss');
  const row = { k: kk, bx: bb ? +bb.x.toFixed(2) : null, by: bb ? +bb.y.toFixed(2) : null, form: bb?.form, hits: bb?.hits, ht: bb?.hitsTimer, px: +run.state.x.toFixed(2), py: +run.state.y.toFixed(2) };
  const keys = kk < sp.n ? sp.approach : (kk === sp.n ? [...sp.approach, 'primary'] : sp.retreat);
  const before = run.ledger('bobBossEvents').length;
  run.advance(new Set(keys));
  row.ev = run.ledger('bobBossEvents').slice(before).map((e) => `${e.what}${e.landed !== undefined ? (e.landed ? ':L' : ':m') : ''}${e.why ? `(${e.why})` : ''}`).join(',');
  rlog.push(row);
}
for (let kk = 0; kk <= sp.landedAt + 2; kk++) {
  const f = flog[kk], g = rlog[kk];
  const same = f && g && f.bx === g.bx && f.by === g.by && f.hits === g.hits && f.ht === g.ht && f.px === g.px && f.py === g.py;
  console.log(`${same ? ' ' : '≠'} +${kk} F boss(${f?.bx},${f?.by}) f${f?.form} h${f?.hits} ht${f?.ht} p(${f?.px},${f?.py}) ${f?.press ?? ''}${f?.test ?? ''} | R boss(${g.bx},${g.by}) f${g.form} h${g.hits} ht${g.ht} p(${g.px},${g.py}) ${g.ev}`);
}
