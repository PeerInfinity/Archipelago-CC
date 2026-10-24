import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape, heldKeysAt } = await import(R + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await import(R + 'tapeRunner.js');
const { atlasLevelSource } = await import(R + 'levelSource.js');
const tape = parseTape(readFileSync(process.argv[2], 'utf8')); const PT = process.argv[3];
const run = createRunForStaging(stagingFromTape(tape), atlasLevelSource());
let n = 0; const out = [];
for (let t = 0; t < tape.tick_count; t += 1) {
  run.advance(new Set(heldKeysAt(tape, t)));
  const T = run.ticksCompleted; const c = run.entities('chasers').find((x) => x.id === PT);
  const inSB = run.entities('strikeBodies').some((x) => x.id === PT);
  const k = (run.presses ?? []).slice(n).filter((q) => q.hits.some((h) => h.id === PT && h.killed)); n = (run.presses ?? []).length;
  if (k.length || [101, 102, 132, 133, 143, 144].includes(T)) out.push([T, inSB, c ? [c.hits, c.hitsTimer, c.dying, c.destroy, +c.alpha.toFixed(2)] : null, k.map((q) => [q.t, q.fired, q.weapon])]);
}
console.log(JSON.stringify(out)); console.log('hits', JSON.stringify(run.ledger('playerHits').map((h) => h.t + ':' + h.id)));
