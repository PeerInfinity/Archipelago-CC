// scratch (STRIKECACHE): compare the census arms request by request: answer, work, kind, progress trace; wall sums
import { readFileSync } from 'node:fs';
const rows = readFileSync(process.argv[2], 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const by = new Map();
for (const r of rows) { const k = `${r.id}:${r.i}`; if (!by.has(k)) by.set(k, {}); by.get(k)[r.arm] = r; }
const pairs = [['off', 'lean'], ['meter', 'leanmeter'], ['off', 'meter']];
for (const [a, b] of pairs) {
  let n = 0; let same = 0; let sameTrace = 0; let msA = 0; let msB = 0; const movers = [];
  for (const [k, x] of by) {
    if (!x[a] || !x[b]) continue; n += 1;
    const s = x[a].answer === x[b].answer && x[a].work === x[b].work && x[a].kind === x[b].kind && JSON.stringify(x[a].passes) === JSON.stringify(x[b].passes);
    if (s) same += 1; else movers.push(`${k} ${x[a].key?.slice(0, 50)}: ${a} ${x[a].kind}/${x[a].work}/${x[a].answer} -> ${b} ${x[b].kind}/${x[b].work}/${x[b].answer}`);
    if (x[a].trace === x[b].trace) sameTrace += 1;
    msA += x[a].ms ?? 0; msB += x[b].ms ?? 0;
  }
  console.log(`${a} vs ${b}: ${n} requests, ${same} identical answers (answer+work+kind+passes), ${sameTrace} identical progress traces; wall ${(msA / 1000).toFixed(0)} s -> ${(msB / 1000).toFixed(0)} s`);
  for (const m of movers) console.log('  MOVER', m);
}
// per leg wall, off vs lean
const legs = new Map();
for (const [k, x] of by) { const id = k.split(':')[0]; const L = legs.get(id) ?? { key: x.off?.key ?? x.lean?.key, n: 0, off: 0, lean: 0, meter: 0, leanmeter: 0 }; L.n += 1; for (const a of ['off', 'lean', 'meter', 'leanmeter']) L[a] += x[a]?.ms ?? 0; legs.set(id, L); }
console.log('\nleg | key | requests | wall s: off lean meter leanmeter');
for (const [id, L] of [...legs].sort((p, q) => q[1].off - p[1].off)) console.log(`${id} | ${L.key} | ${L.n} | ${(L.off / 1000).toFixed(1)} ${(L.lean / 1000).toFixed(1)} ${(L.meter / 1000).toFixed(1)} ${(L.leanmeter / 1000).toFixed(1)}`);
