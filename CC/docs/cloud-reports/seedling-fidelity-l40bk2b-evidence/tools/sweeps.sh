#!/bin/bash
# the keyed L40 sweep (52 legs re-derived at the base), arms A (92 defaults) / B (+ orbitFreeAim, strategyBoundDistinct), x2
cd /home/user/Archipelago-CC
W=/tmp/claude-0/w
K=$(paste -sd'|' $W/l40-leg-keys.txt)
for run in A1 B1 A2 B2; do
  arm=${run:0:1}; cf=$(cat $W/arm-$arm.txt)
  node scripts/procgen/probe-seedling-divergence-sweep.mjs --legs=$W/legs.jsonl --mode=inv --producer=solver --host=http://localhost:9751 --keys="$K" --contact-fidelity="$cf" --capture-requests=$W/sweep-$run-cap.jsonl --out=$W/sweep-$run.jsonl --wait-for-box=7200 > $W/sweep-$run.log 2>&1
  echo "$run rc=$?" >> $W/sweeps.status
done
echo ALLDONE >> $W/sweeps.status
