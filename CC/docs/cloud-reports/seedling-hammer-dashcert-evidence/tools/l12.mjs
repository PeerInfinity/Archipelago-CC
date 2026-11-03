// DASHCERT: L12 survey step 172/200 (fidelity L100LATTICE boots) solved, with timing of spinnerDashWhole (scratch __T patch)
import { readFileSync } from 'node:fs';
const REPO = process.argv[2] + '/';
const M = REPO + 'frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { solveSegment, DEFAULT_DASH_MODE } = await import(M + 'solverBot.js');
const boot = JSON.parse(readFileSync(M + `fixtures/l100lattice-witness/step${process.argv[3]}-boot.json`, 'utf8'));
const tape = parseTape({ ...boot, equips: [] });
const run = createRunForStaging(solveStaging(stagingFromTape(tape)), atlasLevelSource());
const t0 = Date.now();
let r; try { r = solveSegment({ run, goals: [{ kind: 'reach-exit', exit: { x: 32, y: 848 } }], name: 'l12', boot: boot.boot, dashMode: DEFAULT_DASH_MODE }); }
catch (e) { console.log('REFUSED', e.message.slice(0, 300)); }
const T = globalThis.__T ?? {};
console.log(`step ${process.argv[3]} ${r ? 'SOLVED ' + r.perTick.length + ' t, hits ' + run.playerHits.length : ''} ms ${Date.now() - t0} | spinnerDashWhole calls ${T.calls} blind ${Math.round(T.blind)} ms (scanned ${T.blindScanned}) whole ${Math.round(T.whole)} ms fallback ${Math.round(T.fallback)} ms (scanned ${T.fallbackScanned}) wps ${JSON.stringify(T.wps)}`);
for (const row of r?.trace?.rows ?? []) if (row.strategy?.swordDash) console.log('  t' + row.tick, row.strategy.waypoints, 'wps', JSON.stringify(row.strategy.swordDash).slice(0, 200));
