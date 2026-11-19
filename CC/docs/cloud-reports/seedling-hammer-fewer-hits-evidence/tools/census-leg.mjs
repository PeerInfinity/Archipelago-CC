// FEWER-HITS census (measure only), adapted from HIT-TIEBREAK's census-leg.mjs: one seed-1 divergence-sweep leg solved in
// node as the page's solver producer asks its ARRIVAL (inv staging, the sphere's items/slots by KEY, the p4g dump),
// ANYTIME_PASSES under the page's budget + window. Run with SEEDLING_HIT_AVOID_PASS=1 SEEDLING_FEWER_HITS_RANK=1 (and
// HIT_AWARE_ANSWER at its default ON): the dashless/full rows are the base's own (OFF never runs the third pass), so one
// run gives `shippedBase` (the base's rule over those rows: hit verdict, then ticks) and `shippedOn` (the solve's).
// A shipped plan that moved is re-driven on a fresh replayTape (`redrive`). Continuations (a replan after an item
// delivery) are NOT solved here: only the arrival request.
//   SEEDLING_HIT_AVOID_PASS=1 SEEDLING_FEWER_HITS_RANK=1 node census-leg.mjs --legs=<legs.jsonl> --spheres=<rows.jsonl> --dump=<dump.json> --id=<n>
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
// the base's choice over the dashless/full rows: a plan beats none; a hitless verdict beats a hit one; then fewer ticks
let base = null;
const hit = (p) => (p.modelHits ? p.modelHits.hits > 0 || p.modelHits.deaths > 0 : null);
for (const p of out.passes.filter((r) => r.pass !== 'hit-avoid')) {
    if (!p.ok) continue;
    if (base === null) { base = p; continue; }
    const hb = hit(base); const hn = hit(p);
    if (hb !== null && hn !== null && hb !== hn) { if (hb && !hn) base = p; continue; }
    if (p.ticks < base.ticks) base = p;
}
out.shippedBase = base ? { pass: base.pass, ticks: base.ticks, modelHits: base.modelHits ?? null } : null;
out.shippedOn = res.ok ? { pass: res.plan.pass, ticks: res.plan.solution.length, modelHits: res.plan.modelHits ?? null,
    delay: res.plan.hitAvoidDelay ?? null } : null;
out.bothHit = out.passes.filter((p) => p.pass !== 'hit-avoid' && p.ok).length >= 1
    && out.passes.filter((p) => p.pass !== 'hit-avoid' && p.ok).every((p) => hit(p) === true);
out.moved = !!(out.shippedBase && out.shippedOn && (out.shippedBase.pass !== out.shippedOn.pass || out.shippedBase.ticks !== out.shippedOn.ticks));
if (out.moved) {
    const rp = (perTick) => JR.replayTape({ staging: req.staging, perTick, levelSource: SRC, scratchPersistence: req.scratchPersistence });
    const b = rp(req.perTick); const s = rp([...req.perTick, ...res.plan.solution]);
    out.redrive = { hits: s.ledger('playerHits').length - b.ledger('playerHits').length, deaths: s.playerDeaths.length - b.playerDeaths.length };
}
out.env = { avoid: JR.HIT_AVOID_PASS.enabled, fewer: JR.FEWER_HITS_RANK.enabled };
out.save = staging.save;
if (!res.ok) { out.kind = res.kind; out.message = String(res.message).slice(0, 300); }
console.log(JSON.stringify(out));
