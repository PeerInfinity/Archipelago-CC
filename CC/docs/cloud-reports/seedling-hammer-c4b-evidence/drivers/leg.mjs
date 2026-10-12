// scratch (C4b): fidelity L74LEG624's drivers/leg.mjs + location goals from the sweep's dump + the plan's verbs/hits.
// node leg.mjs --id=624 [--legs=…] [--rows=…] [--dump=…]; REPO = the tree (or the lab) whose frontend/modules runs.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO || '/home/user/Archipelago-CC';
const W = '/tmp/claude-0/c4b';
const M = (p) => import(join(REPO, 'frontend/modules', p));
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const legs = readFileSync(arg('legs', `${W}/legs.jsonl`), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const leg = legs.find((l) => l.id === Number(arg('id')));
const row = readFileSync(arg('rows', `${W}/sw/off/merged/rows.jsonl`), 'utf8').split('\n').filter(Boolean)
    .map((l) => JSON.parse(l)).find((r) => r.id === leg.id);
const dump = JSON.parse(readFileSync(arg('dump', `${W}/sw/off/merged/delivered-set.json`), 'utf8'));
const { createJsRuntime } = await M('seedlingDemo/jsRuntimeCore.js');
const { arrivalSolverGoal, arrivalSolveRequest } = await M('seedlingDemo/wasmArrival.js');
const { createInPlaceProduceService } = await M('seedlingDemo/wasmWalkTape.js');
const { ANYTIME_PASSES } = await M('seedlingDemo/jsRuntimeSolver.js');
const { indexLevels, levelSourceFromAtlas } = await M('seedlingDemo/atlasSource.js');
const { atlasLocationGoal } = await M('flashPanel/seedlingPlaybackController.js');
const MAP = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const { mountedRecordsOf } = await M('seedlingDemo/wasmWalkTape.js');
// the atlas carries no AP-item entity, so a LOCATION leg (or RECS=delivered) mounts the sweep's delivered set, as the bare pass does
const RECS = (leg.goal.kind !== 'exit' || process.env.RECS === 'delivered') ? mountedRecordsOf(dump.deliveredSet) : new Map(indexLevels(MAP));
const SRC = levelSourceFromAtlas(RECS);
let goal;
if (leg.goal.kind === 'exit') goal = { kind: 'exit', level: leg.level, tiles: leg.goal.tiles, name: leg.goal.name };
else goal = atlasLocationGoal(dump.entries.find((x) => x.location === leg.goal.name), leg.goal.name);
const rt = createJsRuntime();
rt.setVanilla(RECS);
rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [leg.level, leg.arrive.x, leg.arrive.y] }]);
rt.tick();
const staging = { ...rt.session.staging, inventory_slots: row.slots,
    seam: { ...(rt.session.staging.seam ?? {}), items: { ...(rt.session.staging.seam?.items ?? {}), ...row.items } } };
const mapped = arrivalSolverGoal(goal, { staging, levelSource: SRC, record: RECS.get(leg.level) });
const req = { ...arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource: SRC, records: RECS, scratchPersistence: true }),
    passes: ANYTIME_PASSES,
    ...(process.env.BUDGET ? { budgetWork: Number(process.env.BUDGET), upgradeWindowWork: Number(process.env.WINDOW ?? process.env.BUDGET) } : {}) };
const t0 = Date.now();
const res = createInPlaceProduceService().start(req).result;
const out = { id: leg.id, key: leg.key, ok: res.ok, ms: Date.now() - t0 };
if (res.ok) {
    const p = res.plan;
    out.ticks = p.solution.length; out.verbs = p.verbs; out.end = p.expected.at(-1);
    out.hits = Math.max(0, ...p.expected.map((e) => e.hits ?? e.playerHits ?? 0));
    out.forcedHits = p.forcedHits ?? null; out.dashMode = p.dashMode ?? null;
    out.solutionMd5 = (await import('node:crypto')).createHash('md5').update(JSON.stringify(p.solution.map((k) => [...k].sort()))).digest('hex');
} else { out.kind = res.kind; out.message = String(res.message); }
out.passes = (res.passes ?? []).map((x) => ({ pass: x.pass ?? x.name ?? null, ok: x.ok ?? null, ticks: x.ticks ?? null,
    msg: x.message ? String(x.message).slice(0, 600) : null }));
console.log(JSON.stringify(out));
if (process.env.TAPE_OUT && res.ok) {
    const { buildStagedTape } = await M('seedlingDemo/botDriverV1.js');
    const st = { ...staging, equips: (res.plan.equips ?? []).map((e) => ({ t: e.t, slot: e.slot })) };
    const tape = buildStagedTape({ staging: st, perTick: res.plan.solution.map((k) => new Set(k)), name: process.env.TAPE_NAME ?? 'c4b-plan' });
    writeFileSync(process.env.TAPE_OUT, typeof tape === 'string' ? tape : JSON.stringify(tape, null, 1));
    console.error('wrote', process.env.TAPE_OUT);
}
