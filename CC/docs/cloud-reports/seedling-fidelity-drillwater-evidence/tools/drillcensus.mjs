// scratch: every shipped drill — the hop-graph (16 px from its placement centre, the model's planner walls = world
// solids at the drill's 10x10 box) and the fatal tiles (water 1 / lava 17 / pit 6) it can reach. Measure only.
import { readFileSync } from 'node:fs';
const ROOT = '/home/user/Archipelago-CC'; const M = ROOT + '/frontend/modules/seedlingDemo/';
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const { ROLES, buildLevelWorld } = await import(M + 'levelWorld.js');
const atlas = JSON.parse(readFileSync(ROOT + '/frontend/modules/flashPanel/atlases/seedling-map.json', 'utf8'));
const src = levelSourceFromAtlas(atlas);
for (const lv of [28, 88, 91]) {
  const w = buildLevelWorld(src(lv), { roles: ROLES });
  const drills = (w.combat?.enemies ?? []).filter((e) => e.tag === 'drill');
  const hit = (x, y) => w.boxCollides ? w.boxCollides({ x: x - 5, y: y - 5, right: x + 5, bottom: y + 5 }) : null;
  const solidAt = (x, y) => {
    for (const k of ['collidesBox', 'boxSolid', 'rectSolid', 'solidAt', 'isSolid']) if (typeof w[k] === 'function') return w[k]({ x: x - 5, y: y - 5, right: x + 5, bottom: y + 5, w: 10, h: 10 });
    return null;
  };
  console.log('L', lv, 'world fns:', Object.keys(w).filter((k) => typeof w[k] === 'function').slice(0, 40).join(','));
  let fatalAll = [];
  for (let y = 8; y < w.height * 16; y += 16) for (let x = 8; x < w.width * 16; x += 16) {
    const t = w.nearestWalkableTile(x, y);
    if (t && [1, 17, 6].includes(t.t) && Math.floor(t.x / 16) === Math.floor(x / 16) && Math.floor(t.y / 16) === Math.floor(y / 16)) fatalAll.push([x, y, t.t]);
  }
  console.log('  fatal cells (centre, t):', JSON.stringify(fatalAll));
  for (const d of drills) console.log('  drill', d.tag, d.x, d.y);
}
console.log('--- hop BFS (16 px axis steps, collidesSolid on the 10x10 box; ignores other Enemy bodies and the run\'s dynamic solids)');
for (const lv of [28, 88, 91]) {
  const w = buildLevelWorld(src(lv), { roles: ROLES });
  for (const e of (w.combat?.enemies ?? []).filter((q) => q.tag === 'drill')) {
    const s = [e.x + 8, e.y + 8]; const key = (p) => p.join(','); const dist = new Map([[key(s), 0]]); const q = [s]; const fatal = [];
    while (q.length) {
      const c = q.shift();
      for (const [dx, dy] of [[16, 0], [-16, 0], [0, 16], [0, -16]]) {
        const n = [c[0] + dx, c[1] + dy];
        if (dist.has(key(n)) || n[0] < 0 || n[1] < 0 || n[0] > w.width * 16 || n[1] > w.height * 16) continue;
        if (w.collidesSolid({ x: n[0] - 5, y: n[1] - 5, right: n[0] + 5, bottom: n[1] + 5, w: 10, h: 10 })) continue;
        dist.set(key(n), dist.get(key(c)) + 1);
        const t = w.nearestWalkableTile(n[0], n[1])?.t;
        if ([1, 17, 6].includes(t)) { fatal.push([n, t, dist.get(key(n))]); continue; }
        q.push(n);
      }
    }
    console.log(`  L${lv} drill@${e.x},${e.y}: hop-reach ${dist.size} cells; fatal ${JSON.stringify(fatal)}`);
  }
}
