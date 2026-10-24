// D2 census: every arrival cell (door landing, respawn = the same ctor) vs every presser; the rocks each reaches.
const REPO = '/home/user/Archipelago-CC';
const M = (p) => import(`${REPO}/frontend/modules/seedlingDemo/${p}`);
const { atlasLevelSource, loadAtlas } = await M('levelSource.js');
const { buildLevelWorld, ROLES } = await M('levelWorld.js');
const { playerBoxAt } = await M('playerPhysicsV2.js');
const { fallRocksArmedBy } = await M('activators.js');
const src = atlasLevelSource();
const atlas = loadAtlas();
const levels = (Array.isArray(atlas.levels) ? atlas.levels.map((l) => l.level) : Object.keys(atlas.levels).map(Number));
const worlds = new Map(); const errs = [];
for (const L of levels) {
  try { worlds.set(L, buildLevelWorld(src(L), { roles: ROLES })); } catch (e) {
    try { worlds.set(L, buildLevelWorld(src(L))); errs.push([L, 'ROLES threw; default roles used: ' + e.message.slice(0, 80)]); }
    catch (e2) { errs.push([L, 'BOTH threw: ' + e2.message.slice(0, 120)]); }
  }
}
const ov = (a, b) => a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
const rect = (r) => (r.right !== undefined ? r : { x: r.x, y: r.y, right: r.x + (r.w ?? r.width), bottom: r.y + (r.h ?? r.height) });
let doors = 0; const hits = [];
let nPressers = 0, nRocks = 0;
for (const [L, w] of worlds) { nPressers += (w.pressers ?? []).length; nRocks += (w.fallRocks ?? []).length; }
for (const [L, w] of worlds) {
  for (const tp of w.teleporters ?? []) {
    doors++;
    const dest = worlds.get(tp.to);
    if (!dest) { hits.push({ from: L, to: tp.to, note: 'destination not built' }); continue; }
    const box = playerBoxAt(tp.arrival.x, tp.arrival.y);
    const pr = (dest.pressers ?? []).filter((p) => ov(box, rect(p.rect)));
    if (pr.length === 0) continue;
    const rocks = fallRocksArmedBy(dest, box, []);
    hits.push({ from: L, to: tp.to, door: `${tp.x},${tp.y}`, tag: tp.tag, deactivated: tp.deactivated, stairs: tp.isStairs,
      arrival: tp.arrival, pressers: pr.map((p) => `${p.tag}@${p.x},${p.y} t${JSON.stringify(p.t)}`), rocks: rocks.map((r) => `${r.id} t${r.t} tag${r.persistTag}`) });
  }
}
// any presser under ANY rock? and every presser whose group has a rock
const rockPressers = [];
for (const [L, w] of worlds) for (const p of w.pressers ?? []) {
  const rocks = fallRocksArmedBy(w, rect(p.rect), []);
  if (rocks.length) rockPressers.push({ L, p: `${p.tag}@${p.x},${p.y}`, rocks: rocks.map((r) => r.id) });
}
console.log(JSON.stringify({ levels: levels.length, built: worlds.size, errs, doors, pressers: nPressers, rocks: nRocks, arrivalsOnPresser: hits, pressersThatDropARock: rockPressers }, null, 1));
