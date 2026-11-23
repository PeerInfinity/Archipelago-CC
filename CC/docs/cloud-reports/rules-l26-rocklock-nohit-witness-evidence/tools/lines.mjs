// Build a hand-authored L26 plan from a spec: node lines.mjs <base plan.json> <spec.json> <out plan.json> [itemsJSON]
// spec = [{copy:[from,to]} (ticks of the base plan, to exclusive) | {hold:"down+left", n} | {idle:n} |
//         {fire:{every:16, count:25, keys:"primary", with:""}} (one press tick + every-1 idle ticks, `with` held throughout)]
// The staging is the base plan's; itemsJSON overrides its seam items (the slots are re-derived at play time).
import { readFileSync, writeFileSync } from 'node:fs';
const [baseF, specF, outF, itemsJson] = process.argv.slice(2);
const base = JSON.parse(readFileSync(baseF, 'utf8'));
const spec = JSON.parse(readFileSync(specF, 'utf8'));
const K = (s) => (s ? s.split('+') : []);
const plan = [];
for (const seg of spec) {
    if (seg.copy) plan.push(...base.plan.slice(seg.copy[0], seg.copy[1]));
    else if (seg.hold !== undefined) for (let i = 0; i < seg.n; i++) plan.push(K(seg.hold));
    else if (seg.idle) for (let i = 0; i < seg.idle; i++) plan.push([]);
    else if (seg.fire) { const f = seg.fire; for (let c = 0; c < f.count; c++) { plan.push([...K(f.with), ...K(f.keys ?? 'primary')]); for (let i = 1; i < f.every; i++) plan.push(K(f.with)); } }
}
const items = { ...base.staging.seam.items, ...(itemsJson ? JSON.parse(itemsJson) : {}) };
writeFileSync(outF, JSON.stringify({ spec, staging: { ...base.staging, seam: { ...base.staging.seam, items } }, perTick: base.perTick ?? [], plan }));
console.log(`${outF}: ${plan.length} ticks`);
