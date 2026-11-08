// scratch: solve a captured request page-faithfully (solveAnytime, captured budgets) under the process env, then replay
// the plan on a fresh run and print bodies near the player for ticks [--from,--to]. Measure only.
import { readFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const ROOT = '/home/user/Archipelago-CC';
const { restoreRequest } = await import(ROOT + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(ROOT + '/frontend/modules/seedlingDemo/atlasSource.js');
const JR = await import(ROOT + '/frontend/modules/seedlingDemo/jsRuntimeSolver.js');
let req;
for (const line of readFileSync(args.requests, 'utf8').trim().split('\n')) {
  const row = JSON.parse(line); if (String(row.id) !== args.id) continue;
  const c0 = row.requests.find((c) => String(c.i) === args.i).request;
  req = restoreRequest(args.seam ? { ...c0, staging: { ...c0.staging, seam: { ...c0.staging.seam, time: Number(args.seam) } } } : c0);
}
const { passes: P0 = JR.ANYTIME_PASSES, source, ...tape } = req; const passes = args.pass ? P0.filter((p) => p.pass === args.pass) : P0;
const levelSource = levelSourceFromAtlas(source.records);
const t0 = Date.now();
const ans = JR.solveAnytime({ ...tape, levelSource }, { passes });
console.log('answer', ans.ok, ans.ok ? ans.plan.verbs : (ans.message??'').slice(0,400), 'ms', Date.now()-t0, 'work', ans.work, JSON.stringify(ans.passes));
if (!ans.ok) process.exit(0);
const plan = ans.plan;
const run = JR.replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource: levelSourceFromAtlas(source.records),
  scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
const from = Number(args.from ?? 0), to = Number(args.to ?? 1e9), R = Number(args.r ?? 40);
const fams = ['chasers', 'spinnerBodies', 'strikeBodies', 'staticBodies'];
for (let k = 0; k < plan.solution.length; k += 1) {
  const slot = plan.equipsAt?.get?.(k); if (slot !== undefined) run.equipNow(slot);
  run.advance(plan.solution[k]);
  const t = k + 1;
  if (t < from || t > to) continue;
  const px = run.state.x, py = run.state.y; const near = [];
  for (const f of fams) { let es; try { es = run.entities(f); } catch { continue; }
    for (const e of (es ?? [])) { const ex = e.x ?? e.state?.x, ey = e.y ?? e.state?.y; if (!Number.isFinite(ex)) continue;
      const d = Math.hypot(ex - px, ey - py);
      if (args.only && e.id !== args.only) continue; if (args.fam && f !== args.fam) continue;
      if (args.dump && d < R) near.push(JSON.stringify(e, (kk, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v)).slice(0, 900));
      if (d < R) near.push(`${f}:${e.id}@(${ex.toFixed(2)},${ey.toFixed(2)}) d=${d.toFixed(1)}`); } }
  console.log(`t${t} p=(${px.toFixed(3)},${py.toFixed(3)}) keys=${[...plan.solution[k]].join('+')} hits=${run.playerHits.length} ${near.join(' ')}`);
}
console.log('hits', JSON.stringify(run.playerHits.map((h) => ({ t: h.t, s: h.source, id: h.id }))));
