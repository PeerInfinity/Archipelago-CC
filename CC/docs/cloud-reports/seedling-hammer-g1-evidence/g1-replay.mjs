// SCRATCH (g1): replay a g1-solve --tape (staging + perTick) on the model; print player hits, landings, removals.
import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { createRunForStaging } = await import(R + 'tapeRunner.js');
const { atlasLevelSource } = await import(R + 'levelSource.js');
const { staging, perTick } = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const run = createRunForStaging(staging, atlasLevelSource());
const upto = Number(process.argv[3] ?? perTick.length);
for (let t = 0; t < upto; t += 1) run.advance(new Set(perTick[t]));
console.log(JSON.stringify({ t: run.ticksCompleted, at: [run.state.x, run.state.y], hits: run.playerHits, deaths: run.ledger('playerDeaths') }, null, 0).slice(0, 3000));
