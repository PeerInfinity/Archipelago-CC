// scratch: one leg, inv-mode staging (items from a sweep row), solved in node the way the bare pass does
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO || '/home/user/Archipelago-CC';
const M = (p) => import(join(REPO, 'frontend/modules', p));
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const legs = readFileSync(arg('legs', '/tmp/claude-0/w/legs.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const leg = legs.find((l) => l.id === Number(arg('id')));
const row0 = readFileSync(arg('rows', '/tmp/claude-0/w/sw/before-solver.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((r) => r.id === leg.id)
  ?? readFileSync('/tmp/claude-0/w/sw/before-solver.jsonl', 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))[0];
const row = { ...row0, items: { ...row0.items, ...JSON.parse(process.env.ITEMS_PATCH ?? '{}') } };
const { createJsRuntime } = await M('seedlingDemo/jsRuntimeCore.js');
const { arrivalSolverGoal, arrivalSolveRequest } = await M('seedlingDemo/wasmArrival.js');
const { createInPlaceProduceService } = await M('seedlingDemo/wasmWalkTape.js');
const { ANYTIME_PASSES } = await M('seedlingDemo/jsRuntimeSolver.js');
const { indexLevels, levelSourceFromAtlas } = await M('seedlingDemo/atlasSource.js');
const { atlasLocationGoal } = await M('flashPanel/seedlingPlaybackController.js');
const MAP = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const RECS = new Map(indexLevels(MAP));
const SRC = levelSourceFromAtlas(RECS);
let goal;
if (leg.goal.kind === 'exit') goal = { kind: 'exit', level: leg.level, tiles: leg.goal.tiles, name: leg.goal.name };
else {
  goal = JSON.parse(process.env.GOAL);
}
const rt = createJsRuntime();
rt.setVanilla(RECS);
rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [leg.level, leg.arrive.x, leg.arrive.y] }]);
rt.tick();
let staging = { ...rt.session.staging, inventory_slots: row.slots, seam: { ...(rt.session.staging.seam ?? {}), items: { ...(rt.session.staging.seam?.items ?? {}), ...row.items } } };
if (process.argv.includes("--show")) { console.log(JSON.stringify(rt.session.staging)); }
if (process.env.STAGING_PATCH) staging = { ...staging, ...JSON.parse(process.env.STAGING_PATCH) };
const mapped = arrivalSolverGoal(goal, { staging, levelSource: SRC, record: RECS.get(leg.level) });
const req = { ...arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource: SRC, records: RECS, scratchPersistence: true }), passes: ANYTIME_PASSES, ...(process.env.BUDGET ? { budgetWork: Number(process.env.BUDGET), upgradeWindowWork: Number(process.env.WINDOW ?? process.env.BUDGET) } : {}) };
const t0 = Date.now();
const res = createInPlaceProduceService().start(req).result;
const out = { id: leg.id, ok: res.ok, ms: Date.now() - t0 };
out.passes = res.passes ?? res.plan?.passes ?? null; out.keys = Object.keys(res);
if (res.ok) { out.ticks = res.plan.solution.length; out.verbs = res.plan.verbs; out.end = res.plan.expected.at(-1); }
else { out.kind = res.kind; out.message = String(res.message); }
if (process.argv.includes('--staging')) out.staging = staging;
console.log(JSON.stringify(out, null, 1));
if (process.env.TAPE_OUT && res.ok) {
  const { buildStagedTape } = await M('seedlingDemo/botDriverV1.js');
  const { writeFileSync } = await import('node:fs');
  const st = { ...staging, equips: (res.plan.equips ?? []).map((e) => ({ t: e.t, slot: e.slot })) };
  const tape = buildStagedTape({ staging: st, perTick: res.plan.solution.map((k) => new Set(k)), name: process.env.TAPE_NAME ?? 'leash-plan' });
  writeFileSync(process.env.TAPE_OUT, typeof tape === 'string' ? tape : JSON.stringify(tape, null, 1));
  console.error('wrote', process.env.TAPE_OUT, Object.keys(res.plan));
}
