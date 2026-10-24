// SCRATCH (seedling-hammer-re D1): `node --import <this> …` — collects the lab's per-derivation refuge records
// (`globalThis.__RE_LAB_SINK`, written only by the lab copy's `deriveRefuge` under RE_LAB=census) and writes them,
// one JSON line per derivation, to $RE_LAB_OUT at exit. Measure-only.
import { writeFileSync } from 'node:fs';
const rows = [];
globalThis.__RE_LAB_SINK = (rec) => { rows.push(JSON.stringify(rec)); };
process.on('exit', () => { if (process.env.RE_LAB_OUT) writeFileSync(process.env.RE_LAB_OUT, rows.join('\n') + (rows.length ? '\n' : '')); });
