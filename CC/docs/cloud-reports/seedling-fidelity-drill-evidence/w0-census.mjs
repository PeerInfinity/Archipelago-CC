import { loadAtlas, atlasLevelSource } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/levelSource.js';
import { combatCensusOf, ENTITY_CLASSES } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/levelWorld.js';
const src = atlasLevelSource();
const atlas = loadAtlas();
const levels = Object.keys(atlas.levels ?? atlas).filter(k=>/^\d+$/.test(k)).map(Number).sort((a,b)=>a-b);
for (const n of levels) {
  let rec; try { rec = src(n); } catch { continue; }
  const ents = rec.entities ?? [];
  if (!ents.some(e => e.type === 'drill')) continue;
  const c = combatCensusOf(rec);
  const en = c.enemies.map(e => `${e.tag}@${e.x},${e.y}`);
  const hz = c.hazards.map(e => `${e.tag}@${e.x},${e.y}`);
  console.log(`L${n}\tenemies=${c.enemies.length} [${en.join(' ')}]\thazards=[${hz.join(' ')}]`);
}
