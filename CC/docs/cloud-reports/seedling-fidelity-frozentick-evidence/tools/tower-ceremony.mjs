// The beam tower's trace rows per tick around a TEXTED pickup (L29, `beamtower@112,40` + a feather underfoot at boot):
// T and the ceremony's later (dialogue) frames. Usage: node tools/tower-ceremony.mjs '<json overrides>'
import { loadAtlas } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { levelSourceFromAtlas } from '../../../../../frontend/modules/seedlingDemo/atlasSource.js';
import { withContactFidelity } from '../../../../../frontend/modules/seedlingDemo/contactFidelity.js';
import { createLevelRun } from '../../../../../frontend/modules/seedlingDemo/levelRun.js';
const atlas = structuredClone(loadAtlas());
const L = atlas.levels.find((l) => l.level === 29);
L.entities = L.entities.concat([{ type: 'beamtower', x: 112, y: 40, attrs: { direction: '0', rate: '1', speed: '1' } },
    { type: 'feather', x: 144, y: 48, attrs: { tag: '5' } }]);
withContactFidelity(JSON.parse(process.argv[2] ?? '{}'), () => {
    const run = createLevelRun({ levelSource: levelSourceFromAtlas(atlas), boot: { level: 29, x: 144, y: 48 },
        roles: ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'], pins: ['sound', 'dead_frames'] });
    const rows = [];
    for (let k = 0; k < 8; k += 1) {
        const a = run.advance(new Set());
        rows.push(`t${k + 1}${a.frozen ? 'F' : '-'}:[${run.beamTowerTrace.filter((r) => r.t === k + 1).map((r) => r.frozen).join(',')}]`);
    }
    console.log(JSON.stringify(run.ceremonyStarts.map((s) => [s.t, s.tag])), rows.join(' '));
});
