const M = process.argv[2] + '/frontend/modules/seedlingDemo/';
const lw = await import(M + 'levelWorld.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { planWaypoints, plannerObstacleAt, withStringPullFast, BotDriverV2Error } = await import(M + 'botDriverV2.js');
const src = atlasLevelSource();
const plan = (w, f, t, o) => { try { return JSON.stringify(planWaypoints(w, f, t, null, o)); } catch (e) { if (e instanceof BotDriverV2Error) return 'T'; throw e; } };
let seed = 11; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
let found = 0, n = 0;
for (let L = 0; L < 117 && found < 4; L++) {
  let w; try { w = lw.buildLevelWorld(src(L), { roles: lw.ROLES }); } catch { continue; }
  for (const lattice of [8, 16]) {
    const o = { lattice };
    const pts = [];
    for (let k = 0; k < 4000 && pts.length < 80; k++) { const p = { x: Math.round(rnd() * w.width * 16 * 2) / 2, y: Math.round(rnd() * w.height * 16 * 2) / 2 }; if (!plannerObstacleAt(w, p.x, p.y, null, o)) pts.push(p); }
    for (let q = 0; q < 300; q++) {
      const f = pts[Math.floor(rnd() * pts.length)], t = pts[Math.floor(rnd() * pts.length)]; if (!f || !t || f === t) continue;
      n++;
      const a = withStringPullFast(false, () => plan(w, f, t, o)); const b = withStringPullFast(true, () => plan(w, f, t, o));
      if (a !== b) { found++; console.log(L, lattice, JSON.stringify(f), JSON.stringify(t), a, '|', b); break; }
    }
  }
}
console.log('plans', n, 'found', found);
