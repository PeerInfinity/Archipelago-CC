#!/bin/bash
# LB D2: the seam censuses with both guards ON, each started once its OFF census has written its summary.
cd /home/user/Archipelago-CC
E=CC/docs/cloud-reports/seedling-hammer-l40-band-evidence; R=scripts/procgen/replay-seedling-solve-request.mjs
G="SEEDLING_PRESS_KILL_SHAKE_GUARD=1 SEEDLING_PRESS_KILL_REBOOT_GUARD=1"; WB="SEEDLING_CHASER_SPINNER_WALLS=1 SEEDLING_BOMB_BLAST_BODY=1"
one() { # <off summary> <leg> <requests> <arm env> <out tag>
  until grep -q "SEAM-SWEEP" "$E/d1/census/$1.txt"; do sleep 30; done
  env $G $4 node $R --requests=$3 --id=$2 --i=0 --seam-time-sweep=-10..10 --jobs=1 --out=$E/d2/census/$5.jsonl > $E/d2/census/$5.txt 2>&1
}
mkdir -p $E/d2/census
one c414-def 414 $E/input/requests-414.jsonl "" c414-def-guards &
one c414-wb 414 $E/input/requests-414.jsonl "$WB" c414-wb-guards &
one c397-def 397 $E/input/requests-397-rebuilt.jsonl "" c397-def-guards &
one c397-wb 397 $E/input/requests-397-rebuilt.jsonl "$WB" c397-wb-guards &
wait
echo done > $E/d2/census/queue.done
