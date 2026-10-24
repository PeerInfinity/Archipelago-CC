import { writeFileSync } from 'node:fs';
const P = []; const D = [];
globalThis.__LABP = (r) => P.push(r);
globalThis.__LABD = (r) => { if (D.length < 400) D.push(r); };
const origLog = console.log; console.log = () => {};
try { await import('./leg.mjs'); } catch (e) { origLog('threw', e.message); }
console.log = origLog;
// the drive from tick 0: D rows until the first tick restarts
const drive = []; for (const r of D) { if (drive.length && r.t <= drive.at(-1).t) break; drive.push(r); }
const cand = P.filter((p) => p.start === 0 && p.strike);
let best = null;
for (const p of cand) {
  let i = 0; while (i < Math.min(p.held.length, drive.length) && p.held[i] === drive[i].held) i++;
  if (!best || i > best.i) best = { i, p };
}
origLog('drive ticks', drive.length, 'previews from 0 with strike', cand.length, 'best agreement', best?.i);
if (best) { const i = best.i; for (let k = Math.max(0, i - 6); k < i + 3 && k < drive.length; k++) origLog(k, 'drive', drive[k].held, JSON.stringify(drive[k].bodies.filter((b) => b[0] === 'lavarunner@208,96')), '| prev', best.p.held[k], JSON.stringify((best.p.bodies[k] ?? []).filter((b) => b[0] === 'lavarunner@208,96'))); }
