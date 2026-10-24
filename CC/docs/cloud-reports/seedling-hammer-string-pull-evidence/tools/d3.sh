#!/bin/bash
# SP D3: >= 3 interleaved rounds, OFF/ON, L40 and L18 — one plain run (wall) and one profiled run (planWaypoints share).
E=/home/user/Archipelago-CC/CC/docs/cloud-reports/seedling-hammer-string-pull-evidence
O=$E/d3/rounds.jsonl; : > $O; P=$(mktemp -d)
for r in 1 2 3; do
  for t in "l40|--tape=r5-l40-part5 --goal=collect:160,640" "l18|--tape=r9-solve-18 --goal=exit:176,112 --residue=21"; do
    n=${t%%|*}; a=${t#*|}
    for arm in 0 1; do
      l=$(cut -d' ' -f1 /proc/loadavg)
      j=$(SEEDLING_STRING_PULL_FAST=$arm node $E/tools/hbprobe.mjs $a --interval=none)
      rm -rf $P/p; SEEDLING_STRING_PULL_FAST=$arm node --cpu-prof --cpu-prof-interval 200 --cpu-prof-dir $P/p $E/tools/hbprobe.mjs $a --interval=none > /dev/null
      s=$(node $E/tools/profsum.mjs $P/p/*.cpuprofile planWaypoints controllerPathClear plannerObstacleAt | tr -d '\n ')
      echo "{\"round\":$r,\"solve\":\"$n\",\"fast\":$arm,\"load\":$l,\"r\":$j,\"prof\":$s}" >> $O
    done
  done
done
rm -rf $P
