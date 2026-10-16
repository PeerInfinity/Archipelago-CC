// group A sizing (APPROXIMATE: ignores the knockback each hit applies): per stall, the hits the run would bill with
// the player's 20-tick i-frames (Player.as:336 hitsTimerMax) on the walking corridor; min over stalls.
import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { axeHitsPlayer } = await import(R + 'spinningAxe.js');
const { playerBoxAt } = await import(R + 'playerPhysicsV2.js');
const e = JSON.parse(readFileSync(process.argv[2], 'utf8'))[0];
const axe = JSON.parse(process.argv[3]);
const P = Math.ceil(360 / Math.abs(axe.rate));
let best = null;
for (let s = 0; s < P; s++) {
  const billed = []; let until = -1;
  e.samples.forEach(([x, y], i) => { const t = i + s; if (t <= until) return; if (axeHitsPlayer(axe, e.t0 + t + 1 - e.clockV, playerBoxAt(x, y))) { billed.push(t); until = t + 20; } });
  if (!best || billed.length < best.billed.length) best = { s, billed };
}
console.log(`min billed hits over ${P} stalls: ${best.billed.length} (stall ${best.s}: t${best.billed.join(', t')})`);
