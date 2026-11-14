// node solve-walk.mjs <boot fixture> <on|off> <out walk tape> — solveSegment from the fixture's boot (the survey's own
// staging), the plan's perTick written as the boot tape's inputs (v8), then replayed on the model for its hits.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = '/home/user/Archipelago-CC';
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
const { withContactFidelity } = await M('contactFidelity.js');
const { solveSegment } = await M('solverBot.js');
const { parseTape, heldKeysAt } = await M('tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await M('tapeRunner.js');
const { patchedMapDocument } = await M('seedlingSetPatches.js');
const { levelSourceFromAtlas } = await M('atlasSource.js');
const [file, arm, out] = process.argv.slice(2);
const W = JSON.parse(readFileSync(file, 'utf8'));
const MAP = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const staging = solveStaging(stagingFromTape(parseTape(JSON.stringify(W.tape))));
const src = levelSourceFromAtlas(patchedMapDocument(MAP));
const res = withContactFidelity({ corridorBodyPricing: arm === 'on', unbilledDamageGate: false }, () => solveSegment({
    run: createRunForStaging(staging, src), goals: W.goals, name: 'wit', boot: staging.boot,
    forkRun: () => createRunForStaging(staging, src) }));
const perTick = res.perTick;
const open = new Map(); const inputs = [];
perTick.forEach((held, t) => {
    for (const k of held) if (!open.has(k)) open.set(k, t);
    for (const [k, from] of [...open]) if (!held.has(k)) { inputs.push({ key: k, from, to: t }); open.delete(k); }
});
for (const [k, from] of open) inputs.push({ key: k, from, to: perTick.length });
const tape = { ...W.tape, name: `${W.tape.name.replace(/-boot$/, '')}-${arm}`, tick_count: perTick.length, inputs };
writeFileSync(out, JSON.stringify(tape, null, 1));
const t2 = parseTape(JSON.stringify(tape));
const run = withContactFidelity({ corridorBodyPricing: arm === 'on' }, () => {
    const r = createRunForStaging(solveStaging(stagingFromTape(t2)), src);
    for (let t = 0; t < t2.tick_count; t += 1) r.advance(heldKeysAt(t2, t));
    return r;
});
console.log(JSON.stringify({ arm, ticks: perTick.length, same: perTick.every((h, t) => [...h].sort().join() === [...heldKeysAt(t2, t)].sort().join()),
    hits: run.ledger('playerHits').map((h) => `t${h.t} ${h.id}${h.died ? ' D' : ''}`), level: run.level, x: run.state.x, y: run.state.y }));
