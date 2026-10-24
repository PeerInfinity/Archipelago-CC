#!/bin/bash
# usage: l40cost.sh <tag> <outfile> [env...]; times the five L40 legs (today's ids) sequentially, 900 s cap each
S=/tmp/claude-0/-home-user-Archipelago-CC/5917e43c-f771-5a88-a1e6-18ec2dc67c58/scratchpad
tag=$1; out=$2; shift 2
for id in ${IDS:-378 381 384 396 400}; do
  s=$(date +%s.%N); l=$(cat /proc/loadavg | cut -d' ' -f1)
  row=$(env "$@" timeout ${CAP:-900} node $S/inv-leg.mjs --legs=$S/legs.jsonl --rows=$S/rows.jsonl --dump=$S/dump.json --ids=$id 2>/dev/null)
  rc=$?; e=$(date +%s.%N)
  echo "{\"tag\":\"$tag\",\"id\":$id,\"rc\":$rc,\"load\":$l,\"wall\":$(echo "$e - $s" | bc),\"row\":${row:-null}}" >> $out
done
