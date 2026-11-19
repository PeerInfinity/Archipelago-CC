// For each level with a talker/watcher in the BUILT world (buildLevelWorld, fresh boot, nothing cleared), the
// texted talkers/watchers and the world's drill/turret/iceTurret/beamTower rows. Usage: node tools/world-rooms.mjs
import { loadAtlas } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { levelSourceFromAtlas } from '../../../../../frontend/modules/seedlingDemo/atlasSource.js';
import { buildLevelWorld } from '../../../../../frontend/modules/seedlingDemo/levelWorld.js';
const atlas = loadAtlas();
const src = levelSourceFromAtlas(atlas);
for (const L of atlas.levels) {
    let w;
    try { w = buildLevelWorld(src(L.level), {}); } catch (e) { console.log(L.level, 'BUILD-ERR', e.message.slice(0, 80)); continue; }
    const t = (w.talkers ?? []).filter((x) => !!x.text).map((x) => `${x.tag}@${x.ex},${x.ey}`);
    const wa = (w.watchers ?? []).filter((x) => !!x.text).map((x) => `watcher@${x.ex},${x.ey}`);
    if (t.length + wa.length === 0) continue;
    const fam = {};
    for (const k of Object.keys(w)) {
        if (/drill|turret|beam|shooter|shieldboss|tentacle|bosstotem|lavaboss/i.test(k) && Array.isArray(w[k]) && w[k].length) fam[k] = w[k].length;
    }
    console.log(L.level, [...t, ...wa].join(' '), JSON.stringify(fam));
}
