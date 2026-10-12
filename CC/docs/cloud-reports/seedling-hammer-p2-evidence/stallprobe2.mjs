import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const staging = solveStaging(stagingFromTape(parseTape(readFileSync(M + 'fixtures/hammer-p1-l40-south-boot.json', 'utf8'))));
const run = createRunForStaging(staging, atlasLevelSource());
const step = run.previewStepper();
let st = { ...run.state }; const up = new Set(['up']);
const R = (k, v) => (typeof v === 'symbol' ? String(v) : v);
for (let i = 0; i < 300; i++) { const n = step(st, up); if (i > 290) { const a = {...st}, b = {...n}; const d = {}; for (const k of Reflect.ownKeys(b)) if (JSON.stringify(a[k]) !== JSON.stringify(b[k]) || a[k] !== b[k] && typeof b[k] === 'object') d[String(k)] = [a[k], b[k]]; console.log(i, JSON.stringify(d).slice(0, 400), Reflect.ownKeys(b).length); } st = n; }
process.exit(0);
