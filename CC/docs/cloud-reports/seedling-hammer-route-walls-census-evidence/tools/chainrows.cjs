const fs=require('fs');
for (const f of process.argv.slice(2)) for (const l of fs.readFileSync(f,'utf8').trim().split('\n')) {
  const r=JSON.parse(l); console.log(`== ${r.id}/${r.i} ${r.arm} ${r.ok?'SOLVED '+r.ticks+' t':'REFUSED'} work=${r.work} ms=${r.ms}`);
  for (const b of [640,2560]) if (r.marks?.[b]) console.log(`   @${b}: pass ${r.marks[b].pass} last row ${JSON.stringify(r.marks[b].row)}`);
  let prev=''; const out=[];
  for (const x of r.rows) { const k=`${x.verb} ${x.ob}`; if (k===prev) continue; prev=k; out.push(`u${x.u} ${x.verb} ${x.ob} t${x.tick}`); }
  console.log('   rows: '+out.slice(0,60).join(' · ')+(out.length>60?` … (+${out.length-60})`:''));
  const fr=Object.entries(r.byFrame||{}).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>`${k} ${v}`).join(', '); if(fr) console.log('   frames: '+fr);
}
