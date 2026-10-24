import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const { solveSegment, SolverRefusal } = await import(M + 'solverBot.js');
const SRC = atlasLevelSource();
const [file, a, b, hitless, drown] = process.argv.slice(2);
let tape = JSON.parse(readFileSync(file, 'utf8')); if (tape.tape) tape = tape.tape;
const goals = [
    { kind: 'clear-tag', tag: { level: 57, tag: 0 }, at: { x: 80, y: 48 }, obstacle: 'tentaclebeast@80,48' },
    { kind: 'reach-exit', exit: { x: 96, y: 64 } },
];
for (let seed = Number(a); seed <= Number(b); seed += 1) {
  const staging = stagingFromTape(parseTape(JSON.stringify({ ...tape, rng: { ...tape.rng, seed }, inputs: [], tick_count: 0 })));
  const t0 = Date.now(); let row;
  withContactFidelity({ tentacleHitlessFirst: hitless === 'on', whirlpoolDrown: drown === 'on' }, () => {
    const run = createRunForStaging(staging, SRC);
    try {
      const out = solveSegment({ run, goals, name: 'seed', boot: staging.boot, forkRun: () => createRunForStaging(staging, SRC) });
      const rec = (out.records ?? []).find((x) => x.verb === 'tentaclebeast');
      row = { v: 'SOLVED', ticks: out.perTick.length, level: run.level, hits: run.ledger('playerHits').map(h=>h.t), deaths: run.ledger('playerDeaths').length,
        tried: rec?.tried?.map((t) => `${t.ok ? 'ok' : 'X'}:${t.spent}`), dodge: (out.trace?.rows ?? out.rows ?? []).filter?.((r)=>r.strategy?.whirlpools).length };
    } catch (e) { row = { v: e instanceof SolverRefusal ? 'REFUSED' : 'ERROR', why: String(e.message).split('\n')[0].slice(0, 160), obstacle: e.obstacle ?? null }; }
  });
  console.log(JSON.stringify({ seed, hitless, drown, ms: Date.now() - t0, ...row }));
}
