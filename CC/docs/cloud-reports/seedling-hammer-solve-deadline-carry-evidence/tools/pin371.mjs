// SCRATCH (SDC): the radius capture with leg 371 pinned at a rewind seam. 371 gains i=100 (the W0 page capture, the
// page's own seam 5251) and i=101 (this capture's request moved to 5251 by `atSeamTime`).
import { readFileSync, writeFileSync } from 'node:fs';
const { atSeamTime } = await import('file:///home/user/Archipelago-CC/scripts/procgen/replay-seedling-solve-request.mjs');
const [radius, w0, out] = process.argv.slice(2);
const parse = (f) => readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const W0 = parse(w0).find((d) => d.id === 371).requests[0].request;
const lines = parse(radius).map((d) => (d.id !== 371 ? d : { ...d, requests: [...d.requests,
    { i: 100, request: W0 }, { i: 101, request: atSeamTime(d.requests[0].request, 5251) }] }));
writeFileSync(out, lines.map((d) => JSON.stringify(d)).join('\n') + '\n');
