import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape, solveStaging } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const [boot, plan] = process.argv.slice(2);
const staging = solveStaging(stagingFromTape(parseTape(readFileSync(boot, 'utf8'))));
const d = JSON.parse(readFileSync(plan, 'utf8'));
const run = createRunForStaging(staging, atlasLevelSource());
let lastHits = 0;
for (let t = 0; t < d.perTick.length; t += 1) {
    const held = new Set(d.perTick[t]);
    if (t % 20 === 0 || t > 700) {
        const ch = [...(run.entities('chasers')?.values?.() ?? [])].filter((c) => !c.removed && Math.hypot(c.x - run.state.x, c.y - run.state.y) < 90).map((c) => `${c.id}(${c.x.toFixed(0)},${c.y.toFixed(0)})`).join(' ');
        const sp = (run.entities('spinnerBodies') ?? []).filter((b) => Math.hypot(b.x - run.state.x, b.y - run.state.y) < 60).map((b) => `${b.id}(${b.x.toFixed(0)},${b.y.toFixed(0)} h${b.hits})`).join(' ');
        if (t % 20 === 0 || run.playerHits.length !== lastHits || t > 760) console.log(`t${t} p(${run.state.x.toFixed(1)},${run.state.y.toFixed(1)}) [${[...held]}] hits ${run.playerHits.length} | ${ch} | ${sp}`);
    }
    lastHits = run.playerHits.length;
    run.advance(held);
}
console.log('end', run.playerHits.map((h) => `${h.t}:${h.source}:${h.id}`).join(' '), 'deaths', JSON.stringify(run.playerDeaths ?? []).slice(0, 200));
