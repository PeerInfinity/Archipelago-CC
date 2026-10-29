import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/';
const M = R + 'frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const B = await import(M + 'botDriverV2.js');
const atlas = JSON.parse(readFileSync(R + 'frontend/modules/flashPanel/atlases/seedling-map.json'));
const tape = parseTape(readFileSync(R + 'CC/docs/cloud-reports/seedling-fidelity-l100-evidence/step-219-boot.json', 'utf8'));
const staging = solveStaging(stagingFromTape(tape));
const run = createRunForStaging(staging, levelSourceFromAtlas(atlas));
const w = run.world;
const opts = { ...B.livePerVisitOpts(run), inventory: run.inventory };
const pitch = +(process.argv[2] ?? 8);
const wf = new Set(w.waterfallTiles.map(t => `${t.tx},${t.ty}`));
const water = new Set(w.lethalTerrainTiles.filter(t=>t.t===4||t.name==='Water').map(t => `${t.tx},${t.ty}`));
console.log('lethal kinds', [...new Set(w.lethalTerrainTiles.map(t=>t.t+':'+t.name))]);
for (let ty = 0; ty < w.height*16/pitch; ty++) {
  let row = String(ty*pitch+pitch/2).padStart(4)+' ';
  for (let tx = 0; tx < Math.min(w.width*16/pitch, 24*16/pitch); tx++) {
    const c = B.nodeCentre(tx, ty, pitch);
    const o = B.plannerObstacleAt(w, c.x, c.y, null, opts);
    const k = `${Math.floor(c.x/16)},${Math.floor(c.y/16)}`;
    row += o ? (o.kind?.[0]?.toUpperCase() ?? '#') : wf.has(k) ? 'w' : water.has(k) ? '~' : '.';
  }
  console.log(row);
}
for (const tgt of [{x:124,y:140},{x:122,y:47}]) {
 try { console.log(JSON.stringify(tgt), JSON.stringify(B.planWaypoints(w, run.state, tgt, null, {...opts, lattice: pitch}))); } catch(e) { console.log('ERR', e.message.slice(0,300)); }
}
