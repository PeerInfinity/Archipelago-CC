#!/bin/bash
# scratch (APPROACH, from L40C's armenv.sh): the env of each arm. Usage: armenv <arm>  -> prints "K=V ..." for `env`
CP="SEEDLING_CHOOSER_PAIR=1 SEEDLING_CHOOSER_PAIR_SIZE=3"
IC="SEEDLING_ICETURRET_STATIC_KILL=1"
OP="SEEDLING_OPPORTUNISTIC_STRIKE=1"
LW="SEEDLING_LATCH_WEIGH_FIRST=1"
OF="SEEDLING_ORBIT_FREE_AIM=1"
SB="SEEDLING_STRATEGY_BOUND_DISTINCT=1"
TA="SEEDLING_TURRET_APPROACH=1"
FO="SEEDLING_FIFTH_ORDER=1"
case "$1" in
  D0) echo "APPROACH_ARM=D0" ;;
  D0-TA) echo "$TA" ;;
  D0-TAFO) echo "$TA $FO" ;;
  L) echo "$CP $LW" ;;
  L-TA) echo "$CP $LW $TA" ;;
  L-TAFO) echo "$CP $LW $TA $FO" ;;
  A4) echo "$CP $IC $OP $LW" ;;
  A4-TAFO) echo "$CP $IC $OP $LW $TA $FO" ;;
  A5) echo "$CP $IC $OP $LW $OF $SB" ;;
  A5-TAFO) echo "$CP $IC $OP $LW $OF $SB $TA $FO" ;;
  *) echo "unknown arm $1" >&2; exit 1 ;;
esac
