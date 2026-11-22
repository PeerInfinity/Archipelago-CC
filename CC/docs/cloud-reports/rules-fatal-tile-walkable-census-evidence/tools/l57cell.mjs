// Q3 residue: L57 (5,3) is raw WATER, the producer grid gates it on canSwim, but the maze cell's obstacle clears without
// the Swim. Can any L57 arrival reach it WITHOUT the Swim (every other pool item held)?
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../../..');
const imp = (rel) => import(pathToFileURL(path.join(repo, rel)));
const ENG = await imp('frontend/modules/mazeRoom/mazeRoomEngine.js');
const D = await imp('frontend/modules/mazeRoom/tileSpike/deriveLevelWorldLogic.js');
const R = JSON.parse(fs.readFileSync(path.join(repo, 'frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json'), 'utf8'));
const p = R.preset_sidecars['1'].level_57.playable_payload;
const world = ENG.deserializeMazeWorld(p);
const pool = Object.entries(R.itempool_counts['1']).filter(([k]) => k !== 'Progressive Swim').flatMap(([k, n]) => Array(Math.min(n, 2)).fill(k));
const all = Object.entries(R.itempool_counts['1']).flatMap(([k, n]) => Array(Math.min(n, 2)).fill(k));
console.log('entrance', p.entrance, 'obstacle', JSON.stringify(world.obstacleLib.atlas_gate_2.clear_rule), 'locations', JSON.stringify(p.items ?? []).slice(0, 200));
for (const [tag, set] of [['no Swim', pool], ['all', all]]) {
    const r = D.nativeReachUnder(world, set);
    console.log(tag, 'cells reached', r.cells.size, '(5,3) reached:', r.cells.has('5,3'));
}
