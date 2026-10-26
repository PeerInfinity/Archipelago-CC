// scratch: per-sample gap between the previewed player box and bob@736,752's box, +48..+62
import { readFileSync } from 'node:fs';
const M = process.env.SD_ROOT ?? '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape, solveStaging } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { previewWalk } = await import(M + 'solverBot.js');
const { playerBoxAt } = await import(M + 'playerPhysicsV2.js');
const [boot, plan, T, cx, cy] = process.argv.slice(2);
const staging = solveStaging(stagingFromTape(parseTape(readFileSync(boot, 'utf8'))));
const d = JSON.parse(readFileSync(plan, 'utf8'));
const run = createRunForStaging(staging, atlasLevelSource());
for (let t = 0; t < +T; t += 1) run.advance(new Set(d.perTick[t]));
const walk = previewWalk(run, [{ x: +cx, y: +cy }], 1.0);
for (let k = 46; k < 62; k += 1) {
    const sm = walk.samples[k];
    const b = sm.chasers.find((c) => c.id === 'bob@736,752');
    const p = playerBoxAt(sm.x, sm.y);
    console.log(`+${k} tick ${sm.tick} p(${sm.x.toFixed(2)},${sm.y.toFixed(2)}) box[${p.x.toFixed(1)},${p.y.toFixed(1)},${p.right.toFixed(1)},${p.bottom.toFixed(1)}] bob(${b.x.toFixed(2)},${b.y.toFixed(2)}) rect[${b.rect.x.toFixed(1)},${b.rect.y.toFixed(1)},${b.rect.right.toFixed(1)},${b.rect.bottom.toFixed(1)}] hitsTimer ${b.hitsTimer}`);
}
