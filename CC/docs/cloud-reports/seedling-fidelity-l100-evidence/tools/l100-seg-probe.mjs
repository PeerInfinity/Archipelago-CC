import { readFileSync } from 'node:fs';
const M = '../../../../../frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const { solveSegment } = await import(M + 'solverBot.js');
const atlas = JSON.parse(readFileSync(new URL('../../../../../frontend/modules/flashPanel/atlases/seedling-map.json', import.meta.url)));
const tape = parseTape(readFileSync(process.argv[2], 'utf8'));
const staging = solveStaging(stagingFromTape(tape));
const run = createRunForStaging(staging, levelSourceFromAtlas(atlas));
try { const r = solveSegment({ run, goals: [{ kind: 'reach-exit', exit: { x: 288, y: 96 } }], name: 'l100', boot: staging.boot });
  console.log('SOLVED', r.perTick.length, JSON.stringify(r.trace ?? Object.keys(r)).slice(0, 8000));
} catch (e) { console.log('REFUSED', e.message.slice(0, 400)); for (const k of Object.keys(e)) console.log(k, JSON.stringify(e[k]).slice(0, 10000)); }
