// search for (from,to) whose plan differs when a live solid moves by `d` px (a push / a crusher step), A* path equal
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const lw = await import(M + 'levelWorld.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { planWaypoints, planTilePath, plannerObstacleAt, BotDriverV2Error } = await import(M + 'botDriverV2.js');
const [L, fam, id, mdx, mdy, lat] = [Number(process.argv[2]), process.argv[3], process.argv[4], Number(process.argv[5]), Number(process.argv[6]), Number(process.argv[7] ?? 16)];
const w = lw.buildLevelWorld(atlasLevelSource()(L), { roles: lw.ROLES });
const B = Number(process.env.BASE ?? 0); const rs = w.solids.find((s) => (s.crusherId ?? s.pushableId) === id).rect; const r0 = { ...rs, x: rs.x + B, right: rs.right + B };
const r1 = { ...r0, x: r0.x + mdx, right: r0.right + mdx, y: r0.y + mdy, bottom: r0.bottom + mdy };
const live = new Map(); const o = { [fam]: live, lattice: lat };
const set = (k) => live.set(id, { rect: k ? r1 : r0, removed: false });
const plan = (f, t) => { try { return JSON.stringify(planWaypoints(w, f, t, null, o)); } catch (e) { if (e instanceof BotDriverV2Error) return 'THROW'; throw e; } };
const tp = (f, t) => { try { return JSON.stringify(planTilePath(w, f, t, null, o)); } catch (e) { return 'THROW'; } };
const cx = (r0.x + r0.right) / 2, cy = (r0.y + r0.bottom) / 2;
const pts = [];
for (let x = cx - 120; x <= cx + 120; x += 6) for (let y = cy - 120; y <= cy + 120; y += 6) { set(0); const a = plannerObstacleAt(w, x, y, null, o); set(1); const b = plannerObstacleAt(w, x, y, null, o); if (!a && !b) pts.push({ x, y }); }
let n = 0, d = 0;
let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
outer: for (let q = 0; q < 1e9; q++) { const i = Math.floor(rnd() * pts.length), j = Math.floor(rnd() * pts.length); if (i === j) continue;
  set(0); const a = plan(pts[i], pts[j]); const ta = tp(pts[i], pts[j]); set(1); const b = plan(pts[i], pts[j]); const tb = tp(pts[i], pts[j]); n++;
  if (a !== b && a !== 'THROW' && b !== 'THROW') { d++; console.log('diff', JSON.stringify(pts[i]), JSON.stringify(pts[j]), a, '|', b); if (d >= 3) break outer; }
  if (n > 6000) break outer;
}
console.log(L, id, 'move', mdx, mdy, 'pts', pts.length, 'pairs', n, 'diffs (same A*)', d);
