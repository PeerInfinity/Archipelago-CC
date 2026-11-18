// The room census for the dialogue-freeze slice: every level holding a placed talker (dialogue.PLACED_NPC_TALK) or a
// watcher, with every OTHER entity in it, so the families that update AFTER the NPC (added before it in
// Game.loadlevel) can be read off. Usage: node tools/rooms.mjs > d1/rooms.json
import { loadAtlas } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { PLACED_NPC_TALK } from '../../../../../frontend/modules/seedlingDemo/dialogue.js';
const TALKERS = new Set([...Object.keys(PLACED_NPC_TALK), 'watcher']);
const FOUR = ['turret', 'iceturret', 'beamtower', 'drill'];
const a = loadAtlas();
const out = {};
for (const L of a.levels) {
    const ents = L.entities ?? [];
    const name = (e) => String(e.type ?? e.name ?? e.tag ?? '').toLowerCase();
    const npcs = ents.filter((e) => TALKERS.has(name(e))).map((e) => `${name(e)}@${e.x},${e.y}`);
    if (npcs.length === 0) continue;
    const counts = {};
    for (const e of ents) if (!TALKERS.has(name(e))) counts[name(e)] = (counts[name(e)] ?? 0) + 1;
    out[L.level] = { npcs, four: ents.filter((e) => FOUR.includes(name(e))).map((e) => `${name(e)}@${e.x},${e.y}`), others: counts };
}
console.log(JSON.stringify(out, null, 1));
