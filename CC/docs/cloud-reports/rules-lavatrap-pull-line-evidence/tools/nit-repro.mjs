import { readFileSync } from 'node:fs';
import { deserializeMazeWorld } from '../../../../../frontend/modules/mazeRoom/mazeRoomEngine.js';
import { deriveLevelWorldLogic } from '../../../../../frontend/modules/mazeRoom/tileSpike/deriveLevelWorldLogic.js';
import HELPERS from '../../../../../frontend/modules/mazeRoom/tileSpike/maze_tiles.helpers.json' with { type: 'json' };
const r = JSON.parse(readFileSync('./k-sketch-maze.json (git show origin/claude/rules-k-pursuit-speed-0s83t8:CC/docs/cloud-reports/rules-k-pursuit-speed-evidence/runs/tip-sketch-outputs/frontend_presets_seedling_playthrough_maze_AP_1_AP_1_rules.json.gz | gunzip)', 'utf8'));
const name = Object.keys(r.preset_sidecars['1']).find((n) => r.preset_sidecars['1'][n].playable_payload?.shared_world?.key === 'level_78');
const p = r.preset_sidecars['1'][name].playable_payload;
console.log(name, JSON.stringify(p).length, p.shared_world.regions, JSON.stringify(p.pulls.map(q=>[q.x,q.y,q.from.length])));
for (const cut of [false, true]) {
  const q = structuredClone(p);
  if (cut) q.pulls[2].from = q.pulls[2].from.filter((c) => !(c.x === 11 && c.y === 6) && !(c.x === 9 && c.y === 8));
  const t0 = Date.now();
  const out = deriveLevelWorldLogic(deserializeMazeWorld(q), HELPERS, { native: true });
  const row = out.pairs.filter((x) => x.to === 'level_78__r6c11').map((x) => `${x.from}>${x.to} unreach=${x.unreachable} min=${JSON.stringify(x.minimal)}`);
  console.log(cut ? 'CUT' : 'UNCUT', Date.now() - t0, 'ms', out.items, row);
}
