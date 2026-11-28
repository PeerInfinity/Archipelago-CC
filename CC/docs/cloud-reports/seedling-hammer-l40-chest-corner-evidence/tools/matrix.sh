#!/bin/bash
# usage: matrix.sh <outdir> <parallel> ; jobs read from stdin: "<tag> <file> <id> <i>"
S=/tmp/claude-0/-home-user-Archipelago-CC/2ed3e211-e3df-565c-8597-40e8fa24de8d/scratchpad
OUT=$1; P=$2; mkdir -p $OUT
SIX="SEEDLING_PRESS_KILL_START_WAIT=1 SEEDLING_PRESS_KILL_REFUGE_BOMBS=1 SEEDLING_DASH_STAND_SIGHT=1 SEEDLING_OPP_AIM_CHASERS=1 SEEDLING_HIT_AVOID_STAND_BOMBS=1 SEEDLING_REFUSAL_STAND_BOMBS=1"
CFGS=${CFGS:-"D SIX DP SP"}
while read tag file id i; do
  for c in $CFGS; do
    case $c in D) E="";; SIX) E="$SIX";; DP) E="SEEDLING_PRESS_KILL_HOLD=1";; SP) E="$SIX SEEDLING_PRESS_KILL_HOLD=1";; *) E="${!c}";; esac
    echo "env $E node $S/tools/rc.mjs $file $id $i > $OUT/$tag-$c.txt 2>&1"
  done
done | xargs -P $P -I{} bash -c "cd /home/user/Archipelago-CC && {}"
