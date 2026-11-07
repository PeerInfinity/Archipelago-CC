import { readFileSync } from 'node:fs';
const ROOT='/home/user/Archipelago-CC'; const M=ROOT+'/frontend/modules/seedlingDemo/';
const { restoreRequest } = await import(ROOT + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const JR = await import(M + 'jsRuntimeSolver.js'); const SB = await import(M + 'solverBot.js'); const DM = await import(M + 'dangerMap.js'); const BD = await import(M + 'botDriverV2.js');
let req=null; for (const line of readFileSync(process.argv[2],'utf8').trim().split('\n')) { const r=JSON.parse(line); if (r.id===719) req=restoreRequest(r.requests[0].request); }
const { source, ...tape } = req;
const run = JR.replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource: levelSourceFromAtlas(source.records), scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
const vols = DM.dangerVolumes(run, 0).filter(v=>!String(v.id).startsWith('drill'));
const idx = run.world.teleporters.findIndex(t=>t.rect.x===16&&t.rect.y===144); console.log('tele idx', idx, run.world.teleporters.length);
for (const [lab, o, aim] of [['default', SB.solverPlanOpts(run, new Set()), {x:24,y:152}], ['noDrill+tele', SB.solverPlanOpts(run, new Set(), {extraVolumes: vols, allowTeleporter: idx}), {x:24,y:152}], ['noDrill aim(24,120)', SB.solverPlanOpts(run,new Set(),{extraVolumes: vols}), {x:24,y:120}]]) {
  try { const w = BD.planWaypoints(run.world, run.state, aim, null, o); console.log(lab, 'OK', w.length, JSON.stringify(w.slice(0,12))); } catch(e) { console.log(lab, 'ERR', e.message.slice(0,200)); } }
