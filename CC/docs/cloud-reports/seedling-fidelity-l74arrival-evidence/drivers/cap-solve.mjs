// re-solve a contact capture's own request (its staging + solverGoal) in node, the bare pass's way
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO;
const M = (p) => import(join(REPO, 'frontend/modules', p));
const { untag } = await import(join(REPO, 'scripts/procgen/replay-seedling-contact-capture.mjs'));
const cap = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const req0 = untag(cap.request);
const { arrivalSolveRequest } = await M('seedlingDemo/wasmArrival.js');
const { createInPlaceProduceService } = await M('seedlingDemo/wasmWalkTape.js');
const { ANYTIME_PASSES } = await M('seedlingDemo/jsRuntimeSolver.js');
const { indexLevels, levelSourceFromAtlas } = await M('seedlingDemo/atlasSource.js');
const MAP = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const RECS = new Map(indexLevels(MAP));
const SRC = levelSourceFromAtlas(RECS);
const goal = process.env.GOAL ? JSON.parse(process.env.GOAL) : req0.solverGoal;
const req = { ...arrivalSolveRequest({ staging: req0.staging, solverGoal: goal, levelSource: SRC, records: RECS, scratchPersistence: true }),
  passes: ANYTIME_PASSES, budgetWork: 2560, upgradeWindowWork: 2560 };
const t0 = Date.now();
const res = createInPlaceProduceService().start(req).result;
const out = { ok: res.ok, ms: Date.now() - t0, passes: res.passes };
if (res.ok) { out.ticks = res.plan.solution.length; out.verbs = res.plan.verbs; out.end = res.plan.expected.at(-1); out.hits = res.plan.forcedHits ?? null; }
else { out.kind = res.kind; out.message = String(res.message).slice(0, 500); }
console.log(JSON.stringify(out));
if (process.env.TAPE_OUT && res.ok) {
  const { buildStagedTape } = await M('seedlingDemo/botDriverV1.js');
  const st = { ...req0.staging, equips: (res.plan.equips ?? []).map((e) => ({ t: e.t, slot: e.slot })) };
  const tape = buildStagedTape({ staging: st, perTick: res.plan.solution.map((k) => new Set(k)), name: process.env.TAPE_NAME ?? 'cap-plan' });
  writeFileSync(process.env.TAPE_OUT, typeof tape === 'string' ? tape : JSON.stringify(tape, null, 1));
}
