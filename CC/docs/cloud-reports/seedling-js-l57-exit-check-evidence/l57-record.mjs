import { atlasLevelSource } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/levelSource.js';
import { EXIT_TYPES } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/jsRuntimeCore.js';
const src = atlasLevelSource();
for (const L of [57, 69]) {
  const r = src(L);
  console.log('L'+L, 'entities:', r.entities.length);
  for (const e of r.entities) console.log('  ', e.type, e.x, e.y, JSON.stringify(e.attrs ?? {}), 'tile', Math.floor(e.x/16), Math.floor(e.y/16), EXIT_TYPES.includes(e.type) ? 'EXIT_TYPE' : '');
}
