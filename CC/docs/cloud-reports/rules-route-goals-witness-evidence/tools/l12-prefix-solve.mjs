// solve leg 183 (boot re-staged, no flags) from a PREFIX of an earlier plan (the first N ticks), to see whether the
// solver still detours to shieldlocknorm@288,704 once past its approach.
import { readFileSync, writeFileSync } from 'node:fs';
const R = (process.env.REPO || process.cwd()) + '/';
const M = (p) => import(R + 'frontend/modules/seedlingDemo/' + p);
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await M('atlasSource.js');
const { inventorySlotsFor } = await M('tapeFormat.js');
const { settleSolve, solveFromTape, replayTape, liveOf } = await M('jsRuntimeSolver.js');
const [file, planFile, N, bx, by, extra] = process.argv.slice(2);
let req; for (const line of readFileSync(file, 'utf8').trim().split('\n')) { const o = JSON.parse(line); if (o.id === 183) { req = restoreRequest(o.requests[0].request); break; } }
const { passes, source, budgetWork, upgradeWindowWork, ...tape } = req;
tape.staging = { ...tape.staging, persistence: [], boot: { ...tape.staging.boot, x: Number(bx), y: Number(by) }, inventory_slots: inventorySlotsFor(tape.staging.seam.items) };
const plan = JSON.parse(readFileSync(planFile, 'utf8'));
const extraKeys = (extra ?? '').split(',').filter(Boolean).flatMap((s) => { const [k, n] = s.split('*'); return Array(Number(n)).fill(k === '_' ? [] : k.split('+')); });
tape.perTick = [...plan.keys.slice(0, Number(N)), ...extraKeys].map((k) => new Set(k));
const eqs = plan.equipsAt.filter(([t]) => t < Number(N));
tape.equips = eqs.length ? new Map(eqs) : null;
const levelSource = levelSourceFromAtlas(source.records);
const shadow = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, scratchPersistence: tape.scratchPersistence, equips: tape.equips });
console.log('prefix end', shadow.level, shadow.state.x.toFixed(1), shadow.state.y.toFixed(1), 'earned', JSON.stringify(shadow.earnedClears?.map((c) => `${c.level}:${c.tag}`)));
tape.live = liveOf(shadow);
let work = 0;
const a = settleSolve(() => solveFromTape({ ...tape, levelSource, dashMode: 'none', adds: null, fineCheckpoints: true, shouldStop: () => ++work > 60000 }));
console.log('SOLVE', a.ok, work, a.ok ? a.plan.solution.length : String(a.message).slice(0, 400));
if (a.ok) {
  const full = a.plan.solution.length > tape.perTick.length && a.plan.solution.slice(0, 3).every((k, i) => [...k].join() === [...tape.perTick[i]].join()) && false
    ? a.plan.solution : [...tape.perTick, ...a.plan.solution];
  const eqAll = [...(tape.equips ?? new Map())].concat([...(a.plan.equipsAt ?? [])].map(([t, s]) => [t + tape.perTick.length, s]));
  const r = replayTape({ staging: tape.staging, perTick: full, levelSource, scratchPersistence: true, equips: eqAll.length ? new Map(eqAll) : null });
  console.log('FULL', full.length, r.level, r.state.x.toFixed(1), r.state.y.toFixed(1), 'hits', r.playerHits.length, 'earned', JSON.stringify(r.earnedClears?.map((c) => `${c.level}:${c.tag}@t${c.t}`)));
  writeFileSync(process.argv[8] ?? '/dev/null', JSON.stringify({ keys: full.map((k) => [...k]), equipsAt: eqAll }));
}
