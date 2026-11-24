#!/bin/bash
# argv: refused.tsv idfile.tsv out.jsonl  — one process per request, 300 s cap, 4 at a time
S=$(dirname "$0")
while IFS=$'\t' read -r id i rest; do
  f=$(awk -v id="$id" '$1==id{print $2}' "$2")
  echo "$id $i $f"
done < "$1" | xargs -P 4 -L 1 bash -c 'UNCAPPED=1 ONLY_REQ="$0:$1" timeout 300 node --max-old-space-size=3500 '"$S"'/census.mjs '"$3"' off "$2" >/dev/null 2>&1 || echo "{\"id\":$0,\"i\":$1,\"timeout\":true}" >> '"$3"''
