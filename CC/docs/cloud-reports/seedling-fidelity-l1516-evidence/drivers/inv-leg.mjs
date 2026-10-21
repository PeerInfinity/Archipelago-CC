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
const mapped = arrivalSolverGoal(goal, { staging, levelSource: SRC, record: RECS.get(leg.level) });
if (process.env.SEAM_TIME && row?.seamTime != null) staging = { ...staging, seam: { ...staging.seam, time: row.seamTime } };
const out = { id: leg.id, key: leg.key, level: leg.level, goal: leg.goal.name };
if (!mapped.goal) { out.outcome = 'no-solver-goal'; out.err = mapped.walker; console.log(JSON.stringify(out)); process.exit(0); }
const req = { ...arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource: SRC, records: RECS, scratchPersistence: true }),
    passes: ANYTIME_PASSES,
    ...(process.env.BUDGET ? { budgetWork: Number(process.env.BUDGET), upgradeWindowWork: Number(process.env.WINDOW ?? process.env.BUDGET) } : {}) };
const t0 = Date.now();
const res = createInPlaceProduceService().start(req).result;
out.ms = Date.now() - t0;
out.ok = res.ok;
out.passes = res.passes ?? res.plan?.passes ?? null;
if (res.ok) { out.ticks = res.plan.solution.length; out.verbs = res.plan.verbs; out.end = res.plan.expected.at(-1); }
else { out.kind = res.kind; out.message = String(res.message).slice(0, 1200); out.obstacle = res.obstacle ?? res.refusal?.obstacle ?? null; }
console.log(JSON.stringify(out));
