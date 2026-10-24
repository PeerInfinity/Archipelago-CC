// SCRATCH: the SF witness's ON solve under a never-tripping counter deadline: its call count, and the keys' equality.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const M = (p) => import(join('/home/user/Archipelago-CC/frontend/modules/seedlingDemo', p));
const { solveSegment, withStrikeEtaFloor } = await M('solverBot.js');
const { createRunForStaging, solveStaging, stagingFromTape, createTapeStepper } = await M('tapeRunner.js');
const { parseTape } = await M('tapeFormat.js');
const { atlasLevelSource } = await M('levelSource.js');
const D = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/fixtures/';
const staging = solveStaging(stagingFromTape(parseTape(readFileSync(D + 'hammer-p1-l40-south-boot.json', 'utf8'))));
staging.seam = { ...staging.seam, items: { ...staging.seam.items, hasSword: true, hasGhostSword: true } };
let calls = 0;
const run = createRunForStaging(staging, atlasLevelSource());
const per = withStrikeEtaFloor(true, () => { try { return solveSegment({ run, goals: [{ kind: 'collect-placement', placement: { x: 880, y: 816 } }], name: 'x', boot: staging.boot, dashMode: 'all', shouldStop: () => { calls += 1; return false; } }).perTick; } catch (e) { return e.perTick ?? []; } });
const held = []; const st = createTapeStepper(parseTape(readFileSync(D + 'hammer-sf-strikefloor-witness/hammer-sf-l40-strikefloor.tape.json', 'utf8')), { levelSource: atlasLevelSource(), onTick: (t, s, h) => { held[t] = h; } });
for (let r = st.next(); !r.done; r = st.next());
const w = held.filter(Boolean).slice(0, per.length).map((k) => [...k].sort().join('+'));
console.log('calls', calls, 'len', per.length, 'equal', JSON.stringify(per.map((k) => [...k].sort().join('+'))) === JSON.stringify(w));
