// Stage a family beside L88's `introchar@56,104` (talk circle around (64,112)), boot at (56,112), release X to open
// the dialogue and every `gap` ticks after to page it; per tick print frozen + the family's observable.
// Usage: node tools/stage.mjs <on|off> '<json entity list>' [ticks] [gap] [extraKeysJson]
import { loadAtlas } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { levelSourceFromAtlas } from '../../../../../frontend/modules/seedlingDemo/atlasSource.js';
import { withContactFidelity } from '../../../../../frontend/modules/seedlingDemo/contactFidelity.js';
import { createLevelRun } from '../../../../../frontend/modules/seedlingDemo/levelRun.js';
const [mode, ents, ticksS = '60', gapS = '8', extra = '{}'] = process.argv.slice(2);
const atlas = structuredClone(loadAtlas());
const L = atlas.levels.find((l) => l.level === 88);
L.entities = L.entities.filter((e) => e.type !== 'drill').concat(JSON.parse(ents));
const ROLES = ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'];
withContactFidelity({ dialogueFrameFreeze: mode === 'on', ...JSON.parse(extra) }, () => {
    const run = createLevelRun({ levelSource: levelSourceFromAtlas(atlas), boot: { level: 88, x: 56, y: 112 }, roles: ROLES,
        pins: ['sound', 'dead_frames'] });
    const gap = Number(gapS);
    for (let k = 0; k < Number(ticksS); k += 1) {
        const press = k >= 1 && (k - 1) % gap === 0;
        let a;
        try { a = run.advance(new Set(press ? ['primary'] : [])); } catch (e) { console.log('THROW', k, e.message); break; }
        const fam = [
            ...run.drills.bodies.map((d) => `D${d.x},${d.y},${d.anim}`),
            ...run.shooters.map((s) => `T${s.shootTimer},${s.anim}`),
            ...(run.iceTurrets ?? []).map((t) => `I${t.anim ?? ''}${t.volleyTimer ?? ''}`),
            ...run.beamTowerTrace.filter((r) => r.t === k + 1).map((r) => `B${r.frozen ? 'f' : 'u'}${r.y.toFixed(2)}`),
        ];
        console.log(k, press ? 'X' : '.', a.frozen === true ? 'F' : '-', state(run), fam.join(' '));
    }
    console.log('talks', JSON.stringify(run.talkerTalks), 'hits', JSON.stringify(run.ledger('playerHits').map((h) => [h.t, h.source])),
        'spawns', JSON.stringify(run.ledger('spitEvents').filter((s) => s.what === 'spawn').map((s) => s.t)),
        'volleys', JSON.stringify((run.volleys ?? []).map((v) => v.t)));
});
function state(run) { const s = run.state ?? {}; return `${(s.x ?? 0).toFixed?.(1)},${(s.y ?? 0).toFixed?.(1)}`; }
