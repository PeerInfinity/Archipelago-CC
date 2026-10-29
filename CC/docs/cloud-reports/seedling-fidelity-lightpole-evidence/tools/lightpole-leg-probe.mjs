// Scratch: one leg through the JS-runtime request path (the bare pass's oneLeg), with a bag staged into the seam.
// node leg.mjs <legs.jsonl> <dump.json> <id> [items=hasSword,hasSpear,...] [slots=0,3]
import { readFileSync } from 'node:fs';
const REPO = '/home/user/Archipelago-CC';
const M = (p) => import(`${REPO}/frontend/modules/${p}`);
const [legsPath, dumpPath, idArg, itemsArg = 'hasSword,hasShield,hasFire,canSwim,hasSpear', slotsArg = '0,1,3'] = process.argv.slice(2);
const leg = readFileSync(legsPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((r) => r.id === Number(idArg));
const { createJsRuntime } = await M('seedlingDemo/jsRuntimeCore.js');
const { arrivalSolverGoal, arrivalSolveRequest } = await M('seedlingDemo/wasmArrival.js');
const { createInPlaceProduceService, mountedRecordsOf } = await M('seedlingDemo/wasmWalkTape.js');
const { ANYTIME_PASSES } = await M('seedlingDemo/jsRuntimeSolver.js');
const { atlasEventGoal, atlasLocationGoal } = await M('flashPanel/seedlingPlaybackController.js');
const { indexLevels, levelSourceFromAtlas } = await M('seedlingDemo/atlasSource.js');
const { withStagedFlags } = await import(`${REPO}/scripts/procgen/seedling-divergence-bare.mjs`);
const MAP = JSON.parse(readFileSync(`${REPO}/frontend/modules/flashPanel/atlases/seedling-map.json`, 'utf8'));
const dump = JSON.parse(readFileSync(dumpPath, 'utf8'));
const RECS = dump.deliveredSet ? mountedRecordsOf(dump.deliveredSet) : new Map(indexLevels(MAP));
const SRC = levelSourceFromAtlas(RECS);
let goal;
if (leg.goal.kind === 'exit') goal = { kind: 'exit', level: leg.level, tiles: leg.goal.tiles, name: leg.goal.name };
else {
    const ev = (dump.events ?? []).find((x) => x.location === leg.goal.name);
    const e = dump.entries.find((x) => x.location === leg.goal.name);
    goal = ev ? atlasEventGoal(ev, ev.sideLevel, leg.goal.name) : atlasLocationGoal(e, leg.goal.name);
}
const rt = createJsRuntime();
rt.setVanilla(RECS);
rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [leg.level, leg.arrive.x, leg.arrive.y] }]);
rt.tick();
let staging = rt.session.staging;
if (leg.stagedEvents?.length) staging = withStagedFlags(staging, leg.stagedEvents);
const items = { ...staging.seam.items };
for (const k of itemsArg.split(',').filter(Boolean)) items[k] = true;
staging = { ...staging, seam: { ...staging.seam, items }, inventory_slots: slotsArg.split(',').filter(Boolean).map(Number) };
const mapped = arrivalSolverGoal(goal, { staging, levelSource: SRC, record: RECS.get(leg.level) });
if (!mapped.goal) { console.log(JSON.stringify({ id: leg.id, outcome: 'no-solver-goal', err: mapped.walker })); process.exit(0); }
const req = { ...arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource: SRC, records: RECS, scratchPersistence: true }), passes: ANYTIME_PASSES };
const t0 = Date.now();
const res = createInPlaceProduceService().start(req).result;
const out = { id: leg.id, key: leg.key, ms: Date.now() - t0 };
if (!res.ok) Object.assign(out, { outcome: 'refused', kind: res.kind, err: String(res.message).slice(0, 1200) });
else Object.assign(out, { outcome: 'solved', ticks: res.plan.solution.length, verbs: res.plan.verbs, end: res.plan.expected.at(-1),
    records: (res.plan.records ?? res.plan.solverRecords ?? []).filter((r) => r.goal === 'clear-tag' || r.verb === 'pole').slice(0, 4) });
if (res.ok && process.env.DUMP_PLAN) console.log(JSON.stringify(Object.keys(res.plan)), JSON.stringify({e: res.plan.equipsAt, i: res.plan.equipItems, p: res.plan.solution.map((k,i)=>[i,[...k].join("+")]).filter(([i,k])=>k.includes("primary"))}));
console.log(JSON.stringify(out));
