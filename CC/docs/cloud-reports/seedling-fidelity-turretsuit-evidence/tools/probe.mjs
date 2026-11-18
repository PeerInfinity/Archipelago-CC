// Stage a turret room with (or without) the suit; print hits, spits and turret anims per tick, OFF vs ON.
// usage: node probe.mjs <level> <x> <y> <key> <ticks> <health> <suit 0|1> [idle]
import { withContactFidelity } from '../../../../../frontend/modules/seedlingDemo/contactFidelity.js';
import { atlasLevelSource } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { createLevelRun } from '../../../../../frontend/modules/seedlingDemo/levelRun.js';

const [level, x, y, key, ticks, health, suit, idle = '0'] = process.argv.slice(2);
const levelSource = atlasLevelSource();
const ROLES = ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'];
function stage(on) {
    return withContactFidelity({ turretSuitRetaliation: on }, () => {
        const L = Number(level);
        const run = createLevelRun({
            levelSource, boot: { level: L, x: Number(x), y: Number(y) }, pins: ['sound', 'dead_frames'], roles: ROLES,
            grants: [{ level: L, items: [...(suit === '1' ? ['darksuit'] : []), ...Array(Number(health)).fill('health')] }],
        });
        let thrown = null;
        try {
            for (let k = 0; k < Number(ticks); k += 1) {
                run.advance(new Set(k < Number(idle) + 1 ? [] : key.split('+')));
            }
        } catch (e) { thrown = e.message; }
        return { thrown, hits: run.ledger('playerHits'), spits: run.ledger('spitEvents').filter((s) => s.what === 'spawn'),
            suppressed: run.contactsSuppressed, kills: run.ledger('turretKills'), deaths: run.ledger('staticBodyDeaths') };
    });
}
const out = { off: stage(false), on: stage(true) };
console.log(JSON.stringify(out, null, 1));
