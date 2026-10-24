import { readFileSync } from 'node:fs';
const M='/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { atlasLevelSource } = await import(M+'levelSource.js');
const { createRunForStaging } = await import(M+'tapeRunner.js');
const { plannerObstacleAt } = await import(M+'botDriverV2.js');
const { solverPlanOpts } = await import(M+'solverBot.js');
const st = JSON.parse(readFileSync(process.argv[3] ?? '/home/user/Archipelago-CC/.cache/seedling-survey/through-end/views/step-93-boot.json','utf8'));
const run = createRunForStaging(st, atlasLevelSource());
const opts = solverPlanOpts(run, new Set(), { nodeMargin: 0, triggerMargin: 0 });
const [tx0,ty0,tx1,ty1]=(process.argv[2]??'0,0,59,57').split(',').map(Number);
const legend = new Map(); const ch = (id) => { if(!legend.has(id)) legend.set(id, String.fromCharCode(65+legend.size)); return legend.get(id); };
let hdr='    '; for(let x=tx0;x<=tx1;x++) hdr+= (x%10).toString(); console.log(hdr);
for (let ty=ty0; ty<=ty1; ty++) {
  let s=String(ty).padStart(3)+' ';
  for (let tx=tx0; tx<=tx1; tx++) {
    const hit = plannerObstacleAt(run.world, tx*16+8, ty*16+8, null, opts);
    let c='.';
    if (hit) { if (hit.kind==='terrain') c='#'; else if (hit.kind==='pit') c='~'; else if (hit.kind==='teleporter') c='@';
      else { const b=hit.blocker??{}; const tag=b.tag ?? b.cls?.as3 ?? b.name; if (typeof tag==='string'&&tag.startsWith('tile:')) c='#'; else c=ch(`${hit.kind}:${b.id ?? tag}`); } }
    s+=c;
  }
  console.log(s);
}
for (const [k,v] of legend) console.log(v, k);
