#!/bin/bash
# scratch (L40-CENSUS): every captured request "<id>/<i>" in $REQS under each arm, $N at once, through chain.mjs (cap $CAP).
# Arms: D0 (main's defaults), SB CSH OPP LWF TA SD FO PEE FSB (one OFF switch ON alone), ALL (all nine ON),
# ALL-<X> (all nine but X), A+B (a sum, e.g. ALL+CHS; CHS = CHOOSER_HIT_SOURCES, OFA = fidelity orbitFreeAim).
# Usage: CAP=40960 N=3 CAPF=<capture.jsonl> OUT=<dir> REQS="387/1 388/1" arms.sh <arm>...
T="$(cd "$(dirname "$0")" && pwd)"
envof() { case "$1" in
  D0) echo "X_ARM=D0";; SB) echo SEEDLING_STANCE_BURN=1;; CSH) echo SEEDLING_CHASER_STAGED_HUNT=1;;
  OPP) echo SEEDLING_OPPORTUNISTIC_STRIKE=1;; LWF) echo SEEDLING_LATCH_WEIGH_FIRST=1;; TA) echo SEEDLING_TURRET_APPROACH=1;;
  SD) echo SEEDLING_APPROACH_DOOR=1;; FO) echo SEEDLING_FIFTH_ORDER=1;; PEE) echo SEEDLING_PRESS_ESCAPE_EXACT=1;;
  FSB) echo SEEDLING_FORECAST_SHIELD_BUMP=1;; CHS) echo SEEDLING_CHOOSER_HIT_SOURCES=1;; OFA) echo SEEDLING_ORBIT_FREE_AIM=1;;
  ALL-*) local out=""; for a in SB CSH OPP LWF TA SD FO PEE FSB; do [ "ALL-$a" = "$1" ] || out="$out $(envof $a)"; done; echo $out;;
  *+*) local out=""; for a in $(echo "$1" | tr '+' ' '); do out="$out $(envof $a)" || return 1; done; echo $out;;
  ALL) echo SEEDLING_STANCE_BURN=1 SEEDLING_CHASER_STAGED_HUNT=1 SEEDLING_OPPORTUNISTIC_STRIKE=1 SEEDLING_LATCH_WEIGH_FIRST=1 SEEDLING_TURRET_APPROACH=1 SEEDLING_APPROACH_DOOR=1 SEEDLING_FIFTH_ORDER=1 SEEDLING_PRESS_ESCAPE_EXACT=1 SEEDLING_FORECAST_SHIELD_BUMP=1;;
  *) echo "unknown arm $1" >&2; return 1;; esac; }
mkdir -p "$OUT"; jobs=()
for A in "$@"; do E=$(envof "$A") || continue
  for R in $REQS; do id=${R%/*}; i=${R#*/}
    while [ "$(jobs -rp | wc -l)" -ge "${N:-3}" ]; do sleep 2; done
    env $E node "$T/chain.mjs" --requests="$CAPF" --id=$id --i=$i --cap=${CAP:-40960} --arm=$A --frames=${FRAMES:-0} --out="$OUT/$A.jsonl" > "$OUT/$A-$id-$i.log" 2>&1 &
  done; done; wait; echo ALLDONE
