// The SURVEY's staging (wave 59): the patched vanilla set with the chests as apitems (`apChestItem`), the only
// apitems the survey sees. Per room: the chest apitems, the freeze sources and placed specials, and the distances.
import { l25Sets } from '../../../../../frontend/modules/seedlingDemo/fidelityL25ApItem.js';
import { mountedRecordsOf } from '../../../../../frontend/modules/seedlingDemo/wasmWalkTape.js';
const root = new URL('../../../../../', import.meta.url).pathname;
const atlas = mountedRecordsOf(l25Sets(root).vanilla);
const SPECIAL = ['sword','feather','ghostspear','ghostsword','darkshield','darksuit','conch','shield','torchpickup','fire','bosskey','totempart','health','seed','wand'];
const SRC = ['button', 'rope', 'fallrock', 'fallrocklarge'];
const rows = [];
for (const [level, rec] of atlas) {
  const e = rec.entities ?? [];
  const chests = e.filter((x) => x.type === 'chest');
  if (chests.length === 0) continue;
  const near = e.filter((x) => SPECIAL.includes(x.type) || SRC.includes(x.type));
  if (near.length === 0) continue;
  rows.push({ level, chests: chests.map((c) => `chest@${c.x},${c.y}: ` + near.map((s) => `${s.type}@${s.x},${s.y} d=${Math.round(Math.hypot(c.x - s.x, c.y - s.y))}`).join(', ')) });
}
console.log(JSON.stringify(rows, null, 1));
