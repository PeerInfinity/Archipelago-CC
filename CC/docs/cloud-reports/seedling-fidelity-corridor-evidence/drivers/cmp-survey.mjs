// cmp two survey.json files by (level, goals, boot, occurrence); print counts + rows that differ
import { readFileSync } from 'node:fs';
const [a, b] = process.argv.slice(2).map((p) => JSON.parse(readFileSync(p, 'utf8')).rows);
const k = (r) => JSON.stringify([r.level, r.goals, r.boot?.kind, r.boot?.source, r.boot?.block]);
const idx = (rows) => { const seen = new Map(); const m = new Map(); for (const r of rows) { const kk = k(r); const n = seen.get(kk) ?? 0; seen.set(kk, n + 1); m.set(kk + '#' + n, r); } return m; };
const A = idx(a); const B = idx(b);
const cnt = (rows) => rows.reduce((o, r) => ((o[r.verdict] = (o[r.verdict] ?? 0) + 1), o), {});
console.log('A', JSON.stringify(cnt(a)), 'B', JSON.stringify(cnt(b)));
let diff = 0;
for (const [kk, ra] of A) {
  const rb = B.get(kk);
  if (!rb) { console.log('MISSING in B', ra.step); diff++; continue; }
  if (ra.verdict !== rb.verdict || ra.ticks !== rb.ticks || (ra.hits ?? null) !== (rb.hits ?? null)) {
    diff++; console.log(`step ${ra.step}/${rb.step} L${ra.level}: ${ra.verdict} ${ra.ticks ?? ''} -> ${rb.verdict} ${rb.ticks ?? ''}  ${rb.verdict !== 'SOLVED' ? String(rb.refusal?.message ?? rb.refusal ?? '').slice(0, 160) : ''}`);
  }
}
console.log('rows differing:', diff, 'of', A.size);
