// node room.mjs <boot fixture.json> : the room's flyers/drills, an ASCII solid map (8px cells), the boot.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = '/home/user/Archipelago-CC';
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
const { parseTape } = await M('tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await M('tapeRunner.js');
const { patchedMapDocument } = await M('seedlingSetPatches.js');
const { levelSourceFromAtlas } = await M('atlasSource.js');
const W = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const MAP = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const staging = solveStaging(stagingFromTape(parseTape(JSON.stringify(W.tape ?? W.walk))));
const run = createRunForStaging(staging, levelSourceFromAtlas(patchedMapDocument(MAP)));
console.log('level', run.level, 'player', run.state.x, run.state.y, 'goals', JSON.stringify(W.goals ?? null));
console.log('flyers', JSON.stringify(run.wallFlyers.bodies.map((w) => ({ id: w.id, x: w.x, y: w.y, vx: w.vx, vy: w.vy }))));
console.log('drills', JSON.stringify(run.drills.bodies.map((d) => ({ id: d.id, x: d.x, y: d.y, anim: d.anim }))));
console.log('chasers', JSON.stringify((run.entities('chasers') ?? []).map((c) => c.id)), 'strike', JSON.stringify([...(run.entities('strikeBodies') ?? [])].map((c) => c.id ?? c)));
console.log('weapon', run.progress('primaryWeapon'), 'slots', JSON.stringify(run.progress('inventorySlots')));
const opts = run.liveGeometryOpts();
const Wd = (run.world.width > 100 ? run.world.width : run.world.width * 16), H = (run.world.height > 100 ? run.world.height : run.world.height * 16); console.log("dims", run.world.width, run.world.height);
for (let y = 0; y < H; y += 8) {
  let line = '';
  for (let x = 0; x < Wd; x += 8) {
    const fl = run.wallFlyers.bodies.find((w) => Math.abs(w.x - x - 4) <= 4 && Math.abs(w.y - y - 4) <= 4);
    const dr = run.drills.bodies.find((w) => Math.abs(w.x - x - 4) <= 4 && Math.abs(w.y - y - 4) <= 4);
    const pl = Math.abs(run.state.x - x - 4) <= 4 && Math.abs(run.state.y - y - 4) <= 4;
    line += pl ? 'P' : fl ? 'F' : dr ? 'D' : run.world.collidesSolid({ x: x + 1, y: y + 1, right: x + 7, bottom: y + 7 }, opts) ? '#' : '.';
  }
  console.log(String(y).padStart(3), line);
}
