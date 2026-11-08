#!/bin/bash
# arm label | root | env ; requests list
S=/tmp/claude-0/-home-user-Archipelago-CC/7958d2a1-6b3e-55bd-89f9-355a3f72e92c/scratchpad
REQS="869/0 870/0 395/0 412/0 394/0 411/0"
LTS="SEEDLING_LATCH_WEIGH_FIRST=1 SEEDLING_TURRET_APPROACH=1 SEEDLING_APPROACH_DOOR=1"
run() { local arm=$1 root=$2; shift 2; for R in $REQS; do id=${R%/*}; i=${R#*/}
  while [ "$(jobs -rp | wc -l)" -ge 3 ]; do sleep 2; done
  env "$@" node $S/chain.mjs --root=$root --requests=$S/arm1/req.jsonl --id=$id --i=$i --cap=8192 --arm=$arm --frames=0 --out=$S/w1/$arm.jsonl > $S/w1/$arm-$id-$i.log 2>&1 &
done; }
run D0 /home/user/Archipelago-CC X_ARM=D0
run LTS /home/user/Archipelago-CC $LTS
run KT $S/kt SEEDLING_KEYLOCK_TURRET=1
run KTLTS $S/kt SEEDLING_KEYLOCK_TURRET=1 $LTS
wait; echo ALLDONE
