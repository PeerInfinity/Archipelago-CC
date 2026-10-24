// fidelity MISCRES movers: which levels can each switch reach? Every divergence leg (seedling-divergence-legs.mjs, at
// this base) in such a level is a keyed-sweep leg.
//   forecastCorpseFade      >= 2 stepped chasers, one whose solids carry "Enemy" (a corpse can only wall such a mover)
//   nonChaserRemovalBlocks  a drill / wallflyer / ice turret, and a later "Enemy" mover (an Enemy-listing chaser, or a 2nd drill)
//   phaseDodgeArrivalStall  a type-31 (Igneous) tile in the room
// Usage: node miscres-rooms.mjs <legs.jsonl> [--keys-out=<prefix>]
import { readFileSync, writeFileSync } from 'node:fs';
const D = new URL('../../../../../frontend/modules/seedlingDemo/', import.meta.url).pathname;
const { atlasLevelSource } = await import(D + 'levelSource.js');
const { buildLevelWorld, ROLES } = await import(D + 'levelWorld.js');
const { isBridgedChaser, chaserSolids } = await import(D + 'chasers.js');
const legs = readFileSync(process.argv[2], 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const prefix = (process.argv.find((a) => a.startsWith('--keys-out=')) ?? '').split('=')[1];
const src = atlasLevelSource();
const levels = [...new Set(legs.map((l) => l.level))].sort((a, b) => a - b);
const sets = { forecast: [], nonchaser: [], igneous: [] };
for (const n of levels) {
    let w;
    try { w = buildLevelWorld(src(n), { roles: ROLES }); } catch (e) { console.log(`L${n}\tBUILD-FAILED ${e.message.slice(0, 60)}`); continue; }
    const en = w.combat?.enemies ?? [];
    const ch = en.filter((e) => isBridgedChaser(e.tag));
    const enemyMovers = ch.filter((e) => chaserSolids(e.tag).includes('Enemy'));
    if (ch.length >= 2 && enemyMovers.length >= 1) sets.forecast.push(n);
    const nonCh = en.filter((e) => ['drill', 'wallflyer', 'iceturret'].includes(e.tag));
    const drills = en.filter((e) => e.tag === 'drill').length;
    if (nonCh.length > 0 && (enemyMovers.length > 0 || drills >= 2)) sets.nonchaser.push(n);
    if ((w.tiles ?? []).some((t) => t.t === 31)) sets.igneous.push(n);
}
for (const [k, rooms] of Object.entries(sets)) {
    const keyed = legs.filter((l) => rooms.includes(l.level)).map((l) => l.key);
    console.log(`${k}: rooms ${rooms.length} [${rooms.join(',')}] legs ${keyed.length}`);
    if (prefix) { writeFileSync(`${prefix}-${k}.txt`, keyed.join('\n') + '\n'); writeFileSync(`${prefix}-${k}.joined.txt`, keyed.join('|')); }
}
