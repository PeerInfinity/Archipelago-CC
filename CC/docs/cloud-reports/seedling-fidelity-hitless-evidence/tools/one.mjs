import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const { solveSegment } = await import(M + 'solverBot.js');
const SRC = atlasLevelSource();
let tape = JSON.parse(readFileSync(process.argv[2], 'utf8')); if (tape.tape) tape = tape.tape;
const seed = Number(process.argv[3]);
const goals = [{ kind: 'clear-tag', tag: { level: 57, tag: 0 }, at: { x: 80, y: 48 }, obstacle: 'tentaclebeast@80,48' }, { kind: 'reach-exit', exit: { x: 96, y: 64 } }];
const staging = stagingFromTape(parseTape(JSON.stringify({ ...tape, rng: { ...tape.rng, seed }, inputs: [], tick_count: 0 })));
withContactFidelity({ tentacleHitlessFirst: process.argv[4] === 'on' }, () => {
    const run = createRunForStaging(staging, SRC);
    try {
        const out = solveSegment({ run, goals, name: 'seed', boot: staging.boot, forkRun: () => createRunForStaging(staging, SRC) });
        console.log('OK', out.perTick.length, JSON.stringify(out.records.find((x) => x.verb === 'tentaclebeast')?.tried));
    } catch (e) { console.log(e.stack.split('\n').slice(0, 12).join('\n')); }
});
