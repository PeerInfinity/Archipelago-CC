import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const B = await import(M + 'botDriverV2.js');
const w = JSON.parse(readFileSync(M + 'fixtures/waterfall-witness/l100-exit.json', 'utf8'));
const run = createRunForStaging(solveStaging(stagingFromTape(parseTape({ ...w.tape, inputs: [], tick_count: 0 }))), atlasLevelSource());
const opts = { ...B.livePerVisitOpts(run), inventory: run.inventory, lattice: 8 };
for (const on of [false, true]) withContactFidelity({ waterfallPushPricing: on }, () => {
  for (const from of [{ x: 108, y: 44 }, { x: 108, y: 60 }]) {
    console.log(on, JSON.stringify(from), JSON.stringify(B.planTilePath(run.world, from, { x: 124, y: 140 }, null, opts).slice(0, 8)), JSON.stringify(B.planWaypoints(run.world, from, { x: 124, y: 140 }, null, opts)));
  }
});
