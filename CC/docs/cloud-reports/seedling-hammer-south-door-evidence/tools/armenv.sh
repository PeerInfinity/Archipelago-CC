#!/bin/bash
# scratch (SOUTHDOOR, from APPROACH's armenv.sh): the env of each arm. Usage: armenv <arm>  -> prints "K=V ..." for `env`
# Arms: L = CPAIR-3 + LWF; +TA = TURRET_APPROACH; +SD = this slice's APPROACH_DOOR; +SP = SPIN's PRESS_ESCAPE_SHIELD_CLAIM.
CP="SEEDLING_CHOOSER_PAIR=1 SEEDLING_CHOOSER_PAIR_SIZE=3"
IC="SEEDLING_ICETURRET_STATIC_KILL=1"; OP="SEEDLING_OPPORTUNISTIC_STRIKE=1"; LW="SEEDLING_LATCH_WEIGH_FIRST=1"
OF="SEEDLING_ORBIT_FREE_AIM=1"; SB="SEEDLING_STRATEGY_BOUND_DISTINCT=1"; TA="SEEDLING_TURRET_APPROACH=1"
FO="SEEDLING_FIFTH_ORDER=1"; SD="SEEDLING_APPROACH_DOOR=1"; SP="SEEDLING_PRESS_ESCAPE_SHIELD_CLAIM=1"
base() { case "$1" in
  D0) echo "SOUTHDOOR_ARM=D0" ;; CP3) echo "$CP" ;; L) echo "$CP $LW" ;; A4) echo "$CP $IC $OP $LW" ;; A5) echo "$CP $IC $OP $LW $OF $SB" ;;
  *) echo "unknown arm $1" >&2; exit 1 ;; esac; }
IFS=- read -r B REST <<< "$1"; OUT=$(base "$B") || exit 1
for s in $(echo "$REST" | tr '+' ' '); do case "$s" in TA) OUT="$OUT $TA";; FO) OUT="$OUT $FO";; SD) OUT="$OUT $SD";; SP) OUT="$OUT $SP";; *) echo "unknown suffix $s" >&2; exit 1;; esac; done
echo "$OUT"
