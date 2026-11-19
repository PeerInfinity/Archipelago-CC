#!/bin/bash
# sweep-sw.sh <outfile.jsonl> <jobs> <SWITCH[,SWITCH]> <fx...> — every clock 5213..5257 per fixture, budget 2560, the
# named SEEDLING_ switches =1 (base tree's modules).
out=$1; jobs=$2; sw=$3; shift 3
envs=$(echo "$sw" | tr ',' '\n' | sed 's/^/SEEDLING_/; s/$/=1/' | tr '\n' ' ')
for fx in "$@"; do for s in $(seq 5213 5257); do echo "$fx $s"; done; done \
 | xargs -P"$jobs" -n2 sh -c "env $envs node CC/docs/cloud-reports/seedling-hammer-l40-corner-evidence/tools/seam.mjs --fx=\$0 --seam=\$1 --budget=2560" >> "$out"
