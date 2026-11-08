#!/bin/bash
# scratch (STAGED-HUNT-CHEAP; L40-CENSUS's arms.sh, these arms): every captured request "<id>/<i>" in $REQS under each
# arm, $N at once, through chain.mjs (cap $CAP; $PERSIST stages L40 persistence rows, e.g. 40:12 = the south door).
# Arms: D0 (main's defaults), M (STAGED_HUNT_SCAN_MEMO alone), CSH, OPP, CTS (CLEARTAG_STAND), and sums (CSH+M, OPP+CSH+M…).
# Usage: CAP=40960 N=3 CAPF=<capture.jsonl> OUT=<dir> REQS="394/1 411/1" [PERSIST=40:12] arms.sh <arm>...
T="$(cd "$(dirname "$0")" && pwd)"
envof() { case "$1" in
  D0) echo "X_ARM=D0";; M) echo SEEDLING_STAGED_HUNT_SCAN_MEMO=1;; CSH) echo SEEDLING_CHASER_STAGED_HUNT=1;;
  OPP) echo SEEDLING_OPPORTUNISTIC_STRIKE=1;; CTS) echo SEEDLING_CLEARTAG_STAND=1;;
  LWF) echo SEEDLING_LATCH_WEIGH_FIRST=1;; TA) echo SEEDLING_TURRET_APPROACH=1;; SD) echo SEEDLING_APPROACH_DOOR=1;;
  *+*) local out=""; for a in $(echo "$1" | tr '+' ' '); do out="$out $(envof $a)" || return 1; done; echo $out;;
  *) echo "unknown arm $1" >&2; return 1;; esac; }
mkdir -p "$OUT"
P=${PERSIST:+--persist=$PERSIST}; TAG=${PERSIST:+-p${PERSIST//[:,]/_}}
for A in "$@"; do E=$(envof "$A") || continue
  for R in $REQS; do id=${R%/*}; i=${R#*/}
    while [ "$(jobs -rp | wc -l)" -ge "${N:-3}" ]; do sleep 2; done
    env $E node "$T/chain.mjs" --requests="$CAPF" --id=$id --i=$i --cap=${CAP:-40960} --arm=$A$TAG $P --frames=0 \
      --out="$OUT/$A$TAG.jsonl" > "$OUT/$A$TAG-$id-$i.log" 2>&1 &
  done; done; wait; echo ALLDONE
