#!/bin/bash
# SCRATCH (XF D3): the floor — 3 interleaved rounds, each workload in off (today) / coff (cache) / con (floor + cache).
S=/tmp/claude-0/-home-user-Archipelago-CC/6a6a426f-aaa8-5880-b2ef-d30475870a6b/scratchpad
cd $S
for r in 1 2 3; do for w in l18 A-sword p40; do for m in off coff con; do TAG=xf-r$r-$m bash tools/run.sh $m $w; done; done; done
echo FLOOR-DONE
