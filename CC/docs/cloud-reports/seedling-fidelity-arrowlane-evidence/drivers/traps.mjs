import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = '/home/user/Archipelago-CC';
const { indexLevels } = await import(join(REPO, 'frontend/modules/seedlingDemo/atlasSource.js'));
const MAP = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const out = {};
for (const [lv, rec] of indexLevels(MAP)) {
  const traps = rec.entities.filter((e) => e.type === 'arrowtrap');
  if (!traps.length) continue;
  out[lv] = traps.map((t) => `${t.x},${t.y} t${t.attrs?.tset} s${t.attrs?.shoot ?? 0}`);
}
console.log(JSON.stringify(out));
