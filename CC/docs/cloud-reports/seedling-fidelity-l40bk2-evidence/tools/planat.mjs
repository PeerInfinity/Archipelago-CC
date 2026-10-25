// scratch: drive a captured plan; print the player and one spinner at chosen ticks
import { readFileSync } from 'node:fs';
const REPO = '/home/user/Archipelago-CC';
const P = REPO + '/scripts/procgen/';
const M = REPO + '/frontend/modules/seedlingDemo/';
const { restoreRequest } = await import(P + 'seedlingSolveRequestCodec.js');
const { atSeamTime } = await import(P + 'replay-seedling-solve-request.mjs');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const { solveAnytime, ANYTIME_PASSES } = await import(M + 'jsRuntimeSolver.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { buildStagedTape } = await import(M + 'botDriverV1.js');
const { parseTape } = await import(M + 'tapeFormat.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const [file, id, at, ticks, sid] = process.argv.slice(2);
const line = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((l) => l.id === +id);
const req = restoreRequest(atSeamTime(line.requests[0].request, +at));
const { passes = ANYTIME_PASSES, source, ...tape } = req;
const answer = solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes });
const sol = answer.plan.solution.map((k) => new Set(k));
const st = buildStagedTape({ staging: { ...tape.staging, inventory_slots: undefined }, perTick: sol, name: 's' });
const run = createRunForStaging(solveStaging(stagingFromTape(parseTape(JSON.stringify(st)))), atlasLevelSource());
const want = new Set(ticks.split(',').map(Number));
for (let t = 0; t < sol.length; t += 1) {
    if (want.has(t)) {
        const b = (run.entities('spinnerBodies') ?? []).find((q) => q.id === sid);
        console.log(`t${t} (top) player (${run.state.x.toFixed(2)},${run.state.y.toFixed(2)}) held [${[...sol[t]]}] ${sid} ${b ? `(${b.x.toFixed(2)},${b.y.toFixed(2)}) hits ${b.hits} timer ${b.hitsTimer} rect ${JSON.stringify(b.rect ?? null)}` : 'gone'} hits ${run.playerHits.length}`);
    }
    run.advance(sol[t]);
}
console.log('presses', sol.map((k,i)=>k.has('primary')&&!(i>0&&sol[i-1].has('primary'))?i:-1).filter(i=>i>=1170&&i<=1260).join(','));
console.log('ticks', sol.length, 'hits', run.playerHits.length);
