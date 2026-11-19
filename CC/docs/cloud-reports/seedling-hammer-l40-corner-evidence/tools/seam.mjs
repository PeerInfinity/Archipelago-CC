// L40-CORNER: one committed L40 request re-stamped to an arrival clock, solved by the worker's dispatch (`solveAnytime`,
// the request's own budgets, or --budget=<work>) at the switches the process env sets (SEEDLING_*=1 on, =0 off); the plan
// replayed on a fresh run and its hits counted.
//   node seam.mjs --fx=flag12-L39|flag12-L43|chest-L39 --seam=<clock> [--budget=<work>]   → one JSON line
import { readFileSync } from 'node:fs';
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
const PW = await M('pressPhaseWait.js').catch(() => null);
const waits = [];
if (PW?.PRESS_PHASE_WAIT_TRACE) PW.PRESS_PHASE_WAIT_TRACE.sink = (x) => { waits.push(`w${x.w}:${x.outcome}:${Math.round(x.ms)}ms`); if (process.env.PPW_LOG) console.error(`t${x.t} w${x.w} ${x.outcome} ${Math.round(x.ms)}ms`); };
const FX = { 'flag12-L39': 'hammer-cleartag-chain/leg871-l39-l40-request.json.gz',
    'flag12-L43': 'hammer-cleartag-chain/leg872-l43-l40-request.json.gz',
    'chest-L39': 'hammer-l40-spinner-walls/chest-L39-request.json.gz' };
const fix = JSON.parse(gunzipSync(readFileSync(join(R, 'frontend/modules/seedlingDemo/fixtures', FX[arg('fx')]))).toString('utf8'));
const c0 = fix.requests[0].request;
const seam = arg('seam') === null ? c0.staging.seam.time : Number(arg('seam'));
const { passes = JR.ANYTIME_PASSES, source, budgetWork, upgradeWindowWork, ...tape } = restoreRequest({ ...c0,
    staging: { ...c0.staging, seam: { ...c0.staging.seam, time: seam } } });
const budget = arg('budget') === null ? budgetWork : Number(arg('budget'));
const levelSource = levelSourceFromAtlas(source.records);
const on = Object.keys(process.env).filter((k) => k.startsWith('SEEDLING_')).sort().map((k) => `${k.slice(9)}=${process.env[k]}`);
const t0 = Date.now();
const ans = JR.solveAnytime({ ...tape, budgetWork: budget, upgradeWindowWork, levelSource }, { passes });
const r = { fx: arg('fx'), key: fix.key, seam, on, ok: ans.ok, ms: Date.now() - t0, work: ans.work ?? null, budget,
    passes: (ans.passes ?? []).map((p) => `${p.pass}:${p.ok ? p.ticks : (p.kind ?? 'no')}${p.work ? `@${p.work}` : ''}`) };
if (PW?.PRESS_PHASE_WAIT_COUNTS?.asked) r.phaseWait = { ...PW.PRESS_PHASE_WAIT_COUNTS, waits };
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
        end: [run.level, +run.state.x.toFixed(2), +run.state.y.toFixed(2)],
        clears: (run.ledger('earnedClears') ?? []).map((c) => `${c.level}:${c.tag}`).sort() });
} else {
    r.kind = ans.kind ?? null; r.code = ans.code ?? null;
    r.message = String(ans.message ?? '').slice(0, 2400);
}
console.log(JSON.stringify(r));
