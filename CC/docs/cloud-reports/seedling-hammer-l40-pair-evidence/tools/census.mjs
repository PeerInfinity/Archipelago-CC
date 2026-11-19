// L40-CORNER census: the seed-1 divergence-sweep legs (by KEY) whose room holds a hammer-bearing body (a `spinner` entity
// in the committed atlas) AND whose AP inventory at the leg carries the shield — the legs `PRESS_ESCAPE_SHIELD_CLAIM` can
// move (its claim is read only on a press kill of a spinner with a shield carried). Pure node, reads the leg list.
//   node census.mjs <legs.jsonl>
import { readFileSync } from 'node:fs';
const atlas = JSON.parse(readFileSync('frontend/modules/flashPanel/atlases/seedling-map.json', 'utf8'));
const spinners = new Map();
for (const l of atlas.levels) {
    const n = (l.entities ?? []).filter((e) => e.type === 'spinner').length;
    if (n) spinners.set(l.level, n);
}
const legs = readFileSync(process.argv[2], 'utf8').trim().split('\n').map((s) => JSON.parse(s));
const inRoom = legs.filter((g) => spinners.has(g.level) && !g.skip);
const shield = inRoom.filter((g) => (g.sphere?.inventory ?? []).includes('Progressive Shield'));
console.log(`spinner levels: ${[...spinners].map(([l, n]) => `L${l}x${n}`).join(' ')}`);
console.log(`legs ${legs.length}; in a spinner room ${inRoom.length}; of those with the shield carried ${shield.length}`);
const by = {};
for (const g of shield) (by[g.level] ??= []).push(g);
for (const [lvl, gs] of Object.entries(by)) {
    console.log(`L${lvl}: ${gs.length}`);
    for (const g of gs) console.log(`  ${g.id}\t${g.key}`);
}
const noShield = inRoom.filter((g) => !shield.includes(g));
console.log(`in a spinner room WITHOUT the shield (the claim is not read): ${noShield.length} — ${[...new Set(noShield.map((g) => `L${g.level}`))].join(' ')}`);
