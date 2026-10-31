import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/';
const M = R + 'frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const B = await import(M + 'botDriverV2.js');
const { DEFAULT_TOLERANCE } = await import(M + 'botDriverV1.js');
const atlas = JSON.parse(readFileSync(R + 'frontend/modules/flashPanel/atlases/seedling-map.json'));
if (process.env.NOJELLY) { const lv = atlas.levels.find((l) => l.level === 100); lv.entities = lv.entities.filter((e) => e.type !== 'jellyfish'); }
const raw = JSON.parse(readFileSync(R + 'CC/docs/cloud-reports/seedling-fidelity-l100-evidence/step-219-boot.json', 'utf8'));
const run = createRunForStaging(solveStaging(stagingFromTape(parseTape(raw))), levelSourceFromAtlas(atlas));
const wps = JSON.parse(process.argv[2]).map(([x, y]) => ({ x, y }));
let t = 0; const perTick = []; let hitAt = null;
for (let i = 0; i < wps.length; i++) {
  const wp = wps[i]; let n = 0;
  while (!B.waypointReached(run.state, wp, DEFAULT_TOLERANCE, i < wps.length - 1) && n < 400) {
    const h = B.driveStepHeld(run, wp, DEFAULT_TOLERANCE); perTick.push([...h]); run.advance(h); t++; n++;
    if (run.playerHits.length && hitAt === null) { hitAt = t; console.log('HIT t' + t, JSON.stringify(run.playerHits[0]).slice(0, 150)); }
    if (hitAt !== null && t >= hitAt + Number(process.env.CONT ?? 0)) break;
  }
  console.log(`wp ${i} (${wp.x},${wp.y}) ${n >= 400 ? 'STALL' : 'reached'} t${t} at (${run.state.x.toFixed(1)},${run.state.y.toFixed(1)})`);
  if (n >= 400 || (hitAt !== null && t >= hitAt + Number(process.env.CONT ?? 0))) break;
}

if (process.env.OUT) (await import('node:fs')).writeFileSync(process.env.OUT, JSON.stringify(perTick));
console.log('ticks', perTick.length);
