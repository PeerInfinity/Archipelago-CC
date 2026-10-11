import { readFileSync } from 'node:fs';
const R='/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(R+'tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await import(R+'tapeRunner.js');
const { atlasLevelSource } = await import(R+'levelSource.js');
const W = JSON.parse(readFileSync(R+'fixtures/chaser-witness/leash-l73-622-up-lavarunner.json','utf8'));
const st = stagingFromTape(parseTape(JSON.stringify(W.tape)));
const src = atlasLevelSource();
const DIRS=[[],['up'],['down'],['left'],['right'],['up','left'],['up','right'],['down','left'],['down','right']];
const ACT=[[],['primary'],['secondary'],['primary','secondary']];
const A=[]; for (const d of DIRS) for (const a of ACT) A.push([...d,...a]);
let t0=Date.now(); const r0=createRunForStaging(st,src); console.log('fork ms', Date.now()-t0, Object.keys(r0.damage), r0.damage, r0.progress('inventory').hitsMax);
let frontier=[[]]; let nodes=0;
for (let d=1; d<=3; d++){ const next=[]; const leaves=[];
 for (const p of frontier) for (const a of A){ const r=createRunForStaging(st,src); nodes++; let tr=null;
   for (const k of [...p,a]) { const o=r.advance(new Set(k)); if (o.transition) tr=o.transition; }
   const h=r.ledger('playerHits').length; if (h>0) leaves.push({k:[...p,a],h,died:r.ledger('playerDeaths').length}); else next.push([...p,a]); }
 console.log('depth',d,'survivors',next.length,'leaves',leaves.length,'nodes',nodes,'ms',Date.now()-t0, leaves.length? JSON.stringify(leaves[0]):''); frontier=next; if(!next.length)break; }
