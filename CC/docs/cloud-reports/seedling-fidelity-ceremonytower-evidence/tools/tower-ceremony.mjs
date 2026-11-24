// The beam tower's trace rows per tick around a TEXTED pickup (L29, `beamtower@112,40` + a feather underfoot at boot):
// T, the ceremony's later (dialogue) ticks, and — tapping the talk key (press, release) until the dialogue closes —
// the finishing tick and two live ticks after it. Usage: node tools/tower-ceremony.mjs '<json overrides>'
// (wave 53's tool, extended to the closing frame.) Each cell: tN<F|-><C if the ceremony finished on it>:[frozen,…].
import { loadAtlas } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { levelSourceFromAtlas } from '../../../../../frontend/modules/seedlingDemo/atlasSource.js';
import { withContactFidelity } from '../../../../../frontend/modules/seedlingDemo/contactFidelity.js';
import { createLevelRun } from '../../../../../frontend/modules/seedlingDemo/levelRun.js';
const atlas = structuredClone(loadAtlas());
const L = atlas.levels.find((l) => l.level === 29);
L.entities = L.entities.concat([{ type: 'beamtower', x: 112, y: 40, attrs: { direction: '0', rate: '1', speed: '1' } },
    { type: 'feather', x: 144, y: 48, attrs: { tag: '5' } }]);
const TALK = process.argv[3] ?? 'primary';
withContactFidelity(JSON.parse(process.argv[2] ?? '{}'), () => {
    const run = createLevelRun({ levelSource: levelSourceFromAtlas(atlas), boot: { level: 29, x: 144, y: 48 },
        roles: ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'], pins: ['sound', 'dead_frames'] });
    const rows = [];
    let after = -1;
    for (let k = 0; k < 4000 && after < 2; k += 1) {
        const keys = k > 8 && k % 2 === 1 ? new Set([TALK]) : new Set();
        const before = run.collected.length;
        const a = run.advance(keys);
        const closed = run.collected.length > before;
        if (closed) after = 0; else if (after >= 0) after += 1;
        const cell = `t${k + 1}${a.frozen ? 'F' : '-'}${closed ? 'C' : ''}:[${run.beamTowerTrace.filter((r) => r.t === k + 1).map((r) => r.frozen).join(',')}]`;
        if (k < 6 || after >= 0) rows.push(cell); else if (rows.at(-1) !== '…') rows.push('…');
    }
    console.log(JSON.stringify(run.ceremonyStarts.map((s) => [s.t, s.tag])), rows.join(' '));
});
