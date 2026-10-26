// scratch: an orbit-behind-the-blade policy against bobsoldier@880,832 from the latch staging, in the model.
import { readFileSync, writeFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape, solveStaging } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { strikePolicyFor } = await import(M + 'solverBot.js');
const { chooseHeld } = await import(M + 'botDriverV1.js');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const staging = solveStaging(stagingFromTape(parseTape(readFileSync(args.boot, 'utf8'))));
const run = createRunForStaging(staging, atlasLevelSource());
const R = Number(args.r ?? 26), SAFE = Number(args.safe ?? 100) * Math.PI / 180, STEP = Number(args.step ?? 25) * Math.PI / 180;
const DIR = Number(args.dir ?? 1), TRIG = Number(args.trig ?? 28), CLOSE = Number(args.close ?? 0);
const strike = args.nostrike ? null : strikePolicyFor(run, { dashMode: args.dash ?? 'all' });
const verbose = !!args.v;
const ID = args.id ?? 'bobsoldier@880,832';
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const perTick = [];
let lastHits = 0, mode = '';
for (let t = 0; t < Number(args.ticks ?? 400); t++) {
    const c = [...run.entities('chasers').values()].find((x) => x.id === ID);
    const s = run.state;
    let target;
    if (!c) { console.log(`t${t} soldier removed`); break; }
    const phi = Math.atan2(s.y - c.y, s.x - c.x);
    const beta = Math.atan2(Math.sin(-c.swordSpin), Math.cos(-c.swordSpin));
    const d = Math.hypot(s.x - c.x, s.y - c.y);
    const off = wrap(phi - beta);
    const orbit = (r, dphi) => ({ x: c.x + r * Math.cos(phi + dphi), y: c.y + r * Math.sin(phi + dphi) });
    if (c.destroy) { mode = 'corpse'; target = orbit(Math.max(R, 30), 0); }
    else if (c.swordSpinning) { mode = 'spin'; target = orbit(R, DIR * STEP); }
    else if (c.swordSpinResetTimer === 0) { mode = 'trigger'; target = orbit(TRIG, DIR * STEP); }
    else if (Math.abs(off) < SAFE) { mode = 'around'; target = orbit(R, (off >= 0 ? 1 : -1) * STEP); }
    else if (c.hitsTimer > 0) { mode = 'wait'; target = orbit(Number(args.rw ?? R), 0); }
    else { mode = 'close'; target = { x: c.x + CLOSE * Math.cos(phi), y: c.y + CLOSE * Math.sin(phi) }; }
    let held = chooseHeld(s, target, 1);
    if (strike && !c.destroy) held = strike.decide(s, run.entities('strikeBodies'), run.ticksCompleted, held, { slash: run.progress('slashInfo') }).held;
    perTick.push([...held]);
    const h0 = run.playerHits.length;
    run.advance(held);
    const c2 = [...run.entities('chasers').values()].find((x) => x.id === ID);
    const hitNow = run.playerHits.length !== h0;
    if (verbose || hitNow || (c2 && c2.hits !== lastHits)) console.log(`t${t + 1} ${mode} d${d.toFixed(1)} off${(off * 180 / Math.PI).toFixed(0)} p(${run.state.x.toFixed(1)},${run.state.y.toFixed(1)}) [${[...held]}] hits ${run.playerHits.length} | ${c2 ? `(${c2.x.toFixed(1)},${c2.y.toFixed(1)}) h${c2.hits} ht${c2.hitsTimer} spin${c2.swordSpinning ? 1 : 0} rt${c2.swordSpinResetTimer}${c2.destroy ? ' DESTROY' : ''}` : 'gone'}`);
    if (c2) lastHits = c2.hits;
}
console.log('RESULT hits', JSON.stringify(run.playerHits.map((h) => [h.t, h.source, h.id])), 'kills', JSON.stringify(run.chaserKills ?? []), 'ticks', perTick.length);
if (args.out) writeFileSync(args.out, JSON.stringify(perTick));
