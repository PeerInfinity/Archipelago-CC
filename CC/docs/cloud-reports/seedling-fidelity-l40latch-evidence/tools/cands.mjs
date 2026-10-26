import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape, solveStaging } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { ORBIT_KILL_CANDIDATES, orbitKillPolicy, strikePolicyFor } = await import(M + 'solverBot.js');
const staging = solveStaging(stagingFromTape(parseTape(readFileSync(process.argv[2], 'utf8'))));
ORBIT_KILL_CANDIDATES.forEach((c, i) => {
  const run = createRunForStaging(staging, atlasLevelSource());
  const strike = strikePolicyFor(run, { dashMode: 'all' });
  let t = 0;
  for (; t < 420; t++) { const h = orbitKillPolicy(run, 'bobsoldier@880,832', c, strike); if (h === null) break; run.advance(h); if (run.ledger('playerHits').length) break; }
  console.log(i, JSON.stringify(c), 't', t, 'hits', run.ledger('playerHits').map((h) => `${h.t}:${h.source}`).join(','));
});
