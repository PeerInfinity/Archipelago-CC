// HIT-TIEBREAK census (measure only): one seed-1 divergence-sweep leg solved in node the way the page's solver
// producer asks it (inv-mode staging: the sphere's granted items/slots off a sphere-representative sweep row, matched by
// KEY; a location leg's goal from the sweep's dump), ANYTIME_PASSES under the page's default budget + upgrade window
// (no held retry). Run with SEEDLING_HIT_AWARE_ANSWER=1: every pass row then carries the model's `modelHits`, so one
// run gives both choices — `shippedOn` (the solve's) and `shippedOff` (today's length rule over the same pass rows).
// Adapted from seedling-hammer-small-walls-evidence/tools/census-leg.mjs (sphere rows by key; the pass rows kept).
//   SEEDLING_HIT_AWARE_ANSWER=1 node census-leg.mjs --legs=<legs.jsonl> --spheres=<rows.jsonl> --dump=<dump.json> --id=<n>
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO || process.cwd();
const M = (p) => import(join(REPO, 'frontend/modules', p));
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const jl = (p) => readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const legs = jl(arg('legs'));
const leg = legs.find((l) => l.id === Number(arg('id')));
const byKey = new Map(legs.map((l) => [l.key, l]));
const rep = new Map();
for (const r of jl(arg('spheres'))) { const l = byKey.get(r.key); if (l) rep.set(l.sphere?.index ?? null, r); }
const row = rep.get(leg.sphere?.index ?? null);
const dump = JSON.parse(readFileSync(arg('dump'), 'utf8'));
const { createJsRuntime } = await M('seedlingDemo/jsRuntimeCore.js');
const { arrivalSolverGoal, arrivalSolveRequest } = await M('seedlingDemo/wasmArrival.js');
const { mountedRecordsOf } = await M('seedlingDemo/wasmWalkTape.js');
const JR = await M('seedlingDemo/jsRuntimeSolver.js');
const { atlasEventGoal, atlasLocationGoal } = await M('flashPanel/seedlingPlaybackController.js');
const { levelSourceFromAtlas } = await M('seedlingDemo/atlasSource.js');
const { ITEM_FOR_KEY } = await M('seedlingDemo/seedlingAtlasDerivation.js');
const { sealLogSlots } = await M('seedlingDemo/saveArrayRules.js');
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
// The save arrays the sphere's inventory holds (the small-walls recipe staged none, so every bosslock leg refused):
// keys by `ITEM_FOR_KEY`, the seal log by `sealLogSlots`, one totem part per Totem Shard.
const inv = leg.sphere?.inventory ?? [];
const count = (n) => inv.filter((x) => x === n).length;
staging = { ...staging, save: { ...(staging.save ?? {}),
    keys: ITEM_FOR_KEY.map((n, i) => (inv.includes(n) ? i : -1)).filter((i) => i >= 0),
    seal_parts: Array.from({ length: sealLogSlots(count('Seal')) }, (_, i) => i),
    totem_parts: Array.from({ length: count('Totem Shard') }, (_, i) => i) } };
if (leg.stagedEvents?.length) staging = withStagedFlags(staging, leg.stagedEvents);
const mapped = arrivalSolverGoal(goal, { staging, levelSource: SRC, record: RECS.get(leg.level) });
const out = { id: leg.id, key: leg.key, level: leg.level, goal: leg.goal.name, sphereKey: row?.key ?? null,
    hitAware: JR.HIT_AWARE_ANSWER.enabled };
if (!mapped.goal) { out.outcome = 'no-solver-goal'; console.log(JSON.stringify(out)); process.exit(0); }
const req = arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource: SRC, records: RECS, scratchPersistence: true });
const t0 = Date.now();
const res = JR.solveAnytime({ ...req, levelSource: SRC, budgetWork: JR.SOLVER_BUDGET_WORK,
    upgradeWindowWork: JR.SOLVER_UPGRADE_WINDOW_WORK }, { passes: JR.ANYTIME_PASSES });
out.ms = Date.now() - t0;
out.ok = res.ok;
out.passes = (res.passes ?? []).map(({ ms: _m, ...r }) => r);
// today's choice over the same rows: a plan beats none, then strictly fewer ticks (refusal-vs-refusal detail ignored)
let off = null;
for (const p of out.passes) if (p.ok && (off === null || p.ticks < off.ticks)) off = p;
out.shippedOff = off ? { pass: off.pass, ticks: off.ticks, modelHits: off.modelHits ?? null } : null;
out.shippedOn = res.ok ? { pass: res.plan.pass, ticks: res.plan.solution.length, modelHits: res.plan.modelHits ?? null } : null;
const plans = out.passes.filter((p) => p.ok && p.modelHits);
const verdicts = new Set(plans.map((p) => (p.modelHits.hits > 0 || p.modelHits.deaths > 0)));
out.mixed = plans.length >= 2 && verdicts.size === 2;
out.moved = !!(out.shippedOff && out.shippedOn && out.shippedOff.pass !== out.shippedOn.pass);
out.save = staging.save;
if (!res.ok) { out.kind = res.kind; out.message = String(res.message).slice(0, 300); }
console.log(JSON.stringify(out));
