// L40-SPINNER-WALLS: solve one captured page request in node, in the worker's dispatch (`solveAnytime`, the request's
// own budgets) or one uncapped dashless pass, at the switches the process env sets (SEEDLING_*=1); replay the plan on a
// fresh run and count hits.  node solve.mjs --req=<capture.jsonl> --key=<substring> [--n=<request index, default last>]
//   [--mode=anytime|dashless|full] [--cap=<work, 0 = none>] [--seam=<clock>] [--plan=<out.json>]
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const R = process.env.REPO || process.cwd();
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
const M = (p) => import(join(R, 'frontend/modules/seedlingDemo', p));
const { restoreRequest } = await import(join(R, 'scripts/procgen/seedlingSolveRequestCodec.js'));
const { levelSourceFromAtlas } = await M('atlasSource.js');
const JR = await M('jsRuntimeSolver.js');
const SB = await M('solverBot.js');
const lines = readFileSync(arg('req'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((o) => o.key.includes(arg('key')));
if (lines.length !== 1) throw new Error(`key matched ${lines.length} rows`);
const reqs = lines[0].requests;
const n = arg('n') === null ? reqs.length - 1 : Number(arg('n'));
let c0 = reqs[n].request;
if (arg('seam')) c0 = { ...c0, staging: { ...c0.staging, seam: { ...c0.staging.seam, time: Number(arg('seam')) } } };
const { passes = JR.ANYTIME_PASSES, source, budgetWork, upgradeWindowWork, ...tape } = restoreRequest(c0);
const levelSource = levelSourceFromAtlas(source.records);
const on = Object.keys(process.env).filter((k) => k.startsWith('SEEDLING_') && process.env[k] === '1').sort();
const mode = arg('mode') ?? 'anytime';
const t0 = Date.now();
let ans; let work = 0; let caught = null;
if (mode === 'anytime') ans = JR.solveAnytime({ ...tape, budgetWork, upgradeWindowWork, levelSource }, { passes });
else {
    const cap = Number(arg('cap') ?? 0);
    ans = JR.settleSolve(() => { try { return JR.solveFromTape({ ...tape, levelSource, dashMode: mode === 'dashless' ? 'none' : 'full', adds: null,
        fineCheckpoints: true, shouldStop: () => { work += 1; return cap > 0 && work > cap; } }); } catch (e) { caught = e; throw e; } });
}
const r = { key: lines[0].key, n, of: reqs.length, budget: budgetWork, seam: tape.staging.seam?.time, persistence: tape.staging.persistence.map((c) => `${c.level}:${c.tag}`),
    mode, on, ok: ans.ok, ms: Date.now() - t0, work: ans.work ?? work,
    passes: (ans.passes ?? []).map((p) => `${p.pass}:${p.ok ? p.ticks : (p.kind ?? 'no')}${p.work ? `@${p.work}` : ''}`) };
if (SB.HAMMER_BODY_GATE_COUNTS) r.bodyGate = { ...SB.HAMMER_BODY_GATE_COUNTS };
if (SB.SHOVED_BODY_LOOKAHEAD_COUNTS) r.shoved = { ...SB.SHOVED_BODY_LOOKAHEAD_COUNTS };
if (ans.ok) {
    const run = JR.replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
    const h0 = run.playerHits.length;
    for (let k = 0; k < ans.plan.solution.length; k += 1) {
        const slot = ans.plan.equipsAt?.get?.(k); if (slot !== undefined) run.equipNow(slot);
        run.advance(ans.plan.solution[k]);
    }
    Object.assign(r, { ticks: ans.plan.solution.length, verbs: ans.plan.verbs, sha: createHash('sha256').update(JSON.stringify(ans.plan.solution.map((s) => [...s]))).digest('hex').slice(0, 12),
        hits: run.playerHits.slice(h0).map((h) => `${h.t}:${h.id}`), deaths: run.playerDeaths.length, end: [run.level, +run.state.x.toFixed(2), +run.state.y.toFixed(2)],
        clears: (run.ledger('earnedClears') ?? []).map((c) => `${c.level}:${c.tag}`).sort() });
    if (arg('plan')) writeFileSync(arg('plan'), JSON.stringify({ staging: tape.staging, keys: ans.plan.solution.map((k) => [...k]), equipsAt: [...(ans.plan.equipsAt ?? [])] }));
} else {
    r.kind = ans.kind ?? null; r.code = ans.code ?? caught?.code ?? null;
    r.message = String(ans.message ?? '').slice(0, 1600);
}
console.log(JSON.stringify(r));
