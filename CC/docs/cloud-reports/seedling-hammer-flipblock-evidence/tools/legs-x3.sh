#!/bin/bash
S=/tmp/claude-0/-home-user-Archipelago-CC/2f62232d-9434-5c85-95cf-a9207b9accf7/scratchpad
cd /home/user/Archipelago-CC
K=$(cat $S/sw/keys.txt)
for rep in 1 2 3; do
 for arm in off gsw pm pkh; do
  case $arm in off) E="";; gsw) E="SEEDLING_GOAL_START_WAIT=1";; pm) E="SEEDLING_PREVIEW_METER=1";; pkh) E="SEEDLING_PRESS_KILL_HOLD=1";; esac
  node scripts/procgen/probe-seedling-divergence-sweep.mjs --legs=$S/sw/legs.jsonl --keys="$K" --mode=inv --producer=solver --page=seedling_bot_ap_p4g --page-legs=1 --out=$S/sw4/rows-$arm-$rep.jsonl ${E:+--solver-env=$E} > $S/sw4/$arm-$rep.log 2>&1
  echo "$arm $rep rc=$?" >> $S/sw4/progress.txt
 done
done
echo DONE >> $S/sw4/progress.txt
