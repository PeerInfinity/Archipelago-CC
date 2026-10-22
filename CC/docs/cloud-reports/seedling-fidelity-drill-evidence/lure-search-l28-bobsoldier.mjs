const M='/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { atlasLevelSource } = await import(M+'levelSource.js');
const { createRunForStaging } = await import(M+'tapeRunner.js');
const { ropeStaging } = await import(M+'fidelityRope.js');
const { withContactFidelity } = await import(M+'contactFidelity.js');
const { greedyKeys } = await import(M+'fidelityDrill.js');
const { drillRect } = await import(M+'drill.js');
const { chaserBoxAt } = await import(M+'chasers.js');
const SRC = atlasLevelSource();
const ov=(a,b)=>a.x<b.right&&b.x<a.right&&a.y<b.bottom&&b.y<a.bottom;
const boots=[[240,176],[224,160],[256,176],[240,160],[224,176],[256,192],[240,192],[208,160],[208,176],[224,192],[192,144],[208,144]];
const pts=[]; for(let y=72;y<=152;y+=8) for(let x=104;x<=208;x+=8) pts.push([x,y]);
let n=0;
await withContactFidelity({ drillMixedRooms: true }, async () => {
for (const [bx,by] of boots) {
 const staging = await ropeStaging({ boot:{level:28,x:bx,y:by}, items:['hasSpear'], persistence:[] });
 for (const w1 of pts) {
  const run = createRunForStaging(staging, SRC);
  const ev=[]; let ok=true; let maxT=0;
  for (let t=1;t<=400;t++){
    const k=greedyKeys(run,w1);
    const p={x:run.state.x,y:run.state.y};
    const db=new Map(run.drills.bodies.map(d=>[d.id,{...d}])); const ch=run.chasers.map(c=>({...c}));
    try { run.advance(k); } catch(e){ ok = maxT>0 && t>maxT+3; if(ok) maxT=-(t); break; }
    if (run.level!==28) { ok=false; break; }
    const da=new Map(run.drills.bodies.map(d=>[d.id,d]));
    for (const [id,b] of db){ const a=da.get(id); if(!a||b.anim!=='sit') continue;
      if (Math.hypot(p.x-b.x,p.y-b.y)>48 || run.collideLineSolid(b.x,b.y,p.x,p.y)) continue;
      let tox=Math.trunc(b.x), toy=Math.trunc(b.y);
      if (Math.abs(p.x-b.x)>8) tox+= p.x>b.x?16:-16; if (Math.abs(p.y-b.y)>8) toy+= p.y>b.y?16:-16;
      const rs=[]; if(tox!==b.x) rs.push(['x',drillRect({x:tox,y:b.y})]); if(toy!==b.y) rs.push(['y',drillRect({x:a.x,y:toy})]);
      for (const [ax,r] of rs) for (const c of ch) if (c.tag==='bobsoldier' && ov(r,chaserBoxAt(c.tag,c.x,c.y))) ev.push(`t${t} ${id} ${ax}`);
    }
    if (ev.length && !maxT) maxT=t;
    if (maxT && t>=maxT+25) break;
  }
  if (ev.length && ok) { console.log(`FOUND boot(${bx},${by}) w1=${w1} ticks=${maxT} (neg=throw tick) hits=${run.damage.hits} ${ev.slice(0,3).join(' ')}`); if(++n>=30) process.exit(0); }
 }
}
});
