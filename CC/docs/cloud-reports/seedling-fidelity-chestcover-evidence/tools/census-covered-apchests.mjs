// Census: on the delivered set (p4h capabilities), every AP chest and every activator (responder) whose box overlaps
// it; the same over the vanilla atlas (vanilla `Chest`s, for contrast). usage: node census-covered-apchests.mjs
import { readFileSync } from 'node:fs';
import { apChestRecord, buildLevelWorld, rectsOverlap } from '../../../../../frontend/modules/seedlingDemo/levelWorld.js';
import { atlasLevelSource } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { l25Sets } from '../../../../../frontend/modules/seedlingDemo/fidelityL25ApItem.js';
const ROOT = new URL('../../../../../', import.meta.url).pathname;
const caps = JSON.parse(readFileSync(ROOT + 'frontend/modules/flashPanel/wasm/builds.json', 'utf8'))
    .builds.find((b) => b.name === 'seedling_bot_ap_p4h').capabilities;
const sets = [['delivered (p4h)', l25Sets(ROOT).deliveredSource, caps], ['vanilla atlas', atlasLevelSource(), null]];
for (const [label, src, c] of sets) {
    let chests = 0; const covered = [];
    for (let n = 0; n <= 200; n++) {
        let rec; try { rec = src(n); } catch { continue; }
        if (!rec?.entities) continue;
        const w = buildLevelWorld(c ? apChestRecord(rec, c) : rec);
        for (const ch of w.chests ?? []) {
            chests++;
            const box = { x: ch.x, y: ch.y, right: ch.x + 16, bottom: ch.y + 16 };
            const over = (w.activators ?? []).filter((a) => rectsOverlap(a.rect, box)).map((a) => a.id);
            if (over.length) covered.push(`L${n} ${ch.id}${ch.apChest ? ' (APChest)' : ''} under ${over.join(', ')}`);
        }
    }
    console.log(`${label}: chests ${chests}; with a responder over them: ${covered.length}`);
    for (const l of covered) console.log('  ' + l);
}
