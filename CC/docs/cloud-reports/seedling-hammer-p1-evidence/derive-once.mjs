// scratch (hammer-p1): deriveStrike once at staging A's boot, ON and OFF
import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { deriveStrike } = await import(M + 'solverBot.js');
const { withPressKillCost, PRESS_KILL_COST_COUNTS, resetPressKillCostCounts } = await import(M + 'pressKillCost.js');
const staging = solveStaging(stagingFromTape(parseTape(readFileSync(process.argv[2], 'utf8'))));
const run = createRunForStaging(staging, atlasLevelSource());
const one = (on) => { const t = Date.now(); const r = withPressKillCost(on, () => deriveStrike(run, 'spinner@880,848', new Set(), 0, { continuation: process.argv.includes('--cont') })); return { ms: Date.now() - t, r }; };
resetPressKillCostCounts();
const a = one(true); const counts = { ...PRESS_KILL_COST_COUNTS }; const b = one(false);
console.log(JSON.stringify({ equal: JSON.stringify(a.r) === JSON.stringify(b.r), onMs: a.ms, offMs: b.ms, counts, on: JSON.stringify(a.r).slice(0, 300) }));
