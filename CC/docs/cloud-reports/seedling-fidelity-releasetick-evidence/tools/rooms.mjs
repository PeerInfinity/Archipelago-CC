// The room census for wave 55: (1) every atlas level holding a texted ceremony source (a placed special pickup whose
// ceremony text is non-empty — `PICKUP_CEREMONY`, `PICKUP_CEREMONY_BY_KEYTYPE`, a Seed's `.oel` text — or a runtime
// texted pickup: the Witch's DarkSword, the BobBoss's Fire, a Watcher's Seed) beside any of the four families (beam
// tower, ice turret, turret, drill); (2) every rope and the rocks in its activator group.
// Usage: node tools/rooms.mjs > d1/rooms.json
import { loadAtlas } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { PICKUP_CEREMONY, PICKUP_CEREMONY_BY_KEYTYPE } from '../../../../../frontend/modules/seedlingDemo/dialogue.js';
const a = loadAtlas();
const FAM = ['beamtower', 'iceturret', 'turret', 'drill'];
const lc = (e) => String(e.type).toLowerCase();
const textOf = (e) => {
    const t = lc(e);
    if (t === 'seed') return e.attrs?.text ?? '';
    const k = PICKUP_CEREMONY_BY_KEYTYPE[t]?.[e.attrs?.keyType ?? ''];
    if (k) return k.text;
    return PICKUP_CEREMONY[t]?.text ?? null; // null: not a special pickup
};
const RUNTIME = { witch: 'darksword (Witch)', watcher: 'seed (Watcher; a Seed keeps the flag up)' };
const texted = []; const ropes = [];
for (const L of a.levels) {
    const es = L.entities ?? [];
    const fam = es.filter((e) => FAM.includes(lc(e))).map((e) => `${lc(e)}@${e.x},${e.y}`);
    const sources = [];
    for (const e of es) {
        const tx = textOf(e);
        if (tx !== null) sources.push(`${lc(e)}@${e.x},${e.y}${tx ? ' (texted)' : ' (text-less)'}`);
        if (RUNTIME[lc(e)]) sources.push(`${RUNTIME[lc(e)]} @${e.x},${e.y} (runtime, texted)`);
    }
    if (L.level === 32) sources.push('fire (BobBoss, runtime, texted)');
    if (sources.length && fam.length) texted.push({ level: L.level, families: fam, sources,
        textedBeside: sources.filter((s) => s.includes('(texted)') || s.includes('runtime, texted')) });
    for (const r of es.filter((e) => lc(e) === 'rope')) {
        const t = r.attrs?.t;
        const rocks = es.filter((e) => ['fallrock', 'fallrocklarge'].includes(lc(e)) && e.attrs?.t === t).map((e) => `${lc(e)}@${e.x},${e.y}`);
        ropes.push({ level: L.level, rope: `rope@${r.x},${r.y}`, t, rocks });
    }
}
console.log(JSON.stringify({ textedCeremonyRooms: texted, ropes }, null, 1));
