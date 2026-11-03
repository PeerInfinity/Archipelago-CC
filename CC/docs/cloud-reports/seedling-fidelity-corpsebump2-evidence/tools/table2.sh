#!/bin/bash
cd /tmp/claude-0/cb
L=SEEDLING_LATCH_WEIGH_FIRST=1; CP="SEEDLING_CHOOSER_PAIR=1 SEEDLING_CHOOSER_PAIR_SIZE=3"; TA=SEEDLING_TURRET_APPROACH=1; OF="SEEDLING_ORBIT_FREE_AIM=1"; SB="SEEDLING_STRATEGY_BOUND_DISTINCT=1"
R=SEEDLING_CORPSE_BUMP_REST_READ=1
printf '%s\n' "on2-L-CP-TA|$R $L $CP $TA" "on2-L-CP-TA-OF|$R $L $CP $TA $OF" "on2-L-CP-OF-SB-nosnap|$R $L $CP $OF $SB SEEDLING_TURRET_SNAP_PRICING=0" "on2-L-CP-TA-OF-SB-nosnap|$R $L $CP $TA $OF $SB SEEDLING_TURRET_SNAP_PRICING=0" | xargs -P4 -I{} bash -c 'line="{}"; tag=${line%%|*}; envs=${line#*|}; env TL=1 $envs node latch2.mjs > "tab-$tag.txt" 2>&1'
