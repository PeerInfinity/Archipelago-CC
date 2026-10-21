// SCRATCH (seedling-hammer-digest-audit D1): the ON workload where `lightsFights` lives — fidelityLights.slow's two
// twoPassSolve solves under lightsBossFight ON, run under XC (verify mode from the env); prints whether each solve's
// tape equals the witnessed one, and the cache's counts (the count hook appends them at exit).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const R = process.env.REPO; const M = join(R, 'frontend/modules/seedlingDemo');
const { parseTape } = await import(join(M, 'tapeFormat.js'));
const { atlasLevelSource } = await import(join(M, 'levelSource.js'));
const { withContactFidelity } = await import(join(M, 'contactFidelity.js'));
const { createRunForStaging, solveStaging, stagingFromTape } = await import(join(M, 'tapeRunner.js'));
const { twoPassSolve } = await import(join(M, 'twoPassSolve.js'));
const { buildStagedTape } = await import(join(M, 'botDriverV1.js'));
const { ESCAPE_CROSS_PASS_CACHE_COUNTS: C } = await import(join(M, 'solverBot.js'));
const witness = (n) => JSON.parse(readFileSync(join(M, 'fixtures', 'lights-witness', `${n}.json`), 'utf8'));
const levelSource = atlasLevelSource();
const GOALS = [
    { kind: 'clear-tag', tag: { level: 69, tag: 0 }, at: { x: 72, y: 72 }, obstacle: 'lightbosscontroller@72,72' },
    { kind: 'reach-exit', exit: { x: 72, y: 72 } },
];
for (const name of ['lights-solve-sword', 'lights-solve-spear']) {
    const staging = solveStaging(stagingFromTape(parseTape(JSON.stringify(witness(name).tape))));
    const before = { ...C };
    const solved = await withContactFidelity({ lightsBossFight: true }, () => twoPassSolve({
        makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
        goals: GOALS, name: 'lights-solve', boot: staging.boot, dashMode: 'all',
        persistence: staging.persistence, log: () => {},
    }));
    const rebuilt = buildStagedTape({ staging, perTick: [...solved.out.perTick], name: 'lights-solve' });
    const delta = Object.fromEntries(Object.keys(C).map((k) => [k, C[k] - before[k]]));
    console.log(JSON.stringify({ name, tapeEqual: JSON.stringify(rebuilt.inputs) === JSON.stringify(witness(name).tape.inputs),
        ticks: rebuilt.tick_count, xc: delta }));
}
