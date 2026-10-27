// scratch: solve step 67 with the press-kill trace hook; print one row per tick of the kill (or per change)
import { readFileSync, writeFileSync } from 'node:fs';
const M = process.env.SD_ROOT ?? '/home/user/pkc-scratch/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape, solveStaging } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { solveSegment } = await import(M + 'solverBot.js');
const boot = process.argv[2];
const rows = [];
globalThis.__PKC_TRACE = (r) => rows.push(r);
const staging = solveStaging(stagingFromTape(parseTape(readFileSync(boot, 'utf8'))));
const levelSource = atlasLevelSource();
const run = createRunForStaging(staging, levelSource);
let msg = 'SOLVED';
const t0 = Date.now();
try {
    solveSegment({ run, goals: [{ kind: 'collect-placement', placement: { x: 656, y: 528 } }], name: 'l40bk2', boot: staging.boot,
        dashMode: 'all', forkRun: () => createRunForStaging(staging, levelSource) });
} catch (e) { msg = e.message; }
console.log('VERDICT', msg.split(' -> ').map((x) => x.slice(0, 260)).join(' || -> '));
console.log('HITS', run.playerHits.map((h) => h.t + ':' + h.id).join(' '), 'DEATHS', (run.ledger('playerDeaths') ?? []).length, 'PKC', JSON.stringify(globalThis.__PKC?.counts ?? null), 'ticks', run.ticksCompleted);
let last = '';
for (const r of rows) {
    const k = `${r.branch} ${JSON.stringify(r.strike?.cell)} ${r.strike?.pressAt} ${JSON.stringify(r.refuge)} ${r.phaseStall ? 'stall' : ''}`;
    if (k !== last || r.t % 20 === 0) console.log(`t${r.t} (${r.x.toFixed(1)},${r.y.toFixed(1)}) ${k} keys[${r.keysPre}]`);
    last = k;
}
console.log('ms', Date.now() - t0);
writeFileSync(process.argv[3] ?? '/dev/null', JSON.stringify(rows));
