// KILL880: two seam-time sweeps of one request (OFF = SPINNER880's sweep19.jsonl, ON = this slice's), joined on the
// arrival offset: verdict, ticks, work, wall per arm, and the tally of moves.
//   node sweep-cmp.mjs <off.jsonl> <on.jsonl> <captured seam>
import { readFileSync } from 'node:fs';
const load = (p) => new Map(readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((r) => [r.seamTime, r]));
const [off, on] = [load(process.argv[2]), load(process.argv[3])];
const c = Number(process.argv[4]);
const v = (r) => (r ? (r.ok ? `SOLVED(${r.passes.filter((p) => p.ok).map((p) => `${p.pass} ${p.ticks}t`).join(',')})`
    : (r.passes.some((p) => p.deadline) ? 'cut' : 'HARD')) : '-');
const tally = {};
console.log('d | OFF verdict work ms answer | ON verdict work ms answer');
for (const t of [...new Set([...off.keys(), ...on.keys()])].sort((a, b) => a - b)) {
    const a = off.get(t); const b = on.get(t);
    const k = `${v(a).split('(')[0]}->${v(b).split('(')[0]}${a && b && a.answer === b.answer ? ' (same answer)' : ''}`;
    tally[k] = (tally[k] ?? 0) + 1;
    console.log(`${t - c} | ${v(a)} ${a?.work} ${a?.ms} ${a?.answer} | ${v(b)} ${b?.work} ${b?.ms} ${b?.answer}`);
}
console.log('TALLY', JSON.stringify(tally));
