import { readFileSync } from 'node:fs';
const M='/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M+'tapeFormat.js');
const { createTapeStepper } = await import(M+'tapeRunner.js');
const { atlasLevelSource } = await import(M+'levelSource.js');
const SB = await import(M+'solverBot.js');
const { withPressKillBombs } = await import(M+'pressKillCost.js');
const w = JSON.parse(readFileSync(M+'fixtures/bomb-witness/movingwait-l42-381-pace.json','utf8'));
const cams = new Map(w.samples.map((s) => [s.t, s.cam]));
for (const upto of [1099, 1127, 1140, 1150]) {
  let run=null; const st=createTapeStepper(parseTape(JSON.stringify(w.tape)),{levelSource: atlasLevelSource(), onTick:(t,s,h,rn)=>{run=rn;}, cameraWitness:(t)=>cams.get(t)??null});
  for (let r=st.next(); !r.done; r=st.next()) { if (r.value.observation.t>=upto) break; }
  const sp=(run.entities('spinnerBodies')??[]).map(b=>b.id);
  const off=SB.deriveStrike(run, 'spinner@192,128', new Set(), 0);
  const on=withPressKillBombs(true,()=>SB.deriveStrike(run, 'spinner@192,128', new Set(), 0));
  const rOff=SB.deriveRefuge(run,new Set(),45), rOn=withPressKillBombs(true,()=>SB.deriveRefuge(run,new Set(),45));
  console.log(upto, run.ticksCompleted, [run.state.x.toFixed(2),run.state.y.toFixed(2)], sp, 'bombs', run.entities('bombs').map(b=>b.id),
   'OFF', off?.cell, off?.pressAt, 'ON', on?.cell, on?.pressAt, on?.bombed, (on?.rejected??[]).filter(r=>/bomb/.test(r.why)).slice(0,1).map(r=>r.option+' '+r.why.slice(0,160)), 'refuge', rOff&&[rOff.x,rOff.y], rOn&&[rOn.x,rOn.y]);
}
