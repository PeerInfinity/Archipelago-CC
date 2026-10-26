// scratch: OFF vs ON replay rows per (id, i): answer sha, kind, ticks of the last pass
import { readFileSync } from 'node:fs';
const load = (p) => new Map(readFileSync(p, 'utf8').trim().split('\n').map(JSON.parse).map((r) => [`${r.id}/${r.i}`, r]));
const [a, b] = process.argv.slice(2).map(load);
const brief = (r) => { const p = r.passes?.at(-1) ?? {}; return `${r.kind}${p.ticks != null ? ' t' + p.ticks : ''}`; };
let same = 0;
for (const [k, ra] of a) {
    const rb = b.get(k);
    if (!rb) { console.log(k, 'MISSING ON'); continue; }
    if (ra.answer === rb.answer) { same += 1; continue; }
    console.log(`MOVER ${k} ${ra.key}\n   OFF ${brief(ra)} ${ra.answer.slice(0, 10)}\n   ON  ${brief(rb)} ${rb.answer.slice(0, 10)}`);
}
console.log(`same ${same} / ${a.size}`);
