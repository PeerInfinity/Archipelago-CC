#!/bin/bash
# MEASUREMENT-ONLY: run solve.mjs for every (job × config). Jobs on stdin: "<mode> <file> [<id> <i>] | <seamShift>"; CFGS env.
S=/tmp/claude-0/-home-user-Archipelago-CC/2ed3e211-e3df-565c-8597-40e8fa24de8d/scratchpad
OUT=$1; P=${2:-3}
SIX="SEEDLING_PRESS_KILL_START_WAIT=1 SEEDLING_PRESS_KILL_REFUGE_BOMBS=1 SEEDLING_DASH_STAND_SIGHT=1 SEEDLING_OPP_AIM_CHASERS=1 SEEDLING_HIT_AVOID_STAND_BOMBS=1 SEEDLING_REFUSAL_STAND_BOMBS=1"
cfgenv() { case $1 in D) echo "";; SIX) echo "$SIX";; DP) echo "SEEDLING_PRESS_KILL_HOLD=1";; SP) echo "$SIX SEEDLING_PRESS_KILL_HOLD=1";; X*) echo "${EXTRA_ENV} $(cfgenv ${1#X})";; esac; }
CFGS=${CFGS:-"D DP"}
while IFS='|' read -r job seam; do for c in $CFGS; do echo "$c|$job|${seam:-0}"; done; done | while IFS='|' read -r c job seam; do
  echo "cd $S/tools && env $(cfgenv $c) VARIANT=$c SEAM_SHIFT=$seam timeout 2400 node --import ./seg-reg.mjs solve.mjs $job 2>/dev/null | tail -1"
done | xargs -P $P -d '\n' -I{} bash -c '{}' >> $OUT
