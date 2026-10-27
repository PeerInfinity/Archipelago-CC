const SD = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { l40LatchBoot } = await import(SD + 'fidelityL40Latch.js');
const { parseTape } = await import(SD + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(SD + 'tapeRunner.js');
const { atlasLevelSource } = await import(SD + 'levelSource.js');
const { ORBIT_KILL_CANDIDATES, orbitKillPolicy, strikePolicyFor } = await import(SD + 'solverBot.js');
const { withContactFidelity } = await import(SD + 'contactFidelity.js');
const boot = await l40LatchBoot();
for (const on of [false, true]) {
  const res = [];
  withContactFidelity({ orbitFreeAim: on }, () => {
    for (const [ci, cand] of ORBIT_KILL_CANDIDATES.entries()) {
      const run = createRunForStaging(solveStaging(stagingFromTape(parseTape(JSON.stringify(boot)))), atlasLevelSource());
      const strike = strikePolicyFor(run, { dashMode: 'all' });
      let t = 0; let out = 'bound';
      for (; t < 420; t += 1) { const held = orbitKillPolicy(run, 'bobsoldier@880,832', cand, strike); if (held === null) { out = `kill t${t}`; break; } run.advance(held); const h = run.ledger('playerHits'); if (h.length) { out = `hit t${h[0].t} ${h[0].source}`; break; } }
      res.push(`${ci}:${out}`);
    }
  });
  console.log(`orbitFreeAim ${on}: ${res.join(' | ')}`);
}
