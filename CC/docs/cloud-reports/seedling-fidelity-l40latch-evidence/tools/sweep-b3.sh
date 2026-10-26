#!/bin/bash
until [ -f /tmp/claude-0/-home-user-Archipelago-CC/f50fd5a8-4112-525c-8ddf-660c3b0749fd/scratchpad/sweeps.done ]; do sleep 20; done
cd /home/user/Archipelago-CC
K=$(paste -sd'|' /tmp/claude-0/-home-user-Archipelago-CC/f50fd5a8-4112-525c-8ddf-660c3b0749fd/scratchpad/l40-leg-keys.txt)
B=$(cat /tmp/claude-0/-home-user-Archipelago-CC/f50fd5a8-4112-525c-8ddf-660c3b0749fd/scratchpad/arm-B.txt)
node scripts/procgen/probe-seedling-divergence-sweep.mjs --legs=/tmp/claude-0/-home-user-Archipelago-CC/f50fd5a8-4112-525c-8ddf-660c3b0749fd/scratchpad/legs.jsonl --mode=inv --producer=solver --host=http://localhost:9742 --keys="$K" --contact-fidelity="$B" --capture-requests=/tmp/claude-0/-home-user-Archipelago-CC/f50fd5a8-4112-525c-8ddf-660c3b0749fd/scratchpad/sweep-B3-cap.jsonl --out=/tmp/claude-0/-home-user-Archipelago-CC/f50fd5a8-4112-525c-8ddf-660c3b0749fd/scratchpad/sweep-B3.jsonl --wait-for-box=7200 > /tmp/claude-0/-home-user-Archipelago-CC/f50fd5a8-4112-525c-8ddf-660c3b0749fd/scratchpad/sweep-B3.log 2>&1
echo DONE > /tmp/claude-0/-home-user-Archipelago-CC/f50fd5a8-4112-525c-8ddf-660c3b0749fd/scratchpad/sweep-b3.done
