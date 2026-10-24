// scratch (L40RES D1): spinner@192,144 — the forecast from tick T vs the run's actual at 1222; and when it was struck
import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { stagingFromTape, createRunForStaging } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { hammerHitsPlayer, SPINNER } = await import(M + 'spinner.js').catch(async () => await import(M + 'levelRun.js'));
const [tapeFile, planFile, target = '1222'] = process.argv.slice(2);
const tape = parseTape(readFileSync(tapeFile, 'utf8'));
const ticks = JSON.parse(readFileSync(planFile, 'utf8')).solution;
const TGT = +target;
const mk = () => createRunForStaging(stagingFromTape(tape), atlasLevelSource());
const run = mk();
const ID = 'spinner@192,144';
const at = new Map();
let lastHits = 0;
for (let t = 0; t < TGT; t++) {
  const b = (run.entities('spinnerBodies') ?? []).find((s) => s.id === ID);
  if (b && b.hits !== lastHits) { console.log('struck: before tick', t, 'hits', lastHits, '->', b.hits, 'at', b.x.toFixed(2), b.y.toFixed(2)); lastHits = b.hits; }
  if (t >= 1170) {
    const h = TGT - t;
    const fc = run.spinnerForecast(h)[h - 1];
    const idx = (run.entities('spinnerBodies') ?? []).findIndex((s) => s.id === ID);
    at.set(t, fc?.[idx] ? { x: fc[idx].x + 4, y: fc[idx].y + 4 } : null);
  }
  run.advance(new Set(ticks[t]));
}
const actual = (run.entities('spinnerBodies') ?? []).find((s) => s.id === ID);
console.log('actual at top of', TGT, actual.x.toFixed(3), actual.y.toFixed(3), 'gameTime', run.gameTimeAt?.(0));
for (const [t, p] of at) if (t % 4 === 0 || t > TGT - 8) console.log('forecast from', t, '->', p ? `${p.x.toFixed(3)},${p.y.toFixed(3)}` : null);
