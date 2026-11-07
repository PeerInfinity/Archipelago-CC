import { readFileSync } from 'node:fs'; import { gunzipSync } from 'node:zlib';
const M='/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { restoreRequest } = await import('/home/user/Archipelago-CC/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(M+'atlasSource.js'); const JR = await import(M+'jsRuntimeSolver.js'); const SB = await import(M+'solverBot.js');
const leg=process.argv[2];
const row = JSON.parse(gunzipSync(readFileSync(M+'fixtures/hammer-pit-west/leg'+leg+'-l40-l43-request.json.gz')).toString());
const { passes, source, ...tape } = restoreRequest(row.requests[0].request);
const a = SB.withChooserCut(true, () => JR.solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes }));
const plan=a.plan;
const run = JR.replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource: levelSourceFromAtlas(source.records), scratchPersistence: tape.scratchPersistence===true, equips: tape.equips??null, holds: tape.holds??null });
const ids=['puncher@128,624','bob@192,480','bob@208,448','bob@224,496','bob@352,448','bob@352,416'];
let live=new Set((run.entities('chasers')??[]).map(c=>c.id)); const gone=[]; let near={};
for (let k=0;k<plan.solution.length;k++){ const slot=plan.equipsAt?.get?.(k); if(slot!==undefined) run.equipNow(slot); run.advance(plan.solution[k]);
  if (run.level!==40) { console.log('left L40 at k',k,'to',run.level); break; }
  const now=new Set((run.entities('chasers')??[]).map(c=>c.id)); for(const id of live) if(!now.has(id)) gone.push([id,k]); live=now;
  for (const c of (run.entities('chasers')??[])) if(ids.includes(c.id)){ const d=Math.hypot(c.x-run.state.x,c.y-run.state.y); if(d<(near[c.id]?.[0]??1e9)) near[c.id]=[+d.toFixed(1),k,[+c.x.toFixed(0),+c.y.toFixed(0)]]; } }
console.log('leg',leg,'ticks',plan.solution.length,'pass',plan.pass,'hits',run.playerHits.length,'removed (id, tick):',JSON.stringify(gone));
console.log('closest approach of the cluster bodies [d px, tick, body pos]:',JSON.stringify(near));
