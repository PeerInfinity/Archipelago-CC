import { readFileSync } from 'node:fs';
const D = '../../../../../frontend/modules/seedlingDemo/';
const { CONTACT_FIDELITY } = await import(D + 'contactFidelity.js');
const { FORCED_HIT_TRACE } = await import(D + 'forcedHit.js');
const { createJsRuntime } = await import(D + 'jsRuntimeCore.js');
const { arrivalSolverGoal, arrivalSolveRequest } = await import(D + 'wasmArrival.js');
const { createInPlaceProduceService } = await import(D + 'wasmWalkTape.js');
const { ANYTIME_PASSES } = await import(D + 'jsRuntimeSolver.js');
const { indexLevels, levelSourceFromAtlas } = await import(D + 'atlasSource.js');
const ITEMS_73 = { hitsMax: 3, hasTorch: true, hasDarkSuit: false, hasSpear: true, hasFeather: true, canSwim: true, hasFireWand: false,
    hasWand: true, hasFire: true, hasDarkShield: false, hasShield: true, hasGhostSword: false, hasDarkSword: false, hasSword: true };
const MAP = JSON.parse(readFileSync(D + '../flashPanel/atlases/seedling-map.json', 'utf8'));
const RECS = new Map(indexLevels(MAP)); const SRC = levelSourceFromAtlas(RECS);
function solve622() {
    const rt = createJsRuntime(); rt.setVanilla(RECS);
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [73, 64, 16] }]); rt.tick();
    const s = rt.session.staging;
    const staging = { ...s, inventory_slots: [0, 1, 3, 2], seam: { ...s.seam, items: { ...s.seam.items, ...ITEMS_73 } } };
    const goal = { kind: 'exit', level: 73, tiles: [[4, 0]], name: 'level_73__r0c4 -> level_74' };
    const mapped = arrivalSolverGoal(goal, { staging, levelSource: SRC, record: RECS.get(73) });
    const req = { ...arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource: SRC, records: RECS, scratchPersistence: true }), passes: ANYTIME_PASSES };
    const rows = []; FORCED_HIT_TRACE.sink = (r) => rows.push(r);
    try { return { res: createInPlaceProduceService().start(req).result, rows, staging }; } finally { FORCED_HIT_TRACE.sink = null; }
}
for (const on of [false, true]) {
    CONTACT_FIDELITY.secondaryUse = on;
    const t0 = Date.now();
    const { res, rows, staging } = solve622();
    console.log(`secondaryUse=${on} ok=${res.ok} ${Date.now()-t0}ms slots=${JSON.stringify(staging.inventory_slots)} prim=${staging.seam.primary} sec=${staging.seam.secondary}`);
    if (res.ok) console.log(' verbs', res.plan.verbs, JSON.stringify(res.plan.solution.map(k=>[...k].sort())));
    else console.log(' msg', res.message.slice(-700));
    for (const r of rows) console.log(' row', JSON.stringify({o:r.outcome, at:r.at, proof:r.proof, hitless:r.hitless, cand:r.candidate, why:r.why?.slice(0,300)}));
}
