// The beam tower through a special pickup's phase A (wave 56, gap 2): stage a tower and a pickup in one atlas level,
// boot on the pickup WITH a `Game.time` (`seam: {time}`), tap the talk key until the ceremony closes, and print the
// tower's trace rows (t, frozen, gameTime, y, anim/frame/direction, animKnown) around T and after the release.
// Usage: node tools/tower-phasea.mjs '<spec json>' ['<over json>']
//   spec = {level, x, y, inject: [...], remove?: [types], show?: N, time?: N, ticks?: N, idle?: bool}
import { loadAtlas } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { levelSourceFromAtlas } from '../../../../../frontend/modules/seedlingDemo/atlasSource.js';
import { withContactFidelity } from '../../../../../frontend/modules/seedlingDemo/contactFidelity.js';
import { createLevelRun } from '../../../../../frontend/modules/seedlingDemo/levelRun.js';
const spec = JSON.parse(process.argv[2]);
const over = JSON.parse(process.argv[3] ?? '{}');
const atlas = structuredClone(loadAtlas());
const L = atlas.levels.find((l) => l.level === spec.level);
L.entities = L.entities.filter((e) => !(spec.remove ?? []).includes(e.type)).concat(spec.inject ?? []);
const src = levelSourceFromAtlas(atlas);
const r = withContactFidelity(over, () => {
    const run = createLevelRun({ levelSource: src, boot: { level: spec.level, x: spec.x, y: spec.y },
        seam: spec.time === null ? null : { time: spec.time ?? 900 },
        roles: ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'], pins: ['sound', 'dead_frames'] });
    let thrown = null; const rows = [];
    try {
        for (let k = 0; k < (spec.ticks ?? 80); k += 1) {
            const walk = (spec.walk ?? []).filter(([a, b]) => k >= a && k < b).flatMap(([, , s]) => s.split(','));
            run.advance(new Set(walk.length > 0 ? walk : (!spec.idle && k > (spec.talkFrom ?? 8) && k % 2 === 1 ? ['primary'] : [])));
            const st = run.beamTowers ? [...run.beamTowers.values?.() ?? []] : null;
            const m = run.machinesNow;
            rows.push({ t: k + 1, collected: run.collected.length, p: [+run.state.x.toFixed(3), +run.state.y.toFixed(3)],
                towers: (m?.beamTowers ?? []).map((b) => [b.id, b.direction, b.anim, b.index, b.frame, b.animKnown, b.yKnown, +b.y.toFixed(4)]),
                trace: run.beamTowerTrace.filter((x) => x.t === k + 1).map((x) => [x.id, x.frozen, x.gameTime, +x.y.toFixed(4), x.beam ? 'BEAM' : '']) });
        }
    } catch (e) { thrown = e.message.slice(0, 500); }
    return { thrown, rows, starts: run.collected.map((c) => [c.t, c.tag ?? c.item]), hits: run.ledger('playerHits').map((h) => [h.t, h.source]) };
});
console.log(JSON.stringify({ thrown: r.thrown, starts: r.starts, hits: r.hits }));
for (const row of r.rows.slice(0, spec.show ?? 80)) console.log(JSON.stringify(row));
