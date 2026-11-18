// Which atlas rooms hold each of the four boss classes (D1.3). Matches the entity's class name.
import { atlasLevelSource } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
const src = atlasLevelSource();
const want = ['shieldboss', 'finalboss', 'bobboss', 'bosstotem', 'fallrocklarge'];
const out = {};
for (let L = 0; L <= 200; L++) {
  let lv; try { lv = src(L); } catch (e) { continue; }
  if (!lv) continue;
  for (const e of lv.entities ?? []) {
    const cls = e.type;
    if (want.some((w) => String(cls).includes(w))) (out[L] ??= []).push(`${cls}@${e.x},${e.y}`);
  }
}
console.log(JSON.stringify(out));
