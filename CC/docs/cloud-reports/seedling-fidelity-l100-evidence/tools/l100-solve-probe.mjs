import { readFileSync } from 'node:fs';
const M = '../../../../../frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const { twoPassSolve } = await import(M + 'twoPassSolve.js');
const atlas = JSON.parse(readFileSync(new URL('../../../../../frontend/modules/flashPanel/atlases/seedling-map.json', import.meta.url)));
if (process.env.NOJELLY) { const lv = atlas.levels.find((l) => l.level === 100); lv.entities = lv.entities.filter((e) => e.type !== 'jellyfish'); console.log('NOJELLY: L100 entities', lv.entities.length); }
const tape = parseTape(readFileSync(process.argv[2], 'utf8'));
const staging = solveStaging(stagingFromTape(tape));
const levelSource = levelSourceFromAtlas(atlas);
const goals = [{ kind: 'reach-exit', exit: { x: 288, y: 96 } }];
try {
  const r = await twoPassSolve({ makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource), goals,
    name: 'l100', boot: staging.boot, dashMode: process.env.DASH ?? undefined, persistence: staging.persistence, log: (s) => console.log('LOG', s) });
  console.log('SOLVED', r.out.perTick.length);
  const trace = r.out.trace ?? r.out.decisionTrace;
  if (trace) console.log(JSON.stringify(trace, null, 0).slice(0, 6000));
  if (process.env.OUT) { const { writeFileSync } = await import('node:fs'); writeFileSync(process.env.OUT, JSON.stringify(r.out.perTick.map((k) => [...k]))); }
} catch (e) { console.log("REFUSED", e.message, Object.keys(e)); for (const k of ["rows","cause"]) if (e[k]) console.log(k, JSON.stringify(e[k], null, 0).slice(0, 12000)); if (e.trace) console.log(JSON.stringify(e.trace).slice(0, 8000)); }
