#!/bin/bash
cd /home/user/Archipelago-CC
K=$(paste -sd'|' /tmp/claude-0/-home-user-Archipelago-CC/f50fd5a8-4112-525c-8ddf-660c3b0749fd/scratchpad/l40-leg-keys.txt)
A=$(cat /tmp/claude-0/-home-user-Archipelago-CC/f50fd5a8-4112-525c-8ddf-660c3b0749fd/scratchpad/arm-A.txt)
B=$(cat /tmp/claude-0/-home-user-Archipelago-CC/f50fd5a8-4112-525c-8ddf-660c3b0749fd/scratchpad/arm-B.txt)
for run in B1 A2 B2; do
  arm=${run:0:1}; cf=$A; [ $arm = B ] && cf=$B
  node scripts/procgen/probe-seedling-divergence-sweep.mjs --legs=/tmp/claude-0/-home-user-Archipelago-CC/f50fd5a8-4112-525c-8ddf-660c3b0749fd/scratchpad/legs.jsonl --mode=inv --producer=solver --host=http://localhost:9742 --keys="$K" --contact-fidelity="$cf" --capture-requests=/tmp/claude-0/-home-user-Archipelago-CC/f50fd5a8-4112-525c-8ddf-660c3b0749fd/scratchpad/sweep-$run-cap.jsonl --out=/tmp/claude-0/-home-user-Archipelago-CC/f50fd5a8-4112-525c-8ddf-660c3b0749fd/scratchpad/sweep-$run.jsonl --wait-for-box=7200 > /tmp/claude-0/-home-user-Archipelago-CC/f50fd5a8-4112-525c-8ddf-660c3b0749fd/scratchpad/sweep-$run.log 2>&1
done
echo ALLDONE > /tmp/claude-0/-home-user-Archipelago-CC/f50fd5a8-4112-525c-8ddf-660c3b0749fd/scratchpad/sweeps.done
