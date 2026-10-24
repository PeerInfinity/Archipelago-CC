// SCRATCH (seedling-hammer-sc D2): `node --import <this> …` — collects the lab's per-derivation strike-scan records
// (`globalThis.__SC_LAB_SINK`, written only by the lab copy's `deriveStrike` under SC_LAB=census) and writes them, one
// JSON line per derivation, to $SC_LAB_OUT at exit. Measure-only.
import { writeFileSync } from 'node:fs';
const rows = [];
globalThis.__SC_LAB_SINK = (rec) => { rows.push(JSON.stringify(rec)); };
process.on('exit', () => { if (process.env.SC_LAB_OUT) writeFileSync(process.env.SC_LAB_OUT, rows.join('\n') + (rows.length ? '\n' : '')); });
