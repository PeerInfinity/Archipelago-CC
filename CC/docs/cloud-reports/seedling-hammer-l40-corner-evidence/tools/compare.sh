#!/bin/bash
# compare.sh <off.jsonl> <on.jsonl> [fx] — clock by clock: OFF verdict/ticks/hits/sha vs ON, a mark on every mover, and the
# tallies (solved / refused / hit-taking) per fixture.
node -e '
const fs=require("fs");const rd=(p)=>{const m=new Map();for(const l of fs.readFileSync(p,"utf8").trim().split("\n")){if(!l)continue;const r=JSON.parse(l);m.set(r.fx+" "+r.seam,r)}return m};
const a=rd(process.argv[1]),b=rd(process.argv[2]),only=process.argv[3]||null;const v=(r)=>!r?"-":r.ok?`${r.ticks}t/${r.hits.length}h/${r.sha}`:`REF@${r.work}:${(r.message.match(/kill \((spinner@\d+,\d+)\)|EXHAUSTED|deadline/)||["?"])[0]}`;
const t={};for(const k of [...a.keys()].sort()){const[fx]=k.split(" ");if(only&&fx!==only)continue;const x=a.get(k),y=b.get(k);if(!y)continue;
 const T=(t[fx]??={off:{s:0,r:0,h:0},on:{s:0,r:0,h:0},n:0});T.n++;for(const[s,r]of[["off",x],["on",y]]){if(r.ok){T[s].s++;if(r.hits.length)T[s].h++}else T[s].r++}
 const mv=v(x)!==v(y)?(x.ok&&!y.ok?"  << LOST":!x.ok&&y.ok?"  >> NEW":(y.ok&&y.hits.length>(x.ok?x.hits.length:0))?"  !! HIT":"  ~ moved"):"";console.log(k.padEnd(18),v(x).padEnd(40),v(y),mv)}
for(const[fx,T]of Object.entries(t))console.log(`${fx}: ${T.n} clocks — OFF ${T.off.s} solved (${T.off.h} with a hit) / ${T.off.r} refused; ON ${T.on.s} solved (${T.on.h} with a hit) / ${T.on.r} refused`);
' "$1" "$2" "$3"
