// SCRATCH (PDS D3): the bw-bombstand producer's solve at the defaults (lapse ON, bombBlastBody ON, floor pinned OFF)
// against the game-witnessed wandhold-l42-371-paced tape, key for key.
import { readFileSync, writeFileSync } from 'node:fs';
const REPO = process.argv[2];
const P = await import(`${REPO}/scripts/procgen/plan-seedling-hammer-bw-bombstand.mjs`);
const { parseTape, heldKeysAt } = await import(`${REPO}/frontend/modules/seedlingDemo/tapeFormat.js`);
const staging = await P.bombStandStaging();
const r = await P.bombStandSolve(staging, true, { lapse: true });
const k = (s) => [...s].sort().join('+');
const w = JSON.parse(readFileSync(`${REPO}/frontend/modules/seedlingDemo/fixtures/bomb-witness/wandhold-l42-371-paced.json`, 'utf8'));
const tape = parseTape(JSON.stringify(w.tape));
const n = Math.min(r.keys.length, 1667);
let first = null;
for (let i = 0; i < n; i += 1) if (k(r.keys[i]) !== k(heldKeysAt(tape, i))) { first = i; break; }
console.log(JSON.stringify({ solved: r.keys.length, message: r.message, hits: r.hits, witnessUpto: w.upto,
    witnessSwitches: w.switches, firstDiff: first }));
writeFileSync(process.argv[3], JSON.stringify(r.keys.map(k)));
