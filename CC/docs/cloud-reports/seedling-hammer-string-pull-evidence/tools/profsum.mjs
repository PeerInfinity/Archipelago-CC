// Summarise a .cpuprofile: total ms, inclusive share of named functions, top self.
// node profsum.mjs <file.cpuprofile> [fn ...]
import { readFileSync } from 'node:fs';
const p = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const names = process.argv.slice(3);
const byId = new Map(p.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const dt = new Map();
for (let i = 0; i < p.samples.length; i += 1) dt.set(i, p.timeDeltas[i] ?? 0);
const self = new Map(); const incl = new Map(); let total = 0;
p.samples.forEach((id, i) => {
    const d = p.timeDeltas[i + 1] ?? 0; total += d;
    const n = byId.get(id); const fn = n.callFrame.functionName || '(anon)';
    self.set(fn, (self.get(fn) ?? 0) + d);
    const seen = new Set(); let cur = id;
    while (cur !== undefined) { const f = byId.get(cur).callFrame.functionName || '(anon)';
        if (!seen.has(f)) { seen.add(f); incl.set(f, (incl.get(f) ?? 0) + d); } cur = parent.get(cur); }
});
const ms = (us) => Math.round(us / 1000);
const out = { totalMs: ms(total), inclusive: {}, topSelf: [] };
for (const f of names) out.inclusive[f] = { ms: ms(incl.get(f) ?? 0), pct: +(100 * (incl.get(f) ?? 0) / total).toFixed(1) };
out.topSelf = [...self].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([f, v]) => [f, ms(v), +(100 * v / total).toFixed(1)]);
console.log(JSON.stringify(out, null, 1));
