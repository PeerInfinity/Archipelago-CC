const M = process.cwd() + '/frontend/modules/seedlingDemo/';
import { readFileSync } from 'node:fs';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { twoPassSolve } = await import(M + 'twoPassSolve.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const { parseDashMode } = await import(M + 'solverBot.js').catch(() => ({}));
const staging = stagingFromTape(parseTape(readFileSync(process.argv[2], 'utf8')));
const src = atlasLevelSource();
for (const on of [false, true]) {
  const t0 = Date.now();
  try {
    const s = await withContactFidelity({ partialDodgeReprobe: on }, () => twoPassSolve({ makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, src),
      goals: [{ kind: 'reach-exit', exit: { x: 64, y: 224 } }], name: 'd2', boot: staging.boot, persistence: staging.persistence, log: () => {} }));
    console.log(on, 'SOLVED', s.out.perTick.length, Date.now() - t0);
  } catch (e) { console.log(on, 'REFUSED', e.message.slice(0, 260), Date.now() - t0); }
}
