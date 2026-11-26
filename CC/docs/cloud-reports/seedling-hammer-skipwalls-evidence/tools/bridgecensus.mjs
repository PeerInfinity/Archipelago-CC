const R = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { atlasLevelSource } = await import(R + 'levelSource.js');
const { buildLevelWorld } = await import(R + 'levelWorld.js');
const src = atlasLevelSource();
for (let l = 0; l < 120; l++) {
  let rec; try { rec = src(l); } catch { continue; }
  if (!rec) continue;
  let w; try { w = buildLevelWorld(rec, { level: l }); } catch (e) { continue; }
  const b = w.bridgeTiles ?? [];
  if (!b.length) continue;
  // pairs on an axis within 2 tiles (the spear's rect reaches two tiles)
  const pairs = [];
  for (const p of b) for (const q of b) if (p !== q && ((p.ty === q.ty && Math.abs(p.tx - q.tx) <= 2) || (p.tx === q.tx && Math.abs(p.ty - q.ty) <= 2)) && (p.tx < q.tx || p.ty < q.ty)) pairs.push(`(${p.tx},${p.ty})-(${q.tx},${q.ty})`);
  console.log(`L${l}: ${b.length} bridge tile(s) [${b.map((t) => `${t.tx},${t.ty}`).join(' ')}]${pairs.length ? ' NEAR PAIRS ' + pairs.join(' ') : ''}`);
}
