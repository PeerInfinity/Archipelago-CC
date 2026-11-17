import { readFileSync } from 'node:fs';
const D = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { levelSourceFromAtlas } = await import(D + 'atlasSource.js');
const { contactRect } = await import(D + 'combat.js');
const { staticEnemyDanger } = await import(D + 'dangerMap.js');
const { withContactFidelity } = await import(D + 'contactFidelity.js');
const { patchedMapDocument } = await import(D + 'seedlingSetPatches.js');
const { parseTape } = await import(D + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(D + 'tapeRunner.js');
const SOURCE = levelSourceFromAtlas(patchedMapDocument(JSON.parse(readFileSync(D + '../flashPanel/atlases/seedling-map.json', 'utf8'))));
const STAGING = solveStaging(stagingFromTape(parseTape(readFileSync(D + 'fixtures/wallflyer-drill-kill/survey-step-35-boot.json', 'utf8'))));
const PLAN = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const run = createRunForStaging(STAGING, SOURCE);
const flyers = run.worldFor(22).combat.enemies.filter((e) => e.tag === 'wallflyer');
const id = (e) => `${e.tag}@${e.x},${e.y}`;
const priced = (on) => withContactFidelity({ wallFlyerCorpseGone: on }, () => flyers.filter((e) => staticEnemyDanger(run, contactRect(e)).some((d) => d.id === id(e))).map(id));
let prev = '';
for (let t = 0; t <= 432; t += 1) {
  const fam = run.entities('wallFlyerBodies').map((w) => `${w.id}${w.dieAnim ? '[die]' : ''}${w.destroy ? '[destroy]' : ''}`).join(' ');
  const line = `${fam} | OFF ${priced(false).length} ON ${priced(true).join(',')}`;
  if (line !== prev) { console.log(t, line); prev = line; }
  if (t < 432) run.advance(new Set(PLAN.keys[t] ? PLAN.keys[t].split('+') : []));
}
console.log('level', run.level, 'hits', JSON.stringify(run.ledger('playerHits')));
