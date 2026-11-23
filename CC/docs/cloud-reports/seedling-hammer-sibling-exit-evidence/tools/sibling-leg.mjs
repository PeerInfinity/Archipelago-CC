// SIBLING-EXIT: one seed-1 divergence-sweep leg's ARRIVAL solved in node through the PRODUCTION path the page takes —
// `resolveSeedlingAtlasGoal` (the controller, the atlas map with `siblingExits` ON) → `wasmArrival.arrivalSolverGoal`
// (the mapper, siblings attached) → `arrivalSolveRequest` → `jsRuntimeSolver.solveAnytime` (the worker's call; the
// sibling arm) — with the switch OFF and ON (`withSiblingExitChoice`). Staging = LOOKAHEAD's `pit-landing.mjs` (inv
// staging, the sphere's items/slots by KEY, the leg's staged flags). The shipped plan is replayed on a fresh shadow:
// ticks, hits (by level), the landing (level, ctor).
//   node sibling-leg.mjs --legs=<legs.jsonl> --spheres=<sphere-items.jsonl> --key=<leg key>|--keys-file=<file>
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO || process.cwd();
const M = (p) => import(join(REPO, 'frontend/modules', p));
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const jl = (p) => readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const legs = jl(arg('legs'));
const byKey = new Map(legs.map((l) => [l.key, l]));
const rep = new Map();
for (const r of jl(arg('spheres'))) { const l = byKey.get(r.key); if (l) rep.set(l.sphere?.index ?? null, r); }
const keys = arg('keys-file') ? readFileSync(arg('keys-file'), 'utf8').split('\n').filter(Boolean) : [arg('key')];
const { createJsRuntime } = await M('seedlingDemo/jsRuntimeCore.js');
const { arrivalSolverGoal, arrivalSolveRequest } = await M('seedlingDemo/wasmArrival.js');
const JR = await M('seedlingDemo/jsRuntimeSolver.js');
const { indexLevels, levelSourceFromAtlas } = await M('seedlingDemo/atlasSource.js');
const { ITEM_FOR_KEY } = await M('seedlingDemo/seedlingAtlasDerivation.js');
const { sealLogSlots } = await M('seedlingDemo/saveArrayRules.js');
const SIB = await M('seedlingDemo/siblingExitChoice.js');
const { resolveSeedlingAtlasGoal } = await M('flashPanel/seedlingPlaybackController.js');
const { withStagedFlags } = await import(join(REPO, 'scripts/procgen/seedling-divergence-bare.mjs'));
const MAP = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const RECS = new Map(indexLevels(MAP));
const SRC = levelSourceFromAtlas(RECS);
const RULES = JSON.parse(readFileSync(join(REPO, 'frontend/presets/seedling_playthrough/AP_14089154938208861744/AP_14089154938208861744_rules.json'), 'utf8'));
const regions = new Map(Object.entries(RULES.preset_sidecars['1']).map(([r, s]) => [r, s.playable_payload]));
const ATLAS = { regions, siblingExits: SIB.apSiblingExitsOf(RULES, '1', regions) };
for (const key of keys) {
    const leg = byKey.get(key);
    if (!leg) { console.log(JSON.stringify({ key, outcome: 'no-such-leg' })); continue; }
    const row = rep.get(leg.sphere?.index ?? null);
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
    const out = { key, sphereKey: row?.key ?? null };
    for (const on of [false, true]) {
        const side = on ? 'on' : 'off';
        SIB.withSiblingExitChoice(on, () => {
            const r = resolveSeedlingAtlasGoal({ kind: 'exit', name: leg.goal.name }, ATLAS, { region: leg.region });
            if (!r.goal) { out[side] = { refused: r.refused ?? 'link' }; return; }
            const mapped = arrivalSolverGoal(r.goal, { staging, levelSource: SRC, record: RECS.get(leg.level) });
            if (!mapped.goal) { out[side] = { outcome: 'no-solver-goal', why: mapped.walker }; return; }
            const req = arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource: SRC, records: RECS, scratchPersistence: true });
            const t0 = Date.now();
            const res = JR.solveAnytime({ ...req, levelSource: SRC, budgetWork: JR.SOLVER_BUDGET_WORK,
                upgradeWindowWork: JR.SOLVER_UPGRADE_WINDOW_WORK }, { passes: JR.ANYTIME_PASSES });
            const o = { siblings: (r.goal.siblings ?? []).length, mappedSiblings: (mapped.goal.siblings ?? []).length, ms: Date.now() - t0 };
            if (!res.ok) { out[side] = { ...o, outcome: res.kind }; return; }
            const shadow = JR.replayTape({ staging: req.staging, perTick: req.perTick, levelSource: SRC, scratchPersistence: true });
            const h0 = shadow.ledger('playerHits').length;
            let landing = null;
            res.plan.solution.forEach((h, i) => {
                shadow.advance(h);
                if (!landing && shadow.level !== leg.level) landing = { t: i + 1, level: shadow.level, ctor: { ...(shadow.worldCtor ?? {}) } };
            });
            const hits = shadow.ledger('playerHits').slice(h0);
            out[side] = { ...o, pass: res.plan.pass, ticks: res.plan.solution.length, modelHits: res.plan.modelHits ?? null,
                replayHits: hits.length, hitIds: hits.map((h) => `${h.level}:${h.id}`), landing,
                note: JR.forcedHitNote(res.plan) || null,
                ...(res.plan.siblingExit ? { siblingExit: { named: res.plan.siblingExit.named, chosen: res.plan.siblingExit.chosen,
                    why: res.plan.siblingExit.why, rows: res.plan.siblingExit.rows } } : {}) };
        });
    }
    console.log(JSON.stringify(out));
}
