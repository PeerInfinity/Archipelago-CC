// MEASUREMENT ONLY: replay a committed-format tape through the model (`createTapeStepper`) and print its burns, Fire
// presses, player hits, deaths and final level. Usage: node tape-burns.mjs <tape.json>
import { readFileSync } from 'node:fs';
const D = (process.env.SLOT_ROOT ?? '/home/user/Archipelago-CC') + '/frontend/modules/seedlingDemo/';
const { parseTape } = await import(D + 'tapeFormat.js');
const { createTapeStepper } = await import(D + 'tapeRunner.js');
const { atlasLevelSource } = await import(D + 'levelSource.js');
let run = null;
const st = createTapeStepper(parseTape(readFileSync(process.argv[2], 'utf8')),
    { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
let err = null;
try { for (let r = st.next(); !r.done; r = st.next()); } catch (e) { err = e.message.slice(0, 300); }
console.log(JSON.stringify({ tape: process.argv[2].split('/').pop(), t: run.ticksCompleted, level: run.level, err,
    treeBurns: run.ledger('treeBurns'), firePresses: [...new Set(run.ledger('presses').filter((p) => p.weapon === 'fire').map((p) => p.t))],
    playerHits: run.ledger('playerHits').length, deaths: run.ledger('playerDeaths').length }));
