// cmp.mjs <tape.json> <frames.json> [upto] : the model's lights track vs saved game samples
import { readFileSync } from 'node:fs';
const REPO = '/home/user/Archipelago-CC';
const { parseTape } = await import(`${REPO}/frontend/modules/seedlingDemo/tapeFormat.js`);
const { modelLightsTrack, compareLightsWitness } = await import(`${REPO}/frontend/modules/seedlingDemo/lightBossWitness.js`);
const { atlasLevelSource } = await import(`${REPO}/frontend/modules/seedlingDemo/levelSource.js`);
const tape = parseTape(readFileSync(process.argv[2], 'utf8'));
const samples = JSON.parse(readFileSync(process.argv[3], 'utf8')).samples;
const tr = modelLightsTrack(tape, { levelSource: atlasLevelSource() });
const v = compareLightsWitness(samples, tr, { upto: Number(process.argv[4] ?? Infinity) });
console.log(v.pass ? 'PASS' : 'FAIL', 'compared', v.compared, 'worst', v.worst, 'disagreements', v.disagreements.length);
for (const d of v.disagreements.slice(0, 8)) console.log('   ', d);
const hits = tr.filter(Boolean).filter((m, i, a) => i > 0 && m.hits !== a[i - 1].hits).map((m) => `t${m.t}:${m.hits}`);
console.log('model hits changes', hits.join(' '));
