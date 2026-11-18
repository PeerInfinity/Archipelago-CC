import { atlasLevelSource } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { createLevelRun } from '../../../../../frontend/modules/seedlingDemo/levelRun.js';
const src = atlasLevelSource();
const out = {};
for (let L = 0; L <= 140; L++) {
  let run; try { run = createLevelRun({ levelSource: src, boot: { level: L, x: 0, y: 0 }, noclip: true, roles: ['blocking','trigger','pickup','proximity-hazard','combat'] }); } catch (e) { continue; }
  const w = run.world ?? null;
  const en = (w?.combat?.enemies) ?? null;
  if (!en) continue;
  const st = en.filter(e => ['IceTrap','SandTrap','DarkTrap','Turret'].includes(e.as3)).map(e => `${e.tag}@${e.x},${e.y}`);
  if (st.length) out[L] = st;
}
console.log(JSON.stringify(out));
