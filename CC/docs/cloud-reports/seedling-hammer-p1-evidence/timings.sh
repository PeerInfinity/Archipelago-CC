#!/bin/bash
# 3 rounds; each round, per workload, ON then OFF (alternating the first mode per round). Sequential, alone.
S=/tmp/claude-0/-home-user-Archipelago-CC/5917e43c-f771-5a88-a1e6-18ec2dc67c58/scratchpad
cd /home/user/Archipelago-CC
out=$S/timings.jsonl
for round in 1 2 3; do
  if [ $((round % 2)) = 1 ]; then modes="on off"; else modes="off on"; fi
  for w in 378 381 384 396 400 A; do
    for m in $modes; do
      E=X=1; [ $m = off ] && E=SEEDLING_PRESS_KILL_COST=0
      l=$(cut -d' ' -f1 /proc/loadavg); s=$(date +%s.%N)
      if [ $w = A ]; then
        env $E timeout 1500 node $S/view-solve.mjs --view=$S/step-78-boot.json --goal=collect:880,816 --stop-tick=1 --json=$S/A-t-$m-$round.json > /dev/null 2>&1; rc=$?
        row=$(python3 -c "import json;d=json.load(open('$S/A-t-$m-$round.json'));print(json.dumps({k:d.get(k) for k in ('verdict','refusalTicks','keysMd5','msgMd5','ms')}))" 2>/dev/null)
      else
        row=$(env $E timeout 900 node $S/inv-leg.mjs --legs=$S/legs.jsonl --rows=$S/rows.jsonl --dump=$S/dump.json --ids=$w 2>/dev/null); rc=$?
      fi
      e=$(date +%s.%N)
      echo "{\"round\":$round,\"mode\":\"$m\",\"w\":\"$w\",\"rc\":$rc,\"load\":$l,\"wall\":$(echo "$e - $s" | bc),\"row\":${row:-null}}" >> $out
    done
  done
done
echo done >> $S/timings.done
