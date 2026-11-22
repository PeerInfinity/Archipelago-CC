// LOOKAHEAD step 1 (measure only): one seed-1 divergence-sweep leg's ARRIVAL solved in node the way the census tools of
// FEWER-HITS / HIT-TIEBREAK solve it (inv staging, the sphere's items/slots matched by KEY, save keys/seals/totems from the
// sphere inventory, the leg's staged flags), but with the VANILLA atlas map (`seedling-map.json`) as the records in place
// of a page's p4g dump (an exit leg reads no dump entry), and with its GOAL swapped, in turn, for EVERY sibling exit of
// the leg's region that lands in the same target level (`--siblings=1`, the playthrough sidecars), so each pit tile's
// L17 arrival is measured from the same L16 arrival. Each shipped plan is replayed on a fresh shadow with `--idle=N`
// idle ticks appended past its end: the landing row (the first tick in another level), and every model hit split by
// level (`hitRows`, t relative to the plan's start).
//   node pit-landing.mjs --legs=<legs.jsonl, gunzip legs.jsonl.gz> --spheres=<sphere-items.jsonl> --key=<leg key> [--siblings=1] [--idle=60]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO || process.cwd();
const M = (p) => import(join(REPO, 'frontend/modules', p));
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const jl = (p) => readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const legs = jl(arg('legs'));
const leg = legs.find((l) => l.key === arg('key'));
if (!leg) throw new Error(`no leg ${arg('key')}`);
const byKey = new Map(legs.map((l) => [l.key, l]));
const rep = new Map();
for (const r of jl(arg('spheres'))) { const l = byKey.get(r.key); if (l) rep.set(l.sphere?.index ?? null, r); }
const row = rep.get(leg.sphere?.index ?? null);
const { createJsRuntime } = await M('seedlingDemo/jsRuntimeCore.js');
const { arrivalSolverGoal, arrivalSolveRequest } = await M('seedlingDemo/wasmArrival.js');
const JR = await M('seedlingDemo/jsRuntimeSolver.js');
const { indexLevels, levelSourceFromAtlas } = await M('seedlingDemo/atlasSource.js');
const { ITEM_FOR_KEY } = await M('seedlingDemo/seedlingAtlasDerivation.js');
const { sealLogSlots } = await M('seedlingDemo/saveArrayRules.js');
const { withStagedFlags } = await import(join(REPO, 'scripts/procgen/seedling-divergence-bare.mjs'));
const MAP = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const RECS = new Map(indexLevels(MAP));
const SRC = levelSourceFromAtlas(RECS);
const SIDE = JSON.parse(readFileSync(join(REPO, 'worlds/seedling_playthrough/_worldgen_sidecars.json'), 'utf8'));
const exits = SIDE[leg.region]?.playable_payload?.exits ?? [];
// A location leg (the next room's chest legs): the level's one chest entity, by its tag (measurement only).
const chestOf = (lv) => (MAP.levels.find((l) => l.level === lv)?.entities ?? []).filter((e) => e.type === 'chest');
const own = leg.goal.kind === 'exit' ? exits.find((e) => e.exit_id === leg.goal.exit_id)
    : { exit_id: leg.goal.name, location: true, exit_tiles: null, target_level: null };
const goals = arg('siblings', '0') === '1'
    ? exits.filter((e) => e.target_level === own.target_level && e.target_level !== leg.level)
    : [own];
const rt = createJsRuntime();
rt.setVanilla(RECS);
rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [leg.level, leg.arrive.x, leg.arrive.y] }]);
rt.tick();
let staging = { ...rt.session.staging, inventory_slots: row?.slots ?? [],
    seam: { ...(rt.session.staging.seam ?? {}), items: { ...(rt.session.staging.seam?.items ?? {}), ...(row?.items ?? {}) } } };
const inv = leg.sphere?.inventory ?? [];
const count = (n) => inv.filter((x) => x === n).length;
staging = { ...staging, save: { ...(staging.save ?? {}),
    keys: ITEM_FOR_KEY.map((n, i) => (inv.includes(n) ? i : -1)).filter((i) => i >= 0),
    seal_parts: Array.from({ length: sealLogSlots(count('Seal')) }, (_, i) => i),
    totem_parts: Array.from({ length: count('Totem Shard') }, (_, i) => i) } };
if (leg.stagedEvents?.length) staging = withStagedFlags(staging, leg.stagedEvents);
const IDLE = Number(arg('idle', '60'));
const rnd = (v) => (typeof v === 'number' ? +v.toFixed(2) : v);
for (const ex of goals) {
    const goal = ex.location ? { kind: 'location', level: leg.level, tag: Number(chestOf(leg.level)[0]?.attrs?.tag), entityType: 'chest', name: ex.exit_id }
        : { kind: 'exit', level: leg.level, tiles: ex.exit_tiles, name: ex.exitName };
    const mapped = arrivalSolverGoal(goal, { staging, levelSource: SRC, record: RECS.get(leg.level) });
    const out = { key: leg.key, sphereKey: row?.key ?? null, exit: ex.exit_id, tile: ex.exit_tiles, target: ex.target_spawn,
        own: ex.exit_id === leg.goal.exit_id };
    if (!mapped.goal) { out.outcome = 'no-solver-goal'; console.log(JSON.stringify(out)); continue; }
    const req = arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource: SRC, records: RECS, scratchPersistence: true });
    const t0 = Date.now();
    const res = JR.solveAnytime({ ...req, levelSource: SRC, budgetWork: JR.SOLVER_BUDGET_WORK,
        upgradeWindowWork: JR.SOLVER_UPGRADE_WINDOW_WORK }, { passes: JR.ANYTIME_PASSES });
    out.ms = Date.now() - t0;
    out.passes = (res.passes ?? []).map((p) => [p.pass, p.ok, p.ticks ?? null, p.work ?? null,
        p.modelHits ? `${p.modelHits.hits}h${p.modelHits.deaths}d` : (p.ok ? null : 'refused')]);
    if (!res.ok) { out.outcome = res.kind; console.log(JSON.stringify(out)); continue; }
    out.shipped = [res.plan.pass, res.plan.solution.length];
    const shadow = JR.replayTape({ staging: req.staging, perTick: req.perTick, levelSource: SRC, scratchPersistence: true });
    const h0 = shadow.ledger('playerHits').length;
    const n0 = req.perTick.length;
    let landing = null;
    const plan = [...res.plan.solution, ...Array.from({ length: IDLE }, () => new Set())];
    plan.forEach((h, i) => {
        shadow.advance(h);
        if (!landing && shadow.level !== leg.level) landing = { t: i + 1, level: shadow.level, x: rnd(shadow.state.x), y: rnd(shadow.state.y) };
    });
    out.landing = landing;
    out.hitRows = shadow.ledger('playerHits').slice(h0).map((h) => ({ t: h.t - n0, level: h.level, source: h.source, id: h.id }));
    out.hitsByLevel = out.hitRows.reduce((a, h) => ({ ...a, [h.level]: (a[h.level] ?? 0) + 1 }), {});
    out.deaths = shadow.playerDeaths.length;
    // `--cont=1`: the next room's continuations, solved from the plan's end (`continuationSolveRequest`, the engine's own
    // W7 shape): the target level's every non-arrival exit and its chest(s) (`--cont-goals` = the legs list's goals of
    // the target level). Hits are the continuation's own (replayed from the plan's end).
    if (arg('cont', '0') === '1' && landing) {
        const { continuationSolveRequest } = await M('seedlingDemo/wasmArrival.js');
        const cg = [];
        for (const l of legs.filter((x) => x.level === landing.level)) {
            const g = l.goal.kind === 'exit' ? { kind: 'exit', level: l.level, tiles: l.goal.tiles, name: l.goal.name }
                : { kind: 'location', level: l.level, tag: 0, entityType: 'chest', name: l.goal.name };
            if (!cg.some((x) => x.name === g.name)) cg.push(g);
        }
        const shipped = res.plan.solution.map((h) => [...h]);
        out.cont = [];
        for (const g of cg) {
            const c = continuationSolveRequest({ staging: req.staging, shipped, goal: g, levelSource: SRC, records: RECS, record: RECS.get(g.level) });
            if (!c.request) { out.cont.push({ goal: g.name, refusal: c.refusal }); continue; }
            const t1 = Date.now();
            const r2 = JR.solveAnytime({ ...c.request, levelSource: SRC, budgetWork: JR.SOLVER_BUDGET_WORK,
                upgradeWindowWork: JR.SOLVER_UPGRADE_WINDOW_WORK }, { passes: JR.ANYTIME_PASSES });
            const e = { goal: g.name, ms: Date.now() - t1, passes: (r2.passes ?? []).map((p) => [p.pass, p.ok, p.ticks ?? null,
                p.modelHits ? `${p.modelHits.hits}h${p.modelHits.deaths}d` : (p.ok ? null : 'refused')]) };
            if (r2.ok) {
                const s2 = JR.replayTape({ staging: req.staging, perTick: c.request.perTick, levelSource: SRC, scratchPersistence: true });
                const k0 = s2.ledger('playerHits').length;
                r2.plan.solution.forEach((h) => s2.advance(h));
                e.shipped = [r2.plan.pass, r2.plan.solution.length, s2.ledger('playerHits').length - k0];
            }
            out.cont.push(e);
        }
    }
    console.log(JSON.stringify(out));
}
