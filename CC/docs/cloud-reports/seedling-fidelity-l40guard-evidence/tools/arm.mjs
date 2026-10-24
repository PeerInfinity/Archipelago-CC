// replay a tape to its end, then ask deriveKillByChaser for the guard; print every rejection, and preview the best candidate's guard track
import { readFileSync } from 'node:fs';
const R='/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { createTapeStepper, createRunForStaging, solveStaging, stagingFromTape } = await import(R+'tapeRunner.js');
const { atlasLevelSource } = await import(R+'levelSource.js');
const { parseTape } = await import(R+'tapeFormat.js');
const SB = await import(R+'solverBot.js');
const tapePath = process.argv[2];
const tape = parseTape(readFileSync(tapePath,'utf8'));
let run=null;
const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t,s,h,rn)=>{run=rn;} });
let r=st.next(); while(!r.done) r=st.next();
console.log('t', run.ticksCompleted, 'P', run.state.x, run.state.y, 'hits', run.ledger('playerHits').length);
console.log('chasers', run.entities('chasers').map(c=>`${c.id}(${c.x.toFixed(1)},${c.y.toFixed(1)})`).join(' '));
const guard = run.entities('strikeBodies').find(b=>b.id==='bobsoldier@880,832');
console.log('guard strike body', JSON.stringify(guard)?.slice(0,300));
const aim={x:888,y:834};
const res = SB.deriveKillByChaser(run, {id:'bobsoldier@880,832'}, new Set(), { aim, dashMode:'all' });
console.log('stance', JSON.stringify(res.stance), '\nwhy', res.why);
