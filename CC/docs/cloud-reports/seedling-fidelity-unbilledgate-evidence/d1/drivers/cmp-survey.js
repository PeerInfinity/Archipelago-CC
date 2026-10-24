// compare two survey.json by (level, goals, boot kind/block) → verdict changes
const [a, b] = process.argv.slice(2).map((p) => require(p));
const key = (r) => `L${r.level}|${JSON.stringify(r.goals)}|${r.boot?.kind}|${JSON.stringify(r.boot?.block ?? null)}`;
const idx = (rows) => { const n = {}; return new Map(rows.map((r) => { const k = key(r); n[k] = (n[k] ?? 0) + 1; return [`${k}#${n[k]}`, r]; })); };
const A = idx(a.rows); const B = idx(b.rows);
const tally = (s) => s.rows.reduce((m, r) => (m[r.verdict] = (m[r.verdict] ?? 0) + 1, m), {});
console.log('A', JSON.stringify(tally(a)), 'B', JSON.stringify(tally(b)), 'keys A', A.size, 'B', B.size);
for (const [k, r] of A) { const s = B.get(k); if (!s) { console.log('ONLY A', r.step, k.slice(0, 100)); continue; }
  const wc = JSON.stringify(r.withCommittedDeclarations?.verdict ?? null) !== JSON.stringify(s.withCommittedDeclarations?.verdict ?? null);
  if (r.verdict !== s.verdict || wc || r.ticks !== s.ticks) console.log(`step ${r.step}->${s.step} L${r.level}: ${r.verdict}(${r.ticks}) -> ${s.verdict}(${s.ticks})${wc ? ' withCommitted ' + r.withCommittedDeclarations?.verdict + '->' + s.withCommittedDeclarations?.verdict : ''} ${s.verdict === 'REFUSED' ? (s.refusal ?? '').slice(0, 160).replace(/\n/g, ' ') : ''}`); }
for (const [k, r] of B) if (!A.has(k)) console.log('ONLY B', r.step, k.slice(0, 100));
