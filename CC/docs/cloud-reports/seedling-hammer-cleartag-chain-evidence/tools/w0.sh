#!/bin/bash
# W0: 871/872 × {D0,SB,ALL} × {door/tree as captured, tag 0 staged}
cd /home/user/Archipelago-CC
T=CC/docs/cloud-reports/seedling-hammer-cleartag-chain-evidence/tools
S=/tmp/claude-0/-home-user-Archipelago-CC/1a36ea9b-6295-5cad-bd86-ec5708762351/scratchpad
CAPF=$S/cap/req-871-872.jsonl; OUT=$S/w0; mkdir -p $OUT
ALL="SEEDLING_STANCE_BURN=1 SEEDLING_CHASER_STAGED_HUNT=1 SEEDLING_OPPORTUNISTIC_STRIKE=1 SEEDLING_LATCH_WEIGH_FIRST=1 SEEDLING_TURRET_APPROACH=1 SEEDLING_APPROACH_DOOR=1 SEEDLING_FIFTH_ORDER=1 SEEDLING_PRESS_ESCAPE_EXACT=1 SEEDLING_FORECAST_SHIELD_BUMP=1"
run() { # arm env persist id
  local arm=$1 env=$2 p=$3 id=$4; local lab=$arm${p:+-p$p}
  while [ "$(jobs -rp | wc -l)" -ge 4 ]; do sleep 2; done
  env $env node $T/chain.mjs --requests=$CAPF --id=$id --i=0 --frames=0 --arm=$lab ${p:+--persist=$p} --out=$OUT/rows.jsonl > $OUT/$lab-$id.log 2>&1 &
}
for id in 871 872; do
  run D0 X=1 "" $id; run SB SEEDLING_STANCE_BURN=1 "" $id; run ALL "$ALL" "" $id
  run D0 X=1 40:0 $id; run SB SEEDLING_STANCE_BURN=1 40:0 $id; run ALL "$ALL" 40:0 $id
done; wait; echo ALLDONE
