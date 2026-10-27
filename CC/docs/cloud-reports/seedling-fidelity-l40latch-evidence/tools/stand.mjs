// scratch: stand still N ticks from a boot; print player motion, hits, nearby mobiles
import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape, solveStaging } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const [boot, n] = process.argv.slice(2);
const staging = solveStaging(stagingFromTape(parseTape(readFileSync(boot, 'utf8'))));
const run = createRunForStaging(staging, atlasLevelSource());
let px = run.state.x, py = run.state.y;
for (let t = 0; t < +n; t += 1) {
    run.advance(new Set());
    const s = run.state;
    if (Math.abs(s.x - px) > 1e-9 || Math.abs(s.y - py) > 1e-9) {
        const sp = (run.entities('spinnerBodies') ?? []).map((b) => `${b.id}(${b.x.toFixed(0)},${b.y.toFixed(0)})`).join(' ');
        const ch = [...(run.entities('chasers')?.values?.() ?? [])].filter((c) => Math.hypot(c.x - s.x, c.y - s.y) < 80).map((c) => `${c.id}(${c.x.toFixed(0)},${c.y.toFixed(0)})`).join(' ');
        console.log(`t${t + 1} (${s.x.toFixed(2)},${s.y.toFixed(2)}) v(${s.vx.toFixed(2)},${s.vy.toFixed(2)}) hits ${run.playerHits.length} ${JSON.stringify(run.playerHits.at(-1) ?? null).slice(0, 120)} | ${sp} | ${ch}`);
    }
    px = s.x; py = s.y;
}
console.log('end', run.state.x, run.state.y, 'hits', run.playerHits.length);
