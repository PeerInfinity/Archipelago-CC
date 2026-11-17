// SPINNER-SHOVED-FOLLOWUP: one L40 Chest leg's committed fixture request (L40-SPINNER-WALLS'), re-stamped to an arrival
// clock, solved by the worker's dispatch (`solveAnytime`, the request's own budgets) at the switches the process env
// sets (SEEDLING_*=1); the plan replayed on a fresh run, hits counted.
//   node clock.mjs --leg=L39|L43 --seam=<clock> [--trace=<out.jsonl>]   → one JSON line
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
const R = process.env.REPO || process.cwd();
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
const M = (p) => import(join(R, 'frontend/modules/seedlingDemo', p));
const { restoreRequest } = await import(join(R, 'scripts/procgen/seedlingSolveRequestCodec.js'));
const { levelSourceFromAtlas } = await M('atlasSource.js');
const JR = await M('jsRuntimeSolver.js');
const SB = await M('solverBot.js');
const fix = JSON.parse(gunzipSync(readFileSync(join(R, 'frontend/modules/seedlingDemo/fixtures/hammer-l40-spinner-walls',
    `chest-${arg('leg')}-request.json.gz`))).toString('utf8'));
const c0 = fix.requests[0].request;
const seam = Number(arg('seam'));
const { passes = JR.ANYTIME_PASSES, source, budgetWork, upgradeWindowWork, ...tape } = restoreRequest({ ...c0,
    staging: { ...c0.staging, seam: { ...c0.staging.seam, time: seam } } });
const levelSource = levelSourceFromAtlas(source.records);
const on = Object.keys(process.env).filter((k) => k.startsWith('SEEDLING_') && process.env[k] === '1').sort();
const trace = [];
if (arg('trace') && SB.SHOVED_BODY_LOOKAHEAD_TRACE) SB.SHOVED_BODY_LOOKAHEAD_TRACE.sink = (r) => trace.push(r);
// --chasers=0 / --solve-steps=N / --hit-gate=0 ablate the follow-up's halves (SHOVED_BODY_LOOKAHEAD_TUNING); absent ⇒ shipped
if (SB.SHOVED_BODY_LOOKAHEAD_TUNING) {
    if (arg('chasers') === '0') SB.SHOVED_BODY_LOOKAHEAD_TUNING.chasers = false;
    if (arg('solve-steps')) SB.SHOVED_BODY_LOOKAHEAD_TUNING.solveSteps = Number(arg('solve-steps'));
    if (arg('hit-gate') === '0') SB.SHOVED_BODY_LOOKAHEAD_TUNING.hitGate = false;
}
const t0 = Date.now();
const ans = JR.solveAnytime({ ...tape, budgetWork, upgradeWindowWork, levelSource }, { passes });
const r = { leg: arg('leg'), seam, on, ok: ans.ok, ms: Date.now() - t0, work: ans.work ?? null, budget: budgetWork,
    passes: (ans.passes ?? []).map((p) => `${p.pass}:${p.ok ? p.ticks : (p.kind ?? 'no')}${p.work ? `@${p.work}` : ''}`) };
if (SB.SHOVED_BODY_LOOKAHEAD_COUNTS) r.shoved = { ...SB.SHOVED_BODY_LOOKAHEAD_COUNTS };
if (SB.SHOVED_BODY_LOOKAHEAD_SOLVE_COUNTS) r.solve = { ...SB.SHOVED_BODY_LOOKAHEAD_SOLVE_COUNTS };
if (ans.ok) {
    const run = JR.replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
    const h0 = run.playerHits.length;
    for (let k = 0; k < ans.plan.solution.length; k += 1) {
        const slot = ans.plan.equipsAt?.get?.(k); if (slot !== undefined) run.equipNow(slot);
        run.advance(ans.plan.solution[k]);
    }
    Object.assign(r, { ticks: ans.plan.solution.length, verbs: ans.plan.verbs,
        sha: createHash('sha256').update(JSON.stringify(ans.plan.solution.map((s) => [...s]))).digest('hex').slice(0, 12),
        hits: run.playerHits.slice(h0).map((h) => `${h.t}:${h.id}`), deaths: run.playerDeaths.length,
        end: [run.level, +run.state.x.toFixed(2), +run.state.y.toFixed(2)] });
} else {
    r.kind = ans.kind ?? null; r.code = ans.code ?? null;
    r.message = String(ans.message ?? '').slice(0, 1600);
}
if (arg('trace')) writeFileSync(arg('trace'), trace.map((x) => JSON.stringify(x)).join('\n') + '\n');
console.log(JSON.stringify(r));
