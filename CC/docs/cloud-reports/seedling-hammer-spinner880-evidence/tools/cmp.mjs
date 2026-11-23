import { readFileSync } from 'node:fs';
const rows = readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const k = (r) => `${r.id}:${r.i}`;
const off = new Map(rows.filter((r) => r.arm === 'off').map((r) => [k(r), r]));
const on = new Map(rows.filter((r) => r.arm === 'on').map((r) => [k(r), r]));
let same = 0, liveMatch = 0, liveN = 0, offMs = 0, onMs = 0; const moved = [];
const v = (r) => `${r.ok ? 'PLAN' : r.kind}:${r.work}:${r.answer}`;
for (const [key, a] of off) {
  if (a.liveAnswer) { liveN++; if (a.liveAnswer === a.answer) liveMatch++; }
  const b = on.get(key); if (!b) continue;
  offMs += a.ms; onMs += b.ms;
  if (a.answer === b.answer && a.ok === b.ok) same++; else moved.push(`${key} ${a.key} | OFF ${v(a)} ${a.ms}ms | ON ${v(b)} ${b.ms}ms | ON passes ${JSON.stringify(b.passes)}`);
}
console.log(`off=${off.size} on=${on.size} paired-same-answer=${same} moved=${moved.length} OFF-vs-page-answer ${liveMatch}/${liveN} wall OFF ${offMs} ON ${onMs}`);
for (const m of moved) console.log(m);
const slow = [...off.values()].sort((a, b) => b.ms - a.ms).slice(0, 8).map((r) => `${k(r)} ${r.ms}ms ${v(r)} ON ${on.get(k(r)) ? on.get(k(r)).ms + 'ms ' + v(on.get(k(r))) : '-'}`);
console.log('slowest OFF:\n' + slow.join('\n'));
