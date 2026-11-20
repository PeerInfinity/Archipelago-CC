// FEWER-HITS phase probe on a census leg (measure only): the leg's arrival request built as census-leg.mjs builds it, then
// solved with k idle ticks first (k in --ks), both passes, no budget (--budget=page for the page's budget/window), the
// model's hits/deaths per pass on the idle ticks + the plan's own.
//   node phase-leg.mjs --legs=… --spheres=… --dump=… --id=N [--ks=0..40] [--budget=page|none]
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
const [ka, kb] = (arg('ks', '0..40')).split('..').map(Number);
const page = arg('budget', 'none') === 'page';
const rp = (perTick) => JR.replayTape({ staging: req.staging, perTick, levelSource: SRC, scratchPersistence: req.scratchPersistence });
const h0 = rp(req.perTick).ledger('playerHits').length;
for (let k = ka; k <= kb; k += 1) {
    const perTick = [...req.perTick, ...Array.from({ length: k }, () => new Set())];
    const sh = rp(perTick);
    const idleHits = sh.ledger('playerHits').length - h0;
    const t0 = Date.now();
    const res = JR.withHitAvoidPass(false, () => JR.withHitAwareAnswer(true, () => JR.solveAnytime({ ...req, perTick, live: JR.liveOf(sh), levelSource: SRC,
        ...(page ? { budgetWork: JR.SOLVER_BUDGET_WORK, upgradeWindowWork: JR.SOLVER_UPGRADE_WINDOW_WORK } : {}) }, { passes: JR.ANYTIME_PASSES })));
    const hitRows = (res.ok && arg('hits', '') === '1') ? rp([...perTick, ...res.plan.solution]).ledger('playerHits').slice(h0).map((h) => ({ t: h.t - req.perTick.length, ...Object.fromEntries(Object.entries(h).filter(([k2]) => k2 !== 't').map(([k2, v]) => [k2, typeof v === 'number' ? +v.toFixed(2) : v])) })) : undefined;
    console.log(JSON.stringify({ id: leg.id, k, idleHits, ms: Date.now() - t0, shipped: res.ok ? [res.plan.pass, res.plan.solution.length] : null, hitRows,
        passes: (res.passes ?? []).map((p) => [p.pass, p.ok, p.ticks, p.work ?? null, p.modelHits ? `${p.modelHits.hits}h${p.modelHits.deaths}d` : (p.ok ? null : 'refused')]) }));
}
