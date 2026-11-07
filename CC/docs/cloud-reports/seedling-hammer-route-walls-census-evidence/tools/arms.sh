#!/bin/bash
# scratch (ROUTE-WALLS-CENSUS; from L40-CENSUS's arms.sh): every captured request "<id>/<i>" in $REQS under each arm,
# $N at once, through chain.mjs (cap $CAP), against the tree $ROOT (default the primary checkout = main; set it to a
# worktree of hammer-harvest-wave6 for the wave-6 arms).
# Arms: D0 (the tree's defaults); one OFF switch ON alone: CSH OPP PEE SB LWF TA SD FO FSB CHS OFA CPAIR (main) and
# SHSM CCUT DVB CTC KT (wave-6 only); A+B (a sum); ALL (CSH+OPP+PEE+SB+LWF+TA+SD+FO+FSB); W6 (ALL + the five wave-6).
# Usage: ROOT=<tree> CAP=40960 N=3 CAPF=<capture.jsonl> OUT=<dir> REQS="482/1 717/1" arms.sh <arm>...
T="$(cd "$(dirname "$0")" && pwd)"
ROOT="${ROOT:-/home/user/Archipelago-CC}"
envof() { case "$1" in
  D0) echo "X_ARM=D0";; SB) echo SEEDLING_STANCE_BURN=1;; CSH) echo SEEDLING_CHASER_STAGED_HUNT=1;;
  OPP) echo SEEDLING_OPPORTUNISTIC_STRIKE=1;; LWF) echo SEEDLING_LATCH_WEIGH_FIRST=1;; TA) echo SEEDLING_TURRET_APPROACH=1;;
  SD) echo SEEDLING_APPROACH_DOOR=1;; FO) echo SEEDLING_FIFTH_ORDER=1;; PEE) echo SEEDLING_PRESS_ESCAPE_EXACT=1;;
  FSB) echo SEEDLING_FORECAST_SHIELD_BUMP=1;; CHS) echo SEEDLING_CHOOSER_HIT_SOURCES=1;; OFA) echo SEEDLING_ORBIT_FREE_AIM=1;;
  CPAIR) echo SEEDLING_CHOOSER_PAIR=1;;
  SHSM) echo SEEDLING_STAGED_HUNT_SCAN_MEMO=1;; CCUT) echo SEEDLING_CHOOSER_CUT=1;; DVB) echo SEEDLING_DETOUR_VIA_BOUND=1;;
  CTC) echo SEEDLING_CLEARTAG_CHAIN=1;; KT) echo SEEDLING_KEYLOCK_TURRET=1;;
  ALL) echo SEEDLING_STANCE_BURN=1 SEEDLING_CHASER_STAGED_HUNT=1 SEEDLING_OPPORTUNISTIC_STRIKE=1 SEEDLING_LATCH_WEIGH_FIRST=1 SEEDLING_TURRET_APPROACH=1 SEEDLING_APPROACH_DOOR=1 SEEDLING_FIFTH_ORDER=1 SEEDLING_PRESS_ESCAPE_EXACT=1 SEEDLING_FORECAST_SHIELD_BUMP=1;;
  W6) echo "$(envof ALL) $(envof SHSM) $(envof CCUT) $(envof DVB) $(envof CTC) $(envof KT)";;
  *+*) local out=""; for a in $(echo "$1" | tr '+' ' '); do out="$out $(envof $a)" || return 1; done; echo $out;;
  *) echo "unknown arm $1" >&2; return 1;; esac; }
mkdir -p "$OUT"
for A in "$@"; do E=$(envof "$A") || continue
  for R in $REQS; do id=${R%/*}; i=${R#*/}
    while [ "$(jobs -rp | wc -l)" -ge "${N:-3}" ]; do sleep 2; done
    env $E node "$T/chain.mjs" --root="$ROOT" --requests="$CAPF" --id=$id --i=$i --cap=${CAP:-40960} --arm=$A --frames=${FRAMES:-0} --out="$OUT/$A.jsonl" > "$OUT/$A-$id-$i.log" 2>&1 &
  done; done; wait; echo ALLDONE
