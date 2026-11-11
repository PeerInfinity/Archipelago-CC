#!/bin/bash
# arm.sh <kind> <id|at> <i|cp3> <order>   kind = req | latch ; order = OFF | bfs-anchor | dfs-anchor | bfs-plain | bfs-desc | dfs-window | dfs-right
S=/tmp/claude-0/-home-user-Archipelago-CC/13edd8dc-78a1-59c7-8174-8395374c0929/scratchpad
cd /home/user/Archipelago-CC
kind=$1 a=$2 b=$3 order=$4
if [ "$order" = OFF ]; then export SEEDLING_TURRET_APPROACH_VOLLEY_ORDER=0; else export SEEDLING_TURRET_APPROACH_VOLLEY_ORDER=1; fi
if [ "$kind" = req ]; then
  node $S/tools/chain.mjs --requests=${REQ:-$S/w0/c-req.jsonl} --id=$a --i=$b --arm=$order --order=$order --out=$S/m/arms.jsonl > $S/m/req-$a-$b-$order.txt 2>&1
else
  node $S/tools/latch.mjs --at=$a --cp3=$b --order=$order --out=$S/m/arms.jsonl > $S/m/latch-$a-$b-$order.txt 2>&1
fi
