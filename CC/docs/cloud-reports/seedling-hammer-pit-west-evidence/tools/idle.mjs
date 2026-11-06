import { readFileSync } from 'node:fs'; import { gunzipSync } from 'node:zlib';
const M='/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { restoreRequest } = await import('/home/user/Archipelago-CC/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(M+'atlasSource.js'); const JR = await import(M+'jsRuntimeSolver.js');
const row = JSON.parse(gunzipSync(readFileSync(M+'fixtures/hammer-pit-west/leg388-l40-l43-request.json.gz')).toString());
const { source, ...tape } = restoreRequest(row.requests[0].request);
const run = JR.replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource: levelSourceFromAtlas(source.records), scratchPersistence: tape.scratchPersistence===true, equips: tape.equips??null, holds: tape.holds??null });
const ids=['puncher@128,624','bob@192,480','bob@208,448','bob@224,496','bob@352,448','bob@352,416'];
const pos=()=>Object.fromEntries((run.entities('chasers')??[]).filter(c=>ids.includes(c.id)).map(c=>[c.id,[+c.x.toFixed(1),+c.y.toFixed(1)]]));
const p0=pos(); let moved={};
for (let t=1;t<=600;t++){ run.advance(new Set()); const p=pos(); for(const id of ids){ if(p[id] && (p[id][0]!==p0[id][0]||p[id][1]!==p0[id][1])) moved[id] ??= t; } }
console.log('t0', JSON.stringify(p0)); console.log('t600', JSON.stringify(pos())); console.log('first move tick', JSON.stringify(moved), 'player', run.state.x, run.state.y);
