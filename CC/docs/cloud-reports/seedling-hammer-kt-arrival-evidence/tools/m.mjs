// MEASUREMENT-ONLY (kt-arrival): solve one captured request as the worker does (solveAnytime), print verdict / ticks / work / ms,
// replay a plan on a FRESH run (hits, deaths, transition), and the turret counters. node m.mjs <jsonl> <id> <i>   (BUDGET=<n> overrides budgetWork)
import { readFileSync } from 'node:fs';
const [file, id, i] = process.argv.slice(2);
const ROOT = '/home/user/Archipelago-CC';
const row = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((r) => String(r.id) === id);
const req = row.requests[Number(i)];
const { restoreRequest } = await import(`${ROOT}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { levelSourceFromAtlas } = await import(`${ROOT}/frontend/modules/seedlingDemo/atlasSource.js`);
const { solveAnytime, ANYTIME_PASSES, replayTape } = await import(`${ROOT}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
const sb = await import(`${ROOT}/frontend/modules/seedlingDemo/solverBot.js`);
const env = Object.entries(process.env).filter(([k]) => k.startsWith('SEEDLING_') || k === 'BUDGET').map(([k, v]) => `${k}=${v}`).join(' ');
const r0 = restoreRequest(req.request);
const { passes = ANYTIME_PASSES, source, ...tape } = r0;
if (process.env.BUDGET) tape.budgetWork = Number(process.env.BUDGET);
const t0 = Date.now();
const a = solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes });
const ms = Date.now() - t0;
console.log(`REQ ${id}:${i} env[${env}]`);
console.log(`  ok=${a.ok} kind=${a.kind ?? null} work=${a.work} ticks=${a.ok ? a.plan.solution.length : null} ms=${ms}`);
console.log(`  passes=${JSON.stringify((a.passes ?? []).map(({ ms: _m, ...p }) => p))}`);
if (a.ok) {
    const run = replayTape({ staging: tape.staging, perTick: tape.perTick ?? [], levelSource: levelSourceFromAtlas(source.records),
        scratchPersistence: true });
    let tr = null;
    for (const k of a.plan.solution) {
        const o = run.advance(k);
        if (o?.transition && !tr) tr = { t: run.ticksCompleted, to: o.transition.to_level };
    }
    const t = run.entities('turrets');
    const turrets = t ? [...t.entries()].map(([k, v]) => [k, v.dead === true]) : null;
    const hits = run.playerHits.map((h) => `t${h.t} ${h.source}:${h.id}`);
    console.log(`  verbs=${JSON.stringify(a.plan.verbs ?? null).slice(0, 400)}`);
    console.log(`  FRESH hits=${JSON.stringify(hits)} deaths=${run.playerDeaths.length} transition=${JSON.stringify(tr)} turrets=${JSON.stringify(turrets)}`);
} else console.log(`  message=${String(a.message).slice(0, 1800)}`);
for (const n of ['ICETURRET_STATIC_KILL_COUNTS', 'KEYLOCK_TURRET_COUNTS', 'TURRET_APPROACH_COUNTS', 'KT_ARRIVAL_COUNTS']) {
    if (sb[n]) console.log(`  ${n}=${JSON.stringify(sb[n]).slice(0, 1500)}`);
}
if (a.ok && process.env.SHOWPLAN) {
    console.log(`  planKeys=${Object.keys(a.plan).join(',')}`);
    console.log(`  forcedHits=${JSON.stringify(a.plan.forcedHits ?? null).slice(0, 800)}`);
    const rows = a.plan.trace ?? a.plan.rows ?? [];
    for (const r of rows) if (r?.strategy) console.log(`  row t${r.tick} ${JSON.stringify(r.strategy).slice(0, 300)} obstacle=${JSON.stringify(r.obstacle ?? null)}`);
    console.log(`  records=${JSON.stringify((a.plan.records ?? []).map((r) => [r.verb ?? r.strategy, r.target, r.from, r.ticks])).slice(0, 800)}`);
}
