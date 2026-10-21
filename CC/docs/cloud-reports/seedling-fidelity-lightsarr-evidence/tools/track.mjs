// track.mjs <tape.json> [from] [to] : the model's lights track around ticks
import { readFileSync } from 'node:fs';
const REPO = '/home/user/Archipelago-CC';
const { parseTape } = await import(`${REPO}/frontend/modules/seedlingDemo/tapeFormat.js`);
const { modelLightsTrack } = await import(`${REPO}/frontend/modules/seedlingDemo/lightBossWitness.js`);
const { atlasLevelSource } = await import(`${REPO}/frontend/modules/seedlingDemo/levelSource.js`);
const tape = parseTape(readFileSync(process.argv[2], 'utf8'));
const tr = modelLightsTrack(tape, { levelSource: atlasLevelSource() });
const a = Number(process.argv[3] ?? 0), b = Number(process.argv[4] ?? tr.length);
let lastHits = 0;
for (const m of tr) { if (!m) continue; if (m.hits !== lastHits) { console.log('HITS change t', m.t, m.hits, m.hitsTimer); lastHits = m.hits; } }
for (let t = a; t <= b && t < tr.length; t++) { const m = tr[t]; if (!m) continue;
  console.log(t, m.level, m.player.x.toFixed(3), m.player.y.toFixed(3), 'h', m.hits, 'npc', m.npc, 'F', m.fliers.map(f=>`${f.x.toFixed(2)},${f.y.toFixed(2)}`).join(' '), 'S', m.shots.map(s=>`${s.x.toFixed(1)},${s.y.toFixed(1)}`).join(' ')); }
