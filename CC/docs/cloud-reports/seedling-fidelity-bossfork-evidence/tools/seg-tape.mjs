// BOSSFORK: solveSegment directly on a tape's staging (the fork passed via forkRun), print the boss verb's record.
// node seg-tape.mjs <tape.json> '<goals json>' [--fork=0] [--on=k,k] [--off=k,k]
import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const { solveSegment } = await import(M + 'solverBot.js');
const [file, goalsJson] = process.argv.slice(2);
const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const tape = JSON.parse(readFileSync(file, 'utf8'));
const staging = stagingFromTape(parseTape(JSON.stringify({ ...tape, inputs: [], tick_count: 0 })));
const SRC = atlasLevelSource();
const sw = {};
for (const k of (arg('on') ?? '').split(',').filter(Boolean)) sw[k] = true;
for (const k of (arg('off') ?? '').split(',').filter(Boolean)) sw[k] = false;
withContactFidelity(sw, () => {
    const run = createRunForStaging(staging, SRC);
    const t0 = Date.now();
    try {
        const out = solveSegment({ run, goals: JSON.parse(goalsJson), name: 'bossfork', boot: staging.boot,
            forkRun: arg('fork') === '0' ? undefined : () => createRunForStaging(staging, SRC) });
        console.log('SOLVED level', run.level, 'ticks', out.perTick.length, 'clears', JSON.stringify(run.earnedClears),
            'deaths', run.playerDeaths?.length, 'ms', Date.now() - t0);
        for (const r of out.records ?? []) console.log('record', JSON.stringify(r).slice(0, 1200));
    } catch (e) { console.log('REFUSED', e.constructor.name, String(e.message).slice(0, 900), 'ms', Date.now() - t0); }
});
