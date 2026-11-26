// Census (wave 61, read-only): (1) every Chest with a responder (any `activators` row — RESPONDERS, TOUCH_ and KEY_
// responders) over its box, and (2) every activator group holding two re-publishing setters — the recursion shapes:
//   Button + Button, Button + RopeStart, RopeStart + RopeStart   (unconditional setters: hangs the first frame)
//   Button|RopeStart + ButtonRoom{room -1, flip 0}               (hangs once the group is published true)
//   ButtonRoom{-1, flip 0} + ButtonRoom{-1}                      (hangs once the first is pressed)
// (`Button.as:42-60`, `RopeStart.as:79-90`, `ButtonRoom.as:67-98`; a flip = 1 ButtonRoom publishes false back, which
// the other's setter does not re-publish from a ButtonRoom, and a cross-room ButtonRoom publishes nothing locally.)
// Over: the vanilla atlas, the playthrough's delivered set (p4g records), and every committed generated preset
// (`frontend/presets/seedling_generated_*`, `assembleGeneratedSeedlingSet`). usage: node census.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { buildLevelWorld, rectsOverlap } from '../../../../../frontend/modules/seedlingDemo/levelWorld.js';
import { atlasLevelSource } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { levelSourceFromAtlas } from '../../../../../frontend/modules/seedlingDemo/atlasSource.js';
import { mountedRecordsOf } from '../../../../../frontend/modules/seedlingDemo/wasmWalkTape.js';
import { l25Sets } from '../../../../../frontend/modules/seedlingDemo/fidelityL25ApItem.js';
import { assembleGeneratedSeedlingSet } from '../../../../../frontend/modules/seedlingDemo/seedlingGeneratedSet.js';
const ROOT = new URL('../../../../../', import.meta.url).pathname;
// POSITIVE CONTROLS: wave 60's first staging (the swapped Button beside `button@80,192`, both t 0: the room that hung
// the page), and the same room with the swapped one a `buttonroom {room -1, flip 0}` in group 0.
const V = atlasLevelSource();
const swap = (to) => (n) => { const r = V(n); return n !== 38 ? null : { ...r, entities: r.entities.map((e) => (e.type === 'buttonroom' && e.x === 144 && e.y === 128 ? to : e)) }; };
const sources = [['CONTROL wave 60 first staging (expect one of each)', swap({ type: 'button', x: 144, y: 128, attrs: { tset: '0' } })],
    ['CONTROL Button + ButtonRoom{-1, flip 0} (expect a recursion, no two Buttons)', swap({ type: 'buttonroom', x: 144, y: 128, attrs: { tset: '0', tag: '0', flip: '0', room: '-1' } })],
    ['CONTROL Button + ButtonRoom{-1, flip 1} (expect none)', swap({ type: 'buttonroom', x: 144, y: 128, attrs: { tset: '0', tag: '0', flip: '1', room: '-1' } })],
['vanilla atlas', atlasLevelSource()], ['delivered (playthrough AP_1, p4g)', l25Sets(ROOT).deliveredSource]];
for (const d of readdirSync(ROOT + 'frontend/presets').filter((n) => n.startsWith('seedling_generated_')).sort()) {
    for (const s of readdirSync(`${ROOT}frontend/presets/${d}`)) {
        const p = `${ROOT}frontend/presets/${d}/${s}/${s}_rules.json`;
        if (!existsSync(p)) continue;
        const set = assembleGeneratedSeedlingSet(JSON.parse(readFileSync(p, 'utf8')), { selfPlayer: 1 }).set;
        sources.push([`generated ${d}/${s} (${set.rooms.length} rooms)`, levelSourceFromAtlas(mountedRecordsOf(set))]);
    }
}
const PUB = (e) => (e.type === 'button' || e.type === 'rope') ? 'always'
    : (e.type === 'buttonroom' && Number(e.attrs?.room) === -1 ? (Number(e.attrs?.flip) ? 'true-flip1' : 'true') : null);
let grand = { chests: 0, covered: 0, buttons2: 0, loops: 0 };
for (const [label, src] of sources) {
    const control = label.startsWith('CONTROL');
    let chests = 0, levels = 0; const covered = []; const twoButtons = []; const loops = [];
    for (let n = 0; n <= 300; n++) {
        let rec; try { rec = src(n); } catch { continue; }
        if (!rec?.entities) continue;
        levels++;
        const w = buildLevelWorld(rec);
        for (const ch of w.chests ?? []) {
            chests++;
            const box = { x: ch.x, y: ch.y, right: ch.x + 16, bottom: ch.y + 16 };
            const over = (w.activators ?? []).filter((a) => rectsOverlap(a.rect, box)).map((a) => `${a.id} (t ${a.t})`);
            if (over.length) covered.push(`L${n} ${ch.id} under ${over.join(', ')}`);
        }
        const byT = new Map();
        for (const e of rec.entities) {
            const kind = PUB(e);
            if (!kind) continue;
            const t = Number(e.attrs?.tset);
            if (!byT.has(t)) byT.set(t, []);
            byT.get(t).push({ id: `${e.type}@${e.x},${e.y}`, type: e.type, kind });
        }
        for (const [t, ps] of byT) {
            const plain = ps.filter((p) => p.type === 'button');
            if (plain.length >= 2) twoButtons.push(`L${n} t ${t}: ${plain.map((p) => p.id).join(', ')}`);
            const always = ps.filter((p) => p.kind === 'always').length;
            const br0 = ps.filter((p) => p.kind === 'true').length;
            const br1 = ps.filter((p) => p.kind === 'true-flip1').length;
            if (always >= 2 || (always >= 1 && br0 >= 1) || (br0 >= 1 && br0 + br1 >= 2)) loops.push(`L${n} t ${t}: ${ps.map((p) => `${p.id}[${p.kind}]`).join(', ')}`);
        }
    }
    console.log(`${label}: levels ${levels}; chests ${chests}; with a responder over them ${covered.length}; groups with two plain Buttons ${twoButtons.length}; recursion shapes ${loops.length}`);
    for (const l of covered) console.log('  covered: ' + l);
    for (const l of twoButtons) console.log('  two Buttons: ' + l);
    for (const l of loops) console.log('  recursion: ' + l);
    if (!control) grand = { chests: grand.chests + chests, covered: grand.covered + covered.length, buttons2: grand.buttons2 + twoButtons.length, loops: grand.loops + loops.length };
}
console.log(`TOTAL ${JSON.stringify(grand)}`);
