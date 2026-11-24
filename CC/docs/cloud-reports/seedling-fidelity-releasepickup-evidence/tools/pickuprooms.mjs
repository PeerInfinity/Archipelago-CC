// The release-pickup census (wave 56): every atlas rock room with its rocks, its sources and EVERY pickup in it
// (position, tset/tag, keyType/totempart), and every beam-tower room with its special pickups.
// Usage: node tools/pickuprooms.mjs > d1/pickuprooms.json
import { loadAtlas } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
const PICKUPS = ['bosskey','totempart','conch','darkshield','darksuit','feather','firewand','ghostspear','ghostsword','health','shield','sword','torchpickup','wand','seed','apitem','fire','coin','stick','sealpiece'];
const out = { rocks: [], towers: [] };
const fmt = (e) => `${String(e.type).toLowerCase()}@${e.x},${e.y}${e.attrs && Object.keys(e.attrs).length ? ' ' + JSON.stringify(e.attrs) : ''}`;
for (const L of loadAtlas().levels) {
  const es = L.entities ?? []; const n = (e) => String(e.type).toLowerCase();
  const types = new Set(es.map(n));
  const pick = es.filter((e) => PICKUPS.includes(n(e))).map(fmt);
  if (types.has('beamtower')) out.towers.push({ level: L.level, towers: es.filter((e) => n(e) === 'beamtower').map(fmt), pickups: pick });
  if (!types.has('fallrock') && !types.has('fallrocklarge')) continue;
  out.rocks.push({ level: L.level,
    rocks: es.filter((e) => ['fallrock','fallrocklarge'].includes(n(e))).map(fmt),
    sources: es.filter((e) => ['button','rope','wand','buttonroom'].includes(n(e)) || n(e).startsWith('rope')).map(fmt),
    pickups: pick });
}
console.log(JSON.stringify(out, null, 1));
