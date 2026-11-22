// Q3 residue: rows whose sub-region ARRIVAL cell is a pit exit tile. Reach from that cell vs reach from each of its
// 4-neighbour floor cells in the same region, at the row's inventory (nativeReachUnder, the derive's native search).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../../..');
const imp = (rel) => import(pathToFileURL(path.join(repo, rel)));
const ENG = await imp('frontend/modules/mazeRoom/mazeRoomEngine.js');
const D = await imp('frontend/modules/mazeRoom/tileSpike/deriveLevelWorldLogic.js');
const R = JSON.parse(fs.readFileSync(path.join(repo, 'frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json'), 'utf8'));
const sc = R.preset_sidecars['1'];
const cases = [['level_71__r14c12', [['Dark Suit'], ['Dark Suit', 'L71 flag 2: shieldlock@288,256 cleared'], ['Dark Suit', 'Progressive Shield', 'Progressive Shield']]], ['level_84__r2c4', [[]]]];
for (const [reg, sets] of cases) {
    const lvl = reg.split('__')[0];
    const p = Object.entries(sc).find(([k, v]) => k.startsWith(lvl + '__') && v.playable_payload)?.[1].playable_payload;
    const world = ENG.deserializeMazeWorld(p);
    const e = world.sharedWorld.entrances[reg];
    const owner = (x, y) => ENG.sharedWorldOwnerAt(world, x, y);
    const nbrs = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: e.x + dx, y: e.y + dy })).filter((c) => ENG.isFloor(world, c.x, c.y) && owner(c.x, c.y) === reg && !ENG.getExitAt(world, c.x, c.y));
    for (const set of sets) {
        const at = (c) => D.nativeReachUnder({ ...D.enteredAt(world, reg), entrance: c }, set);
        const fromPit = at(e);
        const pitOwners = new Set([...fromPit.cells.keys()].map((k) => owner(...k.split(',').map(Number))));
        for (const n of nbrs) {
            const fromN = at(n);
            const nOwners = new Set([...fromN.cells.keys()].map((k) => owner(...k.split(',').map(Number))));
            const extra = [...pitOwners].filter((o) => !nOwners.has(o));
            console.log(JSON.stringify({ region: reg, set, pit: e, neighbour: n, regionsFromPit: pitOwners.size, regionsFromNeighbour: nOwners.size, regionsOnlyFromPit: extra }));
        }
        if (nbrs.length === 0) console.log(JSON.stringify({ region: reg, set, pit: e, neighbour: null }));
    }
}
