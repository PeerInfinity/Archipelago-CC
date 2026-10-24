// scratch (C4b): leg.mjs against the lab, with the __C4B census sink -> $SINK (jsonl)
import { appendFileSync, writeFileSync } from 'node:fs';
const SINK = process.env.SINK;
if (SINK) { writeFileSync(SINK, ''); globalThis.__C4B = (r) => appendFileSync(SINK, JSON.stringify(r) + '\n'); }
await import('./leg.mjs');
