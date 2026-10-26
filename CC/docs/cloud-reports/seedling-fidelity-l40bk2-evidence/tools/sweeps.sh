#!/bin/bash
cd /home/user/Archipelago-CC
K=$(paste -sd'|' /home/user/Archipelago-CC/CC/docs/cloud-reports/seedling-fidelity-l40bk2-evidence/l40bk2-leg-keys.txt)
A=$(cat /home/user/Archipelago-CC/CC/docs/cloud-reports/seedling-fidelity-l40bk2-evidence/arm-A.txt)
B=$(cat /home/user/Archipelago-CC/CC/docs/cloud-reports/seedling-fidelity-l40bk2-evidence/arm-B.txt)
for run in B1 A2 B2; do
  arm=${run:0:1}; cf=$A; [ $arm = B ] && cf=$B
  node scripts/procgen/probe-seedling-divergence-sweep.mjs --legs=/tmp/claude-0/-home-user-Archipelago-CC/47f791e4-509e-56d9-b759-c9148d227950/scratchpad/legs.jsonl --mode=inv --producer=solver --host=http://localhost:9736 --keys="$K" --contact-fidelity="$cf" --capture-requests=/tmp/claude-0/-home-user-Archipelago-CC/47f791e4-509e-56d9-b759-c9148d227950/scratchpad/sweep-$run-cap.jsonl --out=/tmp/claude-0/-home-user-Archipelago-CC/47f791e4-509e-56d9-b759-c9148d227950/scratchpad/sweep-$run.jsonl --wait-for-box=7200 > /tmp/claude-0/-home-user-Archipelago-CC/47f791e4-509e-56d9-b759-c9148d227950/scratchpad/sweep-$run.log 2>&1
done
echo ALLDONE > /tmp/claude-0/-home-user-Archipelago-CC/47f791e4-509e-56d9-b759-c9148d227950/scratchpad/sweeps.done
