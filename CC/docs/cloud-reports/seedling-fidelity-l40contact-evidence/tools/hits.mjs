import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape, heldKeysAt } = await import(R + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await import(R + 'tapeRunner.js');
const { atlasLevelSource } = await import(R + 'levelSource.js');
const tape = parseTape(readFileSync(process.argv[2], 'utf8'));
const run = createRunForStaging(stagingFromTape(tape), atlasLevelSource());
for (let t = 0; t < tape.tick_count; t += 1) run.advance(new Set(heldKeysAt(tape, t)));
console.log(JSON.stringify(run.ledger('playerHits').map((h) => [h.t, h.source, h.id, h.knockback ? [+(h.knockback.dx ?? 0).toFixed(2), +(h.knockback.dy ?? 0).toFixed(2)] : null])));
