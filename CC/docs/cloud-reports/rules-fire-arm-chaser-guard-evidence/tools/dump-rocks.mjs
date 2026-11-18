// Dump every ordinary rock's Fire sides (as the producer's map holds them) and the room's enemy bodies.
import { PLAYTHROUGH_MAP, playthroughRockFireSides, rockFireNarrowings } from '../../../../../scripts/procgen/make-seedling-playthrough-rules.mjs';
import { combatCensusOf } from '../../../../../frontend/modules/seedlingDemo/levelWorld.js';
const sides = playthroughRockFireSides();
const byLevel = new Map(PLAYTHROUGH_MAP.levels.map((l) => [l.level, l]));
for (const [k, r] of sides) {
  if (!(r.stances.length || r.narrowed)) continue;
  const lv = byLevel.get(r.level);
  const bodies = combatCensusOf(lv).enemies.map((e) => `${e.tag}@${e.x},${e.y}`);
  console.log(k, JSON.stringify({ ...r, stances: r.stances.length, stanceSample: r.stances.slice(0, 2) }), '| bodies', bodies.join(' '));
}
console.log('narrowings', JSON.stringify(rockFireNarrowings));
console.log('keys of one entry', Object.keys([...sides.values()][0]));
