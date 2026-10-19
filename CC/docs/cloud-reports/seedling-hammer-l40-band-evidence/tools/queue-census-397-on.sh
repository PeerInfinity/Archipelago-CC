#!/bin/bash
# LB D2: 397's guards-ON censuses, started as soon as each 414 guards-ON census frees its core (replaces the
# queue-census-on.sh waiters that keyed on 397's OFF censuses).
cd /home/user/Archipelago-CC
E=CC/docs/cloud-reports/seedling-hammer-l40-band-evidence; R=scripts/procgen/replay-seedling-solve-request.mjs
G="SEEDLING_PRESS_KILL_SHAKE_GUARD=1 SEEDLING_PRESS_KILL_REBOOT_GUARD=1"; WB="SEEDLING_CHASER_SPINNER_WALLS=1 SEEDLING_BOMB_BLAST_BODY=1"
one() { # <414 guards summary> <arm env> <out tag>
  until grep -q "SEAM-SWEEP" "$E/d2/census/$1.txt" 2>/dev/null; do sleep 30; done
  env $G $2 node $R --requests=$E/input/requests-397-rebuilt.jsonl --id=397 --i=0 --seam-time-sweep=-10..10 --jobs=1 --out=$E/d2/census/$3.jsonl > $E/d2/census/$3.txt 2>&1
}
one c414-def-guards "" c397-def-guards &
one c414-wb-guards "$WB" c397-wb-guards &
wait
