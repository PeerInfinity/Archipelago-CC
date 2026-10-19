// AXEFORCEDU copy of AXETIMING's drivers/leg.mjs (+ the AXEPRICED / FORCEDHIT trace sinks on stderr).
// scratch: one sweep leg, solved in node the way the page's solver producer asks it (inv-mode staging: the sweep
// row's items/slots over the JS runtime's arrival staging; a location leg's goal from the sweep's dump), ANYTIME_PASSES,
// optional BUDGET. Adapted from L74LEG624's drivers/leg.mjs + seedling-divergence-bare.mjs's oneLeg. Prints one JSON row.
//   node inv-leg.mjs --legs=<legs.jsonl> --rows=<sweep rows.jsonl> --dump=<delivered-set.json> --id=<leg id>
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO || '/home/user/Archipelago-CC';
const M = (p) => import(join(REPO, 'frontend/modules', p));
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const jl = (p) => readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const legs = jl(arg('legs'));
const leg = legs.find((l) => l.id === Number(arg('id')));
const row = jl(arg('rows')).find((r) => r.key === leg.key);
const dump = JSON.parse(readFileSync(arg('dump'), 'utf8'));
const { createJsRuntime } = await M('seedlingDemo/jsRuntimeCore.js');
const { arrivalSolverGoal, arrivalSolveRequest } = await M('seedlingDemo/wasmArrival.js');
const { createInPlaceProduceService, mountedRecordsOf } = await M('seedlingDemo/wasmWalkTape.js');
const { ANYTIME_PASSES } = await M('seedlingDemo/jsRuntimeSolver.js');
const { atlasEventGoal, atlasLocationGoal } = await M('flashPanel/seedlingPlaybackController.js');
const { levelSourceFromAtlas } = await M('seedlingDemo/atlasSource.js');
const { withStagedFlags } = await import(join(REPO, 'scripts/procgen/seedling-divergence-bare.mjs'));
const RECS = mountedRecordsOf(dump.deliveredSet);
// ⛓ AXEFORCEDU: the priced crossing's trace, one stderr line per asking (inert without the module / switch)
try { const { AXE_PRICED_TRACE } = await M('seedlingDemo/axePricedCrossing.js'); AXE_PRICED_TRACE.sink = (r) => { globalThis.__axep = r; console.error('AXEPRICED ' + JSON.stringify({ ...r, rejected: (r.rejected ?? []).map(({ keys, ...x }) => x) })); }; const m = await M('seedlingDemo/axePricedCrossing.js'); if (process.env.AXEP_CANDIDATES) m.AXE_PRICED_CROSSING.forkCandidates = Number(process.env.AXEP_CANDIDATES); if (process.env.AXEP_PREVIEWS) m.AXE_PRICED_CROSSING.maxPreviews = Number(process.env.AXEP_PREVIEWS); } catch {}
try { const { FORCED_HIT_TRACE } = await M('seedlingDemo/forcedHit.js'); FORCED_HIT_TRACE.sink = (r) => console.error('FORCEDHIT ' + JSON.stringify({ outcome: r.outcome, what: r.what, why: String(r.why ?? '').slice(0, 300) })); } catch {}
const SRC = levelSourceFromAtlas(RECS);
let goal;
if (leg.goal.kind === 'exit') goal = { kind: 'exit', level: leg.level, tiles: leg.goal.tiles, name: leg.goal.name };
else {
    const ev = (dump.events ?? []).find((x) => x.location === leg.goal.name);
    if (ev) goal = atlasEventGoal(ev, ev.sideLevel, leg.goal.name);
    goal ??= atlasLocationGoal(dump.entries.find((x) => x.location === leg.goal.name), leg.goal.name);
}
const rt = createJsRuntime();
rt.setVanilla(RECS);
rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [leg.level, leg.arrive.x, leg.arrive.y] }]);
rt.tick();
let staging = { ...rt.session.staging, inventory_slots: row?.slots ?? [],
    seam: { ...(rt.session.staging.seam ?? {}), items: { ...(rt.session.staging.seam?.items ?? {}), ...(row?.items ?? {}) } } };
if (leg.stagedEvents?.length) staging = withStagedFlags(staging, leg.stagedEvents);
if (process.env.SEAM_TIME) staging = { ...staging, seam: { ...staging.seam, time: Number(process.env.SEAM_TIME) } };
if (row?.slots) staging.inventory_slots = row.slots;
const mapped = arrivalSolverGoal(goal, { staging, levelSource: SRC, record: RECS.get(leg.level) });
const out = { id: leg.id, key: leg.key, level: leg.level, goal: leg.goal.name };
if (!mapped.goal) { out.outcome = 'no-solver-goal'; out.err = mapped.walker; console.log(JSON.stringify(out)); process.exit(0); }
const req = { ...arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource: SRC, records: RECS, scratchPersistence: true }),
    passes: process.env.ONLY_PASS ? ANYTIME_PASSES.filter((p) => p.pass === process.env.ONLY_PASS) : ANYTIME_PASSES,
    ...(process.env.BUDGET ? { budgetWork: Number(process.env.BUDGET), upgradeWindowWork: Number(process.env.WINDOW ?? process.env.BUDGET) } : {}) };
const t0 = Date.now();
let res;
if (process.env.PAGE_BUDGET) {
    // the page's flow: one attempt at SOLVER_BUDGET_WORK (640) with the upgrade window, then — no plan, a pass cut by its
    // budget — the held retry at 4x over the passes not answered (`seedlingWasmPlayback.retrySolve` / `passesAfter`)
    const { solveAnytime, SOLVER_BUDGET_WORK, SOLVER_UPGRADE_WINDOW_WORK } = await M('seedlingDemo/jsRuntimeSolver.js');
    let budget = SOLVER_BUDGET_WORK; let passes = req.passes; const attempts = [];
    for (let k = 0; k < 2; k += 1) {
        res = solveAnytime({ ...req, passes: undefined, levelSource: SRC, budgetWork: budget, upgradeWindowWork: SOLVER_UPGRADE_WINDOW_WORK }, { passes });
        attempts.push({ budget, rows: res.passes });
        if (res.ok) break;
        const cut = (res.passes ?? []).filter((r) => r.deadline);
        if (!cut.length) break;
        const answered = new Set((res.passes ?? []).filter((r) => !r.deadline).map((r) => r.pass));
        passes = passes.filter((p) => !answered.has(p.pass)); budget *= 4;
    }
    res.attempts = attempts;
} else res = createInPlaceProduceService().start(req).result;
out.ms = Date.now() - t0; if (process.env.RES_OUT) (await import("node:fs")).writeFileSync(process.env.RES_OUT, JSON.stringify(res, (k, v) => v instanceof Set ? [...v] : (v instanceof Map ? [...v] : v)));
out.ok = res.ok;
out.passes = res.passes ?? res.plan?.passes ?? null; out.attempts = res.attempts ?? null;
if (res.ok && process.env.PLAN_OUT) { (await import('node:fs')).writeFileSync(process.env.PLAN_OUT, JSON.stringify({ request: req, plan: res.plan }, (k, v) => v instanceof Set ? { __set: [...v] } : (v instanceof Map ? { __map: [...v] } : v))); }
if (res.ok && process.env.TAPE_OUT) { const { buildStagedTape } = await M('seedlingDemo/botDriverV1.js'); const tape = buildStagedTape({ staging: req.staging, perTick: res.plan.solution.map((k) => new Set(k)), name: process.env.TAPE_NAME ?? 'smallgaps-plan' }); (await import('node:fs')).writeFileSync(process.env.TAPE_OUT, typeof tape === 'string' ? tape : JSON.stringify(tape, null, 1)); }
if (res.ok) { out.ticks = res.plan.solution.length; out.verbs = res.plan.verbs; out.end = res.plan.expected.at(-1); }
else { out.kind = res.kind; out.message = String(res.message).slice(0, 30000); out.obstacle = res.obstacle ?? res.refusal?.obstacle ?? null; }
console.log(JSON.stringify(out));
// ⛓ AXEFORCEDU D3: MEMBER_TAPE_OUT — the first rejected priced member's keys (the fork's), as a staged tape for the game
if (process.env.MEMBER_TAPE_OUT && globalThis.__axep) { const pick = (globalThis.__axep.rejected ?? []).find((x) => x.keys && (!process.env.MEMBER || x.candidate === process.env.MEMBER)); if (pick) { const { buildStagedTape } = await M('seedlingDemo/botDriverV1.js'); const tape = buildStagedTape({ staging: req.staging, perTick: pick.keys.map((k) => new Set(k)), name: process.env.TAPE_NAME ?? 'axeforcedu-member' }); (await import('node:fs')).writeFileSync(process.env.MEMBER_TAPE_OUT, typeof tape === 'string' ? tape : JSON.stringify(tape, null, 1)); console.error('MEMBER ' + JSON.stringify({ candidate: pick.candidate, why: pick.why, ticks: pick.keys.length })); } }
