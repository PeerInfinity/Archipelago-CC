import { atlasLevelSource } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { createLevelRun } from '../../../../../frontend/modules/seedlingDemo/levelRun.js';
import { withContactFidelity } from '../../../../../frontend/modules/seedlingDemo/contactFidelity.js';
const src = atlasLevelSource();
const [L, x, y, key, n, on] = process.argv.slice(2);
const go = () => {
  const run = createLevelRun({ levelSource: src, boot: { level: +L, x: +x, y: +y }, grants: [{ level: +L, items: ['darksuit', ...Array(+(process.env.HEALTH ?? 0)).fill('health')] }],
    pins: ['sound', 'dead_frames'], roles: ['blocking','trigger','pickup','proximity-hazard','combat'] });
  try {
    for (let k = 0; k < +n; k++) { run.advance(new Set(k === 0 ? [] : [key])); }
  } catch (e) { console.log('THROW', e.message.slice(0, 900)); }
  console.log(JSON.stringify(run.ledger('playerHits')), JSON.stringify(run.ledger('staticBodyDeaths')), run.level, run.state?.x ?? '', run.state?.y ?? '');
};
withContactFidelity({ darkSuitStaticRetaliation: on === '1' }, go);
