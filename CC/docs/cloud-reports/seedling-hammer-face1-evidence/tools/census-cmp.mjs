// FACE 1: census OFF vs ON by leg KEY: verdict, shipped ticks, model hits, work, and whether the plan sha moved.
//   node census-cmp.mjs <off.jsonl> <on.jsonl>
import { readFileSync } from 'node:fs';
const load = (p) => new Map(readFileSync(p, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).map((r) => [r.id, r]));
const [a, b] = [load(process.argv[2]), load(process.argv[3])];
const v = (r) => (r.cap ? 'CAP' : r.crash !== undefined ? 'CRASH' : r.outcome ? r.outcome : r.ok
    ? `SOLVED ${r.shippedOn?.ticks ?? '?'}t h${r.shippedOn?.modelHits?.hits ?? '?'}` : `REFUSED ${(r.message ?? r.firstAsk?.message ?? '').includes('EXHAUSTED') ? 'EXHAUSTED' : (r.message ?? '').slice(0, 40)}`);
const t = { off: {}, on: {} };
let moved = 0; let gained = 0;
for (const [id, x] of a) {
    const y = b.get(id);
    const [vx, vy] = [v(x), v(y)];
    t.off[vx.split(' ')[0]] = (t.off[vx.split(' ')[0]] ?? 0) + 1;
    t.on[vy.split(' ')[0]] = (t.on[vy.split(' ')[0]] ?? 0) + 1;
    const same = vx === vy && (x.sha ?? null) === (y.sha ?? null);
    if (!same) moved += 1;
    if ((y.shippedOn?.modelHits?.hits ?? 0) > (x.shippedOn?.modelHits?.hits ?? 0)) gained += 1;
    console.log(`${same ? '  ' : '* '}${String(id).padStart(4)} ${x.key}\n       OFF ${vx} work ${x.work ?? '-'} sha ${x.sha ?? '-'} | ON ${vy} work ${y.work ?? '-'} sha ${y.sha ?? '-'}`);
}
console.log(`\nOFF ${JSON.stringify(t.off)} | ON ${JSON.stringify(t.on)} | moved ${moved} | gained a hit ${gained}`);
