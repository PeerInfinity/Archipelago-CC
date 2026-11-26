// The DELIVERED set's ceremonies (wave 59): every room still holding a placed special pickup, or a runtime
// ceremony's room, and the apitems in it (distance to each special).
import { l25Sets } from '../../../../../frontend/modules/seedlingDemo/fidelityL25ApItem.js';
import { mountedRecordsOf } from '../../../../../frontend/modules/seedlingDemo/wasmWalkTape.js';
const root = new URL('../../../../../', import.meta.url).pathname;
const atlas = mountedRecordsOf(l25Sets(root).delivered);
const SPECIAL = ['sword','feather','ghostspear','ghostsword','darkshield','darksuit','conch','shield','torchpickup','fire','bosskey','totempart','health','seed','wand'];
const RUNTIME = ['bobboss','witch','bosstotem','lavaboss','lavaboss2','chest','enemychest'];
const rows = [];
for (const [level, rec] of atlas) {
  const e = rec.entities ?? [];
  const sp = e.filter((x) => SPECIAL.includes(x.type));
  const rt = e.filter((x) => RUNTIME.includes(x.type) || /boss/i.test(x.type));
  const ap = e.filter((x) => x.type === 'apitem');
  if (sp.length === 0 && rt.length === 0) continue;
  rows.push({ level, specials: sp.map((x) => `${x.type}@${x.x},${x.y}`), runtimeHosts: rt.map((x) => `${x.type}@${x.x},${x.y}`),
    apitems: ap.map((a) => `apitem@${a.x},${a.y} (${a.attrs?.look}) d=` + [...sp, ...rt].map((s) => Math.round(Math.hypot(a.x - s.x, a.y - s.y))).join('/')) });
}
console.log(JSON.stringify(rows, null, 1));
