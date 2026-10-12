// leg.mjs + a plan dump (scratch)
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync(new URL('./leg.mjs', import.meta.url), 'utf8')
  .replace("console.log(JSON.stringify(out, null, 1));", `
if (res.ok) {
  const p = res.plan;
  out.planKeys = Object.keys(p);
  out.contactFidelity = res.contactFidelity ?? null;
  out.forcedHits = p.forcedHits ?? null; out.damage = p.damage ?? null;
  out.trace = (p.trace ?? []).map((r) => ({ t: r.t ?? r.tick, verb: r.verb, why: String(r.why ?? r.note ?? '').slice(0, 300) }));
  out.exp = p.expected.filter((e, i) => i % 1 === 0).map((e) => ({ t: e.t ?? e.tick, x: e.x, y: e.y, level: e.level, hits: e.hits ?? e.playerHits ?? null })); out.presses = p.solution.map((k, i) => [i, k]).filter(([, k]) => [...k].includes('primary')).map(([i]) => i);
}
if (!res.ok) { out.passMessages = (res.passes ?? []).map((x) => ({ pass: x.pass, msg: String(x.message ?? '').slice(0, 3000) })); }
console.log(JSON.stringify(out, null, 1));`);
writeFileSync(new URL('./leg2.gen.mjs', import.meta.url), src);
await import(new URL('./leg2.gen.mjs', import.meta.url));
