// A pickup under the player inside a rock's span (wave 56, gap 1): stage `.oel` rows into an atlas level, boot (or
// walk), and print what OFF and ON do: the ceremony starts and their ticks, the rock falls, the dead frames, the throw.
// Usage: node tools/rockspan-pickup.mjs '<spec json>' ['<base overrides json>']
//   spec = {level, x, y, inject: [...], remove?: [types], keys?: [[fromTick, toTick, 'key,key']], ticks?: N}
import { loadAtlas } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { levelSourceFromAtlas } from '../../../../../frontend/modules/seedlingDemo/atlasSource.js';
import { withContactFidelity } from '../../../../../frontend/modules/seedlingDemo/contactFidelity.js';
import { createLevelRun } from '../../../../../frontend/modules/seedlingDemo/levelRun.js';
const spec = JSON.parse(process.argv[2]);
const base = JSON.parse(process.argv[3] ?? '{}');
const atlas = structuredClone(loadAtlas());
const L = atlas.levels.find((l) => l.level === spec.level);
L.entities = L.entities.filter((e) => !(spec.remove ?? []).includes(e.type)).concat(spec.inject ?? []);
const src = levelSourceFromAtlas(atlas);
const keysAt = (k) => new Set((spec.keys ?? []).filter(([a, b]) => k >= a && k < b).flatMap(([, , s]) => s.split(',')));
function go(over) {
    return withContactFidelity(over, () => {
        const run = createLevelRun({ levelSource: src, boot: { level: spec.level, x: spec.x, y: spec.y },
            seam: { time: 900 }, roles: ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'],
            pins: ['sound', 'dead_frames'] });
        let thrown = null; const pos = [];
        try {
            for (let k = 0; k < (spec.ticks ?? 40); k += 1) {
                run.advance(keysAt(k));
                pos.push([k + 1, +run.state.x.toFixed(3), +run.state.y.toFixed(3)]);
            }
        } catch (e) { thrown = e.message.slice(0, 600); }
        return { thrown, starts: run.ceremonyStarts.map((c) => [c.t, c.tag]), collected: run.collected.map((c) => [c.t, c.item]), rockFalls: run.rockFalls ?? null,
            pos: pos.slice(spec.from ?? 0, (spec.from ?? 0) + (spec.n ?? 6)), deadFrames: run.deadFrames ?? null };
    });
}
const off = go({ ...base, freezeSpanUpdates: false });
const on = go({ ...base, freezeSpanUpdates: true });
console.log('OFF', JSON.stringify(off));
console.log('ON ', JSON.stringify(on));
console.log('whole result equal:', JSON.stringify(off) === JSON.stringify(on));
