#!/bin/bash
# scratch (CLEARTAG-CHAIN): captured requests "<id>/<i>" ($REQS) × arms ($@) through chain.mjs, $N at once.
# An arm is '+'-joined tokens: D0, CC (CLEARTAG_CHAIN), SB CSH OPP LWF TA SD FO PEE FSB (the census's nine), ALL (the nine),
# and pT (stage L40 persistence tag T, e.g. p0 = the tree burnt, p12 = the south door cleared).
# Env: ROOT (the tree to import; default this checkout), CAPF, OUT, CAP (40960), N (2).
T="$(cd "$(dirname "$0")" && pwd)"
tok() { case "$1" in
  D0) echo "X_ARM=D0";; CC) echo SEEDLING_CLEARTAG_CHAIN=1;; SB) echo SEEDLING_STANCE_BURN=1;;
  CSH) echo SEEDLING_CHASER_STAGED_HUNT=1;; OPP) echo SEEDLING_OPPORTUNISTIC_STRIKE=1;; LWF) echo SEEDLING_LATCH_WEIGH_FIRST=1;;
  TA) echo SEEDLING_TURRET_APPROACH=1;; SD) echo SEEDLING_APPROACH_DOOR=1;; FO) echo SEEDLING_FIFTH_ORDER=1;;
  PEE) echo SEEDLING_PRESS_ESCAPE_EXACT=1;; FSB) echo SEEDLING_FORECAST_SHIELD_BUMP=1;;
  ALL-*) for a in SB CSH OPP LWF TA SD FO PEE FSB; do [ "ALL-$a" = "$1" ] || tok $a; done;;
  ALL) for a in SB CSH OPP LWF TA SD FO PEE FSB; do tok $a; done;; p*) ;; *) echo "unknown $1" >&2; return 1;; esac; }
mkdir -p "$OUT"
for A in "$@"; do E=""; P=""
  for t in $(echo "$A" | tr '+' ' '); do E="$E $(tok $t | tr '\n' ' ')"; case $t in p*) P="${P:+$P,}40:${t#p}";; esac; done
  for R in $REQS; do id=${R%/*}; i=${R#*/}
    while [ "$(jobs -rp | wc -l)" -ge "${N:-2}" ]; do sleep 2; done
    env $E node "$T/chain.mjs" --root="${ROOT:-/home/user/Archipelago-CC}" --requests="$CAPF" --id=$id --i=$i --cap=${CAP:-40960} \
      --arm=$A ${P:+--persist=$P} --frames=0 --out="$OUT/rows.jsonl" > "$OUT/$A-$id-$i.log" 2>&1 &
  done; done; wait; echo ALLDONE
