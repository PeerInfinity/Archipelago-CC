// print the t0 walk rows' swordDash + rejected; arg1 = repo root, arg2 = boot
import { readFileSync } from 'node:fs';
const REPO = process.argv[2] + '/';
const M = REPO + 'frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const { solveSegment } = await import(M + 'solverBot.js');
const atlas = JSON.parse(readFileSync(REPO + 'frontend/modules/flashPanel/atlases/seedling-map.json'));
const tape = parseTape(readFileSync(process.argv[3], 'utf8'));
const staging = solveStaging(stagingFromTape(tape));
const run = createRunForStaging(staging, levelSourceFromAtlas(atlas));
let rows; let res;
try { res = solveSegment({ run, goals: [{ kind: 'reach-exit', exit: { x: 288, y: 96 } }], name: 'l100', boot: staging.boot }); rows = res.trace.rows; }
catch (e) { rows = e.rows ?? []; console.log('REFUSED', e.message.slice(0, 200)); }
for (const r of rows) if (r.strategy?.verb === 'walk') console.log('t' + r.tick, JSON.stringify(r.strategy.swordDash), JSON.stringify(r.rejected));
if (res) { console.log('ticks', res.perTick.length); }
globalThis.__done?.(run, res);
