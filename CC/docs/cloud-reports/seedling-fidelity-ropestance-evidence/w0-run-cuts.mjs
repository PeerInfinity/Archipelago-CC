const M='/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { atlasLevelSource } = await import(M+'levelSource.js');
const { createRunForStaging } = await import(M+'tapeRunner.js');
const { arrivalStaging } = await import(M+'fidelityArrival.js');
const { spearRect } = await import(M+'presses.js');
const { auditFire } = await import(M+'presses.js');
const SRC = atlasLevelSource();
const KEYS=['right','up','left','down'];
const ov=(a,b)=>a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;
const N=new Set();
for (const [lv,rid] of [[16,'rope@32,16'],[28,'rope@160,64']]) {
  for (const w of ['hasSpear','hasFire']) {
    const rows=[];
    const r0 = createRunForStaging(arrivalStaging({level:lv,x:lv===16?32:96,y:lv===16?64:16},{items:[w]}), SRC);
    const rope = r0.world.solids.find(s=>s.ropeId===rid).rect;
    for (let ty=Math.floor(rope.y/16)-3; ty<=Math.floor(rope.bottom/16)+2; ty++) for (let tx=Math.floor(rope.x/16)-3; tx<=Math.floor(rope.right/16)+2; tx++) {
      const x=tx*16+8,y=ty*16+8; if(x<0||y<0) continue;
      const dirs = w==='hasSpear'?[0,1,2,3]:[null];
      for (const d of dirs) {
        if (d!==null && !ov(spearRect(x,y,d),rope)) continue;
        if (d===null) { const a=auditFire(r0.world,{x,y},{}); if(!a.live.some(r=>r.as3==='RopeStart')) continue; }
        let run; try { run=createRunForStaging(arrivalStaging({level:lv,x,y},{items:[w]}),SRC);} catch(e){ rows.push(`${x},${y} d${d}: boot ${e.message.slice(0,60)}`); continue;}
        let err=null; const sx=run.state.x, sy=run.state.y;
        try {
          if (d!==null) { run.advance(new Set([KEYS[d]])); for(let i=0;i<30&&(run.state.vx||run.state.vy);i++) run.advance(N); }
          const px=run.state.x,py=run.state.y,dir=run.direction;
          run.advance(new Set(['primary']));
          for(let i=0;i<45;i++) run.advance(N);
          const p=run.ledger('ropePulls');
          rows.push(`${x},${y} d${d} at(${px.toFixed(1)},${py.toFixed(1)}) dir${dir}: ${p.length?('PULLED t'+p[0].t):'no'} lat=${[...run.entities('latchedGroups')]}`);
        } catch(e){ rows.push(`${x},${y} d${d}: THREW ${e.message.slice(0,140)}`);}
      }
    }
    console.log(`== L${lv} ${w}`); rows.forEach(r=>console.log('  '+r));
  }
}
