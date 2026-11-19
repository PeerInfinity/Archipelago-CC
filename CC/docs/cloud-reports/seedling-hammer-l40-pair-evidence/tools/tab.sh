#!/bin/bash
# tab.sh <jsonl> — one line per solve: fx seam verdict work ticks hits refusal-head
node -e 'for (const l of require("fs").readFileSync(process.argv[1],"utf8").trim().split("\n")){if(!l)continue;const r=JSON.parse(l);console.log(r.fx,r.seam,r.ok?"SOLVED":"REFUSED",r.work,r.ticks??"-",r.ok?(r.hits||[]).length+"hit":"",r.sha??"",r.ok?"":r.message.slice(0,300).replace(/solverBot\([^)]*\) /,""))}' "$1" | sort -k1,1 -k2n
