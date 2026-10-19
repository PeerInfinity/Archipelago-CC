#!/bin/bash
# SCRATCH: D1 — pristine walls (primary tree, base) then the lab's records (scratch worktree), sequential.
S=/tmp/claude-0/-home-user-Archipelago-CC/2f4d6e0e-1690-55e4-985b-1d7061ddd905/scratchpad
cd $S
for m in off on; do TAG=d1-pristine-$m bash tools/run.sh $m l18; done
for m in off on; do for w in l18 A-sword p40; do LAB=1 ROOT=$S/lab TAG=d1-lab-$m bash tools/run.sh $m $w; done; done
for m in off on; do TAG=d1-pristine-$m bash tools/run.sh $m A-sword; TAG=d1-pristine-$m bash tools/run.sh $m p40; done
echo D1-DONE
