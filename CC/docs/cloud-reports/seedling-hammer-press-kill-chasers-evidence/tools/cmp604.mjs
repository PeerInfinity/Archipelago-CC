// scratch: preview vs live, tick by tick, from T: player, keys, bob@736,752
import { readFileSync } from 'node:fs';
const M = process.env.SD_ROOT ?? '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape, solveStaging } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { previewWalk } = await import(M + 'solverBot.js');
const [boot, plan, T, cx, cy, from, to] = process.argv.slice(2);
const staging = solveStaging(stagingFromTape(parseTape(readFileSync(boot, 'utf8'))));
const d = JSON.parse(readFileSync(plan, 'utf8'));
const run = createRunForStaging(staging, atlasLevelSource());
for (let t = 0; t < +T; t += 1) run.advance(new Set(d.perTick[t]));
const walk = previewWalk(run, [{ x: +cx, y: +cy }], 1.0);
const live = createRunForStaging(staging, atlasLevelSource());
const bob = (r) => [...r.entities('chasers').values()].find((c) => c.id === 'bob@736,752');
for (let t = 0; t < d.perTick.length; t += 1) {
    const k = t - +T;
    if (k >= +from && k <= +to) {
        const sm = walk.samples[k];
        const lb = bob(live);
        const pb = sm?.chasers?.find((c) => c.id === 'bob@736,752');
        console.log(`+${k} live p(${live.state.x.toFixed(1)},${live.state.y.toFixed(1)}) [${d.perTick[t]}] bob(${lb.x.toFixed(1)},${lb.y.toFixed(1)}) ${JSON.stringify(Object.fromEntries(Object.entries(lb).filter(([kk, v]) => typeof v !== 'object' && !['x','y','id'].includes(kk))))} | prev p(${sm?.x.toFixed(1)},${sm?.y.toFixed(1)}) [${[...(sm?.held ?? [])]}] bob(${pb?.x?.toFixed(1)},${pb?.y?.toFixed(1)}) hits ${live.playerHits.length}`);
    }
    live.advance(new Set(d.perTick[t]));
}
