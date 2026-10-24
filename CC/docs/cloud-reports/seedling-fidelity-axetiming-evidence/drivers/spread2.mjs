import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { axeHitsPlayer, axeCanReach } = await import(R + 'spinningAxe.js');
const { playerBoxAt } = await import(R + 'playerPhysicsV2.js');
const d = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const roomAxes = JSON.parse(process.argv[3]);
const e = d[0];
function an(samples, label) {
  const out = [];
  for (const axe of roomAxes) {
    const P = Math.ceil(360 / Math.abs(axe.rate));
    const inR = samples.map(([x, y], i) => axeCanReach(axe, playerBoxAt(x, y)) ? i : -1).filter((i) => i >= 0);
    if (!inR.length) { out.push(`axe(${axe.cx},${axe.cy}) never in reach`); continue; }
    const first = inR[0], last = inR.at(-1);
    let unw = [], prev = null, off = 0;
    for (let i = first; i <= last; i++) {
      const [x, y] = samples[i]; const b = playerBoxAt(x, y);
      const th = Math.atan2((b.y + b.bottom) / 2 - axe.cy, (b.x + b.right) / 2 - axe.cx);
      const a = -(axe.rate * (e.t0 + i + 1 - e.clockV)) / 180 * Math.PI;
      let psi = th - a;
      if (prev !== null) { while (psi + off - prev > Math.PI) off -= 2 * Math.PI; while (psi + off - prev < -Math.PI) off += 2 * Math.PI; }
      unw.push(psi + off); prev = psi + off;
    }
    const spread = Math.max(...unw) - Math.min(...unw);
    const hits = [];
    for (let s = 0; s < P; s++) { let n = 0; for (let i = first; i <= last; i++) { const [x, y] = samples[i]; if (axeHitsPlayer(axe, e.t0 + i + 1 - e.clockV + s, playerBoxAt(x, y))) n++; } hits.push(n); }
    const clean = hits.map((h, s) => h === 0 ? s : -1).filter((s) => s >= 0);
    out.push(`axe(${axe.cx},${axe.cy}) r${axe.rate}: reach ${first}..${last} (${last - first + 1}t) spread ${spread.toFixed(2)} minHits ${Math.min(...hits)} cleanStalls[${clean.length}] ${clean.slice(0, 8).join(',')}`);
  }
  console.log(`${label.padEnd(10)} n=${samples.length} ${JSON.stringify(e.truncated?.kind ?? null)} | ${out.join(' | ')}`);
}
an(e.samples, 'walk');
for (const dd of e.dashed) an(dd.samples, `dash+${dd.off}`);
