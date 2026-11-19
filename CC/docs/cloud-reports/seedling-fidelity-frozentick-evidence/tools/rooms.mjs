// The room census for the frozen-tick slice: every atlas level holding a chaser or a pushable block, with every freeze source in it (texted/text-less NPCs, special pickups, rocks, ropes, buttons, chests, the Lights/Owl/arena/door/moonrock controllers). Usage: node tools/rooms.mjs > d1/rooms.json
import { loadAtlas } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { PLACED_NPC_TALK } from '../../../../../frontend/modules/seedlingDemo/dialogue.js';
const a = loadAtlas();
const CH = ['bob','bobsoldier','puncher','jellyfish','lavarunner','bulb','flyer'];
const PU = ['pushableblock','pushableblockfire','pushableblockspear'];
const NPC = new Set([...Object.keys(PLACED_NPC_TALK),'watcher']);
const SPECIAL = ['bosskey','totempart','conch','darkshield','darksuit','feather','firewand','ghostspear','ghostsword','health','shield','sword','torchpickup','wand','seed'];
const OTHER = ['lightbosscontroller','fallrock','fallrocklarge','finaldoor','moonrock','finalboss','chest','lavaboss','button','rope','burnabletree','opentree','treelarge'];
const out = [];
for (const L of a.levels) {
  const es = L.entities ?? []; const n = (e)=>String(e.type).toLowerCase();
  const ch = es.filter(e=>CH.includes(n(e))).map(e=>`${n(e)}@${e.x},${e.y}`);
  const pu = es.filter(e=>PU.includes(n(e))).map(e=>`${n(e)}@${e.x},${e.y}`);
  if (!ch.length && !pu.length) continue;
  const src = [];
  for (const e of es) {
    const t=n(e);
    if (NPC.has(t)) { const tx=(e.attrs?.text??'')+(e.attrs?.text1??''); src.push(`${t}@${e.x},${e.y}${tx?'(texted)':'(text-less)'}`); }
    else if (SPECIAL.includes(t)) src.push(`${t}@${e.x},${e.y}`);
    else if (OTHER.includes(t)) src.push(`${t}@${e.x},${e.y}`);
  }
  out.push({ level: L.level, chasers: ch, pushables: pu, sources: src });
}
console.log(JSON.stringify(out));
