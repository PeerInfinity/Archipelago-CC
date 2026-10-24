import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const { solveSegment, SolverRefusal } = await import(M + 'solverBot.js');
const SRC = atlasLevelSource();
const [file, seedS, hitless] = process.argv.slice(2);
let tape = JSON.parse(readFileSync(file, 'utf8')); if (tape.tape) tape = tape.tape;
const goals = [
    { kind: 'clear-tag', tag: { level: 57, tag: 0 }, at: { x: 80, y: 48 }, obstacle: 'tentaclebeast@80,48' },
    { kind: 'reach-exit', exit: { x: 96, y: 64 } },
];
const seed = Number(seedS);
const staging = stagingFromTape(parseTape(JSON.stringify({ ...tape, rng: { ...tape.rng, seed }, inputs: [], tick_count: 0 })));
let run;
withContactFidelity({ tentacleHitlessFirst: hitless === 'on' }, () => {
  run = createRunForStaging(staging, SRC);
  try {
    const out = solveSegment({ run, goals, name: 'seed', boot: staging.boot, forkRun: () => createRunForStaging(staging, SRC) });
    console.log('SOLVED', out.perTick.length, 'level', run.level, 'hits', run.ledger('playerHits').length, 'deaths', JSON.stringify(run.ledger('playerDeaths')));
  } catch (e) { console.log(e instanceof SolverRefusal ? 'REFUSED' : 'ERROR', String(e.message).replace(/\n/g," ⏎ ").slice(0, Number(process.env.MSGLEN??600)), JSON.stringify(e.obstacle ?? null)); }
  console.log('deaths', JSON.stringify(run.ledger('playerDeaths')));
  console.log('state', JSON.stringify({x:run.state.x,y:run.state.y,drown:run.state.drown, t: run.ticksCompleted}));
});
