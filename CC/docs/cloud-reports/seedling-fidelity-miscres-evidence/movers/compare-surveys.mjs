import { readFileSync } from 'node:fs';
const [fa, fb] = process.argv.slice(2);
const A = JSON.parse(readFileSync(fa, 'utf8')), B = JSON.parse(readFileSync(fb, 'utf8'));
const rows = (x) => (Array.isArray(x) ? x : x.steps ?? x.rows);
const key = (r) => JSON.stringify([r.level, r.goals, r.boot?.block ?? r.boot]);
const pick = (r) => ({ verdict: r.verdict, ticks: r.ticks ?? r.solution?.ticks ?? null, hits: r.hits ?? null, refusal: (r.refusal ?? '').toString().replace(/survey-step-\d+/g, 'survey-step-N') });
const occ = (rs) => { const seen = new Map(); return rs.map((r) => { const k = key(r); const n = seen.get(k) ?? 0; seen.set(k, n + 1); return [`${k}#${n}`, r]; }); };
const bm = new Map(occ(rows(B)));
const count = (rs) => rs.reduce((m, r) => (m[r.verdict] = (m[r.verdict] ?? 0) + 1, m), {});
console.log('A', rows(A).length, JSON.stringify(count(rows(A))), 'B', rows(B).length, JSON.stringify(count(rows(B))));
let movers = 0;
for (const [ka, a] of occ(rows(A))) {
  const b = bm.get(ka);
  if (!b) { console.log('MISSING in B: step', a.step, a.level); movers++; continue; }
  const pa = pick(a), pb = pick(b);
  if (JSON.stringify(pa) !== JSON.stringify(pb)) { movers++; console.log(`step ${a.step} L${a.level}: ${pa.verdict} ${pa.ticks} -> ${pb.verdict} ${pb.ticks}${pa.refusal !== pb.refusal ? `\n   A: ${pa.refusal.slice(0, 220)}\n   B: ${pb.refusal.slice(0, 220)}` : ''}`); }
}
console.log('movers', movers);
