// rules-route-goals-witness: one line per sweep row (`node sum.js <rows.jsonl>...`): end, hits, cleared count, plays and passes, the refusal.
const fs=require("fs");
for(const f of process.argv.slice(2)){ if(!fs.existsSync(f)) continue; console.log("##",f);
for(const l of fs.readFileSync(f,"utf8").trim().split("\n")){ if(!l) continue; const r=JSON.parse(l);
const fl=r.failed?(typeof r.failed==="string"?r.failed:JSON.stringify(r.failed)).slice(0,400):"";
console.log([r.id,r.goal,"arr="+r.arrive,"end="+r.end,"hits="+r.roomHits?.max,"cleared="+r.cleared,"s="+Math.round(r.ms/1000),
 "plays="+(r.history||[]).map(h=>`${h.ticks}t/${h.outcome}${h.passes?"["+h.passes.map(p=>p.pass+":"+(p.ok?"ok":"NO")+":"+p.work).join(" ")+"]":""}`).join(","),
 "end@"+(r.x!=null?Math.round(r.x)+","+Math.round(r.y):""), fl].join(" | "));}}
