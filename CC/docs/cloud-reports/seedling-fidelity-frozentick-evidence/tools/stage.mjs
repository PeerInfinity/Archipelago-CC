// Stage bodies in a level (default L88 beside `introchar@56,104`, boot (56,112)); release X ('primary') on a schedule;
// (env HOLD='k:key+key;…' holds keys from tick index k on) per tick print frozen + every chaser's state + pushables. Usage:
//   node tools/stage.mjs <on|off> '<json entity list>' [ticks] [level] [x] [y] [schedule: gap|none|"k1,k2"] [extraKeysJson] [grantsJson]
import { loadAtlas } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { levelSourceFromAtlas } from '../../../../../frontend/modules/seedlingDemo/atlasSource.js';
import { withContactFidelity } from '../../../../../frontend/modules/seedlingDemo/contactFidelity.js';
import { createLevelRun } from '../../../../../frontend/modules/seedlingDemo/levelRun.js';
const [mode, ents, ticksS = '60', lvS = '88', xS = '56', yS = '112', sched = '8', extra = '{}', grants = '[]', keysS = 'primary'] = process.argv.slice(2);
const level = Number(lvS);
const atlas = structuredClone(loadAtlas());
const L = atlas.levels.find((l) => l.level === level);
L.entities = L.entities.filter((e) => !(level === 88 && e.type === 'drill')).concat(JSON.parse(ents));
const ROLES = ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'];
const press = sched === 'none' ? () => false : sched.includes(',') || /^\d+$/.test(sched) && sched.length > 2
    ? ((s) => (k) => s.has(k))(new Set(sched.split(',').map(Number)))
    : (k) => k >= 1 && k < 40 && (k - 1) % Number(sched) === 0;
withContactFidelity({ frozenTickUngated: mode === 'on', ...JSON.parse(extra) }, () => {
    const run = createLevelRun({ levelSource: levelSourceFromAtlas(atlas), boot: { level, x: Number(xS), y: Number(yS) }, roles: ROLES,
        pins: ['sound', 'dead_frames'], grants: JSON.parse(grants) });
    for (let k = 0; k < Number(ticksS); k += 1) {
        let a;
        const hold = (process.env.HOLD ?? '').split(';').filter(Boolean).map((h) => h.split(':')).filter(([from]) => k >= Number(from)).flatMap(([, ks]) => ks.split('+'));
        try { a = run.advance(new Set([...(press(k) ? keysS.split('+') : []), ...hold])); } catch (e) { console.log('THROW', k, e.message); break; }
        const ch = (run.entities('chasers') ?? []).map((c) => `${c.id}:${c.x.toFixed(2)},${c.y.toFixed(2)} v${c.vx.toFixed(2)},${c.vy.toFixed(2)} h${c.hits}/${c.hitsTimer}${c.removed ? ' R' : ''}${c.destroy ? ' D' : ''}${c.attack ? ' A' + JSON.stringify(c.attack).slice(0, 40) : ''}`);
        const pu = [...(run.entities('pushables') ?? new Map())].map(([id, b]) => `P${id}:${b.rect.x},${b.rect.y}`);
        console.log(k, press(k) ? 'X' : '.', a.frozen === true ? 'F' : '-', `${run.state.x.toFixed(2)},${run.state.y.toFixed(2)}`, [...ch, ...pu].join(' | '));
    }
    console.log('starts', JSON.stringify(run.ceremonyStarts.map((s) => [s.t, s.tag])), 'talks', JSON.stringify(run.talkerTalks?.map((t) => t.t)), 'hits', JSON.stringify(run.ledger('playerHits').map((h) => [h.t, h.source, h.id])),
        );
});
