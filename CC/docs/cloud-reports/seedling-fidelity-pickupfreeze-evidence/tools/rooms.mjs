// The room census for the pickup-freeze slice: every level holding a family that updates AFTER a freeze-starting
// pickup/NPC and gates on `Game.freezeObjects` (turret, iceturret, beamtower, drill), with the freeze starters it holds.
import { loadAtlas } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
const FAMILIES = ['turret', 'iceturret', 'beamtower', 'drill'];
// `special = true` pickup classes (Pickups/*.as) by their .oel element name, plus apitem (APItem extends Pickup; see below).
const SPECIAL = ['sword', 'feather', 'ghostspear', 'ghostsword', 'darkshield', 'darksuit', 'conch', 'shield',
    'torchpickup', 'fire', 'bosskey', 'totempart', 'health', 'seed', 'wand', 'firewand', 'apitem'];
const NPCS = ['introchar', 'rekcahdam', 'forestchar', 'karlore', 'adnanchar', 'watcher', 'oracle', 'witch', 'hermit',
    'yeti', 'sensei', 'sign', 'totem', 'statue1', 'statue2', 'shieldboss', 'finalboss', 'bobboss1', 'bobboss2', 'bobboss3'];
const a = loadAtlas();
const out = {};
for (const L of a.levels) {
    const ents = [];
    for (const e of L.entities ?? []) ents.push(e);
    const name = (e) => String(e.type ?? e.name ?? e.tag ?? '').toLowerCase();
    const pick = (list) => ents.filter((e) => list.includes(name(e))).map((e) => `${name(e)}@${e.x},${e.y}`);
    const fam = pick(FAMILIES);
    if (fam.length === 0) continue;
    out[L.level] = { families: fam, special: pick(SPECIAL), npcs: pick(NPCS) };
}
console.log(JSON.stringify(out, null, 1));
