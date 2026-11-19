// Stage a pickup touched beside a family that updates after it; print spits, turret/iceturret state and the ceremony,
// OFF vs ON. usage: node probe.mjs <level> <bootX> <bootY> <keys> <idle> <ticks> <inject JSON> [remove-type]
//   inject: [{"type":"bosskey","x":..,"y":..,"attrs":{"keyType":"1"}}]  (atlas entity rows, appended to the level)
import { withContactFidelity } from '../../../../../frontend/modules/seedlingDemo/contactFidelity.js';
import { loadAtlas } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { levelSourceFromAtlas } from '../../../../../frontend/modules/seedlingDemo/atlasSource.js';
import { createLevelRun } from '../../../../../frontend/modules/seedlingDemo/levelRun.js';

export function stagedSource(level, inject, removeTypes = []) {
    const atlas = structuredClone(loadAtlas());
    const L = atlas.levels.find((l) => l.level === level);
    L.entities = L.entities.filter((e) => !removeTypes.includes(e.type)).concat(inject);
    return levelSourceFromAtlas(atlas);
}
const ROLES = ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'];
export function stage({ level, x, y, keys, idle, ticks, inject, remove = [], on, over = {} }) {
    return withContactFidelity({ pickupTickFreeze: on, ...over }, () => {
        const run = createLevelRun({ levelSource: stagedSource(level, inject, remove), boot: { level, x, y },
            pins: ['sound', 'dead_frames'], roles: ROLES });
        let thrown = null;
        const trace = [];
        try {
            for (let k = 0; k < ticks; k += 1) {
                run.advance(new Set(k < idle ? [] : keys));
                const sh = run.shooters ?? null;
                trace.push({ t: k + 1, x: run.state?.x, y: run.state?.y,
                    sh: sh ? JSON.stringify(sh.map((s) => [s.shootTimer, s.anim, Math.round((s.angle ?? 0) * 1000) / 1000])) : null,
                    ice: JSON.stringify(run.turrets ?? null),
                    drill: JSON.stringify((run.drills?.bodies ?? []).map((d) => [d.x, d.y, d.anim, d.sprite])),
                    beam: JSON.stringify((run.beamTowerTrace ?? []).filter((r) => r.t === k + 1)) });
            }
        } catch (e) { thrown = e.message; }
        return { thrown, spits: run.ledger('spitEvents').filter((s) => s.what === 'spawn').map((s) => [s.t, s.id]),
            starts: run.ceremonyStarts, volleys: (run.volleys ?? []).map((v) => [v.t, v.id ?? v.turret]), hits: run.ledger('playerHits').map((h) => [h.t, h.source, h.id]),
            trace };
    });
}
if (process.argv[1] && process.argv[1].endsWith('probe.mjs')) {
    const [level, x, y, keys, idle, ticks, inject, remove = ''] = process.argv.slice(2);
    const a = { level: Number(level), x: Number(x), y: Number(y), keys: keys ? keys.split('+') : [], idle: Number(idle),
        ticks: Number(ticks), inject: JSON.parse(inject), remove: remove ? remove.split(',') : [] };
    const off = stage({ ...a, on: false });
    const on = stage({ ...a, on: true });
    const diff = off.trace.map((r, i) => (JSON.stringify(r) === JSON.stringify(on.trace[i]) ? null : { off: r, on: on.trace[i] })).filter(Boolean);
    console.log(JSON.stringify({ off: { ...off, trace: undefined }, on: { ...on, trace: undefined }, firstDiffs: diff.slice(0, 6) }, null, 1));
}
