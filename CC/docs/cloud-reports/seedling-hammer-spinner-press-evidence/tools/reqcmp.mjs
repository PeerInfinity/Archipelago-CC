// scratch (SPIN): two arms' request rows (arms.mjs jsonl) side by side by (id, i): verdict, digest, the spinner kills.
// Usage: node reqcmp.mjs <base.jsonl> <arm.jsonl>  -> `same` / `MOVED` per request, then the movers' heads.
import { readFileSync } from 'node:fs';
const load = (p) => new Map(readFileSync(p, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).map((r) => [`${r.id}/${r.i}`, r]));
const [a, b] = process.argv.slice(2).map(load);
let moved = 0; let solvedA = 0; let solvedB = 0;
const tail = (r) => (r.head ?? '').slice(Math.max(0, (r.head ?? '').lastIndexOf(' -> ')), (r.head ?? '').lastIndexOf(' -> ') + 260).replace(/\n/g, ' | ');
for (const k of [...a.keys()].sort((x, y) => parseInt(x, 10) - parseInt(y, 10) || x.localeCompare(y))) {
    const ra = a.get(k); const rb = b.get(k);
    if (ra?.ok) solvedA += 1; if (rb?.ok) solvedB += 1;
    const same = rb && ra.digest === rb.digest && ra.ok === rb.ok;
    if (!same) moved += 1;
    console.log(`${k}\t${ra.ok ? 'SOLVED ' + ra.ticks : 'REFUSED'}\t${rb ? (rb.ok ? 'SOLVED ' + rb.ticks : 'REFUSED') : '-'}\t${ra.digest}\t${rb?.digest}\t${same ? 'same' : 'MOVED'}\t${JSON.stringify(rb?.spin ?? null)}`);
    if (!same) {
        console.log(`   base: ${ra.ok ? `gm=${ra.gm?.gm}` : tail(ra)} kills ${JSON.stringify((ra.kills ?? []).map((x) => x.bodies[0]))}`);
        console.log(`   arm:  ${rb?.ok ? `gm=${rb.gm?.gm} hits=${JSON.stringify(rb.gm?.hits)}` : tail(rb ?? {})} kills ${JSON.stringify((rb?.kills ?? []).map((x) => x.bodies[0]))}`);
    }
}
console.log(`# ${moved} mover(s) of ${a.size}; base ${solvedA} SOLVED, arm ${solvedB} SOLVED`);
