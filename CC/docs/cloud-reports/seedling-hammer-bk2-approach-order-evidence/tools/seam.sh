#!/bin/bash
# seam.sh <label> <id> <i> <from..to> [ENV...] : the page's own solveAnytime (640/2560) on the captured request, one replay per arrival clock
S=/tmp/claude-0/-home-user-Archipelago-CC/13edd8dc-78a1-59c7-8174-8395374c0929/scratchpad
l=$1 id=$2 i=$3 rng=$4; shift 4
cd /home/user/Archipelago-CC
env "$@" node scripts/procgen/replay-seedling-solve-request.mjs --requests=$S/w0/c-req.jsonl --id=$id --i=$i --seam-time-sweep=$rng --jobs=${JOBS:-2} --out=$S/m/seam-$l-$id-$i.jsonl > $S/m/seam-$l-$id-$i.txt 2>&1
