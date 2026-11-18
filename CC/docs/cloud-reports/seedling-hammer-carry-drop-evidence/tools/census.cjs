// Scratch instrument (seedling-hammer-carry-drop): the census table, one line per carried leg.
// node census.js <sweep-carry.jsonl> <sweep-off.jsonl> <legs-line.jsonl> <legs-carryedge.jsonl>
// Success = end done (or crossed, for an exit: the lab's 200 ms poll names the same crossing either way) with 0 game hits.
const fs = require('fs');
const L = (f) => fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const byKey = (f) => new Map(L(f).map((r) => [r.key, r]));
const sum = (r) => ({ end: r.end === 'crossed' ? 'done' : r.end, ticks: (r.history ?? []).reduce((a, x) => a + (x.ticks || 0), 0),
    hits: r.roomHits?.max ?? null, ok: (r.plans ?? []).filter((p) => p.ok).length, plans: (r.plans ?? []).length,
    why: (r.plans ?? []).filter((p) => !p.ok).map((p) => String(p.message ?? '').replace(/^solverBot(\([^)]*\))?:? ?/, '').slice(0, 70))[0] ?? '' });
const good = (s) => s.end === 'done' && s.hits === 0;
const off = byKey(process.argv[3]); const line = byKey(process.argv[4]); const edge = byKey(process.argv[5]);
const f = (s) => `${s.end} ${s.ticks}t ${s.hits}h ${s.ok}/${s.plans}${s.end !== 'done' && s.why ? ` [${s.why}]` : ''}`;
const tally = {};
console.log('id | sphere | key | carried | CARRY (page) | NO CARRY (page) | verdict | --carry-line-only | --stage-edge-events ON');
for (const r of L(process.argv[2])) {
    const c = sum(r); const o = sum(off.get(r.key));
    let v;
    if (c.end === o.end && c.ticks === o.ticks && c.hits === o.hits) v = good(c) ? 'not needed: identical' : 'not needed: identical stop';
    else if (good(o) && good(c)) v = 'not needed: plan changes';
    else if (good(o)) v = 'not needed: better without';
    else if (good(c)) v = 'NEEDED';
    else v = 'not needed: both stop';
    tally[v] = (tally[v] ?? 0) + 1;
    const ln = line.get(r.key); const ed = edge.get(r.key);
    const lc = (ln.carriedFlags ?? []).map((x) => `${x.level}:${x.tag}`).join(',') || 'drops all';
    const ec = ed.skip ? `skipped (${ed.skip.split(':')[0]})` : ((ed.carriedFlags ?? []).map((x) => `${x.level}:${x.tag}`).join(',') || 'carries none')
        + (ed.edgeEvents?.length ? `, stages ${ed.edgeEvents.join('+')}` : '');
    console.log([r.id, r.sphere, r.key, (r.carriedFlags ?? []).map((x) => `${x.level}:${x.tag}`).join(','), f(c), f(o), v, lc, ec].join(' | '));
}
console.log('TALLY ' + JSON.stringify(tally));
