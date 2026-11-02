// DASHCERT W0: the drive's swing tests (run.ledger chaserPressHits) on step 216, ticks LO..HI.
import { readFileSync } from 'node:fs';
const REPO = process.argv[2] + '/';
const M = REPO + 'frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const { solveSegment } = await import(M + 'solverBot.js');
const atlas = JSON.parse(readFileSync(REPO + 'frontend/modules/flashPanel/atlases/seedling-map.json'));
const tape = parseTape(readFileSync(process.argv[3], 'utf8'));
const mk = () => createRunForStaging(solveStaging(stagingFromTape(tape)), levelSourceFromAtlas(atlas));
const run = mk();
let r; try { r = solveSegment({ run, goals: [{ kind: 'reach-exit', exit: { x: 288, y: 96 } }], name: 'l100', boot: solveStaging(stagingFromTape(tape)).boot }); } catch (e) { console.log('REFUSED'); process.exit(0); }
const LO = +process.env.LO; const HI = +process.env.HI;
let names = []; try { names = Object.keys(run.ledgers?.() ?? {}); } catch {}
const rows = (() => { for (const n of ['chaserPressHits', 'pressHits']) { try { const v = run.ledger(n); if (v) return v; } catch {} } return run.chaserPressHits ?? []; })();
for (const h of rows) if (h.t >= LO && h.t <= HI) console.log(JSON.stringify(h));
