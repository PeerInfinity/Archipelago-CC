// The DELIVERED set's rock rooms (wave 59): every room holding a freeze source (button → fallrock, rope/pull, the
// wand's tset-0 rocks, fallrocklarge) and the apitems in it, with each apitem's distance to each source cell.
// Usage: node tools/delivered-rooms.mjs > d1/delivered-rooms.json
import { l25Sets } from '../../../../../frontend/modules/seedlingDemo/fidelityL25ApItem.js';
import { mountedRecordsOf } from '../../../../../frontend/modules/seedlingDemo/wasmWalkTape.js';
const root = new URL('../../../../../', import.meta.url).pathname;
const { delivered, vanilla } = l25Sets(root);
const atlas = mountedRecordsOf(delivered);
const SRC = ['button', 'rope', 'fallrock', 'fallrocklarge', 'wand', 'pull'];
const out = [];
let apTotal = 0;
for (const [level, rec] of atlas) { const L = { level, entities: rec.entities };
  const ents = L.entities ?? [];
  const aps = ents.filter((e) => e.type === 'apitem');
  apTotal += aps.length;
  const srcs = ents.filter((e) => SRC.includes(e.type));
  if (!srcs.some((e) => e.type.startsWith('fallrock'))) continue;
  out.push({ level: L.level, sources: srcs.map((e) => `${e.type}@${e.x},${e.y}${e.attrs?.tset !== undefined ? ` tset ${e.attrs.tset}` : ''}`),
    apitems: aps.map((a) => ({ at: `${a.x},${a.y}`, tag: a.attrs?.tag, look: a.attrs?.look,
      nearest: srcs.filter((s) => !s.type.startsWith('fallrock')).map((s) => [`${s.type}@${s.x},${s.y}`, Math.round(Math.hypot(a.x - s.x, a.y - s.y))]) })),
    specials: ents.filter((e) => ['sword','feather','ghostspear','ghostsword','darkshield','darksuit','conch','shield','torchpickup','fire','bosskey','totempart','health','seed','wand','chest'].includes(e.type)).map((e) => `${e.type}@${e.x},${e.y}`) });
}
console.log(JSON.stringify({ apitemsInDeliveredSet: apTotal, levels: atlas.size, rockRooms: out }, null, 1));
