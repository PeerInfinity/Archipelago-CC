// scratch: stage a level arrival (inv items from the sweep row), drive held keys on the MODEL run, print per tick
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO || '/home/user/Archipelago-CC';
const M = (p) => import(join(REPO, 'frontend/modules', p));
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const { createJsRuntime } = await M('seedlingDemo/jsRuntimeCore.js');
const { indexLevels, levelSourceFromAtlas } = await M('seedlingDemo/atlasSource.js');
const { createRunForStaging } = await M('seedlingDemo/tapeRunner.js');
const MAP = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const RECS = new Map(indexLevels(MAP));
const SRC = levelSourceFromAtlas(RECS);
const [lv, ax, ay] = arg('at', '16,112,48').split(',').map(Number);
const rt = createJsRuntime();
rt.setVanilla(RECS);
rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [lv, ax, ay] }]);
rt.tick();
const staging = rt.session.staging;
// keys: "right*20,down*5" ; '-' = none
const plan = arg('keys', 'right*30').split(',').flatMap((s) => { const [k, n] = s.split('*'); return Array(Number(n ?? 1)).fill(k === '-' ? [] : k.split('+')); });
const run = createRunForStaging(staging, SRC);
let h0 = 0;
for (let i = 0; i < plan.length; i += 1) {
  const o = run.advance(new Set(plan[i]));
  const s = run.state;
  const hits = run.ledger('playerHits') ?? [];
  const arrows = (run.entities('arrowsInFlight') ?? []).filter((a) => Math.abs(a.x - s.x) < 24 && Math.abs(a.y - s.y) < 24).map((a) => `${a.id}@${a.x},${a.y}`);
  console.log(`t${i + 1} [${plan[i].join('+') || '·'}] L${run.level} (${s.x.toFixed(3)},${s.y.toFixed(3)}) v(${s.vx.toFixed(2)},${s.vy.toFixed(2)}) hits=${hits.length}${hits.length > h0 ? ' HIT ' + JSON.stringify(hits.at(-1)) : ''} ${arrows.join(' ')}${o?.transition ? ' TRANSITION→' + o.transition.to_level : ''}`);
  h0 = hits.length;
  if (o?.transition) break;
}
