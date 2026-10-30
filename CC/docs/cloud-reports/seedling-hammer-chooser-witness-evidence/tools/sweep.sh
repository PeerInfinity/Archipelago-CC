#!/bin/bash
# usage: sweep.sh <name> <keys|-separated> [<solver-env spec>]
cd /home/user/Archipelago-CC
S=/tmp/claude-0/-home-user-Archipelago-CC/cec3a1c4-1faa-5340-a8b2-648308e101e6/scratchpad
N=$1; K=$2; ENVSPEC=${3:-}
node scripts/procgen/probe-seedling-divergence-sweep.mjs --legs=$S/legs.jsonl --mode=inv --producer=solver \
  --page=seedling_bot_ap_p4g --page-legs=1 --keys="$K" ${ENVSPEC:+--solver-env="$ENVSPEC"} \
  --out=$S/rows-$N.jsonl ${CAPTURE:+--capture-requests=$S/req-$N.jsonl} --wait-for-box=7200 > $S/sweep-$N.log 2>&1
echo "EXIT $?" >> $S/sweep-$N.log
