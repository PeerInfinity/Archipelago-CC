// scratch: a staged tape at a level arrival (new Game(lv, x, y)), held keys "right*6,-*3"
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = '/home/user/Archipelago-CC';
const M = (p) => import(join(REPO, 'frontend/modules', p));
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const { createJsRuntime } = await M('seedlingDemo/jsRuntimeCore.js');
const { indexLevels } = await M('seedlingDemo/atlasSource.js');
const { buildStagedTape } = await M('seedlingDemo/botDriverV1.js');
const MAP = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const RECS = new Map(indexLevels(MAP));
const [lv, ax, ay] = arg('at', '16,112,48').split(',').map(Number);
const rt = createJsRuntime(); rt.setVanilla(RECS);
rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [lv, ax, ay] }]); rt.tick();
const plan = arg('keys', 'right*8').split(',').flatMap((s) => { const [k, n] = s.split('*'); return Array(Number(n ?? 1)).fill(k === '-' ? [] : k.split('+')); });
const tape = buildStagedTape({ staging: rt.session.staging, perTick: plan.map((k) => new Set(k)), name: arg('name', 'arrowlane') });
writeFileSync(arg('out'), typeof tape === 'string' ? tape : JSON.stringify(tape, null, 1));
console.log('wrote', arg('out'), plan.length, 'ticks');
