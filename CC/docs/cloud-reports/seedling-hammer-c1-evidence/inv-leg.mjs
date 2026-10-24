#!/usr/bin/env node
// SCRATCH (seedling-hammer-c1): one divergence-sweep leg solved in node WITH the sweep row's items (the bare pass's
// `oneLeg`, plus the row's item flags queued before the boot). Measure-only; nothing tracked.
//   node inv-leg.mjs --legs=legs.jsonl --rows=rows.jsonl --dump=delivered-set.json --ids=551,552
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = '/home/user/Archipelago-CC';
const M = (p) => import(join(REPO, 'frontend/modules', p));
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const legs = new Map(readFileSync(arg('legs'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((l) => [l.id, l]));
const rows = new Map(readFileSync(arg('rows'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((l) => [l.id, l]));
const ids = arg('ids').split(',').map(Number);
const { createJsRuntime } = await M('seedlingDemo/jsRuntimeCore.js');
const { arrivalSolverGoal, arrivalSolveRequest } = await M('seedlingDemo/wasmArrival.js');
const { wasmGoalRefusal } = await M('seedlingDemo/wasmPlayback.js');
const { createInPlaceProduceService, mountedRecordsOf } = await M('seedlingDemo/wasmWalkTape.js');
const { ANYTIME_PASSES } = await M('seedlingDemo/jsRuntimeSolver.js');
const { levelSourceFromAtlas } = await M('seedlingDemo/atlasSource.js');
const dump = JSON.parse(readFileSync(arg('dump'), 'utf8'));
const RECS = mountedRecordsOf(dump.deliveredSet);
const SRC = levelSourceFromAtlas(RECS);
for (const id of ids) {
    const leg = legs.get(id);
    const row = rows.get(id);
    const out = { id, key: leg.key };
    const t0 = Date.now();
    try {
        let goal;
        if (leg.goal.kind === 'exit') goal = { kind: 'exit', level: leg.level, tiles: leg.goal.tiles, name: leg.goal.name };
        else {
            const e = dump.entries.find((x) => x.location === leg.goal.name);
            goal = { kind: 'location', level: e.level, tag: e.tag, entityType: e.entityType ?? null, name: leg.goal.name };
        }
        const ref = wasmGoalRefusal(goal, RECS.get(leg.level) ?? null);
        if (ref) throw new Error(`wasm-refused ${ref}`);
        const rt = createJsRuntime();
        rt.setVanilla(RECS);
        const items = Object.entries(row.items ?? {}).filter(([k, v]) => (k === 'hitsMax' ? v !== 3 : v === true))
            .map(([property, value]) => ({ class: 'Main', property, value }));
        out.items = items.map((i) => i.property);
        rt.queueItems([...items, { invocation: 'new_instance', className: 'Game', args: [leg.level, leg.arrive.x, leg.arrive.y] }]);
        rt.tick();
        rt.tick();
        const staging = rt.session.staging;
        const mapped = arrivalSolverGoal(goal, { staging, levelSource: SRC, record: RECS.get(leg.level) });
        if (!mapped.goal) throw new Error(`no-solver-goal ${mapped.walker}`);
        const req = { ...arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource: SRC, records: RECS,
            scratchPersistence: true }), passes: ANYTIME_PASSES };
        const res = createInPlaceProduceService().start(req).result;
        if (!res.ok) { out.outcome = 'refused'; out.err = String(res.message); }
        else {
            out.outcome = 'solved'; out.ticks = res.plan.solution.length; out.verbs = res.plan.verbs; out.pass = res.plan.pass;
            // replay the plan on a fresh run of the request's staging: hits, deaths, the end, the static deaths
            try {
                const { createRunForStaging } = await M('seedlingDemo/tapeRunner.js');
                const run = createRunForStaging(req.staging, SRC);

                res.plan.solution.forEach((keys) => { run.advance(new Set(keys)); });
                out.hits = run.ledger('playerHits').length; out.deaths = run.ledger('playerDeaths').length;
                out.end = { level: run.level, x: run.state.x, y: run.state.y };
                out.staticDeaths = (run.ledger('staticBodyDeaths') ?? []).map((d) => `${d.id}@${d.killedAt}->${d.removedAt}`);
                out.equips = JSON.stringify(res.plan.equipsAt ?? null).slice(0, 80); out.prefix = res.plan.prefixLength;
            } catch (e) { out.replayErr = String(e.message).slice(0, 300); }
            if (process.env.C1_SAVE) {
                const { writeFileSync } = await import('node:fs');
                writeFileSync(`${process.env.C1_SAVE}-${id}.json`, JSON.stringify({ staging: req.staging, plan: res.plan }));
            }
        }
    } catch (e) { out.outcome = 'threw'; out.err = `${e.name}: ${e.message}`; }
    out.ms = Date.now() - t0;
    console.log(JSON.stringify(out));
}
process.exit(0);
