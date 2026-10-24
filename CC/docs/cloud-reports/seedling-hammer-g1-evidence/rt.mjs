// SCRATCH (g1): leg 397's staging → a boot view (buildStagedTape, no keys) → stagingFromTape; replay 397's keys on both.
import { readFileSync, writeFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { createRunForStaging, solveStaging, stagingFromTape } = await import(R + 'tapeRunner.js');
const { atlasLevelSource } = await import(R + 'levelSource.js');
const { buildStagedTape } = await import(R + 'botDriverV1.js');
const { parseTape } = await import(R + 'tapeFormat.js');
const { staging, perTick } = JSON.parse(readFileSync('cand-397.tape.json', 'utf8'));
const { hitsMax, ...items } = staging.seam.items;
const tapeStaging = { ...staging, seam: { ...staging.seam, items, hits_max: hitsMax } };
if (Array.isArray(tapeStaging.inventory_slots) && tapeStaging.inventory_slots.length === 0) delete tapeStaging.inventory_slots;
const built = buildStagedTape({ staging: tapeStaging, perTick: [], name: 'hammer-g1-l40-397-boot' });
const json = JSON.stringify(built, null, 1);
writeFileSync('boot-397.json', json + '\n');
const st2 = solveStaging(stagingFromTape(parseTape(json)));
const sum = (st) => { const run = createRunForStaging(st, atlasLevelSource()); const xs = [];
  for (const k of perTick) { run.advance(new Set(k)); xs.push([run.state.x, run.state.y, run.playerHits.length]); }
  return [JSON.stringify(xs).length, run.state.x, run.state.y, run.spinnerPressHits.filter((h) => h.landed).map((h) => [h.t, h.hits]), JSON.stringify(xs)]; };
const a = sum(staging), b = sum(st2);
console.log(a.slice(0, 4), b.slice(0, 4), 'equal', a[4] === b[4]);
