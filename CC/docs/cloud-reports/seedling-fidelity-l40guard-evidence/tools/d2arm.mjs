// boot L40 (atlas, 414's view) at --boot, advance --pre ticks with --keys, then ask the arm for the guard (OFF and ON)
import { readFileSync } from 'node:fs';
const R='/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { createRunForStaging, solveStaging, stagingFromTape } = await import(R+'tapeRunner.js');
const { atlasLevelSource } = await import(R+'levelSource.js');
const { parseTape } = await import(R+'tapeFormat.js');
const SB = await import(R+'solverBot.js');
const { withContactFidelity } = await import(R+'contactFidelity.js');
const arg=(n,f)=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3)??f;
const v = JSON.parse(readFileSync(R+'fixtures/hammer-lb-hx/boot-414.json','utf8'));
const [bx,by]=arg('boot','760,848').split(',').map(Number); v.boot={level:40,x:bx,y:by};
if (arg('ghost','0')!=='1') v.seam.items.hasGhostSword=false;
const run = createRunForStaging(solveStaging(stagingFromTape(parseTape(JSON.stringify(v)))), atlasLevelSource());
for (let t=0;t<Number(arg('pre','0'));t++) run.advance(new Set());
console.log('t', run.ticksCompleted, 'P', run.state.x, run.state.y);
for (const on of [false,true]) {
  const t0=Date.now();
  const res = withContactFidelity({guardApproachStance:on}, ()=>SB.deriveKillByChaser(run, {id:'bobsoldier@880,832'}, new Set(), { aim:{x:888,y:834}, dashMode:'all', tolerance:Number(arg('tol','2')) }));
  console.log(on?'ON ':'OFF', Date.now()-t0,'ms stance', JSON.stringify(res.stance), 'ticks', res.ticks, '\n   why', res.why.slice(0, on? 2000: 400));
}
