// L80 in the maze (L71 + L79 + L80): the certifier lines, natively; and the two mutant controls' outcomes.
import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/';
const { buildPlaythroughMaze } = await import(R + 'scripts/procgen/make-seedling-playthrough-maze.mjs');
const { certifyPlaythroughMaze } = await import(R + 'frontend/modules/mazeRoom/tileSpike/certifyPlaythroughMaze.js');
const HELPERS = JSON.parse(readFileSync(R + 'frontend/modules/mazeRoom/tileSpike/maze_tiles.helpers.json', 'utf8'));
const ATLAS = JSON.parse(readFileSync(R + 'frontend/modules/flashPanel/atlases/seedling-playthrough.json', 'utf8'));
const lv = process.argv[2] ?? 'level_80';
const levels = (process.argv[3] ?? 'level_71,level_79,level_80').split(',');
const RULES = JSON.parse(buildPlaythroughMaze({ levels }).text);
const regions = Object.keys(RULES.preset_sidecars['1']).filter((n) => n.startsWith(lv));
const native = certifyPlaythroughMaze(RULES, HELPERS, { native: true, atlas: ATLAS, regions });
console.log('NATIVE problems', JSON.stringify(native.problems), 'accepted', JSON.stringify(native.accepted));
for (const l of native.lines) console.log('  ', l);
const payloadOf = (rules, level) => Object.values(rules.preset_sidecars['1']).find((s) => s.playable_payload?.atlas_region === level && s.playable_payload.shared_world)?.playable_payload;
const copy = structuredClone(RULES);
delete payloadOf(copy, lv).pulls;
const stripped = certifyPlaythroughMaze(copy, HELPERS, { native: true, atlas: ATLAS, regions });
console.log('STRIPPED problems', stripped.problems.length); for (const p of stripped.problems) console.log('  ', p);
try {
  const broken = { ...HELPERS, pulled: { ...HELPERS.pulled, body: { type: 'constant', value: false } } };
  const s = certifyPlaythroughMaze(RULES, broken, { native: false, atlas: ATLAS, regions });
  console.log('BROKEN problems', s.problems.length); for (const p of s.problems) console.log('  ', p);
} catch (e) { console.log('BROKEN threw', e.message, e.stack.split('\n').slice(1, 6).join(' | ')); }
