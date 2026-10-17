import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { twoPassSolve } = await import(M + 'twoPassSolve.js');
const W = JSON.parse(readFileSync(M + 'fixtures/chaser-witness/axetiming-l61-152-plan.json', 'utf8'));
const staging = stagingFromTape(parseTape(JSON.stringify(W.tape)));
const SRC = atlasLevelSource();
try {
  const s = await twoPassSolve({ makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, SRC), goals: [{ kind: 'reach-exit', exit: { x: 0, y: 160 } }], name: 'x', boot: staging.boot, persistence: staging.persistence, log: () => {} });
  console.log('SOLVED', s.out.perTick.length);
  console.log(Object.keys(s.out)); const rows = s.out.trace?.rows ?? s.out.trace ?? s.out.rows; console.log(JSON.stringify(rows, null, 0).slice(0, 3000));
  console.log(Object.keys(s.out));
} catch (e) { console.log('REFUSED', e.message.slice(0, 600)); }
