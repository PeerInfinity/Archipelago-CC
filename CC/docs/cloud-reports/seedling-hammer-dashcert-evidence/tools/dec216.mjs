// DASHCERT W0: every dash-plan strike policy's decisions on step 216 (scratch __DEC patch); prints ticks LO..HI per policy.
import { readFileSync } from 'node:fs';
globalThis.__DEC = [];
const REPO = process.argv[2] + '/';
const M = REPO + 'frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const { solveSegment } = await import(M + 'solverBot.js');
const atlas = JSON.parse(readFileSync(REPO + 'frontend/modules/flashPanel/atlases/seedling-map.json'));
const tape = parseTape(readFileSync(process.argv[3], 'utf8'));
const run = createRunForStaging(solveStaging(stagingFromTape(tape)), levelSourceFromAtlas(atlas));
try { solveSegment({ run, goals: [{ kind: 'reach-exit', exit: { x: 288, y: 96 } }], name: 'l100', boot: solveStaging(stagingFromTape(tape)).boot }); } catch (e) { console.log('REFUSED'); }
const LO = +process.env.LO; const HI = +process.env.HI;
const target = globalThis.__CERT[0].plan;
for (const p of globalThis.__DEC) {
    if (p.plan !== target) continue;
    console.log(`policy ${p.id} (${p.log.length} decides) ${p.stack.replace(/file:\/\/\S+\//g, '').slice(0, 300)}`);
    for (const r of p.log) if (r.tick >= LO && r.tick <= HI) console.log(`   t${r.tick} (${r.x.toFixed(2)},${r.y.toFixed(2)}) n${r.n} [${r.b}] ${r.dec} held=${r.held} ${r.last} ${r.bodies} ${r.slash}`);
}
