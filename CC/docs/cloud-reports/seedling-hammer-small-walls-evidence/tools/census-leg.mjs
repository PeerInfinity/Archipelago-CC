// small-walls census: one seed-1 leg solved in node the way the page's solver producer asks it (inv-mode staging: the
// sphere's granted items/slots, read off a sphere-representative sweep row, over the JS runtime's arrival staging; a
// location leg's goal from the sweep's dump), ANYTIME_PASSES. Prints one JSON row with FRONTIER_DOOR_ROUTE's counts.
// Adapted from seedling-hammer-wallflyer-drill-kill-evidence/drivers/inv-leg.mjs (the sphere map is the only change).
//   [SEEDLING_FRONTIER_DOOR_ROUTE=1] node census-leg.mjs --legs=<legs.jsonl> --spheres=<rows.jsonl> --dump=<dump.json> --id=<n>
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO || process.cwd();
const M = (p) => import(join(REPO, 'frontend/modules', p));
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const jl = (p) => readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const legs = jl(arg('legs'));
const leg = legs.find((l) => l.id === Number(arg('id')));
const rep = new Map(jl(arg('spheres')).map((r) => [legs.find((l) => l.id === r.id).sphere?.index ?? null, r]));
const row = rep.get(leg.sphere?.index ?? null);
const dump = JSON.parse(readFileSync(arg('dump'), 'utf8'));
const { createJsRuntime } = await M('seedlingDemo/jsRuntimeCore.js');
const { arrivalSolverGoal, arrivalSolveRequest } = await M('seedlingDemo/wasmArrival.js');
const { createInPlaceProduceService, mountedRecordsOf } = await M('seedlingDemo/wasmWalkTape.js');
const { ANYTIME_PASSES, replayTape } = await M('seedlingDemo/jsRuntimeSolver.js');
const { atlasEventGoal, atlasLocationGoal } = await M('flashPanel/seedlingPlaybackController.js');
const { levelSourceFromAtlas } = await M('seedlingDemo/atlasSource.js');
const { FRONTIER_DOOR_ROUTE } = await M('seedlingDemo/solverBot.js');
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
const out = { id: leg.id, key: leg.key, level: leg.level, goal: leg.goal.name, sphereRow: row?.id ?? null, on: FRONTIER_DOOR_ROUTE.enabled };
if (!mapped.goal) { out.outcome = 'no-solver-goal'; console.log(JSON.stringify(out)); process.exit(0); }
const req = { ...arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource: SRC, records: RECS, scratchPersistence: true }),
    passes: ANYTIME_PASSES };
const t0 = Date.now();
const res = createInPlaceProduceService().start(req).result;
out.ms = Date.now() - t0;
out.ok = res.ok;
out.counts = { ...FRONTIER_DOOR_ROUTE.counts };
if (res.ok) {
    out.ticks = res.plan.solution.length; out.end = res.plan.expected.at(-1);
    try {
        const fr = replayTape({ staging, perTick: res.plan.solution, levelSource: SRC, scratchPersistence: true });
        out.hits = fr.ledger('playerHits').length; out.deaths = fr.ledger('playerDeaths').length;
    } catch (e) { out.replayError = String(e.message).slice(0, 200); }
} else { out.kind = res.kind; out.message = String(res.message).slice(0, 400); }
console.log(JSON.stringify(out));
