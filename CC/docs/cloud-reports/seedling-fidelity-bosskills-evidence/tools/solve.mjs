import { readFileSync, writeFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const { solveSegment } = await import(M + 'solverBot.js');
const base = JSON.parse(readFileSync('/tmp/claude-0/d1/l57-idle-a.json', 'utf8'));
const seed = +(process.argv[2] || 1); const on = process.argv[3] !== 'off'; const split = process.argv[4] !== 'nosplit';
const tape = { ...base, rng: { ...base.rng, seed, split }, inputs: [], tick_count: 0, name: `tb-solve-s${seed}` };
const staging = stagingFromTape(parseTape(JSON.stringify(tape)));
const SRC = atlasLevelSource();
const goals = [{ kind: 'clear-tag', tag: { level: 57, tag: 0 }, at: { x: 80, y: 48 }, obstacle: 'tentaclebeast@80,48', report: { level: 57, tag: 0 } },
  { kind: 'reach-exit', exit: { x: 96, y: 64 } }];
withContactFidelity({ tentacleBeastFight: on }, () => {
  const run = createRunForStaging(staging, SRC);
  try {
    const out = solveSegment({ run, goals, name: 'tb-solve', boot: staging.boot, forkRun: () => createRunForStaging(staging, SRC) });
    console.log('SOLVED level', run.level, 'ticks', out.perTick.length, 'clears', JSON.stringify(run.earnedClears), 'deaths', run.playerDeaths.length);
    const per = out.perTick.map((s) => [...s]);
    const inputs = [];
    for (const k of ['up', 'down', 'left', 'right', 'primary', 'secondary']) { let from = null; for (let t = 0; t <= per.length; t++) { const o = t < per.length && per[t].includes(k); if (o && from === null) from = t; if (!o && from !== null) { inputs.push({ key: k, from, to: t }); from = null; } } }
    inputs.sort((a, b) => a.from - b.from);
    writeFileSync(`/tmp/claude-0/d3/tb-solve-s${seed}.json`, JSON.stringify({ ...tape, inputs, tick_count: per.length, description: 'bosskills D3 solver walk' }, null, 1));
  } catch (e) { console.log('REFUSED', e.constructor.name, e.message.slice(0, 900)); }
});
