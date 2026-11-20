#!/bin/bash
# recap.sh <out.jsonl> — the seam solves the 4-job sweeps cut at the 300 s wall cap (and the one spot row a container
# restart lost), asked again 3 at a time with a 900 s cap. Each row carries its arm in "on".
out=$1; T=$(dirname "$0")
printf '%s\n' "off flag12-L43 5227" "pkc flag12-L43 5227" "pair flag12-L43 5227" "pair flag12-L43 5232" "claim flag12-L43 5232" "claim flag12-L43 5227" \
 | xargs -P3 -L1 sh -c 'case $0 in off) e="";; pkc) e=SEEDLING_PRESS_KILL_CHASERS=1;; claim) e=SEEDLING_PRESS_ESCAPE_SHIELD_CLAIM=1;; pair) e="SEEDLING_PRESS_ESCAPE_SHIELD_CLAIM=1 SEEDLING_PRESS_KILL_CHASERS=1";; esac; l=$(env $e timeout 900 node '"$T"'/seam.mjs --fx=$1 --seam=$2 --budget=2560 2>/dev/null) || l="{\"fx\":\"$1\",\"seam\":$2,\"arm\":\"$0\",\"cap\":true,\"capS\":900}"; printf "%s\n" "$l"' >> "$out"
