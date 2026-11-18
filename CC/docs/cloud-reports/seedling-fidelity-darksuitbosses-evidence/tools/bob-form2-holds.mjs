import { stage } from './stage.mjs';
const out = [];
for (const hold of ['up', 'down', 'left', 'right']) for (const from of [1330, 1340, 1360, 1380, 1400]) {
    const r = stage({ tape: 'r5-bobboss-fire', ticks: 1600, on: true, noDamage: false, health: 6, hold, from, sources: ['bobBoss'] });
    const f2 = r.hits.filter((h) => h.id.startsWith('bobboss#2'));
    out.push([hold, from, r.thrown?.slice(0, 80) ?? null, f2.map((h) => `${h.t}:${h.id.split(':')[1]}:${h.retaliation?.swords}`).join(' ')]);
}
console.log(out.map((o) => o.join(' | ')).join('\n'));
