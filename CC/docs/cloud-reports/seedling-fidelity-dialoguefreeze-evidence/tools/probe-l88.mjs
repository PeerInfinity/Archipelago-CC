// L88: boot beside `introchar@56,104`, release X to open its dialogue, keep releasing X every `gap` ticks until it
// closes; print per tick the run's `frozen`, the drill's (x, y, anim) and the talker ledger. Usage:
//   node tools/probe-l88.mjs [on|off] [gap] [ticks]
import { atlasLevelSource } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { withContactFidelity } from '../../../../../frontend/modules/seedlingDemo/contactFidelity.js';
import { createLevelRun } from '../../../../../frontend/modules/seedlingDemo/levelRun.js';
const [mode = 'off', gapS = '8', ticksS = '200'] = process.argv.slice(2);
const KEY = 'dialogueFrameFreeze';
const gap = Number(gapS);
const ROLES = ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'];
withContactFidelity(mode === 'on' ? { [KEY]: true } : {}, () => {
    const run = createLevelRun({ levelSource: atlasLevelSource(), boot: { level: 88, x: 56, y: 112 }, roles: ROLES });
    const rows = [];
    for (let k = 0; k < Number(ticksS); k += 1) {
        // press on odd multiples so each press is released the next tick
        const press = k >= 1 && (k - 1) % gap === 0;
        let a;
        try { a = run.advance(new Set(press ? ['primary'] : [])); } catch (e) { console.log('THROW', k, e.message); break; }
        rows.push([k, press ? 'X' : '.', a.frozen === true ? 'F' : '-',
            ...run.drills.bodies.map((d) => `${d.x},${d.y},${d.anim}`)].join(' '));
    }
    console.log(rows.join('\n'));
    console.log('talks', JSON.stringify(run.talkerTalks ?? run.ledger?.('talkerTalks')));
});
