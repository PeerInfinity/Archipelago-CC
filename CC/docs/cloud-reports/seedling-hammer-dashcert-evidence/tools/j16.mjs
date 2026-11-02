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
const target = globalThis.__CERT[0].plan;
const ps = globalThis.__DEC.filter((p) => p.plan === target);
const [pv, dr] = ps;
const dm = new Map(dr.log.map((r) => [r.tick, r]));
let first = null;
for (const r of pv.log) {
    const d = dm.get(r.tick); if (!d) continue;
    const same = r.j16 === d.j16 && r.x === d.x && r.y === d.y && r.held === d.held;
    if (!same && first === null) first = r.tick;
    if (r.tick >= +process.env.LO && r.tick <= +process.env.HI) console.log(`t${r.tick} P (${r.x.toFixed(2)},${r.y.toFixed(2)}) ${r.dec} ${r.held} j16=${r.j16} | D (${d.x.toFixed(2)},${d.y.toFixed(2)}) ${d.dec} ${d.held} j16=${d.j16}`);
}
console.log('first tick preview≠drive (player, held or jellyfish@80,16):', first);
