import { readFileSync } from 'node:fs';
const ROOT = '/home/user/Archipelago-CC'; const M = (p) => import(ROOT + '/frontend/modules/seedlingDemo/' + p);
const { parseTape, heldKeysAt } = await M('tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await M('tapeRunner.js');
const { withContactFidelity } = await M('contactFidelity.js');
const { l25Sets } = await M('fidelityL25ApItem.js');
const SETS = l25Sets(ROOT);
const tape = parseTape(readFileSync(ROOT + '/frontend/modules/seedlingDemo/fixtures/bobiframe-witness/l40-chest-l39-s5222-default.tape.json', 'utf8'));
for (const walls of [false, true]) withContactFidelity({ chaserSpinnerWalls: walls }, () => {
  const t0 = Date.now();
  const run = createRunForStaging(stagingFromTape(tape), SETS.deliveredSource);
  for (let t = 0; t < tape.tick_count; t += 1) run.advance(new Set(heldKeysAt(tape, t)));
  console.log(walls ? 'ON' : 'OFF', Date.now() - t0, 'ms', JSON.stringify(run.chaserPressHits.filter((h) => h.id === 'bob@736,752').map((h) => [h.t, h.landed, h.killed, h.hits, h.hitsTimer, (h.why ?? '').slice(0, 12)])));
  console.log(JSON.stringify(run.playerHits.map((h) => [h.t, h.source, h.id])), JSON.stringify(run.ledger('playerDeaths')).slice(0, 200));
});
