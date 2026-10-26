// scratch: a hit-and-run policy against bobsoldier@880,832 from the latch staging, in the model.
import { readFileSync, writeFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape, solveStaging } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { strikePolicyFor } = await import(M + 'solverBot.js');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const staging = solveStaging(stagingFromTape(parseTape(readFileSync(args.boot, 'utf8'))));
const run = createRunForStaging(staging, atlasLevelSource());
const EVADE_D = Number(args.evade ?? 34);
const DIRS = [[], ['up'], ['down'], ['left'], ['right'], ['up', 'left'], ['up', 'right'], ['down', 'left'], ['down', 'right']];
const strike = strikePolicyFor(run, { dashMode: args.dash ?? 'all' });
const step = run.previewStepper();
const perTick = [];
const soldier = () => [...run.entities('chasers').values()].find((x) => x.id === 'bobsoldier@880,832');
for (let t = 0; t < Number(args.ticks ?? 400); t++) {
    const c = soldier();
    if (!c || c.destroy) { console.log(`t${t} soldier ${c ? 'destroyed' : 'gone'}`); if (!c) break; }
    const s = run.state;
    let held = new Set();
    if (c && !c.destroy) {
        const d = Math.hypot(c.x - s.x, c.y - s.y);
        const evade = c.swordSpinning || (c.swordSpinResetTimer === 0 && d < EVADE_D);
        const px = c.x + c.vx, py = c.y + c.vy;
        let best = null;
        for (const k of DIRS) {
            const n = step(s, new Set(k));
            if (!n) continue;
            const nd = Math.hypot(px - n.x, py - n.y);
            const score = evade ? nd : -Math.abs(nd - Number(args.engage ?? 14));
            if (best === null || score > best.score) best = { k, score };
        }
        held = new Set(best?.k ?? []);
        if (!evade) held = strike.decide(s, run.entities('strikeBodies'), run.ticksCompleted, held, { slash: run.progress('slashInfo') }).held;
    }
    perTick.push([...held]);
    const h0 = run.playerHits.length;
    run.advance(held);
    const c2 = soldier();
    if (run.playerHits.length !== h0 || t % 10 === 0) console.log(`t${t + 1} p(${run.state.x.toFixed(1)},${run.state.y.toFixed(1)}) [${[...held]}] hits ${run.playerHits.length} | soldier ${c2 ? `(${c2.x.toFixed(1)},${c2.y.toFixed(1)}) h${c2.hits} spin${c2.swordSpinning ? 1 : 0} rt${c2.swordSpinResetTimer}${c2.destroy ? ' DESTROY' : ''}` : 'gone'}`);
}
console.log('hits', JSON.stringify(run.playerHits.map((h) => [h.t, h.source, h.id])), 'kills', JSON.stringify(run.chaserKills ?? []));
if (args.out) writeFileSync(args.out, JSON.stringify(perTick));
