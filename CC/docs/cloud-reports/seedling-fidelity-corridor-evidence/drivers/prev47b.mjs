import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO || '/home/user/Archipelago-CC';
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
const { withContactFidelity } = await M('contactFidelity.js');
const sb = await M('solverBot.js');
const { parseTape } = await M('tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await M('tapeRunner.js');
const { patchedMapDocument } = await M('seedlingSetPatches.js');
const { levelSourceFromAtlas } = await M('atlasSource.js');
const W = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const MAP = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const staging = solveStaging(stagingFromTape(parseTape(JSON.stringify(W.tape))));
const src = levelSourceFromAtlas(patchedMapDocument(MAP));
const mk = (on) => { const probes = []; globalThis.__DBG_CORRIDOR_PROBE = (wps, walk, hit) => probes.push({ wps, walk, hit });
  let out = null; try { out = withContactFidelity({ corridorBodyPricing: on }, () => sb.solveSegment({
    run: createRunForStaging(staging, src), goals: W.goals, name: 'fc', boot: staging.boot,
    forkRun: () => createRunForStaging(staging, src) })); } catch (e) { out = { err: e.message.slice(0, 100) }; }
  globalThis.__DBG_CORRIDOR_PROBE = null; return { out, probes }; };
const OFF = mk(false); const ON = mk(true);
const key = (p) => JSON.stringify(p.wps);
console.log('OFF probes', OFF.probes.map((p) => `${key(p)} hit=${p.hit ? p.hit.tick + ':' + p.hit.sources.map((s) => s.id) : '-'} n=${p.walk.samples.length}`));
console.log('ON probes', ON.probes.slice(0, 4).map((p) => `${key(p)} hit=${p.hit ? p.hit.tick + ':' + p.hit.sources.map((s) => s.id) : '-'} n=${p.walk.samples.length}`));
const offClean = OFF.probes.find((p) => !p.hit);
const onSame = ON.probes.find((p) => key(p) === key(offClean));
if (onSame) {
  let firstHeld = null; let firstPos = null;
  for (let i = 0; i < Math.min(offClean.walk.samples.length, onSame.walk.samples.length); i += 1) {
    const a = offClean.walk.samples[i]; const b = onSame.walk.samples[i];
    if (firstPos === null && (a.x !== b.x || a.y !== b.y)) firstPos = { i, off: [a.x, a.y], on: [b.x, b.y] };
  }
  const drv = OFF.out.perTick; let fh = null;
  for (let i = 0; i < Math.min(drv.length, onSame.walk.samples.length); i += 1) {
    const h = [...drv[i]].sort().join('+'); const ph = [...(onSame.walk.samples[i].held ?? [])].sort().join('+');
    if (fh === null && h !== ph) fh = { i, drive: h, onPreview: ph, offPreview: [...(offClean.walk.samples[i]?.held ?? [])].sort().join('+') };
  }
  console.log(JSON.stringify({ firstPos, fh, hit: onSame.hit && { tick: onSame.hit.tick, x: onSame.hit.x, y: onSame.hit.y } }));
}
