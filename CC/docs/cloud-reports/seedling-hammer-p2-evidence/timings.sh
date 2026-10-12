#!/bin/bash
# P2's A/B and timings: 3 rounds; each round, per workload, ON then OFF (the first mode alternating per round).
# Sequential, one process at a time. OFF = SEEDLING_STRIKE_SCAN_COST=0 (P1 ON both).
S=${S:?scratchpad}; E=$(cd "$(dirname "$0")" && pwd)
cd /home/user/Archipelago-CC
out=$S/timings.jsonl
for round in 1 2 3; do
  if [ $((round % 2)) = 1 ]; then modes="on off"; else modes="off on"; fi
  for w in A 378 381 384 396 400; do
    for m in $modes; do
      E2=X=1; [ $m = off ] && E2=SEEDLING_STRIKE_SCAN_COST=0
      l=$(cut -d' ' -f1 /proc/loadavg); s=$(date +%s.%N)
      if [ $w = A ]; then
        env $E2 timeout 1500 node $E/view-solve.mjs --view=frontend/modules/seedlingDemo/fixtures/hammer-p1-l40-south-boot.json --goal=collect:880,816 --stop-tick=1 --json=$S/A-t-$m-$round.json > $S/A-t-$m-$round.log 2>&1; rc=$?
        row=$(python3 -c "import json;d=json.load(open('$S/A-t-$m-$round.json'));print(json.dumps({k:d.get(k) for k in ('verdict','refusalTicks','keysMd5','msgMd5','ms')}))" 2>/dev/null)
      else
        row=$(env $E2 timeout 900 node $E/leg-ab.mjs --legs=$S/legs.jsonl --dump=$S/dump.json --ids=$w --ghost=0 2>/dev/null); rc=$?
      fi
      e=$(date +%s.%N)
      echo "{\"round\":$round,\"mode\":\"$m\",\"w\":\"$w\",\"rc\":$rc,\"load\":$l,\"wall\":$(echo "$e - $s" | bc),\"row\":${row:-null}}" >> $out
    done
  done
done
echo done >> $S/timings.done
