// scratch: replay step 67's refused kill to tick T, then preview the strike walk the executor took and price it
import { readFileSync } from 'node:fs';
const M = process.env.SD_ROOT ?? '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape, solveStaging } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { previewWalk } = await import(M + 'solverBot.js');
const { dangerDuringTransit } = await import(M + 'dangerMap.js');
const { playerBoxAt } = await import(M + 'playerPhysicsV2.js');
const [boot, plan, T, cx, cy] = process.argv.slice(2);
const staging = solveStaging(stagingFromTape(parseTape(readFileSync(boot, 'utf8'))));
const d = JSON.parse(readFileSync(plan, 'utf8'));
const run = createRunForStaging(staging, atlasLevelSource());
for (let t = 0; t < +T; t += 1) run.advance(new Set(d.perTick[t]));
console.log('at', run.ticksCompleted, run.state.x.toFixed(1), run.state.y.toFixed(1), 'hits', run.playerHits.length);
const walk = previewWalk(run, [{ x: +cx, y: +cy }], 1.0);
console.log('walk samples', walk.samples.length, 'truncated', JSON.stringify(walk.truncated));
let firstDanger = null;
for (const sm of walk.samples) {
    const dd = dangerDuringTransit(run, sm.tick, playerBoxAt(sm.x, sm.y), sm.arrows, sm.chasers, sm.spits ?? null, sm.grenades ?? null);
    const near = (sm.chasers ?? []).filter((c) => Math.hypot(c.x - sm.x, c.y - sm.y) < 40).map((c) => `${c.id}(${(c.x ?? NaN).toFixed?.(0)},${(c.y ?? NaN).toFixed?.(0)})`).join(' ');
    const k = sm.tick - run.ticksCompleted;
    if (k % 10 === 0 || dd.danger) console.log(`+${k} p(${sm.x.toFixed(1)},${sm.y.toFixed(1)}) [${[...(sm.held ?? [])]}] chasers:${sm.chasers === null ? 'NULL' : sm.chasers?.length} near ${near} ${dd.danger ? 'DANGER ' + dd.sources.map((s) => s.kind + ':' + s.id).join(',') : ''}`);
    if (dd.danger && !firstDanger) firstDanger = k;
}
console.log('firstDanger', firstDanger);
