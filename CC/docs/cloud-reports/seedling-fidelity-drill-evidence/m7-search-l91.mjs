const A='/home/user/Archipelago-CC/frontend/modules/seedlingDemo/', B='/tmp/claude-0/sp/m7/frontend/modules/seedlingDemo/';
const load = async (M) => ({ src: (await import(M+'levelSource.js')).atlasLevelSource(), mk: (await import(M+'tapeRunner.js')).createRunForStaging,
  st: (await import(M+'fidelityRope.js')).ropeStaging, cf: (await import(M+'contactFidelity.js')).withContactFidelity, gk: (await import(M+'fidelityDrill.js')).greedyKeys });
const a = await load(A), b = await load(B);
const lv = 91; let found = 0;
const tg=[]; for(let y=16;y<=160;y+=16) for(let x=16;x<=272;x+=16) tg.push([x,y]);
for (let by=16; by<=160; by+=16) for (let bx=16; bx<=272; bx+=16) {
  let sa; try { sa = await a.st({ boot:{level:lv,x:bx,y:by}, items:['hasSpear'], persistence:[] }); } catch { continue; }
  for (const T of [null, ...tg.filter((_,i)=>i%5===0)]) {
    let ra, rb; try { ra = a.cf({drillMixedRooms:true}, ()=>a.mk(sa, a.src)); rb = b.cf({drillMixedRooms:true}, ()=>b.mk(sa, b.src)); } catch { break; }
    let diverged=null;
    for (let t=1;t<=150;t++){
      const k = T ? a.gk(ra, T) : new Set();
      try { a.cf({drillMixedRooms:true}, ()=>ra.advance(new Set(k))); b.cf({drillMixedRooms:true}, ()=>rb.advance(new Set(k))); } catch { break; }
      if (ra.level!==lv) break;
      const ca = a.cf({drillMixedRooms:true}, ()=>JSON.stringify(ra.chasers.map(c=>[c.id,c.x,c.y]))), cb = b.cf({drillMixedRooms:true}, ()=>JSON.stringify(rb.chasers.map(c=>[c.id,c.x,c.y])));
      if (ca!==cb || ra.state.x!==rb.state.x || ra.state.y!==rb.state.y) { diverged=t; break; }
    }
    if (diverged) { console.log(`DIVERGE boot(${bx},${by}) T=${T} t${diverged}`); if (++found>=8) process.exit(0); break; }
  }
}
console.log('done', found);
