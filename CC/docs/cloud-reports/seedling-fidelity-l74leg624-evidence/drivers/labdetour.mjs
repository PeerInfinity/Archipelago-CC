import { writeFileSync } from 'node:fs';
const caps = [];
globalThis.__LAB = (r) => caps.push(r);
const origLog = console.log; let out = null; console.log = (s) => { out = s; };
await import('./leg.mjs');
console.log = origLog;
const clean = caps.filter((c) => c.at === 'detourClean');
writeFileSync(process.env.DUMP, JSON.stringify(clean.at(-1))); writeFileSync(process.env.DUMP + '.all', JSON.stringify(clean.map((c) => ({ wps: c.wps, n: c.samples.length }))));
origLog('clean previews', clean.length, 'last samples', clean.at(-1)?.samples.length);
