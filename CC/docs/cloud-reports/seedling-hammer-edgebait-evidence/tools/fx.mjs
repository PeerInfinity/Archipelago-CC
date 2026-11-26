// MEASUREMENT-ONLY (edgebait): the committed A1 29:11 fixture solved over the committed atlas + its own records
// (BUDGET=<n> overrides budgetWork), the plan replayed on a FRESH run, the turret counters.
const ROOT = '/home/user/Archipelago-CC';
import { readFileSync } from 'node:fs';
const fx = JSON.parse(readFileSync(`${ROOT}/frontend/modules/seedlingDemo/fixtures/kt-arrival/A1-29-11.request.json`, 'utf8'));
const { restoreRequest } = await import(`${ROOT}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { atlasLevelSource } = await import(`${ROOT}/frontend/modules/seedlingDemo/levelSource.js`);
const { solveAnytime, ANYTIME_PASSES, replayTape } = await import(`${ROOT}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
const sb = await import(`${ROOT}/frontend/modules/seedlingDemo/solverBot.js`);
const { passes = ANYTIME_PASSES, ...tape } = restoreRequest(fx.request);
if (process.env.BUDGET) tape.budgetWork = Number(process.env.BUDGET);
const base = atlasLevelSource();
const own = new Map(fx.levels.map(([k, v]) => [k, restoreRequest(v)]));
const levelSource = (level) => own.get(level) ?? base(level);
const env = Object.entries(process.env).filter(([k]) => k.startsWith('SEEDLING_') || k.startsWith('HOOK_') || k === 'BUDGET').map(([k, v]) => `${k}=${v}`).join(' ');
const t0 = Date.now();
const a = solveAnytime({ ...tape, levelSource }, { passes });
console.log(`A1 29:11 env[${env}] ok=${a.ok} work=${a.work} ticks=${a.ok ? a.plan.solution.length : null} ms=${Date.now() - t0}`);
console.log(`  passes=${JSON.stringify(a.passes?.map(({ ms, ...p }) => p))}`);
if (a.ok) {
    const run = replayTape({ staging: tape.staging, perTick: tape.perTick ?? [], levelSource, scratchPersistence: true });
    let tr = null;
    for (const k of a.plan.solution) { const o = run.advance(k); if (o?.transition && !tr) tr = { t: run.ticksCompleted, to: o.transition.to_level }; }
    console.log(`  FRESH hits=${JSON.stringify(run.playerHits.map((h) => `t${h.t} ${h.source}:${h.id}`))} deaths=${run.playerDeaths.length} transition=${JSON.stringify(tr)}`);
} else console.log(`  message=${String(a.message).slice(0, 1500)}`);
for (const n of ['ICETURRET_STATIC_KILL_COUNTS', 'KEYLOCK_TURRET_COUNTS', 'KEYLOCK_TURRET_ARRIVAL_COUNTS', 'TURRET_APPROACH_COUNTS']) if (sb[n]) console.log(`  ${n}=${JSON.stringify(sb[n]).slice(0, 1500)}`);
