#!/bin/bash
S=/tmp/claude-0/-home-user-Archipelago-CC/07d3eb7f-83a9-539a-8337-fe826c0f05ee/scratchpad
ALL=$(cat $S/ALL.env)
read arm f id i <<< "$1"
E="$ALL"; [[ $arm == W* ]] && E="$E SEEDLING_WALK_BLADE_ARM=1"; [[ $arm == *1 ]] && E="$E SEEDLING_SPEAR_PRESS_GATE_WAIT=1"
out=$(cd /home/user/Archipelago-CC && env $E node $S/tools/planhits.mjs $S/ev/$f $id $i 2>/dev/null | grep -a "^ANSWER\|^REPLAY\|^SPGW" | tr '\n' ' ')
echo "$arm ${f:0:2} $id:$i $out"
