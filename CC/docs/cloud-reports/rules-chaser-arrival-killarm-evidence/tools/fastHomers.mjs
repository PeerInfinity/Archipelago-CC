// Which classes meet terms (b) (faster than dMS on some terrain) and are homers; and the levels holding them.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../../..');
const FCG = await import(pathToFileURL(path.join(repo, 'scripts/procgen/seedlingFireChaserGuard.js')));
const { ENEMY_CLASSES } = await import(pathToFileURL(path.join(repo, 'frontend/modules/seedlingDemo/combat.js')));
const P = await import(pathToFileURL(path.join(repo, 'scripts/procgen/make-seedling-playthrough-rules.mjs')));
const { combatCensusOf } = await import(pathToFileURL(path.join(repo, 'frontend/modules/seedlingDemo/levelWorld.js')));
const walk = FCG.PLAYER_GUARD_PROFILE.walkSpeed;
const fast = {};
for (const tag of Object.keys(ENEMY_CLASSES)) {
  const c = FCG.guardClassOf(tag);
  const speeds = [null, 0, 1, 6, 17].map((t) => c.speedOn(t));
  if (c.homing && Math.max(...speeds) > walk) fast[tag] = { speeds: [...new Set(speeds)], runRange: c.runRange, kind: c.aggroKind };
}
console.log('walk', walk, fast);
for (const l of P.PLAYTHROUGH_MAP.levels) {
  const b = combatCensusOf(l).enemies.filter((e) => fast[e.tag]);
  if (b.length) console.log(`L${l.level}: ${b.map((e) => `${e.tag}@${e.x},${e.y}`).join(' ')}`);
}
