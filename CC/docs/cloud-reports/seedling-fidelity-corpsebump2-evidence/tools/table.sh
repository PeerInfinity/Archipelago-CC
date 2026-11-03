#!/bin/bash
# D2: one line per arm "tag|envs|over"; 4 at a time
cd /tmp/claude-0/cb
L=SEEDLING_LATCH_WEIGH_FIRST=1
CP="SEEDLING_CHOOSER_PAIR=1 SEEDLING_CHOOSER_PAIR_SIZE=3"
TA=SEEDLING_TURRET_APPROACH=1
OF="SEEDLING_ORBIT_FREE_AIM=1"
SB="SEEDLING_STRATEGY_BOUND_DISTINCT=1"
gen() {
for rr in off on; do
  R="SEEDLING_CORPSE_BUMP_REST_READ=0"; [ $rr = on ] && R="SEEDLING_CORPSE_BUMP_REST_READ=1"
  echo "$rr-base|$R"
  echo "$rr-L|$R $L"; echo "$rr-CP|$R $CP"; echo "$rr-TA|$R $TA"
  echo "$rr-L-CP|$R $L $CP"; echo "$rr-L-TA|$R $L $TA"; echo "$rr-CP-TA|$R $CP $TA"; echo "$rr-L-CP-TA|$R $L $CP $TA"
  echo "$rr-L-CP-OF|$R $L $CP $OF"; echo "$rr-L-CP-TA-OF|$R $L $CP $TA $OF"
  echo "$rr-L-CP-OF-SB-nosnap|$R $L $CP $OF $SB SEEDLING_TURRET_SNAP_PRICING=0"
  echo "$rr-L-CP-TA-OF-SB-nosnap|$R $L $CP $TA $OF $SB SEEDLING_TURRET_SNAP_PRICING=0"
done
}
gen | xargs -P4 -I{} bash -c 'line="{}"; tag=${line%%|*}; envs=${line#*|}; env TL=1 $envs node latch2.mjs > "tab-$tag.txt" 2>&1'
