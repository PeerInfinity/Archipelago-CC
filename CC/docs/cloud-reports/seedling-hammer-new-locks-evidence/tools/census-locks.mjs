// scratch (NEW-LOCKS W0): every shipped rocklock (tag, tset, the room's counted enemies), and every kill-lock
// (`combat.killLocksIn`: a KILL_LOCK_TAGS entity with tset == -1) with its flag and its bill. Measure only.
import { readFileSync } from 'node:fs';
const ROOT = process.env.ROOT ?? '/home/user/Archipelago-CC';
const { killLocksIn, combatCensus, KILL_LOCK_TAGS } = await import(ROOT + '/frontend/modules/seedlingDemo/combat.js');
const map = JSON.parse(readFileSync(ROOT + '/frontend/modules/flashPanel/atlases/seedling-map.json', 'utf8'));
console.log('== rocklocks ==');
for (const rec of map.levels) for (const e of rec.entities) {
    if (e.type !== 'rocklock') continue;
    const bill = combatCensus(rec).enemies.filter((r) => r.counted).map((r) => `${r.tag}@${r.x},${r.y}`);
    console.log(`L${rec.level} rocklock@${e.x},${e.y} tset=${e.attrs?.tset ?? '(absent=0)'} tag=${e.attrs?.tag ?? '(absent)'} counted=[${bill.join(' ')}] pressers=[${rec.entities.filter((x) => /^button/.test(x.type)).map((x) => `${x.type}@${x.x},${x.y} t=${x.attrs?.tset ?? 0}`).join(' ')}] finalboss=${rec.entities.some((x) => x.type === 'finalboss')}`);
}
console.log(`== kill-locks (tags ${KILL_LOCK_TAGS.join(', ')}; tset -1) ==`);
let n = 0;
for (const rec of map.levels) {
    const locks = killLocksIn(rec);
    if (!locks.length) continue;
    for (const l of locks) {
        n += 1;
        console.log(`L${rec.level} ${l.tag}@${l.x},${l.y} flag=${l.flag} bill=[${l.bill.map((r) => `${r.tag}@${r.x},${r.y}`).join(' ')}]`);
    }
}
console.log(`${n} kill-lock(s)`);
