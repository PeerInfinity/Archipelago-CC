#!/bin/bash
# usage: run1.sh "<arm 0|1> <file-stem> <id> <i>" — one captured request under ALL+WBA, PGF off/on; one line out
S=/tmp/claude-0/-home-user-Archipelago-CC/044f527a-cb54-5a30-b5d4-6d43ac443e88/scratchpad
read arm f id i <<< "$1"
E=$(cat $S/ALLWBA.env)
out=$(cd /home/user/Archipelago-CC && env $E SEEDLING_PRESS_GLIDE_FOLLOW=$arm timeout 900 node $S/tools/planhits2.mjs $S/ev/$f.jsonl $id $i 2>/dev/null | grep -a "^ANSWER\|^REPLAY\|^PGF" | tr '\n' ' ')
echo "PGF$arm ${f:0:2} $id:$i $out"
