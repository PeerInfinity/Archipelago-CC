// ROCKBUTTON W0 census (measure-only): every shipped level (the atlas, all levels) where a LANDED rock Solid — a
// `fallrock` (16x16 at its placement), a `fallrocklarge` (32x32) or a `moonrock` (48x48, its landed box) — overlaps a
// PRESSER's rect (`button` / `buttonroom`, the model's own `world.pressers` rects: `Button.as:22`, `ButtonRoom.as:32`)
// or an ACTIVATOR's cell (`world.activators[].rect`: the lock/cover occupancy arm, `Lock.returnToNormal` / `Cover.update`).
// It also lists every rock's group and what drops it (a rope / button / the wand / a boss rock) — the drop path decides
// whether `fallRockHoldsButton`'s span step runs (rope only).
//   node CC/docs/cloud-reports/seedling-fidelity-rockbutton-evidence/census-rock-solids.mjs
import { loadAtlas, atlasLevelSource } from '../../../../frontend/modules/seedlingDemo/levelSource.js';
import { indexLevels } from '../../../../frontend/modules/seedlingDemo/atlasSource.js';
import { createRunForStaging } from '../../../../frontend/modules/seedlingDemo/tapeRunner.js';
import { arrivalStaging } from '../../../../frontend/modules/seedlingDemo/fidelityArrival.js';

const idx = indexLevels(loadAtlas());
const run = createRunForStaging(arrivalStaging({ level: 28, x: 128, y: 288 }, { items: [], cleared: [] }), atlasLevelSource());
const SIZE = { fallrock: 16, fallrocklarge: 32, moonrock: 48 };
const ov = (a, b) => a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;
const rows = [];
const rocks = [];
const refused = [];
for (const [n, L] of idx) {
    const rs = (L.entities ?? []).filter((e) => SIZE[e.type]);
    if (rs.length === 0) continue;
    let w = null;
    try { w = run.worldFor(n); } catch (e) { refused.push(`L${n}: ${e.message.slice(0, 100)}`); }
    const droppers = (L.entities ?? []).filter((e) => ['rope', 'ropestart', 'button', 'buttonroom'].includes(e.type));
    for (const r of rs) {
        const s = SIZE[r.type];
        const rect = { x: r.x, y: r.y, right: r.x + s, bottom: r.y + s };
        const t = r.attrs?.tset ?? null;
        const by = droppers.filter((d) => (d.attrs?.tset ?? null) === t).map((d) => `${d.type}@${d.x},${d.y}`);
        rocks.push(`L${n} ${r.type}@${r.x},${r.y} tset ${t} tag ${r.attrs?.tag ?? '-'}${r.attrs?.bossrock === '1' ? ' bossrock' : ''}`
            + `${r.attrs?.thirdboss === '1' ? ' thirdboss' : ''} dropped by [${by.join(', ')}]`);
        if (!w) continue;
        for (const p of w.pressers ?? []) {
            if (ov(rect, p.rect)) rows.push(`PRESSER  L${n} ${r.type}@${r.x},${r.y} (tset ${t}) on ${p.tag}@${p.x},${p.y} (t ${p.t})`);
        }
        for (const a of w.activators ?? []) {
            if (a.rect && ov(rect, a.rect)) rows.push(`CELL     L${n} ${r.type}@${r.x},${r.y} (tset ${t}) in ${a.id} (t ${a.t})`);
        }
    }
}
console.log(`levels in the atlas: ${idx.size}; rock entities: ${rocks.length}`);
for (const r of rocks) console.log(`  ${r}`);
console.log(`\nOVERLAPS (${rows.length}):`);
for (const r of rows) console.log(`  ${r}`);
if (refused.length) console.log(`\nworlds refused (${refused.length}):\n  ${refused.join('\n  ')}`);
