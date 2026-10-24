// For a dumped corridor preview: per hit axe, the in-reach span, the unwrapped relative angle spread, and hits per stall.
import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { axeHitsPlayer, axeCanReach } = await import(R + 'spinningAxe.js');
const { playerBoxAt } = await import(R + 'playerPhysicsV2.js');
const d = JSON.parse(readFileSync(process.argv[2], 'utf8'));
for (const [k, e] of d.entries()) {
  const axes = e.hit.sources.map((s) => s.axe);
  console.log(`#${k} t0=${e.t0} V=${e.clockV} start=(${e.state.x},${e.state.y}) samples=${e.samples.length} hit@${e.hit.tick} (${e.hit.x?.toFixed?.(1)},${e.hit.y?.toFixed?.(1)}) trunc=${JSON.stringify(e.truncated)?.slice(0,80)}`);
  for (const axe of axes) {
    const P = Math.ceil(360 / Math.abs(axe.rate));
    const inR = e.samples.map(([x, y], i) => axeCanReach(axe, playerBoxAt(x, y)) ? i : -1).filter((i) => i >= 0);
    const first = inR[0], last = inR.at(-1);
    let unw = [], prev = null, off = 0;
    for (let i = first; i <= last; i++) {
      const [x, y] = e.samples[i]; const b = playerBoxAt(x, y);
      const th = Math.atan2((b.y + b.bottom) / 2 - axe.cy, (b.x + b.right) / 2 - axe.cx);
      const a = -(axe.rate * (e.t0 + i + 1 - e.clockV)) / 180 * Math.PI;
      let psi = th - a;
      if (prev !== null) { while (psi + off - prev > Math.PI) off -= 2 * Math.PI; while (psi + off - prev < -Math.PI) off += 2 * Math.PI; }
      unw.push(psi + off); prev = psi + off;
    }
    const spread = Math.max(...unw) - Math.min(...unw);
    const hits = [];
    for (let s = 0; s < P; s++) {
      let n = 0;
      for (let i = first; i <= last; i++) { const [x, y] = e.samples[i]; if (axeHitsPlayer(axe, e.t0 + i + 1 - e.clockV + s, playerBoxAt(x, y))) n++; }
      hits.push(n);
    }
    console.log(`  axe (${axe.cx},${axe.cy}) rate ${axe.rate} P ${P}: in reach samples ${first}..${last} (${inR.length}); rel-angle spread ${(spread).toFixed(2)} rad (2π=6.28); min hits over stalls ${Math.min(...hits)} at s=${hits.indexOf(Math.min(...hits))}; path ${e.samples.slice(first,last+1).filter((_,j)=>j%6==0).map(([x,y])=>`${x.toFixed(0)},${y.toFixed(0)}`).join(' ')}`);
  }
}
