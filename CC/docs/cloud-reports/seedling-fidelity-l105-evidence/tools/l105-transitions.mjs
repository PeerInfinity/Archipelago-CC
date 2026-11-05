const M = new URL('../../../../../frontend/modules/seedlingDemo/', import.meta.url).pathname; const M0 = '/modules/seedlingDemo/';
import { readFileSync } from 'node:fs';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const tape = parseTape(readFileSync(process.argv[2], 'utf8'));
const run = createRunForStaging(solveStaging(stagingFromTape(tape)), atlasLevelSource());
const per = Array.from({ length: tape.tick_count }, () => new Set());
for (const k of tape.inputs) for (let t = k.from; t < k.to; t += 1) per[t].add(k.key);
for (const h of per) { const r = run.advance(h); if (r.transition) console.log(JSON.stringify(r.transition), run.state.x, run.state.y); }
