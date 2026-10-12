// SCRATCH (g1): as div.mjs, with the page's delivered set as the level source (dump.json); also diff L40's records.
import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { createRunForStaging } = await import(R + 'tapeRunner.js');
const { atlasLevelSource } = await import(R + 'levelSource.js');
const { mountedRecordsOf } = await import(R + 'wasmWalkTape.js');
const { levelSourceFromAtlas } = await import(R + 'atlasSource.js');
const dump = JSON.parse(readFileSync('dump.json', 'utf8'));
const src = levelSourceFromAtlas(mountedRecordsOf(dump.deliveredSet));
const { staging, perTick } = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const trail = JSON.parse(readFileSync(process.argv[3], 'utf8'));
const run = createRunForStaging(staging, src);
let bad = null;
for (let t = 0; t < perTick.length; t += 1) {
  run.advance(new Set(perTick[t]));
  const [, x, y] = trail[t];
  if (bad === null && (Math.abs(x - run.state.x) > 1e-9 || Math.abs(y - run.state.y) > 1e-9)) bad = t;
}
console.log('delivered-set replay: first divergence', bad, 'landings', run.spinnerPressHits.filter((h) => h.landed).map((h) => [h.t, h.hits]), 'hits', run.playerHits.length);
const a = src.level?.(40) ?? src(40); const b = atlasLevelSource().level?.(40) ?? atlasLevelSource()(40);
const ents = (l) => JSON.stringify(l?.entities ?? l?.record?.entities ?? l);
console.log('L40 equal between sources:', ents(a) === ents(b), Object.keys(a ?? {}).slice(0, 12));
