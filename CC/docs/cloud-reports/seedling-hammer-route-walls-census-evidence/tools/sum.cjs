// scratch (L40-CENSUS): the arms table — the latest row per (request, arm, what-if) of every <dir>/*.jsonl chain.mjs wrote, one line each: work, wall time, digest, and the wall it ended on (or SOLVED with the fresh-run hits/deaths). Usage: node sum.cjs <dir> [ids] 
const fs=require("fs");const m=new Map();for(const f of fs.readdirSync(process.argv[2]).filter(f=>f.endsWith(".jsonl")))for(const l of fs.readFileSync(process.argv[2]+"/"+f,"utf8").trim().split("\n"))if(l){const r=JSON.parse(l);m.set(`${r.id}/${r.i}/${r.arm}/${r.persist}`,r)}
const ids=process.argv[3]?process.argv[3].split(",").map(Number):null;
function wall(r){if(r.ok)return `SOLVED ${r.ticks}t hits=${r.gm?.hits?.length??'?'} deaths=${r.gm?.deaths??'?'} gm=${r.gm?.gm}`;
const h=(r.head??"").replace(/\n/g," ");const chain=(h.match(/^solverBot\([^)]*\) ([^:]*?):/)||[])[1]??"";
let w; let m;
if(m=h.match(/EXHAUSTED\. The corridor passes through danger at \(([^)]*)\) — ([a-z]+:[^ ]+)/))w=`EXHAUSTED ${m[2]} @(${m[1]})`;
else if(m=h.match(/player died at (t\d+) \(chaser ([^)]*)\) while pressing ([^ ,]+)/))w=`DIED ${m[1]} to ${m[2]} pressing ${m[3]}`;
else if(m=h.match(/applied (\d+) strategies for one goal (\[[^\]]*\])/))w=`BOUND ${m[1]} ${m[2]}`;
else if(m=h.match(/no REACHABLE stance ([^—]*)/))w=`NO-STANCE ${m[1]}`;
else if(/does not chain openers/.test(h))w='CLEARTAG-NO-CHAIN (burn)';
else w=h.slice(0,160);
return `${w} || ${chain.slice(0,260)}`}
for(const r of [...m.values()].sort((a,b)=>a.id-b.id||a.arm.localeCompare(b.arm))){if(r.arm.startsWith("check")||(ids&&!ids.includes(r.id)))continue;
console.log([r.id+"/"+r.i,r.arm+(r.persist?" P"+r.persist:""),r.work,Math.round(r.ms/1000)+"s",r.digest,wall(r)].join(" | "))}
