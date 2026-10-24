// SCRATCH (seedling-hammer-sc D1): the per-tick displacement of the player on the GAME (p4f), from the drained stream
// `probe-seedling-dash-window.mjs --out=` wrote, through the repo's own `gameStreamFromDrain`.
import { readFileSync } from 'node:fs';
const { gameStreamFromDrain } = await import('/home/user/Archipelago-CC/frontend/modules/seedlingDemo/tapeFormat.js');
const j = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const s = gameStreamFromDrain(j.drain).stream;
const t = s.ticks; console.log('keys of a tick:', Object.keys(t[0]).join(','));
const P = (o) => [o.x ?? o.player?.x ?? o.px, o.y ?? o.player?.y ?? o.py];
let maxdx = 0, maxdy = 0; const rows = [];
for (let k = 1; k < t.length; k++) { const [x0, y0] = P(t[k - 1]); const [x1, y1] = P(t[k]); const dx = x1 - x0, dy = y1 - y0;
  maxdx = Math.max(maxdx, Math.abs(dx)); maxdy = Math.max(maxdy, Math.abs(dy)); rows.push([k, x1.toFixed(3), y1.toFixed(3), dx.toFixed(3), dy.toFixed(3)].join('\t')); }
console.log('obs\tx\ty\tdx\tdy'); console.log(rows.join('\n'));
const seg = (a, b) => { const [xa, ya] = P(t[a]); const [xb, yb] = P(t[b]); return `obs ${a}..${b}: dx ${(xb - xa).toFixed(3)} (${((xb - xa) / (b - a)).toFixed(3)}/tick), dy ${(yb - ya).toFixed(3)}`; };
console.log('max |dx| per tick', maxdx.toFixed(3), 'max |dy| per tick', maxdy.toFixed(3));
console.log(seg(0, 20)); console.log(seg(20, 40)); console.log(seg(40, 64)); console.log(seg(0, 64));
