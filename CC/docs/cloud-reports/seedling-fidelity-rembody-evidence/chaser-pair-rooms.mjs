// fidelity REMBODY: which levels can see the switch? A room needs >= 2 stepped chasers (the tick loop's bridged tags,
// at the shipped defaults) and at least one whose own solids carry "Enemy" (a removed sibling can only block such a
// mover). Then every divergence leg (seedling-divergence-legs.mjs, at this base) in such a level is a keyed-sweep leg.
// Usage: node chaser-pair-rooms.mjs <legs.jsonl> [--keys-out=<file>]
import { readFileSync, writeFileSync } from 'node:fs';
import { atlasLevelSource } from '../../../../frontend/modules/seedlingDemo/levelSource.js';
import { buildLevelWorld, ROLES } from '../../../../frontend/modules/seedlingDemo/levelWorld.js';
import { isBridgedChaser, chaserSolids } from '../../../../frontend/modules/seedlingDemo/chasers.js';
const legs = readFileSync(process.argv[2], 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const keysOut = (process.argv.find((a) => a.startsWith('--keys-out=')) ?? '').split('=')[1];
const src = atlasLevelSource();
const levels = [...new Set(legs.map((l) => l.level))].sort((a, b) => a - b);
const rooms = [];
for (const n of levels) {
    let w;
    try { w = buildLevelWorld(src(n), { roles: ROLES }); } catch (e) { console.log(`L${n}\tBUILD-FAILED ${e.message.slice(0, 60)}`); continue; }
    const ch = (w.combat?.enemies ?? []).filter((e) => isBridgedChaser(e.tag));
    const enemyMovers = ch.filter((e) => chaserSolids(e.tag).includes('Enemy'));
    if (ch.length >= 2 && enemyMovers.length >= 1) {
        const tags = {};
        for (const e of ch) tags[e.tag] = (tags[e.tag] ?? 0) + 1;
        rooms.push(n);
        console.log(`L${n}\tchasers ${ch.length}\tEnemy-movers ${enemyMovers.length}\t${JSON.stringify(tags)}`);
    }
}
const keyed = legs.filter((l) => rooms.includes(l.level)).map((l) => l.key);
console.log(`rooms ${rooms.length}: ${rooms.join(',')}\nlegs ${keyed.length} of ${legs.length}`);
if (keysOut) writeFileSync(keysOut, keyed.join('\n') + '\n');
