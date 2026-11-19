#!/bin/bash
# sweep-rest.sh <outfile.jsonl> <jobs> <SWITCH> <skip-list "fx seam" lines file> <fx...> — sweep-sw.sh minus the (fx, clock)
# pairs already in <outfile.jsonl> or named in the skip file (in flight elsewhere).
out=$1; jobs=$2; sw=$3; skip=$4; shift 4
done_pairs=$(node -e 'const fs=require("fs");for(const l of fs.readFileSync(process.argv[1],"utf8").trim().split("\n")){if(!l)continue;const r=JSON.parse(l);console.log(r.fx+" "+r.seam)}' "$out"; cat "$skip")
for fx in "$@"; do for s in $(seq 5213 5257); do echo "$fx $s"; done; done | grep -v -x -F "$done_pairs" \
 | xargs -P"$jobs" -n2 sh -c "env SEEDLING_$sw=1 node CC/docs/cloud-reports/seedling-hammer-l40-corner-evidence/tools/seam.mjs --fx=\$0 --seam=\$1 --budget=2560" >> "$out"
