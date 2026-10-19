#!/bin/bash
# SCRATCH (XC D3): 3 interleaved rounds — every workload in off / coff (cache) / on (floor) / con (floor + cache).
S=/tmp/claude-0/-home-user-Archipelago-CC/2f4d6e0e-1690-55e4-985b-1d7061ddd905/scratchpad
cd $S
for r in 1 2 3; do for w in l18 A-sword p40; do for m in off coff on con; do TAG=d3-r$r-$m bash tools/run.sh $m $w; done; done; done
echo D3-DONE
