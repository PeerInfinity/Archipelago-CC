import { readFileSync } from 'node:fs';
const D = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { levelSourceFromAtlas } = await import(D + 'atlasSource.js');
const { contactRect } = await import(D + 'combat.js');
const { wallFlyerRect } = await import(D + 'wallFlyer.js');
const { patchedMapDocument } = await import(D + 'seedlingSetPatches.js');
const { parseTape } = await import(D + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(D + 'tapeRunner.js');
const SOURCE = levelSourceFromAtlas(patchedMapDocument(JSON.parse(readFileSync(D + '../flashPanel/atlases/seedling-map.json', 'utf8'))));
const STAGING = solveStaging(stagingFromTape(parseTape(readFileSync(D + 'fixtures/wallflyer-drill-kill/survey-step-35-boot.json', 'utf8'))));
const PLAN = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const run = createRunForStaging(STAGING, SOURCE);
const flyers = run.worldFor(22).combat.enemies.filter((e) => e.tag === 'wallflyer');
const r = (b) => `[${b.x},${b.y} ${b.w}x${b.h}]`;
let prev = '';
for (let t = 0; t <= 538; t += 1) {
  if (run.level !== 22) { console.log('left L22 at', t); break; }
  const line = run.entities('wallFlyerBodies').map((w) => { const e = flyers.find((f) => `${f.tag}@${f.x},${f.y}` === w.id);
    return `${w.id} live${r(wallFlyerRect(w))} v(${w.vx.toFixed(1)},${w.vy.toFixed(1)}) placement${r(contactRect(e))}`; }).join(' | ');
  if (line !== prev) { console.log(t, line); prev = line; }
  run.advance(new Set(PLAN.keys[t] ? PLAN.keys[t].split('+') : []));
}
