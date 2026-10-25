// scratch (L40RES D1): plan json (req2tape) -> a staged tape + the model's own replay (hits)
import { readFileSync, writeFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { buildStagedTape } = await import(M + 'botDriverV1.js');
const { parseTape } = await import(M + 'tapeFormat.js');
const { runTape } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const [planFile, name, out] = process.argv.slice(2);
const d = JSON.parse(readFileSync(planFile, 'utf8'));
const staging = d.req.staging;
const perTick = d.solution.map((k) => new Set(k));
const tape = { ...buildStagedTape({ staging: { ...staging, inventory_slots: undefined }, perTick, name }), description: `scratch L40RES ${name}` };
writeFileSync(out, JSON.stringify(tape));
const res = runTape(parseTape(tape), { levelSource: atlasLevelSource() });
const t = res.ticks;
let prevHits = t[0]?.hits ?? 0;
for (let i = 0; i < t.length; i++) { const h = t[i].hits ?? 0; if (h !== prevHits) { console.log('model hits change at', i, prevHits, '->', h, t[i].x, t[i].y); prevHits = h; } }
console.log('ticks', t.length, 'last', t.at(-1)?.level, t.at(-1)?.x, t.at(-1)?.y, 'keys', Object.keys(t[0] ?? {}).join(','));
