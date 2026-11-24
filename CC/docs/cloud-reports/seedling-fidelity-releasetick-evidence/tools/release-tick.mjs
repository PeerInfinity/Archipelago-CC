// The finishing tick of a TEXTED ceremony, per family, OFF vs ON (`freezeReleaseTick`): stage `.oel` rows into one
// atlas level, boot on the pickup, tap the talk key (press, release) until the dialogue closes, and print the closing
// tick C and the ticks after it: the tower's trace rows ([frozen…] per tick), the turrets' [shootTimer, anim], the
// drills' [x, y, anim], the ice turrets' volleys and the spit spawns, the hits.
// Usage: node tools/release-tick.mjs '<spec json>' ['<base overrides json>']
//   spec = {level, x, y, inject: [...], remove?: [types], after?: N, text?: bool}
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
function go(over) {
    return withContactFidelity(over, () => {
        const run = createLevelRun({ levelSource: src, boot: { level: spec.level, x: spec.x, y: spec.y },
            roles: ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'], pins: ['sound', 'dead_frames'] });
        const rows = []; let after = -1; let thrown = null; let closeT = null;
        try {
            for (let k = 0; k < 4000 && after < (spec.after ?? 12); k += 1) {
                const keys = k > 8 && k % 2 === 1 ? new Set(['primary']) : new Set();
                const before = run.collected.length;
                run.advance(keys);
                const closed = run.collected.length > before;
                if (closed) { after = 0; closeT = k + 1; } else if (after >= 0) after += 1;
                if (after >= 0) {
                    rows.push({ t: k + 1, close: closed,
                        beam: run.beamTowerTrace.filter((r) => r.t === k + 1).map((r) => r.frozen),
                        turrets: [...run.shooters.values()].map((s) => [s.id, s.shootTimer, s.anim]),
                        drills: run.drills.bodies.map((d) => [d.id, d.x, d.y, d.anim]) });
                }
            }
        } catch (e) { thrown = e.message.slice(0, 400); }
        const beams = run.beamTowerTrace.filter((r) => r.beam && closeT !== null && r.t > closeT).map((r) => r.t);
        return { thrown, closeT, rows, beams: beams.slice(0, 3), volleys: run.volleys.map((v) => v.t),
            spits: run.spitEvents.filter((e) => e.what === 'spawn').map((e) => [e.t, e.id]),
            hits: run.ledger('playerHits').map((h) => [h.t, h.source, h.id]),
            drillEvents: run.drills.events?.map?.((e) => [e.t, e.id, e.kind]) ?? null };
    });
}
const off = go({ ...base, freezeReleaseTick: false });
const on = go({ ...base, freezeReleaseTick: true });
for (const [name, r] of [['OFF', off], ['ON ', on]]) {
    console.log(name, JSON.stringify({ thrown: r.thrown, closeT: r.closeT, beams: r.beams, volleys: r.volleys.filter((t) => t >= (r.closeT ?? 0) - 1),
        spits: r.spits.filter(([t]) => t >= (r.closeT ?? 0) - 1), hits: r.hits, drillEvents: r.drillEvents?.filter(([t]) => t >= (r.closeT ?? 0) - 1) }));
}
const n = Math.max(off.rows.length, on.rows.length);
for (let i = 0; i < Math.min(n, spec.show ?? 4); i += 1) {
    const a = JSON.stringify(off.rows[i]); const b = JSON.stringify(on.rows[i]);
    console.log(a === b ? '  =' : '  ≠', 'OFF', a, a === b ? '' : `\n     ON  ${b}`);
}
console.log('whole result equal:', JSON.stringify(off) === JSON.stringify(on));
