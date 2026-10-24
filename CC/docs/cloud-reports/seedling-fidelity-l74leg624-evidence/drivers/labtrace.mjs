import { writeFileSync } from 'node:fs';
const caps = [];
globalThis.__LAB = (r) => caps.push(r);
const origLog = console.log; let out = null; console.log = (s) => { out = s; };
await import('./leg.mjs');
console.log = origLog;
const last = caps.at(-1);
const rows = (last?.rows ?? []).map((r) => ({ tick: r.tick, verb: r.strategy?.verb ?? null, goal: r.goal?.kind ?? null,
  why: JSON.stringify(r.strategy ?? {}).slice(0, 400), rejected: (r.rejected ?? []).length }));
writeFileSync(process.env.TRACE_OUT, JSON.stringify({ caps: caps.length, rows, raw: last?.rows ?? [] }, null, 1));
origLog(out?.slice(0, 300)); origLog('trace rows', rows.length, 'caps', caps.length);
