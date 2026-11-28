import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { atlasLevelSource } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/levelSource.js';
import { EXIT_TYPES } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/jsRuntimeCore.js';
import { buildLevelWorld } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/levelWorld.js';
const src = atlasLevelSource();
const pits = new Map();
const pitsOf = (L) => { if (!pits.has(L)) { let p=[]; try { p = buildLevelWorld(src(L)).pitTiles; } catch {} pits.set(L, p); } return pits.get(L); };
const files = process.argv.slice(2);
for (const f of files) {
  const j = JSON.parse(readFileSync(f, 'utf8'));
  let sc = j.preset_sidecars ?? j; if (sc && Object.keys(sc).every((k)=>/^\d+$/.test(k))) sc = Object.assign({}, ...Object.values(sc));
  let total = 0, refused = [], skipped = 0;
  for (const [region, v] of Object.entries(sc)) {
    const p = v?.playable_payload; if (!p?.exits) continue;
    for (const e of p.exits) {
      if (!e.exitName) continue;
      total++;
      if (!Number.isInteger(p.level)) { skipped = (skipped ?? 0) + 1; continue; }
      let r = null; try { r = src(p.level); } catch {} if (!r) { refused.push([region, e.exit_id, 'no record']); continue; }
      const tiles = e.exit_tiles ?? [];
      const ok = tiles.some(([tx,ty]) => (r.entities??[]).some((en)=>EXIT_TYPES.includes(en.type) && Math.floor(en.x/16)===tx && Math.floor(en.y/16)===ty))
        || tiles.some(([tx,ty]) => pitsOf(p.level).some((q)=>q.tx===tx&&q.ty===ty));
      if (!ok) refused.push([region, e.exit_id, e.exitName, JSON.stringify(tiles)]);
    }
  }
  console.log(f, "exits", total, "refused", refused.length, "non-vanilla-level skipped", skipped);
  for (const x of refused) console.log('   ', x.join(' | '));
}
