import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO || '/home/user/Archipelago-CC';
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
const { withContactFidelity } = await M('contactFidelity.js');
const sb = await M('solverBot.js');
const { parseTape } = await M('tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await M('tapeRunner.js');
const { patchedMapDocument } = await M('seedlingSetPatches.js');
const { levelSourceFromAtlas } = await M('atlasSource.js');
const W = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const MAP = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const staging = solveStaging(stagingFromTape(parseTape(JSON.stringify(W.tape))));
const src = levelSourceFromAtlas(patchedMapDocument(MAP));
const out = withContactFidelity({ corridorBodyPricing: false }, () => sb.solveSegment({
    run: createRunForStaging(staging, src), goals: W.goals, name: 'fc', boot: staging.boot,
    forkRun: () => createRunForStaging(staging, src) }));
console.log(JSON.stringify(out.dashes).slice(0, 1500));
console.log(out.perTick.slice(0, 12).map((h) => [...h].join('+')).join(' | '));
