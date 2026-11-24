// leg 906 in node, the page's producer request (hammer small-walls census-leg.mjs, adapted): no sweep dump, so the
// records are the atlas's own (`seedling-divergence-bare`'s fallback) and the chest goal is built from its record
// (L63 chest@224,80, tag 5). Prints one JSON row; with --trace, the playerHits of the replayed plan.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.cwd();
const M = (p) => import(join(REPO, 'frontend/modules', p));
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const jl = (p) => readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const legs = jl(arg('legs'));
const leg = legs.find((l) => l.id === Number(arg('id', '906')));
const rep = new Map(jl(arg('spheres')).map((r) => [legs.find((l) => l.id === r.id).sphere?.index ?? null, r]));
const row = rep.get(leg.sphere?.index ?? null);
const { createJsRuntime } = await M('seedlingDemo/jsRuntimeCore.js');
const { arrivalSolverGoal, arrivalSolveRequest } = await M('seedlingDemo/wasmArrival.js');
const { createInPlaceProduceService } = await M('seedlingDemo/wasmWalkTape.js');
const { ANYTIME_PASSES, replayTape } = await M('seedlingDemo/jsRuntimeSolver.js');
const { indexLevels, levelSourceFromAtlas } = await M('seedlingDemo/atlasSource.js');
const { CONTACT_FIDELITY } = await M('seedlingDemo/contactFidelity.js');
const MAP = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const RECS = new Map(indexLevels(MAP));
const SRC = levelSourceFromAtlas(RECS);
const goal = leg.goal.kind === 'exit' ? { kind: 'exit', level: leg.level, tiles: leg.goal.tiles, name: leg.goal.name }
    : { kind: 'location', level: leg.level, tag: Number(arg('tag', '5')), entityType: arg('etype', 'chest'), name: leg.goal.name };
const rt = createJsRuntime();
rt.setVanilla(RECS);
rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [leg.level, leg.arrive.x, leg.arrive.y] }]);
rt.tick();
let staging = { ...rt.session.staging, inventory_slots: row?.slots ?? [],
    seam: { ...(rt.session.staging.seam ?? {}), items: { ...(rt.session.staging.seam?.items ?? {}), ...(row?.items ?? {}) } } };
if (arg('row')) {
    const r = JSON.parse(readFileSync(arg('row'), 'utf8'));
    const flags = (r.granted ?? []).map((g) => /^L(\d+) flag (\d+):/.exec(g)).filter(Boolean)
        .map((m) => ({ level: Number(m[1]), tag: Number(m[2]) }));
    const { withStagedFlags } = await import(join(REPO, 'scripts/procgen/seedling-divergence-bare.mjs'));
    staging = withStagedFlags(staging, flags);
}
const mapped = arrivalSolverGoal(goal, { staging, levelSource: SRC, record: RECS.get(leg.level) });
const out = { id: leg.id, key: leg.key, key_on: CONTACT_FIDELITY.darkSuitStaticRetaliation, hasDarkSuit: row?.items?.hasDarkSuit };
if (!mapped.goal) { out.outcome = 'no-solver-goal'; out.why = mapped; console.log(JSON.stringify(out)); process.exit(0); }
const req = { ...arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource: SRC, records: RECS, scratchPersistence: true }),
    passes: ANYTIME_PASSES };
const t0 = Date.now();
const res = createInPlaceProduceService().start(req).result;
out.ms = Date.now() - t0;
out.ok = res.ok;
if (res.ok) {
    out.ticks = res.plan.solution.length; out.verbs = res.plan.verbs; out.end = res.plan.expected.at(-1);
    try {
        const fr = replayTape({ staging, perTick: res.plan.solution, levelSource: SRC, scratchPersistence: true });
        out.hits = fr.ledger('playerHits').length; out.deaths = fr.ledger('playerDeaths').length;
        out.hitRows = fr.ledger('playerHits').map((h) => ({ t: h.t, source: h.source, id: h.id, retaliation: h.retaliation ?? null }));
    } catch (e) { out.replayError = String(e.message).slice(0, 400); }
} else { out.kind = res.kind; out.message = String(res.message).slice(0, 900); }
console.log(JSON.stringify(out));
