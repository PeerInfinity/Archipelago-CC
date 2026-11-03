// L100LATTICE: solve a survey reach-exit step from its boot (env picks the arm) and compare its keys to a walk tape.
// Usage: node keyseq.mjs <boot.json> <exit x> <exit y> <walk-tape.json>
import { readFileSync } from 'node:fs';
const REPO = new URL('../../../../../', import.meta.url).pathname;
const M = REPO + 'frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { solveSegment } = await import(M + 'solverBot.js');
const { DEFAULT_DASH_MODE } = await import(REPO + 'scripts/procgen/dashMode.js');
const boot = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const tape = JSON.parse(readFileSync(process.argv[5], 'utf8'));
const run = createRunForStaging(solveStaging(stagingFromTape(parseTape({ ...boot, inputs: [], tick_count: 0, equips: [] }))), atlasLevelSource());
const r = solveSegment({ run, goals: [{ kind: 'reach-exit', exit: { x: +process.argv[3], y: +process.argv[4] } }], name: 's', boot: boot.boot, dashMode: DEFAULT_DASH_MODE });
const got = r.perTick.map((k) => [...k].sort().join('+'));
const want = Array.from({ length: tape.tick_count }, (_, t) => tape.inputs.filter((i) => i.from <= t && t < i.to).map((i) => i.key).sort().join('+'));
const firstDiff = got.findIndex((k, i) => k !== want[i]);
console.log(`ticks ${got.length} vs tape ${want.length}; ${JSON.stringify(got) === JSON.stringify(want) ? 'IDENTICAL keys' : `first diff at t${firstDiff}`}`);
