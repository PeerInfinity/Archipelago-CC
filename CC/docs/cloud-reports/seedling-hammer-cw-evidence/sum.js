const fs=require("fs");
for (const f of process.argv.slice(2)) { if(!fs.existsSync(f)) {console.log(f.split('/').pop(),'MISSING'); continue;} const r=JSON.parse(fs.readFileSync(f));
 const last=(r.ladder||[]).filter(x=>x.rung==="kill").at(-1);
 console.log([f.split("/").pop().replace(".json",""), "lapse="+r.lapse, r.verdict, r.refusalTicks??r.ticks, "obst="+(r.obstacle?r.obstacle.id+" ["+(r.obstacle.sources||[]).join(" ")+"]":"-"), "at="+JSON.stringify(r.at), "hits="+r.hits.length, "deaths="+r.deaths.length, "keys="+(r.keysMd5||"-").slice(0,8), "msg="+(r.msgMd5||"-").slice(0,8), "removed="+JSON.stringify(r.removed), "lastKill="+(last?last.tick+":"+last.arm+":"+last.target:"-"), "s="+r.s].join(" | ")); }
