import fs from 'node:fs';
const [a, b] = process.argv.slice(2).map((f) => fs.readFileSync(f, 'utf8').trim().split('\n').map(JSON.parse));
const key = (r) => `${r.id}/${r.i}`;
const B = new Map(b.map((r) => [key(r), r]));
let same = 0; const movers = [];
for (const r of a) {
    const s = B.get(key(r));
    if (s && s.answer === r.answer) { same += 1; continue; }
    movers.push(`MOVER ${key(r)} ${r.key}\n   OFF ${r.ok ? 'SOLVE' : r.kind} ${r.answer} ${(r.message ?? '').slice(0, 260)}\n   ON  ${s?.ok ? 'SOLVE' : s?.kind} ${s?.answer} ${(s?.message ?? '').slice(0, 260)}`);
}
console.log(`${same} identical of ${a.length}; ${movers.length} mover(s)`);
console.log(movers.join('\n'));
