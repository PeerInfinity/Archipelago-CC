#!/bin/bash
# census.sh <tag> : every key of census-keys.txt, 3 in parallel; env passes through
S=/tmp/claude-0/-home-user-Archipelago-CC/8c778e1a-081b-511c-96d6-cf60918b2646/scratchpad
mkdir -p $S/census/$1; cd /home/user/Archipelago-CC
i=0; while IFS= read -r k; do i=$((i+1)); echo "$i	$k"; done < $S/repro/census-keys.txt | \
  xargs -P 3 -d '\n' -I{} bash -c 'n=$(echo "{}" | cut -f1); k=$(echo "{}" | cut -f2-); timeout 900 node '$S'/drivers/inv-leg.mjs --legs='$S'/sweep/legs/legs.jsonl --rows='$S'/sweep/merged/merged/rows.jsonl --dump='$S'/sweep/merged/merged/delivered-set.json "--key=$k" > '$S'/census/'$1'/$n.json 2>/dev/null || echo "{\"key\":\"$k\",\"crash\":true}" > '$S'/census/'$1'/$n.json'
echo DONE > $S/census/$1.done
