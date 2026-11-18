// trace the runner (model) for one spot and one landing/input: node trace.mjs x y L74|L72 key ticks
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const R = new URL('../../../../../', import.meta.url).pathname;
const M = (p) => import(join(R, 'frontend/modules/seedlingDemo', p));
const { SEEDLING_SET_PATCHES, patchedMapDocument } = await M('seedlingSetPatches.js');
const { levelSourceFromAtlas } = await M('atlasSource.js');
const { createRunForStaging } = await M('tapeRunner.js');
const { arrivalStaging } = await M('fidelityArrival.js');
const { moveRow } = await import('./move-search.mjs');
const MAP = JSON.parse(readFileSync(join(R, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const [x, y, which, key, ticks] = process.argv.slice(2);
const doc = patchedMapDocument(MAP, [...SEEDLING_SET_PATCHES.filter((p) => p.id !== 'l73-lavarunner-moved'), moveRow(+x, +y)]);
const boot = which === 'L74' ? { level: 73, x: 64, y: 16 } : { level: 73, x: 32, y: 128 };
const run = createRunForStaging(JSON.parse(JSON.stringify(arrivalStaging(boot, {}))), levelSourceFromAtlas(doc), { scratchPersistence: true });
for (let t = 0; t < +(ticks ?? 60); t++) {
  run.advance(new Set(key && key !== 'idle' ? [key] : []));
  const ch = (run.chasers ?? []).filter((b) => !b.destroy).map((b) => `${b.id}(${b.x.toFixed(1)},${b.y.toFixed(1)})`).join(' ');
  if (t % 5 === 0 || t < 5) console.log(t + 1, run.level, run.state.x.toFixed(1), run.state.y.toFixed(1), 'hits', run.playerHits.length, ch);
}
