// census-cmp.mjs <off.jsonl> <on.jsonl> — the 50 shield spinner-room legs, OFF vs an arm: the verdict, shipped plan
// (sha, ticks, model hits) each way, every mover by KEY, and the tallies.
import { readFileSync } from 'node:fs';
const rd = (p) => new Map(readFileSync(p, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).map((r) => [r.id, r]));
const [a, b] = [rd(process.argv[2]), rd(process.argv[3])];
const v = (r) => (r.cap ? 'CAP' : r.crash !== undefined ? `CRASH${r.crash}` : r.outcome ?? (r.ok
    ? `${r.shippedOn.ticks}t/${r.shippedOn.modelHits ? r.shippedOn.modelHits.hits + r.shippedOn.modelHits.deaths : '?'}h/${r.sha}${r.budgets.length > 1 ? '@2560' : ''}`
    : `REF${r.budgets?.length > 1 ? '@2560' : ''}:${String(r.message).slice(0, 90)}`));
const T = { off: { s: 0, h: 0, r: 0, c: 0 }, on: { s: 0, h: 0, r: 0, c: 0 } };
let moved = 0;
for (const [id, x] of a) {
    const y = b.get(id);
    for (const [k, r] of [['off', x], ['on', y]]) { if (r.cap) T[k].c++; else if (r.ok) { T[k].s++; if (r.shippedOn.modelHits?.hits || r.shippedOn.modelHits?.deaths) T[k].h++; } else T[k].r++; }
    if (v(x) === v(y)) continue;
    moved++;
    console.log(`${x.key}\n    OFF ${v(x)}\n    ON  ${v(y)}`);
}
console.log(`${a.size} legs, ${moved} moved. OFF: ${T.off.s} solved (${T.off.h} with a hit) / ${T.off.r} refused / ${T.off.c} capped; ON: ${T.on.s} solved (${T.on.h} with a hit) / ${T.on.r} refused / ${T.on.c} capped`);
