import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape, solveStaging } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const [boot, plan, on = ''] = process.argv.slice(2);
const staging = solveStaging(stagingFromTape(parseTape(readFileSync(boot, 'utf8'))));
const d = JSON.parse(readFileSync(plan, 'utf8'));
const over = Object.fromEntries(on.split(',').filter(Boolean).map((k) => [k, true]));
withContactFidelity(over, () => {
const run = createRunForStaging(staging, atlasLevelSource());
let prev = { latched: '', open: '', chasers: '', spinners: '', hits: 0 };
for (let t = 0; t < d.perTick.length; t++) {
    run.advance(new Set(d.perTick[t]));
    const now = {
        latched: [...(run.entities('latchedGroups') ?? [])].sort().join(','),
        open: [...run.entities('openActivators')].sort().join(','),
        chasers: (run.entities('chasers') ?? []).filter((c) => c.x > 700 && c.y > 700).map((c) => c.id).join(','),
        spinners: (run.entities('spinnerBodies') ?? []).filter((c) => c.x > 700 && c.y > 700).map((c) => c.id).join(','),
        hits: run.ledger('playerHits').length,
    };
    for (const k of Object.keys(now)) if (now[k] !== prev[k]) console.log(`t${t + 1} p(${run.state.x.toFixed(1)},${run.state.y.toFixed(1)}) ${k}: ${prev[k]} -> ${now[k]}`);
    prev = now;
}
console.log('end', run.state.x, run.state.y, JSON.stringify(run.ledger('playerHits')));
});
